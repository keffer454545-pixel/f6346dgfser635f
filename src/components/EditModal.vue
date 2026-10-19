<script setup>
import { ref, onMounted, watch, computed, toRaw } from 'vue'
import { useStore } from '../store'

const props = defineProps({ item: Object })
const emit = defineEmits(['close'])
const store = useStore()

const saving = ref(false)
const errorMsg = ref('')
const DRAFT_KEY = 'draft_item'

const defaultForm = () => ({
  type: 'movie',
  titleRu: '',
  titleOrig: '',
  altTitles: '',
  year: '',
  poster: '',
  backdrop: '',
  stills: '',
  trailer: '',
  genres: '',
  subgenres: '',
  themes: '',
  moods: '',
  ageRating: '',
  releaseStatus: '',
  studio: '',
  director: '',
  cast: '',
  country: '',
  originalLang: '',
  duration: '',
  seasons: '',
  episodes: '',
  watchLink: '',
  imdb: '',
  kinopoisk: '',
  shikimori: '',
  mal: '',
  anilist: '',
  shortDesc: '',
  fullDesc: '',
  slogan: '',
  keywords: ''
})

const form = ref(defaultForm())

/* Персональные поля */
const myStatus = ref('not-watched')
const myRating = ref('')
const myWatchLink = ref('')
const myComment = ref('')
const myCollections = ref([])

const isAdminEditing = computed(() => store.effectiveAdmin)

function split(v) {
  if (!v) return []
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean)
  return String(v).split(',').map(s => s.trim()).filter(Boolean)
}

onMounted(() => {
  if (props.item) {
    const i = props.item
    form.value = {
      ...defaultForm(),
      ...i,
      altTitles: (i.altTitles || []).join(', '),
      stills: (i.stills || []).join(', '),
      genres: (i.genres || []).join(', '),
      subgenres: (i.subgenres || []).join(', '),
      themes: (i.themes || []).join(', '),
      moods: (i.moods || []).join(', '),
      cast: (i.cast || []).join(', '),
      country: (i.country || []).join(', '),
      episodes: (i.episodes || []).join(', ')
    }
    myStatus.value = i.status || 'not-watched'
    myRating.value = i.myRating ?? ''
    myWatchLink.value = i.myWatchLink || ''
    myComment.value = i.myComment || ''
    myCollections.value = [...(i.collectionIds || [])]
  } else {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try { form.value = { ...defaultForm(), ...JSON.parse(saved) } } catch {}
    }
  }
})

const watchDraft = computed(() => !props.item && isAdminEditing.value)
watch(form, (v) => {
  if (!watchDraft.value) return
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(toRaw(v))) } catch {}
}, { deep: true })

function plain(obj) { return JSON.parse(JSON.stringify(toRaw(obj))) }

function toggleCollection(id) {
  const idx = myCollections.value.indexOf(id)
  if (idx >= 0) myCollections.value.splice(idx, 1)
  else myCollections.value.push(id)
}

async function saveContent() {
  errorMsg.value = ''
  if (!form.value.titleRu.trim()) { errorMsg.value = 'Введите название'; return }
  saving.value = true
  try {
    const raw = plain(form.value)
    const data = {
      type: raw.type || 'movie',
      titleRu: raw.titleRu.trim(),
      titleOrig: (raw.titleOrig || '').trim(),
      altTitles: split(raw.altTitles),
      year: parseInt(raw.year) || null,
      poster: (raw.poster || '').trim(),
      backdrop: (raw.backdrop || '').trim(),
      stills: split(raw.stills),
      trailer: (raw.trailer || '').trim(),
      genres: split(raw.genres),
      subgenres: split(raw.subgenres),
      themes: split(raw.themes),
      moods: split(raw.moods),
      ageRating: raw.ageRating || '',
      releaseStatus: raw.releaseStatus || '',
      studio: raw.studio || '',
      director: raw.director || '',
      cast: split(raw.cast),
      country: split(raw.country),
      originalLang: raw.originalLang || '',
      duration: parseInt(raw.duration) || null,
      seasons: parseInt(raw.seasons) || null,
      episodes: split(raw.episodes).map(Number),
      watchLink: (raw.watchLink || '').trim(),
      imdb: raw.imdb || '',
      kinopoisk: raw.kinopoisk || '',
      shikimori: raw.shikimori || '',
      mal: raw.mal || '',
      anilist: raw.anilist || '',
      shortDesc: raw.shortDesc || '',
      fullDesc: raw.fullDesc || '',
      slogan: raw.slogan || '',
      keywords: raw.keywords || ''
    }

    if (props.item?.id) await store.updateItem(props.item.id, data)
    else await store.addItem(data)

    localStorage.removeItem(DRAFT_KEY)
    emit('close')
  } catch (e) {
    console.error(e)
    errorMsg.value = 'Ошибка: ' + (e?.message || e)
  } finally {
    saving.value = false
  }
}

