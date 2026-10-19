<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store'

const props = defineProps({ userId: { type: String, required: true } })
const emit = defineEmits(['close'])
const store = useStore()

const data = ref(null)
const loading = ref(true)

const STATUS_LABELS = {
  watched: 'Смотрел', watching: 'Смотрю', want: 'Хочу',
  'not-watched': 'Не смотрел', 'wont-watch': 'Не интересен'
}
const STATUS_CLASSES = {
  watched: 'bg-watched', watching: 'bg-watching', want: 'bg-want',
  'not-watched': 'bg-not-watched', 'wont-watch': 'bg-wont-watch'
}

/* Оценка: цветной бейдж без звезды */
function formatRating(r) {
  const n = Number(r)
  if (isNaN(n)) return ''
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
function ratingClass(r) {
  const n = Number(r)
  if (isNaN(n)) return ''
  if (n < 5) return 'rating-red'
  if (n < 6.5) return 'rating-gray'
  if (n < 9) return 'rating-green'
  return 'rating-gold'
}

const cards = computed(() => {
  if (!data.value || data.value.denied) return []
  const map = new Map(data.value.userItems.map(u => [u.itemId, u]))
  return store.items
    .filter(it => {
      const u = map.get(it.id)
      if (!u) return false
      if (u.status === 'not-watched') return false
      return true
    })
    .map(it => {
      const u = map.get(it.id)
      const eps = it.episodes || []
      const total = eps.reduce((a, b) => a + Number(b || 0), 0)
      const watched = Object.values(u.watchedEpisodes || {})
        .reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0)
      const pct = total ? Math.round((watched / total) * 100) : 0
      return { item: it, u, total, watched, pct }
    })
})

const collectionsById = computed(() => {
  const m = {}
  for (const c of data.value?.collections || []) m[c.id] = c
  return m
})

