<script setup>
import { computed, ref, watch } from 'vue'
import { useStore } from '../store'
import EditModal from './EditModal.vue'
import LinkModal from './LinkModal.vue'
import Icon from './Icon.vue'

const props = defineProps({
  itemId: { type: [Number, String], required: true },
  zIndex: { type: Number, default: 100 },
  depth: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'open', 'back'])
const store = useStore()

/* Fallback: decoratedItems → сырой item → null */
const item = computed(() => {
  const id = String(props.itemId)
  const decorated = store.decoratedItems.find(i => String(i.id) === id)
  if (decorated) return decorated
  const raw = store.items.find(i => String(i.id) === id)
  if (!raw) return null
  return {
    ...raw,
    status: 'not-watched',
    myRating: null,
    watchedEpisodes: {},
    collectionIds: [],
    myWatchLink: '',
    myComment: '',
    watchLink: raw.trailer || ''
  }
})

/* В чужом профиле — только просмотр */
const canEdit = computed(() => store.effectiveAdmin && !store.viewingUserId)
const readOnly = computed(() => !!store.viewingUserId)

const localWatched = ref({})
const isDirty = ref(false)

watch(() => props.itemId, () => {
  isDirty.value = false
  localWatched.value = JSON.parse(JSON.stringify(item.value?.watchedEpisodes || {}))
}, { immediate: true })

watch(() => item.value?.watchedEpisodes, (val) => {
  if (!isDirty.value) localWatched.value = JSON.parse(JSON.stringify(val || {}))
}, { deep: true })

const showEdit = ref(false)
const showLink = ref(false)
const confirmDelete = ref(false)

