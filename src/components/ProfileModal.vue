<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store'
import { supabase } from '../supabase'
import { exportToFile, importFromFile } from '../cloud'
import AdminMessagesModal from './AdminMessagesModal.vue'
import AdminUsersModal from './AdminUsersModal.vue'
import ComposeMessageModal from './ComposeMessageModal.vue'
import Icon from './Icon.vue'


const emit = defineEmits(['close'])
const store = useStore()

const showUserSearch = ref(false)
const userQuery = ref('')
const userResults = ref([])

const showMessages = ref(false)
const showUsers = ref(false)
const showCompose = ref(false)

const status = ref('')
const hidden = ref(!!store.currentUser?.hidden)
const busyImport = ref(false)

const isAdmin = computed(() => store.isAdmin)
const isSuperAdmin = computed(() => store.isSuperAdmin)
const roleLabel = computed(() => {
  if (isSuperAdmin.value) return 'Супер-администратор'
  if (isAdmin.value) return 'Администратор'
  return 'Пользователь'
})

async function searchUsers() {
  userResults.value = await store.searchUsers(userQuery.value)
}

async function openUser(id) {
  showUserSearch.value = false
  emit('close')
  try {
    await store.openUserProfile(id)
  } catch (e) {
    alert(e.message || String(e))
  }
}

async function toggleHidden() {
  await store.setProfileHidden(hidden.value)
  status.value = hidden.value ? 'Профиль скрыт' : 'Профиль открыт'
  setTimeout(() => (status.value = ''), 2500)
}

/* ---------- Мой пак ---------- */
async function exportMyPack() {
  const me = store.currentUser
  if (!me) return
  const { data: ui } = await supabase.from('user_items').select('*').eq('user_id', me.id)
  const { data: cols } = await supabase.from('collections').select('*').eq('user_id', me.id)
  const data = {
    kind: 'user-pack',
    username: me.username,
    exportedAt: Date.now(),
    userItems: ui || [],
    collections: cols || []
  }
  exportToFile(data, `my-pack-${me.username}.json`)
  status.value = '✅ Мой пак сохранён'
}

async function importMyPack() {
  const data = await importFromFile()
  if (!data || data.kind !== 'user-pack') return alert('Неверный файл')
  if (!confirm(
    'Импортировать пак?\n\n' +
    '• Коллекции: если с таким именем уже есть — будут использованы существующие.\n' +
    '• Метки/оценки/прогресс привяжутся по старому id карточки.\n' +
    '• Существующие ваши данные перезапишутся.'
  )) return

  busyImport.value = true
  status.value = '⏳ Импорт личного пака…'
  const me = store.currentUser

  try {
    const { data: existingCols } = await supabase
      .from('collections').select('id, name').eq('user_id', me.id)
    const byName = new Map((existingCols || []).map(c => [c.name, c.id]))
    const colIdMap = new Map()

    for (const c of data.collections || []) {
      const name = (c.name || '').trim()
      if (!name) continue
      if (byName.has(name)) {
        colIdMap.set(c.id, byName.get(name))
      } else {
        const { data: inserted, error } = await supabase.from('collections').insert({
          user_id: me.id, name, icon: c.icon || '📁'
        }).select('id').single()
        if (error) { console.warn(error); continue }
        colIdMap.set(c.id, inserted.id)
        byName.set(name, inserted.id)
      }
    }

    const rows = (data.userItems || [])
      .map(u => {
        const itemId = u.item_id ?? u.itemId ?? null
        if (itemId == null) return null
        const collectionIds = (u.collection_ids || u.collectionIds || [])
          .map(oldId => colIdMap.get(oldId)).filter(v => v != null)
        return {
          user_id: me.id,
          item_id: itemId,
          status: u.status || 'not-watched',
          my_rating: u.my_rating ?? u.myRating ?? null,
          watched_episodes: u.watched_episodes ?? u.watchedEpisodes ?? {},
          watch_link: u.watch_link ?? u.watchLink ?? '',
          collection_ids: collectionIds
        }
      }).filter(Boolean)

    await supabase.from('user_items').delete().eq('user_id', me.id)
    let inserted = 0
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { error } = await supabase.from('user_items')
        .upsert(chunk, { onConflict: 'user_id,item_id' })
      if (error) throw new Error(`user_items: ${error.message}`)
      inserted += chunk.length
    }

    await store.loadAll()
    status.value = `✅ Импорт: ${inserted} записей, ${colIdMap.size} коллекций`
  } catch (e) {
    console.error(e)
    status.value = '❌ ' + (e.message || e)
  } finally {
    busyImport.value = false
  }
}