onMounted(async () => {
  data.value = await store.getPublicProfile(props.userId)
  loading.value = false
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div v-if="loading" class="center">Загрузка…</div>

      <div v-else-if="data?.denied" class="center">
        <div class="lock">🔒</div>
        <p>Профиль {{ data.user.username }} скрыт пользователем.</p>
        <button class="btn" @click="emit('close')">Закрыть</button>
      </div>

      <template v-else-if="data">
        <div class="head">
          <div class="ava" :class="{ gold: data.user.superAdmin }">
            {{ data.user.username.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="name">{{ data.user.username }}</div>
            <div class="role">
              {{ data.user.role === 'admin'
                  ? (data.user.superAdmin ? 'Супер-администратор' : 'Администратор')
                  : 'Пользователь' }}
            </div>
          </div>
          <button class="close-x" @click="emit('close')">×</button>
        </div>

        <div class="section-title">Коллекции ({{ data.collections.length }})</div>
        <div class="collections">
          <span v-for="c in data.collections" :key="c.id" class="col-chip">
            <img v-if="c.icon?.startsWith('http')" :src="c.icon" alt="">
            <span v-else>{{ c.icon || '📁' }}</span>
            {{ c.name }}
          </span>
          <p v-if="!data.collections.length" class="hint">Нет коллекций</p>
        </div>

        <div class="section-title">Карточки с метками ({{ cards.length }})</div>
        <div class="cards">
          <div v-for="c in cards" :key="c.item.id" class="u-card">
            <img :src="c.item.poster || 'https://via.placeholder.com/120x180/2a2a2a/757575'" />
            <div class="u-title">{{ c.item.titleRu }}</div>
            <div class="u-meta">
              <span class="badge" :class="STATUS_CLASSES[c.u.status]">
                {{ STATUS_LABELS[c.u.status] || c.u.status }}
              </span>
              <span
                v-if="c.u.myRating !== null && c.u.myRating !== undefined"
                class="rating"
                :class="ratingClass(c.u.myRating)"
              >
                {{ formatRating(c.u.myRating) }}
              </span>
            </div>
            <div v-if="c.total" class="progress">
              <div class="bar"><div class="fill" :style="{ width: c.pct + '%' }"></div></div>
              <span class="ptext">{{ c.watched }}/{{ c.total }}</span>
            </div>
            <div v-if="c.u.collectionIds?.length" class="u-cols">
              <span v-for="cid in c.u.collectionIds" :key="cid" class="uc">
                {{ collectionsById[cid]?.name || '…' }}
              </span>
            </div>
            <div v-if="c.u.comment" class="u-comment">
              💬 {{ c.u.comment }}
            </div>
          </div>
          <p v-if="!cards.length" class="hint">
            Пользователь ещё ничего не отметил
          </p>
        </div>
      </template>

      <div v-else class="center">
        <p>Не удалось загрузить профиль.</p>
        <button class="btn" @click="emit('close')">Закрыть</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.85);
  display:flex;align-items:center;justify-content:center;
  z-index:400;padding:20px;
}
.modal{
  background:var(--bg-modal);border:1px solid var(--border);
  border-radius:var(--radius);padding:24px;
  width:100%;max-width:720px;max-height:90vh;overflow-y:auto;
}
.center{text-align:center;padding:30px 0;color:var(--text-secondary);}
.lock{font-size:2.5rem;margin-bottom:10px;}
.head{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.ava{
  width:52px;height:52px;border-radius:50%;
  background:var(--status-watching);color:#fff;
  font-weight:700;font-size:1.3rem;
  display:flex;align-items:center;justify-content:center;
}
.ava.gold{background:linear-gradient(135deg,#b8860b,#daa520);}
.name{font-size:1.1rem;font-weight:700;}
.role{font-size:.8rem;color:var(--text-muted);}
.close-x{
  margin-left:auto;background:none;border:none;
  color:var(--text-muted);font-size:1.5rem;cursor:pointer;
}
.section-title{
  font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;
  color:var(--text-muted);margin:18px 0 10px;
  border-bottom:1px solid var(--border);padding-bottom:6px;
}
.collections{display:flex;flex-wrap:wrap;gap:6px;}
.col-chip{
  display:inline-flex;align-items:center;gap:5px;padding:5px 10px;
  border-radius:14px;background:var(--bg-card);border:1px solid var(--border);
  font-size:.8rem;
}
.col-chip img{width:14px;height:14px;object-fit:contain;border-radius:2px;}
.cards{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;
}
.u-card{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:10px;overflow:hidden;padding-bottom:8px;
}
.u-card img{width:100%;aspect-ratio:2/3;object-fit:cover;}
.u-title{
  font-size:.82rem;font-weight:600;padding:6px 8px 2px;line-height:1.25;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.u-meta{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px;align-items:center;}
.badge{
  font-size:.62rem;text-transform:uppercase;color:#fff;
  padding:2px 7px;border-radius:10px;font-weight:600;
}
.bg-watched{background:var(--status-watched);}
.bg-watching{background:var(--status-watching);}
.bg-want{background:var(--status-want);}
.bg-not-watched{background:var(--status-not-watched);}
.bg-wont-watch{background:var(--status-wont-watch);}

/* Оценка — цветной бейдж без звезды */
.rating {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  color: #fff;
  line-height: 1;
}
.rating.rating-red   { background: #f44336; }
.rating.rating-gray  { background: #9e9e9e; color: #1a1a1a; }
.rating.rating-green { background: #4caf50; }
.rating.rating-gold  { background: linear-gradient(135deg, #daa520, #ffd700); color: #1a1a1a; }

.progress{display:flex;align-items:center;gap:6px;padding:6px 8px 0;}
.bar{flex:1;height:4px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;}
.fill{height:100%;background:var(--status-watching);transition:width .3s;}
.ptext{font-size:.68rem;color:var(--text-muted);}
.u-cols{display:flex;flex-wrap:wrap;gap:3px;padding:4px 8px 0;}
.uc{
  font-size:.62rem;background:rgba(33,150,243,.15);
  color:var(--status-watching);padding:1px 6px;border-radius:8px;
}
.u-comment{
  font-size:.72rem;color:var(--text-secondary);
  padding:4px 8px;line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
}
.hint{
  font-size:.85rem;color:var(--text-muted);
  text-align:center;padding:10px;grid-column:1/-1;
}
.btn{
  display:inline-flex;padding:9px 16px;border-radius:24px;
  border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-primary);cursor:pointer;font-family:inherit;margin-top:8px;
}
</style>