const STATUS_LABELS = {
  watched: 'Смотрел', watching: 'Смотрю', want: 'Хочу посмотреть',
  'not-watched': 'Не смотрел', 'wont-watch': 'Не заинтересован'
}
const STATUS_CLASSES = {
  watched: 'bg-watched', watching: 'bg-watching', want: 'bg-want',
  'not-watched': 'bg-not-watched', 'wont-watch': 'bg-wont-watch'
}
const TYPE_LABELS = { movie: 'Фильм', series: 'Сериал', cartoon: 'Мультфильм', anime: 'Аниме' }
const RELEASE_STATUS = {
  completed: 'Завершён', ongoing: 'Выходит',
  announced: 'Анонс', frozen: 'Заморожен'
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

const related = computed(() => item.value ? store.related(item.value.id) : [])

const itemCollections = computed(() => {
  if (!item.value) return []
  const ids = item.value.collectionIds || []
  const pool = store.effectiveCollections
  return pool.filter(c => ids.includes(c.id))
})

const episodesArray = computed(() => {
  if (!item.value) return []
  const raw = item.value.episodes
  if (!raw) return []
  if (Array.isArray(raw)) {
    if (raw.length === 1 && typeof raw[0] === 'string' && raw[0].includes(',')) {
      return raw[0].split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
    }
    return raw.map(x => Number(x)).filter(n => !isNaN(n) && n > 0)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
  }
  return []
})

const hasEpisodeTable = computed(() => {
  if (!item.value) return false
  if (!episodesArray.value.length) return false
  return item.value.type === 'series' || item.value.type === 'anime' || item.value.type === 'cartoon'
})

const totalEpisodes = computed(() => episodesArray.value.reduce((a, b) => a + b, 0))
const watchedEpisodesCount = computed(() => {
  let c = 0
  for (const k in localWatched.value) {
    if (Array.isArray(localWatched.value[k])) c += localWatched.value[k].length
  }
  return c
})
const progressPercent = computed(() =>
  totalEpisodes.value ? Math.round((watchedEpisodesCount.value / totalEpisodes.value) * 100) : 0
)
const maxEpisodesInSeason = computed(() =>
  episodesArray.value.length ? Math.max(...episodesArray.value) : 0
)

function isWatched(season, episode) {
  const s = String(season)
  const e = Number(episode)
  const arr = localWatched.value[s] || []
  return arr.map(Number).includes(e)
}

async function onEpClick(season, episode, count) {
  if (readOnly.value) return
  const ep = Number(episode), cnt = Number(count)
  if (isNaN(ep) || isNaN(cnt) || ep > cnt) return
  const s = String(season)
  const w = JSON.parse(JSON.stringify(localWatched.value))
  const arr = new Set((w[s] || []).map(Number))
  if (arr.has(ep)) arr.delete(ep); else arr.add(ep)
  if (arr.size) w[s] = Array.from(arr).sort((a, b) => a - b)
  else delete w[s]
  localWatched.value = w
  isDirty.value = true
  try { await store.setWatchedEpisodes(props.itemId, w) } catch (e) { console.error(e) }
}

function isSeasonFullyWatched(season, count) {
  const s = String(season)
  const arr = localWatched.value[s] || []
  return arr.length === Number(count)
}

async function onSeasonToggle(season, count) {
  if (readOnly.value) return
  const full = isSeasonFullyWatched(season, count)
  const s = String(season)
  const cnt = Number(count)
  const w = JSON.parse(JSON.stringify(localWatched.value))
  if (full) delete w[s]
  else w[s] = Array.from({ length: cnt }, (_, i) => i + 1)
  localWatched.value = w
  isDirty.value = true
  try { await store.setWatchedEpisodes(props.itemId, w) } catch (e) { console.error(e) }
}

async function doDelete() {
  if (!item.value) return
  await store.deleteItem(item.value.id)
  emit('close')
}

function openRelated(r) { emit('open', r) }
function stop(e) { e.stopPropagation() }

const hasInfo = computed(() => {
  const i = item.value
  if (!i) return false
  return i.studio || i.director || i.country?.length || i.originalLang ||
    i.ageRating || i.releaseStatus || i.imdb || i.kinopoisk ||
    i.shikimori || i.mal || i.anilist || i.slogan || i.cast?.length ||
    i.themes?.length || i.moods?.length || i.keywords
})
</script>

<template>
  <div v-if="item" class="modal-overlay" :style="{ zIndex }" @click.self="emit('close')">
    <div class="modal view-modal" @click="stop">
      <div
        class="view-hero"
        :style="(item.backdrop || item.poster) ? `background-image:url('${item.backdrop || item.poster}')` : ''"
      >
        <div class="status-badge" :class="STATUS_CLASSES[item.status]">
          {{ STATUS_LABELS[item.status] }}
        </div>
        <div class="round-actions">
          <button v-if="depth > 0" class="round-btn" @click="emit('back')" title="Назад">←</button>
          <button v-if="canEdit" class="round-btn" @click="showLink = true" title="Связать">🔗</button>
          <button v-if="!readOnly" class="round-btn" @click="showEdit = true" title="Изменить">
            <Icon name="edit" :size="18" />
          </button>
          <button v-if="canEdit" class="round-btn danger" @click="confirmDelete = true" title="Удалить">🗑</button>
          <button class="round-btn" @click="emit('close')" title="Закрыть">
            <Icon name="close" :size="20" />
          </button>
        </div>
      </div>

      <div class="view-body">
        <div class="view-poster">
          <img
            :src="item.poster || 'https://via.placeholder.com/400x600/2a2a2a/757575?text=Нет+постера'"
            @error="$event.target.src='https://via.placeholder.com/400x600/2a2a2a/757575?text=Нет+постера'"
          >
        </div>
        <div class="view-main">
          <div class="view-title">{{ item.titleRu || item.titleOrig || 'Без названия' }}</div>
          <div v-if="item.titleOrig && item.titleRu" class="view-subtitle">{{ item.titleOrig }}</div>

          <div class="view-meta-row">
            <span v-if="item.year">📅 {{ item.year }}</span>
            <span class="type-chip">{{ TYPE_LABELS[item.type] }}</span>
            <span v-if="item.duration">⏱ {{ item.duration }} мин</span>
            <span v-if="episodesArray.length">📺 {{ episodesArray.length }} сез.</span>
            <span v-if="totalEpisodes">🎞 {{ totalEpisodes }} серий</span>
            <span
              v-if="item.myRating !== null && item.myRating !== undefined"
              class="view-rating"
              :class="ratingClass(item.myRating)"
            >
              {{ formatRating(item.myRating) }}/10
            </span>
          </div>

          <div v-if="item.genres?.length || item.subgenres?.length" class="view-tags">
            <span v-for="g in item.genres" :key="'g' + g" class="view-tag">{{ g }}</span>
            <span v-for="g in item.subgenres" :key="'sg' + g" class="view-tag sub">{{ g }}</span>
          </div>

          <div v-if="itemCollections.length" class="view-collections">
            <span class="col-label">📁 Коллекции:</span>
            <span v-for="c in itemCollections" :key="c.id" class="col-badge">
              <img v-if="c.icon?.startsWith('http')" :src="c.icon" alt="">
              <template v-else>{{ c.icon || '📁' }}</template>
              {{ c.name }}
            </span>
          </div>

          <div v-if="item.shortDesc" class="view-desc">{{ item.shortDesc }}</div>

          <div v-if="item.myComment && readOnly" class="view-comment">
            <div class="comment-label">
              💬 Комментарий {{ store.viewingUserProfile?.username || '' }}
            </div>
            <div class="comment-text">{{ item.myComment }}</div>
          </div>

          <div v-if="item.trailer || item.watchLink" class="view-links">
            <a v-if="item.trailer" :href="item.trailer" target="_blank" class="link-btn">▶ Трейлер</a>
            <a v-if="item.watchLink" :href="item.watchLink" target="_blank" class="link-btn">
              ▶ Смотреть {{ item.myWatchLink ? '(моя ссылка)' : '' }}
            </a>
          </div>
        </div>
      </div>

      <div v-if="hasEpisodeTable" class="progress-section">
        <div class="progress-header">
          <span class="progress-label">Прогресс</span>
          <span class="progress-count">
            {{ watchedEpisodesCount }} / {{ totalEpisodes }} ({{ progressPercent }}%)
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <div v-if="hasEpisodeTable" class="episodes-section">
        <div class="section-title">Серии</div>
        <div class="episodes-table-wrap">
          <table class="episodes-table">
            <thead>
              <tr>
                <th class="season-head">Сезон</th>
                <th v-for="ep in maxEpisodesInSeason" :key="'h' + ep" class="ep-head">{{ ep }}</th>
                <th class="all-head"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(count, sIdx) in episodesArray" :key="'s' + sIdx">
                <td class="season-cell">
                  <span class="season-num">S{{ sIdx + 1 }}</span>
                  <span class="season-count">{{ count }} эп.</span>
                </td>
                <td
                  v-for="ep in maxEpisodesInSeason"
                  :key="'c' + sIdx + '-' + ep"
                  class="ep-cell"
                  :class="{
                    watched: ep <= count && isWatched(sIdx + 1, ep),
                    disabled: ep > count,
                    readonly: readOnly
                  }"
                  @click="onEpClick(sIdx + 1, ep, count)"
                >
                  <div class="ep-inner" v-if="ep <= count">
                    <svg v-if="isWatched(sIdx + 1, ep)" class="ep-check" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                    </svg>
                  </div>
                </td>
                <td class="all-cell">
                  <button
                    class="season-toggle"
                    :disabled="readOnly"
                    :class="{ active: isSeasonFullyWatched(sIdx + 1, count) }"
                    @click="onSeasonToggle(sIdx + 1, count)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path
                        :d="isSeasonFullyWatched(sIdx + 1, count)
                          ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
                          : 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'"
                        fill="currentColor"/>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ep-hint">
          {{ readOnly
              ? 'Просмотр профиля другого пользователя'
              : 'Клик по ячейке — отметить серию. Кнопка справа — весь сезон.' }}
        </p>
      </div>

      <div v-if="hasInfo" class="view-info-grid">
        <div v-if="item.studio" class="info-item"><div class="label">Студия</div><div class="value">{{ item.studio }}</div></div>
        <div v-if="item.director" class="info-item"><div class="label">Режиссёр</div><div class="value">{{ item.director }}</div></div>
        <div v-if="item.country?.length" class="info-item"><div class="label">Страна</div><div class="value">{{ item.country.join(', ') }}</div></div>
        <div v-if="item.originalLang" class="info-item"><div class="label">Язык</div><div class="value">{{ item.originalLang }}</div></div>
        <div v-if="item.ageRating" class="info-item"><div class="label">Возраст</div><div class="value">{{ item.ageRating }}</div></div>
        <div v-if="item.releaseStatus" class="info-item"><div class="label">Статус</div><div class="value">{{ RELEASE_STATUS[item.releaseStatus] || item.releaseStatus }}</div></div>
        <div v-if="item.imdb" class="info-item"><div class="label">IMDb</div><div class="value">⭐ {{ item.imdb }}</div></div>
        <div v-if="item.kinopoisk" class="info-item"><div class="label">Кинопоиск</div><div class="value">⭐ {{ item.kinopoisk }}</div></div>
        <div v-if="item.shikimori" class="info-item"><div class="label">Shikimori</div><div class="value">⭐ {{ item.shikimori }}</div></div>
        <div v-if="item.mal" class="info-item"><div class="label">MAL</div><div class="value">⭐ {{ item.mal }}</div></div>
        <div v-if="item.anilist" class="info-item"><div class="label">AniList</div><div class="value">⭐ {{ item.anilist }}</div></div>
        <div v-if="item.slogan" class="info-item full"><div class="label">Слоган</div><div class="value italic">«{{ item.slogan }}»</div></div>
        <div v-if="item.cast?.length" class="info-item full"><div class="label">В ролях</div><div class="value">{{ item.cast.join(', ') }}</div></div>
        <div v-if="item.themes?.length" class="info-item full"><div class="label">Темы</div><div class="value">{{ item.themes.join(', ') }}</div></div>
        <div v-if="item.moods?.length" class="info-item full"><div class="label">Настроение</div><div class="value">{{ item.moods.join(', ') }}</div></div>
        <div v-if="item.keywords" class="info-item full"><div class="label">Ключевые слова</div><div class="value">{{ item.keywords }}</div></div>
      </div>

      <div v-if="item.fullDesc" class="view-section">
        <div class="section-title">Описание</div>
        <div class="view-desc">{{ item.fullDesc }}</div>
      </div>

      <div v-if="related.length" class="view-section">
        <div class="section-title">Связанные ({{ related.length }})</div>
        <div class="related-grid">
          <div v-for="r in related" :key="r.id" class="related-card" @click="openRelated(r)">
            <img
              :src="r.poster || 'https://via.placeholder.com/200x300/2a2a2a/757575'"
              @error="$event.target.style.display='none'"
            >
            <div class="related-title">{{ r.titleRu }}</div>
            <div class="related-year">{{ r.year }}</div>
          </div>
        </div>
      </div>

      <div v-if="item.stills?.length" class="view-gallery">
        <img v-for="(s, i) in item.stills" :key="i" :src="s" @error="$event.target.style.display='none'">
      </div>

      <div v-if="confirmDelete" class="confirm-overlay" @click.self="confirmDelete = false">
        <div class="confirm-box">
          <h4>Удалить безвозвратно?</h4>
          <p>Карточка «{{ item.titleRu }}» будет удалена навсегда.</p>
          <div class="confirm-actions">
            <button class="btn" @click="confirmDelete = false">Отмена</button>
            <button class="btn btn-danger" @click="doDelete">Подтвердить</button>
          </div>
        </div>
      </div>
    </div>

    <EditModal v-if="showEdit" :item="item" @close="showEdit = false; emit('close')" />
    <LinkModal v-if="showLink" :item="item" @close="showLink = false" />
  </div>