/* ---------- Пак карточек (админ) ---------- */
async function exportContentPack() {
  const { data: items } = await supabase.from('items').select('*')
  let links = []
  try {
    const { data: linkRows } = await supabase.from('links').select('*')
    links = (linkRows || []).map(r => ({ itemIds: r.item_ids || [] }))
  } catch (e) {
    console.warn('links export skipped:', e.message)
  }
  exportToFile({
    kind: 'content-pack',
    exportedAt: Date.now(),
    items: items || [],
    links
  }, `content-pack-${new Date().toISOString().slice(0, 10)}.json`)
  status.value = `✅ Пак сохранён (${(items || []).length} карточек, ${links.length} связей)`
}

function toDbRow(raw) {
  const intArr = (v) => {
    if (!v) return []
    const arr = Array.isArray(v) ? v : String(v).split(',')
    return arr.map(x => Number(x))
      .filter(n => Number.isFinite(n) && n > 0).map(Math.trunc)
  }
  const strArr = (v) => {
    if (!v) return []
    if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
    return String(v).split(',').map(s => s.trim()).filter(Boolean)
  }
  return {
    type: raw.type || 'movie',
    title_ru: raw.titleRu || raw.title_ru || '',
    title_orig: raw.titleOrig || raw.title_orig || '',
    alt_titles: strArr(raw.altTitles || raw.alt_titles),
    year: Number(raw.year) || null,
    poster: raw.poster || '',
    backdrop: raw.backdrop || '',
    stills: strArr(raw.stills),
    trailer: raw.trailer || '',
    genres: strArr(raw.genres),
    subgenres: strArr(raw.subgenres),
    themes: strArr(raw.themes),
    moods: strArr(raw.moods),
    age_rating: raw.ageRating || raw.age_rating || '',
    release_status: raw.releaseStatus || raw.release_status || '',
    studio: raw.studio || '',
    director: raw.director || '',
    cast_members: strArr(raw.cast || raw.cast_members),
    country: strArr(raw.country),
    original_lang: raw.originalLang || raw.original_lang || '',
    duration: Number(raw.duration) || null,
    seasons: Number(raw.seasons) || null,
    episodes: intArr(raw.episodes),
    watch_link: raw.watchLink || raw.watch_link || '',
    imdb: raw.imdb || '',
    kinopoisk: raw.kinopoisk || '',
    shikimori: raw.shikimori || '',
    mal: raw.mal || '',
    anilist: raw.anilist || '',
    short_desc: raw.shortDesc || raw.short_desc || '',
    full_desc: raw.fullDesc || raw.full_desc || '',
    slogan: raw.slogan || '',
    keywords: raw.keywords || ''
  }
}

