<script setup>
import { computed } from 'vue'
import { useStore } from '../store'

const props = defineProps({ item: Object })
const emit = defineEmits(['open'])
const store = useStore()

const STATUS_LABELS = {
  watched: 'Смотрел',
  watching: 'Смотрю',
  want: 'Хочу посмотреть',
  'not-watched': 'Не смотрел',
  'wont-watch': 'Не заинтересован'
}
const STATUS_CLASSES = {
  watched: 'bg-watched',
  watching: 'bg-watching',
  want: 'bg-want',
  'not-watched': 'bg-not-watched',
  'wont-watch': 'bg-wont-watch'
}

const isSelected = computed(() => store.isSelected(props.item.id))

const hasEpisodes = computed(() =>
  props.item.episodes?.length > 0 &&
  (props.item.type === 'series' || props.item.type === 'anime' || props.item.type === 'cartoon')
)

const totalEpisodes = computed(() =>
  (props.item.episodes || []).reduce((a, b) => a + Number(b || 0), 0)
)
const watchedEpisodesCount = computed(() => {
  const w = props.item.watchedEpisodes || {}
  return Object.values(w).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0)
})
const progressPercent = computed(() =>
  totalEpisodes.value
    ? Math.round((watchedEpisodesCount.value / totalEpisodes.value) * 100)
    : 0
)

function handleClick() {
  if (store.selectionMode) store.toggleSelected(props.item.id)
  else emit('open', props.item)
}
function formatRating(r) {
  const n = Number(r)
  if (isNaN(n)) return ''
  // 9.0 → "9", 9.5 → "9.5"
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
</script>

<template>
  <div
    class="card-vertical"
    :class="{ selected: isSelected, 'selection-mode': store.selectionMode }"
    @click="handleClick"
  >
    <div class="poster">
      <img
        :src="item.poster || 'https://via.placeholder.com/400x600/2a2a2a/757575?text=Нет+постера'"
        loading="lazy"
        @error="$event.target.src='https://via.placeholder.com/400x600/2a2a2a/757575?text=Нет+постера'"
      >

      <div v-if="isSelected" class="check-overlay">
        <div class="check-mark">✓</div>
      </div>

      <div
  v-if="item.myRating !== null && item.myRating !== undefined"
  class="rating"
  :class="ratingClass(item.myRating)"
>
  {{ formatRating(item.myRating) }}
</div>
      <div class="status-badge" :class="STATUS_CLASSES[item.status]">
        {{ STATUS_LABELS[item.status] }}
      </div>
    </div>

    <div class="info">
      <div class="title">{{ item.titleRu || item.titleOrig || 'Без названия' }}</div>

      <div class="meta">
        <span v-if="item.year">{{ item.year }}</span>
        <span v-if="item.year">•</span>
        <span>{{ ({movie:'Фильм',series:'Сериал',cartoon:'Мультфильм',anime:'Аниме'})[item.type] }}</span>
      </div>

      <div v-if="item.genres?.length" class="genre">
        {{ item.genres.slice(0, 3).join(', ') }}
      </div>

      <div v-if="hasEpisodes" class="card-progress">
        <div class="card-progress-bar">
          <div
            class="card-progress-fill"
            :class="{ complete: progressPercent === 100 }"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
        <span class="card-progress-text">
          {{ watchedEpisodesCount }}/{{ totalEpisodes }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-vertical{background:var(--bg-card);border-radius:var(--radius);overflow:hidden;
  transition:var(--transition);box-shadow:var(--shadow);display:flex;flex-direction:column;
  cursor:pointer;border:1px solid var(--border);position:relative;user-select:none;}
.card-vertical:hover{transform:translateY(-8px);box-shadow:var(--shadow-hover);
  background:var(--bg-card-hover);}
.card-vertical.selected{border-color:var(--status-watching);
  box-shadow:0 0 0 3px rgba(33,150,243,.5),var(--shadow-hover);transform:translateY(-4px);}
.card-vertical.selection-mode{cursor:crosshair;}
.poster{position:relative;width:100%;aspect-ratio:2/3;overflow:hidden;background:#2a2a2a;}
.poster img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease;}
.card-vertical:hover .poster img{transform:scale(1.08);}
.check-overlay{position:absolute;inset:0;background:rgba(33,150,243,.35);
  display:flex;align-items:center;justify-content:center;z-index:3;}
.check-mark{width:56px;height:56px;border-radius:50%;background:var(--status-watching);
  color:#fff;font-size:2rem;display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 20px rgba(0,0,0,.5);font-weight:bold;}
.rating {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.85rem;
  color: #fff;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  letter-spacing: 0.3px;
  line-height: 1;
}
.rating-red    { background: #f44336; }
.rating-gray   { background: #9e9e9e; color: #1a1a1a; }
.rating-green  { background: #4caf50; }
.rating-gold   { background: linear-gradient(135deg, #daa520, #ffd700); color: #1a1a1a; }
.status-badge{position:absolute;bottom:10px;left:10px;padding:4px 10px;border-radius:20px;
  font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:#fff;
  z-index:2;box-shadow:0 2px 8px rgba(0,0,0,.3);}
.info{padding:14px;display:flex;flex-direction:column;gap:7px;flex-grow:1;}
.title{font-size:1rem;font-weight:700;line-height:1.3;display:-webkit-box;
  -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.meta{display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--text-secondary);}
.genre{font-size:.75rem;color:var(--text-muted);background:rgba(255,255,255,.05);
  padding:3px 8px;border-radius:6px;display:inline-block;width:fit-content;}
.card-progress{display:flex;align-items:center;gap:8px;margin-top:2px;}
.card-progress-bar{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;}
.card-progress-fill{height:100%;background:var(--status-watching);border-radius:3px;transition:width .4s;}
.card-progress-fill.complete{background:var(--status-watched);}
.card-progress-text{font-size:.7rem;color:var(--text-muted);font-weight:600;min-width:34px;text-align:right;}
.bg-watched{background:var(--status-watched);}
.bg-watching{background:var(--status-watching);}
.bg-want{background:var(--status-want);}
.bg-not-watched{background:var(--status-not-watched);}
.bg-wont-watch{background:var(--status-wont-watch);}
@media (max-width:860px){
  .info{padding:10px;gap:5px;}
  .title{font-size:.88rem;}
  .meta{font-size:.72rem;}
  .genre{font-size:.68rem;}
  .status-badge{font-size:.62rem;padding:3px 8px;bottom:8px;left:8px;}
  .rating {
    top: 8px;
    right: 8px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.72rem;
  }
  .check-mark{width:42px;height:42px;font-size:1.5rem;}
  .card-progress-text{font-size:.65rem;min-width:30px;}
  .card-progress-bar{height:4px;}
}
</style>