</template>

<style scoped>
.modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;padding:20px;
}
.modal.view-modal{
  background:var(--bg-modal);border-radius:var(--radius);border:1px solid var(--border);
  width:100%;max-width:860px;max-height:92vh;overflow-y:auto;position:relative;
  display:flex;flex-direction:column;box-shadow:var(--shadow-hover);
}
.view-hero{
  position:relative;height:280px;
  background:#2a2a2a center/cover no-repeat;flex-shrink:0;
}
.view-hero::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(to top,var(--bg-modal) 5%,transparent 80%);pointer-events:none;
}
.status-badge{
  position:absolute;top:16px;left:16px;padding:6px 14px;border-radius:20px;
  font-size:.75rem;font-weight:600;text-transform:uppercase;color:#fff;z-index:2;
  box-shadow:0 2px 8px rgba(0,0,0,.4);
}
.bg-watched{background:var(--status-watched);}
.bg-watching{background:var(--status-watching);}
.bg-want{background:var(--status-want);}
.bg-not-watched{background:var(--status-not-watched);}
.bg-wont-watch{background:var(--status-wont-watch);}
.round-actions{position:absolute;top:16px;right:16px;display:flex;gap:8px;z-index:3;}
.round-btn{
  width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.65);
  backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:1rem;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
}
.round-btn:hover{background:rgba(0,0,0,.9);}
.round-btn.danger:hover{background:var(--status-wont-watch);}
.round-btn :deep(svg) {
  width: 15px;
  height: 15px;
}
.view-body{display:flex;gap:24px;padding:0 28px 20px;margin-top:-80px;position:relative;z-index:2;}
.view-poster{
  width:200px;min-width:200px;aspect-ratio:2/3;border-radius:12px;overflow:hidden;
  box-shadow:var(--shadow-hover);background:#2a2a2a;border:2px solid var(--bg-modal);
}
.view-poster img{width:100%;height:100%;object-fit:cover;}
.view-main{flex:1;padding-top:90px;display:flex;flex-direction:column;gap:10px;min-width:0;}
.view-title{font-size:1.8rem;font-weight:800;line-height:1.2;}
.view-subtitle{font-size:1rem;color:var(--text-secondary);margin-top:-4px;}
.view-meta-row{
  display:flex;flex-wrap:wrap;gap:10px;align-items:center;
  font-size:.88rem;color:var(--text-secondary);
}
.type-chip{padding:2px 10px;border-radius:10px;background:rgba(255,255,255,.08);font-size:.78rem;}