async function importContentPack() {
  const data = await importFromFile()
  if (!data || data.kind !== 'content-pack') return alert('Неверный файл')
  if (!confirm(
    'Импортировать карточки и связи?\n\n' +
    '• Совпадающие по id — обновятся.\n' +
    '• Новые — добавятся с сохранением старого id.\n' +
    '• Связи будут перезаписаны.'
  )) return

  busyImport.value = true
  let added = 0, updated = 0, skipped = 0, linksAdded = 0
  try {
    const items = data.items || []
    const links = data.links || []
    status.value = `⏳ Импорт ${items.length} карточек…`

    /* ----- items ----- */
    const { data: existingRows, error: selErr } = await supabase.from('items').select('id')
    if (selErr) throw selErr
    const existingIds = new Set((existingRows || []).map(r => r.id))

    const insertRows = [], updateRows = []
    for (const raw of items) {
      const row = toDbRow(raw)
      const oldId = Number(raw.id)
      if (Number.isFinite(oldId) && oldId > 0) row.id = oldId
      if (Number.isFinite(oldId) && existingIds.has(oldId)) updateRows.push(row)
      else insertRows.push(row)
    }

    for (let i = 0; i < updateRows.length; i += 500) {
      const chunk = updateRows.slice(i, i + 500)
      const { error } = await supabase.from('items').upsert(chunk, { onConflict: 'id' })
      if (error) skipped += chunk.length
      else updated += chunk.length
      status.value = `⏳ обновлено ${updated}, ошибок ${skipped}…`
    }

    for (let i = 0; i < insertRows.length; i += 500) {
      const chunk = insertRows.slice(i, i + 500)
      const { error } = await supabase.from('items').insert(chunk)
      if (!error) added += chunk.length
      else {
        for (const row of chunk) {
          const { error: e1 } = await supabase.from('items').insert(row)
          if (e1) { console.warn('insert error', row.id, e1.message); skipped++ }
          else added++
        }
      }
      status.value = `⏳ добавлено ${added}, обновлено ${updated}, ошибок ${skipped}…`
    }

    /* ----- links ----- */
    if (links.length) {
      status.value = `⏳ Импорт ${links.length} связей…`
      try {
        const { error: delErr } = await supabase.from('links').delete().neq('id', 0)
        if (delErr) throw delErr

        // Собираем только валидные пары
        const validIds = new Set([
          ...existingIds,
          ...insertRows.map(r => r.id).filter(Number.isFinite),
          ...updateRows.map(r => r.id).filter(Number.isFinite)
        ])

        const linkRows = []
        for (const l of links) {
          const ids = (l.itemIds || [])
            .map(Number)
            .filter(n => Number.isFinite(n) && validIds.has(n))
          // без дублей
          const uniq = [...new Set(ids)]
          if (uniq.length >= 2) linkRows.push({ item_ids: uniq })
        }

        for (let i = 0; i < linkRows.length; i += 500) {
          const chunk = linkRows.slice(i, i + 500)
          const { error } = await supabase.from('links').insert(chunk)
          if (error) {
            console.warn('links chunk error', error)
            for (const row of chunk) {
              const { error: e1 } = await supabase.from('links').insert(row)
              if (!e1) linksAdded++
            }
          } else {
            linksAdded += chunk.length
          }
        }
      } catch (e) {
        console.warn('links import failed:', e.message)
      }
    }

    await store.loadAll()
    status.value =
      `✅ Добавлено: ${added}, обновлено: ${updated}, ` +
      `связей: ${linksAdded}, ошибок: ${skipped}`
  } catch (e) {
    console.error(e)
    status.value = '❌ ' + (e.message || e)
  } finally {
    busyImport.value = false
  }
}

function logout() { store.doLogout(); emit('close') }

onMounted(searchUsers)
</script>

<template>
  <div class="modal-overlay" @click.self="!busyImport && emit('close')">
    <div class="modal">
      <div class="head">
        <div class="ava" :class="{ gold: isSuperAdmin }">
          {{ (store.currentUser?.username || '?').charAt(0).toUpperCase() }}
        </div>
        <div>
          <div class="name">{{ store.currentUser?.username }}</div>
          <div class="role">{{ roleLabel }}</div>
        </div>
      </div>

      <div class="row">
        <button class="btn" :disabled="busyImport" @click="showUserSearch = true">
          <Icon name="search" :size="16" />
          Найти пользователя
        </button>
        <button class="btn" :disabled="busyImport" @click="showCompose = true">
          <Icon name="mail" :size="16" />
          Написать админу
        </button>
        <button v-if="isAdmin" class="btn" :disabled="busyImport" @click="showMessages = true">
          <Icon name="messages" :size="16" />
          Сообщения
        </button>
        <button v-if="isAdmin" class="btn" :disabled="busyImport" @click="showUsers = true">
          <Icon name="users" :size="16" />
          Пользователи
        </button>
      </div>

      <div class="section-title">Приватность</div>
      <label class="switch-row">
        <input type="checkbox" v-model="hidden" :disabled="busyImport" @change="toggleHidden" />
        <span>Скрыть мой профиль от других пользователей</span>
      </label>

      <div class="section-title">Мой пак (метки, оценки, коллекции)</div>
      <div class="row">
        <button class="btn" :disabled="busyImport" @click="exportMyPack">
          <Icon name="export" :size="16" />
          Экспорт моего пака
        </button>
        <button class="btn" :disabled="busyImport" @click="importMyPack">
          <Icon name="import" :size="16" />
          Импорт моего пака
        </button>
      </div>

      <template v-if="isAdmin">
        <div class="section-title">Пак карточек (контент — только админ)</div>
        <div class="row">
          <button class="btn" :disabled="busyImport" @click="exportContentPack">
            <Icon name="export" :size="16" />
            Экспорт карточек
          </button>
          <button class="btn" :disabled="busyImport" @click="importContentPack">
            <Icon name="import" :size="16" />
            Импорт карточек
          </button>
        </div>
      </template>

      <p v-if="status" class="status">{{ status }}</p>

      <div class="modal-actions">
        <button class="btn" :disabled="busyImport" @click="logout">Выйти</button>
        <button class="btn btn-primary" :disabled="busyImport" @click="emit('close')">Закрыть</button>
      </div>
    </div>

    <div v-if="showUserSearch" class="sub-overlay" @click.self="showUserSearch = false">
      <div class="sub-modal">
        <h3>Найти пользователя</h3>
        <div class="search-input-wrap">
          <Icon name="search" :size="16" class="search-icon" />
          <input v-model="userQuery" @input="searchUsers" placeholder="Поиск по нику..." class="search-input" />
        </div>
        <div class="user-list">
          <div v-for="u in userResults" :key="u.id" class="user-item" @click="openUser(u.id)">
            <div class="ava small">{{ u.username.charAt(0).toUpperCase() }}</div>
            <div class="u-info">
              <div class="u-name">{{ u.username }}</div>
              <div class="u-role">
                {{ u.role === 'admin' ? 'Админ' : 'Пользователь' }}
                <span v-if="u.hidden" class="hidden-tag">🔒 скрыт</span>
              </div>
            </div>
          </div>
          <p v-if="!userResults.length" class="hint">Никого не найдено</p>
        </div>
        <button class="btn" @click="showUserSearch = false">Закрыть</button>
      </div>
    </div>

    <AdminMessagesModal v-if="showMessages" @close="showMessages = false" />
    <AdminUsersModal v-if="showUsers" @close="showUsers = false" />
    <ComposeMessageModal v-if="showCompose" @close="showCompose = false" />
  </div>