async function savePersonal() {
  errorMsg.value = ''
  if (!props.item?.id) return
  saving.value = true
  try {
    const id = props.item.id
    await store.setMyStatus(id, myStatus.value)
    await store.setMyRating(id, myRating.value === '' ? null : parseFloat(myRating.value))
    await store.setMyWatchLink(id, myWatchLink.value)
    await store.setMyComment(id, myComment.value)
    const cur = new Set(props.item.collectionIds || [])
    const next = new Set(myCollections.value)
    for (const cid of next) if (!cur.has(cid)) await store.toggleMyCollection(id, cid)
    for (const cid of cur) if (!next.has(cid)) await store.toggleMyCollection(id, cid)
    emit('close')
  } catch (e) {
    errorMsg.value = 'Ошибка: ' + (e?.message || e)
  } finally {
    saving.value = false
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
  form.value = defaultForm()
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>
        {{ item ? (isAdminEditing ? 'Редактировать карточку' : 'Мои настройки карточки') : 'Добавить карточку' }}
      </h3>

      <!-- АДМИН -->
      <form v-if="isAdminEditing" @submit.prevent="saveContent">
        <div class="section-title">Основное</div>
        <div class="form-row">
          <div class="field">
            <label>Тип</label>
            <select v-model="form.type">
              <option value="movie">Фильм</option>
              <option value="series">Сериал</option>
              <option value="cartoon">Мультфильм</option>
              <option value="anime">Аниме</option>
            </select>
          </div>
          <div class="field">
            <label>Год</label>
            <input v-model="form.year" type="number">
          </div>
        </div>
        <div class="field">
          <label>Название (рус.) *</label>
          <input v-model="form.titleRu" type="text">
        </div>
        <div class="field">
          <label>Название (ориг.)</label>
          <input v-model="form.titleOrig" type="text">
        </div>
        <div class="field">
          <label>Альтернативные (через запятую)</label>
          <input v-model="form.altTitles" type="text">
        </div>

        <div class="section-title">Медиа</div>
        <div class="field"><label>Постер (URL)</label><input v-model="form.poster" type="url"></div>
        <div class="field"><label>Кадры (URL через запятую)</label><input v-model="form.stills" type="text"></div>
        <div class="field"><label>Ссылка на просмотр (для всех)</label><input v-model="form.watchLink" type="url"></div>

        <div class="section-title">Жанры и темы</div>
        <div class="field"><label>Жанры</label><input v-model="form.genres" type="text"></div>

        <div class="form-row">
          <div class="field">
            <label>Возраст</label>
            <select v-model="form.ageRating">
              <option value="">—</option>
              <option value="0+">0+</option>
              <option value="6+">6+</option>
              <option value="12+">12+</option>
              <option value="16+">16+</option>
              <option value="18+">18+</option>
            </select>
          </div>
          <div class="field">
            <label>Статус выхода</label>
            <select v-model="form.releaseStatus">
              <option value="">—</option>
              <option value="completed">Завершён</option>
              <option value="ongoing">Выходит</option>
              <option value="announced">Анонс</option>
              <option value="frozen">Заморожен</option>
            </select>
          </div>
        </div>

        <div class="section-title">Детали</div>
        <div class="form-row">
          <div class="field"><label>Студия</label><input v-model="form.studio" type="text"></div>
          <div class="field"><label>Режиссёр</label><input v-model="form.director" type="text"></div>
        </div>
        <div class="field"><label>Актёры (через запятую)</label><input v-model="form.cast" type="text"></div>
        <div class="form-row">
          <div class="field"><label>Страна</label><input v-model="form.country" type="text"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Длительность (мин)</label><input v-model="form.duration" type="number"></div>
          <div class="field"><label>Сезонов</label><input v-model="form.seasons" type="number"></div>
        </div>
        <div class="field">
          <label>Серий в сезонах</label>
          <input v-model="form.episodes" type="text" placeholder="25, 12, 22">
        </div>

        <div class="section-title">Описание</div>
        <div class="field"><label>Краткое</label><textarea v-model="form.shortDesc"></textarea></div>
        <div class="field"><label>Ключевые слова</label><input v-model="form.keywords" type="text"></div>

        <p v-if="errorMsg" class="error-msg">⚠️ {{ errorMsg }}</p>

        <div class="modal-actions">
          <button v-if="!item" type="button" class="btn" @click="clearDraft">Очистить</button>
          <button type="button" class="btn" @click="emit('close')">Отмена</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? '...' : 'Сохранить' }}
          </button>
        </div>
      </form>

      <!-- ПОЛЬЗОВАТЕЛЬ -->
      <div v-else>
        <div class="section-title">Моя метка</div>
        <div class="field">
          <select v-model="myStatus">
            <option value="not-watched">Не смотрел ⚪</option>
            <option value="watched">Смотрел 🟢</option>
            <option value="watching">Смотрю 🔵</option>
            <option value="want">Хочу посмотреть 🟣</option>
            <option value="wont-watch">Не заинтересован 🔴</option>
          </select>
        </div>

        <div class="section-title">Моя оценка</div>
        <div class="field">
          <input v-model="myRating" type="number" step="0.1" min="0" max="10" placeholder="0–10">
        </div>

        <div class="section-title">Моя ссылка на просмотр</div>
        <div class="field">
          <input v-model="myWatchLink" type="url" placeholder="https://...">
          <div class="hint">Видна только вам.</div>
        </div>

        <div class="section-title">Комментарий</div>
        <div class="field">
          <textarea
            v-model="myComment"
            placeholder="Поделитесь впечатлением или заметкой. Виден в вашем профиле."
            maxlength="1000"
          ></textarea>
          <div class="hint">{{ myComment.length }}/1000</div>
        </div>

        <div class="section-title">Мои коллекции</div>
        <div class="collections-pick">
          <button
            v-for="c in store.collections" :key="c.id"
            type="button"
            class="col-chip"
            :class="{ active: myCollections.includes(c.id) }"
            @click="toggleCollection(c.id)"
          >
            <img v-if="c.icon?.startsWith('http')" :src="c.icon" alt="">
            <span v-else>{{ c.icon || '📁' }}</span>
            {{ c.name }}
          </button>
          <p v-if="!store.collections.length" class="hint">У вас пока нет коллекций</p>
        </div>

        <p v-if="errorMsg" class="error-msg">⚠️ {{ errorMsg }}</p>

        <div class="modal-actions">
          <button class="btn" @click="emit('close')">Отмена</button>
          <button class="btn btn-primary" :disabled="saving" @click="savePersonal">
            {{ saving ? '...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;
}
.modal{
  background:var(--bg-modal);border-radius:var(--radius);
  border:1px solid var(--border);padding:28px;
  width:100%;max-width:640px;max-height:90vh;overflow-y:auto;
}
.modal h3{margin-bottom:20px;font-size:1.2rem;}
.section-title{
  font-size:.72rem;text-transform:uppercase;color:var(--text-muted);
  margin:18px 0 10px;border-bottom:1px solid var(--border);
  padding-bottom:6px;letter-spacing:.5px;
}
.section-title:first-child{margin-top:0;}
.form-row{display:flex;gap:10px;}
.field{flex:1;margin-bottom:14px;}
.field label{display:block;font-size:.8rem;color:var(--text-secondary);margin-bottom:4px;}
.field input,.field select,.field textarea{
  width:100%;padding:9px 12px;border-radius:8px;
  border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-primary);font-size:.88rem;outline:none;font-family:inherit;
}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--status-watching);}
.field textarea{resize:vertical;min-height:60px;}
.hint{font-size:.72rem;color:var(--text-muted);margin-top:4px;}
.collections-pick{display:flex;flex-wrap:wrap;gap:8px;}
.col-chip{
  display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;
  border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-secondary);font-size:.82rem;cursor:pointer;font-family:inherit;
}
.col-chip.active{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.col-chip img{width:16px;height:16px;object-fit:contain;border-radius:3px;}
.error-msg{
  margin-top:12px;font-size:.85rem;color:var(--status-wont-watch);
  background:rgba(244,67,54,.1);padding:8px 12px;border-radius:8px;
  border:1px solid rgba(244,67,54,.3);
}
.modal-actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;}
.modal-actions .btn{flex:1;justify-content:center;min-width:100px;}
.btn{
  display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-primary);font-size:.9rem;cursor:pointer;font-family:inherit;
}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
@media (max-width:640px){
  .modal-overlay{padding:0;align-items:flex-end;}
  .modal{padding:20px 16px;max-height:96vh;border-radius:20px 20px 0 0;}
  .form-row{flex-direction:column;gap:0;}
}
</style>