/* Оценка — цветной бейдж */
.view-rating {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.82rem;
  color: #fff;
  line-height: 1;
}
.view-rating.rating-red   { background: #f44336; }
.view-rating.rating-gray  { background: #9e9e9e; color: #1a1a1a; }
.view-rating.rating-green { background: #4caf50; }
.view-rating.rating-gold  { background: linear-gradient(135deg, #daa520, #ffd700); color: #1a1a1a; }

.view-tags{display:flex;flex-wrap:wrap;gap:6px;}
.view-tag{
  font-size:.75rem;background:rgba(255,255,255,.07);color:var(--text-secondary);
  padding:4px 10px;border-radius:6px;
}
.view-tag.sub{background:rgba(156,39,176,.2);color:#e1bee7;}
.view-collections{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.8rem;}
.col-label{color:var(--text-muted);font-size:.75rem;}
.col-badge{
  display:inline-flex;align-items:center;gap:4px;padding:3px 10px;
  background:rgba(33,150,243,.15);color:var(--status-watching);
  border-radius:12px;font-size:.75rem;
}
.col-badge img{width:14px;height:14px;object-fit:contain;border-radius:2px;}
.view-desc{font-size:.92rem;line-height:1.6;color:var(--text-secondary);}

.view-comment{
  background:rgba(33,150,243,.08);
  border-left:3px solid var(--status-watching);
  border-radius:8px;
  padding:10px 14px;
  margin-top:8px;
}
.comment-label{
  font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;
  color:var(--status-watching);margin-bottom:4px;
}
.comment-text{
  font-size:.9rem;line-height:1.5;color:var(--text-primary);
  white-space:pre-wrap;word-break:break-word;
}

.view-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;}
.link-btn{
  display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;
  background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);
  font-size:.85rem;text-decoration:none;
}
.link-btn:hover{background:var(--status-watching);border-color:var(--status-watching);}

.progress-section{padding:16px 28px;border-top:1px solid var(--border);}
.progress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.progress-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);}
.progress-count{font-size:.82rem;color:var(--status-watching);font-weight:600;}
.progress-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;}
.progress-fill{height:100%;background:var(--status-watching);transition:width .3s;}

.episodes-section{padding:16px 28px;border-top:1px solid var(--border);}
.episodes-table-wrap{
  overflow-x:auto;border-radius:10px;border:1px solid var(--border);
  background:rgba(0,0,0,.2);padding:4px;
}
.episodes-table{border-collapse:separate;border-spacing:4px;padding:4px;}
.episodes-table th,.episodes-table td{text-align:center;padding:0;}
.season-head,.season-cell{
  position:sticky;left:0;background:var(--bg-modal);z-index:2;
  min-width:60px;padding:8px 6px;font-weight:600;font-size:.78rem;
  text-align:left;border-radius:6px;
}
.season-cell{display:flex;flex-direction:column;gap:2px;background:var(--bg-card);}
.season-num{color:var(--text-primary);}
.season-count{color:var(--text-muted);font-size:.68rem;}
.all-head,.all-cell{min-width:44px;background:var(--bg-modal);padding:4px;border-radius:6px;}
.ep-head{
  min-width:34px;height:34px;font-weight:600;font-size:.72rem;
  color:var(--text-secondary);background:var(--bg-card);border-radius:6px;vertical-align:middle;
}
.ep-cell{
  min-width:34px;height:34px;cursor:pointer;border-radius:8px;
  background:var(--bg-body);transition:all .18s;position:relative;
  overflow:hidden;user-select:none;border:1px solid transparent;
}
.ep-cell:hover:not(.disabled):not(.readonly){
  transform:translateY(-1px);border-color:rgba(33,150,243,.4);
}
.ep-cell.watched{
  background:linear-gradient(135deg,rgba(102,187,106,.25),rgba(102,187,106,.15));
  border-color:rgba(102,187,106,.4);
}
.ep-cell.disabled{background:rgba(255,255,255,.02);cursor:not-allowed;opacity:.35;}
.ep-cell.readonly{cursor:default;}
.ep-inner{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}
.ep-check{width:18px;height:18px;color:var(--status-watched);}
.season-toggle{
  width:30px;height:30px;border-radius:50%;border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-secondary);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
}
.season-toggle:disabled{opacity:.5;cursor:not-allowed;}
.season-toggle.active{
  background:var(--status-watched);border-color:var(--status-watched);color:#fff;
}
.ep-hint{font-size:.72rem;color:var(--text-muted);margin-top:10px;text-align:center;}