</template>

<style scoped>
.modal-overlay{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.8);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; padding: 20px;
}
.modal{
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  width: 100%; max-width: 560px; max-height: 90vh;
  overflow-y: auto;
}
.head{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.ava{
  width:52px;height:52px;border-radius:50%;
  background:var(--status-watching);color:#fff;
  font-weight:700;font-size:1.3rem;
  display:flex;align-items:center;justify-content:center;
}
.ava.gold{background:linear-gradient(135deg,#b8860b,#daa520);}
.ava.small{width:36px;height:36px;font-size:1rem;background:var(--status-watching);}
.name{font-size:1.1rem;font-weight:700;}
.role{font-size:.8rem;color:var(--text-muted);}
.section-title{
  font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;
  color:var(--text-muted);
  margin:18px 0 10px;padding-bottom:6px;
  border-bottom:1px solid var(--border);
}
.row{display:flex;gap:8px;flex-wrap:wrap;}
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:9px 14px;border-radius:24px;
  border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-primary);
  font-size:.85rem;cursor:pointer;font-family:inherit;
}
.btn:hover:not(:disabled){background:var(--bg-card-hover);}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.switch-row{
  display:flex;align-items:center;gap:10px;
  font-size:.9rem;cursor:pointer;color:var(--text-secondary);
}
.status{margin-top:12px;font-size:.85rem;color:var(--status-watched);white-space:pre-line;}
.modal-actions{display:flex;gap:10px;margin-top:20px;}
.modal-actions .btn{flex:1;}

.sub-overlay{
  position:fixed;inset:0;
  background:rgba(0,0,0,.85);
  display:flex;align-items:center;justify-content:center;
  z-index:400;padding:20px;
}
.sub-modal{
  background:var(--bg-modal);border:1px solid var(--border);
  border-radius:var(--radius);padding:22px;
  width:100%;max-width:440px;max-height:80vh;overflow-y:auto;
}
.sub-modal h3{margin-bottom:14px;font-size:1.05rem;}
.search-input{
  width:100%;padding:10px 14px;border-radius:8px;
  border:1px solid var(--border);background:var(--bg-body);
  color:var(--text-primary);outline:none;font-family:inherit;
  margin-bottom:12px;
}
.search-input-wrap { position: relative; margin-bottom: 12px; }
.search-input-wrap .search-icon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); pointer-events: none;
}
.search-input-wrap .search-input { margin-bottom: 0; padding-left: 34px; }
.user-list{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
.user-item{
  display:flex;align-items:center;gap:10px;
  padding:8px 10px;border-radius:8px;cursor:pointer;
}
.user-item:hover{background:var(--bg-card-hover);}
.u-name{font-size:.92rem;font-weight:600;}
.u-role{font-size:.75rem;color:var(--text-muted);}
.hidden-tag{color:var(--status-wont-watch);}
.hint{font-size:.85rem;color:var(--text-muted);text-align:center;padding:8px;}
</style>