.view-info-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
  gap:12px 20px;padding:20px 28px;border-top:1px solid var(--border);
  border-bottom:1px solid var(--border);background:rgba(0,0,0,.15);
}
.info-item.full{grid-column:1 / -1;}
.info-item .label{
  font-size:.7rem;text-transform:uppercase;letter-spacing:.5px;
  color:var(--text-muted);margin-bottom:4px;
}
.info-item .value{font-size:.9rem;color:var(--text-primary);line-height:1.4;}
.info-item .value.italic{font-style:italic;color:var(--text-secondary);}

.view-section{padding:18px 28px;border-top:1px solid var(--border);}
.section-title{
  font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;
  color:var(--text-muted);margin-bottom:12px;
}

.related-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;
}
.related-card{cursor:pointer;border-radius:8px;padding:4px;}
.related-card:hover{transform:translateY(-4px);background:var(--bg-card-hover);}
.related-card img{
  width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;background:#2a2a2a;
}
.related-title{
  font-size:.8rem;margin-top:6px;color:var(--text-primary);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.related-year{font-size:.7rem;color:var(--text-muted);}

.view-gallery{
  display:flex;gap:10px;padding:16px 28px;overflow-x:auto;
  border-top:1px solid var(--border);
}
.view-gallery img{height:110px;border-radius:8px;object-fit:cover;flex-shrink:0;}

.confirm-overlay{
  position:absolute;inset:0;background:rgba(0,0,0,.85);display:flex;
  align-items:center;justify-content:center;z-index:10;border-radius:var(--radius);padding:20px;
}
.confirm-box{
  background:var(--bg-modal);padding:28px;border-radius:var(--radius);
  border:1px solid var(--border);max-width:400px;text-align:center;
}
.confirm-box h4{margin-bottom:10px;font-size:1.1rem;}
.confirm-box p{color:var(--text-secondary);font-size:.9rem;margin-bottom:20px;}
.confirm-actions{display:flex;gap:12px;}
.confirm-actions .btn{flex:1;justify-content:center;}

.btn{
  display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);
  font-size:.9rem;cursor:pointer;font-family:inherit;
}
.btn-danger{background:var(--status-wont-watch);border-color:var(--status-wont-watch);color:#fff;}

@media (max-width:640px){
  .modal-overlay{padding:0;align-items:flex-end;}
  .modal.view-modal{max-width:100%;max-height:96vh;border-radius:20px 20px 0 0;}
  .view-hero{height:200px;}
  .round-btn{width:36px;height:36px;font-size:.9rem;}
  .round-actions{top:12px;right:12px;gap:6px;}
  .status-badge{top:12px;left:12px;font-size:.68rem;padding:4px 10px;}
  .view-body{flex-direction:column;margin-top:-60px;padding:0 16px 16px;gap:14px;}
  .view-poster{width:130px;min-width:130px;align-self:center;}
  .view-main{padding-top:0;align-items:center;text-align:center;}
  .view-title{font-size:1.35rem;text-align:center;}
  .view-meta-row{justify-content:center;font-size:.8rem;}
  .view-tags,.view-collections{justify-content:center;}
  .view-desc{text-align:left;width:100%;}
  .progress-section,.episodes-section,.view-info-grid,.view-section,.view-gallery{
    padding-left:16px;padding-right:16px;
  }
  .view-info-grid{grid-template-columns:1fr 1fr;gap:10px 14px;}
  .view-info-grid .info-item.full{grid-column:1/-1;}
  .related-grid{grid-template-columns:repeat(3,1fr);gap:8px;}
  .view-gallery img{height:80px;}
  .episodes-table{border-spacing:3px;padding:4px;}
  .season-head,.season-cell{min-width:48px;padding:6px 4px;font-size:.72rem;}
  .ep-head{min-width:28px;height:28px;font-size:.66rem;}
  .ep-cell{min-width:28px;height:28px;border-radius:6px;}
  .ep-check{width:14px;height:14px;}
  .season-toggle{width:24px;height:24px;}
  .all-head,.all-cell{min-width:32px;}
}
</style>