import { defineStore } from 'pinia'
import { supabase } from './supabase'

const episodeWriteQueue = new Map()

/* ===== Маппинг items: БД (snake_case) → фронт (camelCase) ===== */
function mapItemFromDb(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    titleRu: row.title_ru,
    titleOrig: row.title_orig,
    altTitles: row.alt_titles || [],
    year: row.year,
    poster: row.poster,
    backdrop: row.backdrop,
    stills: row.stills || [],
    trailer: row.trailer,
    genres: row.genres || [],
    subgenres: row.subgenres || [],
    themes: row.themes || [],
    moods: row.moods || [],
    ageRating: row.age_rating,
    releaseStatus: row.release_status,
    studio: row.studio,
    director: row.director,
    cast: row.cast_members || [],
    country: row.country || [],
    originalLang: row.original_lang,
    duration: row.duration,
    seasons: row.seasons,
    episodes: row.episodes || [],
    watchLink: row.watch_link || '',
    imdb: row.imdb,
    kinopoisk: row.kinopoisk,
    shikimori: row.shikimori,
    mal: row.mal,
    anilist: row.anilist,
    shortDesc: row.short_desc,
    fullDesc: row.full_desc,
    slogan: row.slogan,
    keywords: row.keywords,
    createdAt: row.created_at
  }
}

function mapItemToDb(data) {
  return {
    type: data.type || 'movie',
    title_ru: data.titleRu || '',
    title_orig: data.titleOrig || '',
    alt_titles: data.altTitles || [],
    year: data.year || null,
    poster: data.poster || '',
    backdrop: data.backdrop || '',
    stills: data.stills || [],
    trailer: data.trailer || '',
    genres: data.genres || [],
    subgenres: data.subgenres || [],
    themes: data.themes || [],
    moods: data.moods || [],
    age_rating: data.ageRating || '',
    release_status: data.releaseStatus || '',
    studio: data.studio || '',
    director: data.director || '',
    cast_members: data.cast || [],
    country: data.country || [],
    original_lang: data.originalLang || '',
    duration: data.duration || null,
    seasons: data.seasons || null,
    episodes: data.episodes || [],
    watch_link: data.watchLink || '',
    imdb: data.imdb || '',
    kinopoisk: data.kinopoisk || '',
    shikimori: data.shikimori || '',
    mal: data.mal || '',
    anilist: data.anilist || '',
    short_desc: data.shortDesc || '',
    full_desc: data.fullDesc || '',
    slogan: data.slogan || '',
    keywords: data.keywords || ''
  }
}

function mapUserItemFromDb(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    status: row.status || 'not-watched',
    myRating: row.my_rating ?? null,
    watchedEpisodes: row.watched_episodes || {},
    watchLink: row.watch_link || '',
    comment: row.comment || '',
    collectionIds: row.collection_ids || [],
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0
  }
}

function mapCollectionFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    createdAt: row.created_at
  }
}

export const useStore = defineStore('main', {
  state: () => ({
    currentUser: null,
    adminViewMode: 'admin',

    items: [],
    links: [],

    userItems: [],
    collections: [],

    /* Просмотр чужого профиля в главном окне */
    viewingUserId: null,
    viewingUserProfile: null,
    viewingUserItems: [],
    viewingUserCollections: [],

    selected: new Set(),
    selectionMode: false,
    currentCategory: 'all',
    currentCollection: null,
    currentStatuses: [],          // мультивыбор статусов
    currentSort: 'default',
    searchQuery: '',

    /* Настройки показа карточек */
    viewMode: 'grid',             // 'grid' | 'list' | 'posters'
    gridCols: 5,                  // 2..10
    autoCols: false,              // авто-подстройка количества плиток
    containerWide: false,         // false = с отступами, true = на всю ширину
    showViewSettings: false,      // открыта ли панель настроек в Topbar

    loading: false,
    lastError: ''
  }),

  getters: {
    isAdmin(state) {
      return state.currentUser?.role === 'admin'
    },
    isSuperAdmin(state) {
      return !!state.currentUser?.super_admin
    },
    effectiveAdmin(state) {
      return state.currentUser?.role === 'admin'
        && state.adminViewMode === 'admin'
        && !state.viewingUserId
    },
    isViewingOther(state) {
      return !!state.viewingUserId
    },

    /* userItems, которые сейчас активны (свои или чужие) */
    effectiveUserItems(state) {
      return state.viewingUserId ? state.viewingUserItems : state.userItems
    },
    effectiveCollections(state) {
      return state.viewingUserId ? state.viewingUserCollections : state.collections
    },

    myUserItemsMap() {
      const map = new Map()
      for (const u of this.effectiveUserItems) map.set(u.itemId, u)
      return map
    },

    decoratedItems(state) {
      const map = this.myUserItemsMap
      return state.items.map(it => {
        const u = map.get(it.id) || {}
        return {
          ...it,
          status: u.status || 'not-watched',
          myRating: u.myRating ?? null,
          watchedEpisodes: u.watchedEpisodes || {},
          collectionIds: u.collectionIds || [],
          myWatchLink: u.watchLink || '',
          myComment: u.comment || '',
          myUpdatedAt: u.updatedAt || 0,
          watchLink: u.watchLink || it.trailer || ''
        }
      })
    },

    filtered(state) {
      const q = state.searchQuery.trim().toLowerCase()
      const base = this.decoratedItems

      let r = base.filter(it => {
        if (state.currentCollection != null) {
          if (!(it.collectionIds || []).includes(state.currentCollection)) return false
        } else if (state.currentCategory !== 'all' && it.type !== state.currentCategory) {
          return false
        }

        // Мультивыбор статусов (если пусто — «Все»)
        if (state.currentStatuses && state.currentStatuses.length) {
          if (!state.currentStatuses.includes(it.status)) return false
        }

        // В чужом профиле «не смотрел» не показываем
        if (state.viewingUserId && (it.status === 'not-watched' || !it.status)) return false

        if (q) {
          const titles = [
            it.titleRu || '',
            it.titleOrig || '',
            ...(it.altTitles || [])
          ].map(s => s.toLowerCase())
          if (!titles.some(t => t.includes(q))) return false
        }
        return true
      })

      if (state.currentSort === 'updated') {
        r.sort((a, b) => (b.myUpdatedAt || 0) - (a.myUpdatedAt || 0))
      } else if (state.currentSort === 'rating') {
        r.sort((a, b) => (b.myRating || 0) - (a.myRating || 0))
      } else if (state.currentSort === 'year') {
        r.sort((a, b) => (b.year || 0) - (a.year || 0))
      } else if (state.currentSort === 'title') {
        r.sort((a, b) => (a.titleRu || '').localeCompare(b.titleRu || ''))
      } else if (q) {
        const rank = (it) => {
          const titles = [
            it.titleRu || '',
            it.titleOrig || '',
            ...(it.altTitles || [])
          ].map(s => s.toLowerCase())
          if (titles.some(t => t.startsWith(q))) return 0
          if (titles.some(t => t.split(/\s+/).some(w => w.startsWith(q)))) return 1
          return 2
        }
        r.sort((a, b) => {
          const ra = rank(a), rb = rank(b)
          if (ra !== rb) return ra - rb
          return (a.titleRu || '').localeCompare(b.titleRu || '')
        })
      } else {
        // «По умолчанию» без поиска — сначала изменённые пользователем
        r.sort((a, b) => (b.myUpdatedAt || 0) - (a.myUpdatedAt || 0))
      }

      return r
    },

    /* Счётчики с учётом чужого профиля и фильтра статусов */
    countsByType(state) {
      let base = this.decoratedItems

      if (state.viewingUserId) {
        base = base.filter(it => it.status && it.status !== 'not-watched')
      }

      if (state.currentStatuses && state.currentStatuses.length) {
        const set = new Set(state.currentStatuses)
        base = base.filter(it => set.has(it.status))
      }

      const c = { all: base.length, movie: 0, series: 0, cartoon: 0, anime: 0 }
      for (const it of base) if (c[it.type] !== undefined) c[it.type]++
      return c
    },

    countsByCollection(state) {
      let base = this.decoratedItems
      if (state.viewingUserId) {
        base = base.filter(it => it.status && it.status !== 'not-watched')
      }
      const map = {}
      for (const col of this.effectiveCollections) {
        map[col.id] = base.filter(it => (it.collectionIds || []).includes(col.id)).length
      }
      return map
    },

    isSelectionMode(state) {
      return state.selectionMode
    },

    /* Связи — getter-функция */
    related(state) {
      return (itemId) => {
        const id = Number(itemId)
        const direct = state.links.filter(l =>
          (l.itemIds || []).map(Number).includes(id)
        )
        const ids = new Set()
        direct.forEach(l => (l.itemIds || []).forEach(x => {
          const n = Number(x)
          if (n !== id) ids.add(n)
        }))
        return state.items.filter(it => ids.has(Number(it.id)))
      }
    }
  },

  actions: {
    /* ================== АВТОРИЗАЦИЯ ================== */

    async loadCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { this.currentUser = null; return null }

      const { data: profile, error } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle()

      if (error) {
        console.error('loadCurrentUser profile error:', error)
        throw new Error('Не удалось загрузить профиль: ' + error.message)
      }

      // Профиля нет — создаём (fallback, если триггер не сработал)
      if (!profile) {
        const fallbackUsername = user.email?.split('@')[0] || 'user'
        const { data: created, error: insErr } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: fallbackUsername,
            role: 'user',
            super_admin: false,
            banned: false,
            hidden: false
          })
          .select()
          .single()

        if (insErr) {
          console.error('loadCurrentUser insert error:', insErr)
          throw new Error('Профиль не найден и не создан: ' + insErr.message)
        }
        this.currentUser = { ...created, email: user.email }
      } else {
        this.currentUser = { ...profile, email: user.email }
      }

      if (this.currentUser?.banned) {
        await supabase.auth.signOut()
        this.currentUser = null
        throw new Error('Вы забанены администратором')
      }

      return this.currentUser
    },

    async afterLogin() {
      this.adminViewMode = 'admin'
      await this.loadCurrentUser()
      this.loadViewPrefs()
      await this.loadAll()
    },

    async doLogout() {
      await supabase.auth.signOut()
      this.currentUser = null
      this.adminViewMode = 'admin'
      this.items = []
      this.userItems = []
      this.collections = []
      this.links = []
      this.selected = new Set()
      this.selectionMode = false
      this.closeUserProfile()
    },

    /* ================== НАСТРОЙКИ ПОКА ================== */

        saveViewPrefs() {
      try {
        localStorage.setItem('view_prefs', JSON.stringify({
          viewMode: this.viewMode,
          gridCols: this.gridCols,
          autoCols: this.autoCols,
          containerWide: this.containerWide
        }))
      } catch {}
    },

    loadViewPrefs() {
      try {
        const raw = localStorage.getItem('view_prefs')
        if (!raw) return
        const p = JSON.parse(raw)
        if (p.viewMode === 'grid' || p.viewMode === 'list' || p.viewMode === 'posters') {
          this.viewMode = p.viewMode
        }
        if (Number.isInteger(p.gridCols) && p.gridCols >= 2 && p.gridCols <= 10) {
          this.gridCols = p.gridCols
        }
        if (typeof p.autoCols === 'boolean') this.autoCols = p.autoCols
        if (typeof p.containerWide === 'boolean') {
          this.containerWide = p.containerWide
        }
      } catch {}
    },

    /* ================== ЗАГРУЗКА ================== */

    async loadAll() {
      if (!this.currentUser) return
      this.loading = true
      this.lastError = ''
      try {
        /* items — постранично */
        let allItems = []
        let from = 0
        const pageSize = 1000
        let hasMore = true
        while (hasMore) {
          const { data, error } = await supabase
            .from('items').select('*')
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1)
          if (error) throw error
          const rows = data || []
          allItems = allItems.concat(rows)
          from += rows.length
          hasMore = rows.length === pageSize
        }
        this.items = allItems.map(mapItemFromDb)

        /* links — необязательно */
        try {
          const { data: linkRows, error: linkErr } = await supabase
            .from('links').select('*')
          if (linkErr) throw linkErr
          this.links = (linkRows || []).map(r => ({
            id: r.id,
            itemIds: r.item_ids || []
          }))
        } catch (e) {
          console.warn('links load skipped:', e.message)
          this.links = []
        }

        /* свои userItems */
        const { data: uiRows, error: uiErr } = await supabase
          .from('user_items').select('*').eq('user_id', this.currentUser.id)
        if (uiErr) throw uiErr
        this.userItems = (uiRows || []).map(mapUserItemFromDb)

        /* свои коллекции */
        const { data: colRows, error: colErr } = await supabase
          .from('collections').select('*')
          .eq('user_id', this.currentUser.id)
          .order('created_at', { ascending: true })
        if (colErr) throw colErr
        this.collections = (colRows || []).map(mapCollectionFromDb)

        /* почистим выделение */
        const ids = new Set(this.items.map(i => i.id))
        for (const id of Array.from(this.selected)) if (!ids.has(id)) this.selected.delete(id)
        this.selected = new Set(this.selected)
      } catch (e) {
        console.error('loadAll error:', e)
        this.lastError = e.message || String(e)
      } finally {
        this.loading = false
      }
    },

    /* ================== ПЕРСОНАЛЬНЫЕ ДАННЫЕ ================== */

    async _ensureUserItem(itemId) {
      if (!this.currentUser) throw new Error('Нужен вход')
      if (this.viewingUserId) throw new Error('В чужом профиле нельзя менять данные')
      const userId = this.currentUser.id
      const existing = this.userItems.find(u => u.itemId === itemId)
      if (existing) return existing

      const { data, error } = await supabase
        .from('user_items')
        .upsert({
          user_id: userId,
          item_id: itemId,
          status: 'not-watched',
          my_rating: null,
          watched_episodes: {},
          watch_link: '',
          comment: '',
          collection_ids: []
        }, { onConflict: 'user_id,item_id' })
        .select().single()
      if (error) throw error
      const mapped = mapUserItemFromDb(data)
      this.userItems = [...this.userItems, mapped]
      return mapped
    },

    async setMyStatus(itemId, status) {
      const u = await this._ensureUserItem(itemId)
      const { error } = await supabase.from('user_items')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) throw error
      const local = this.userItems.find(x => x.itemId === itemId)
      if (local) { local.status = status; local.updatedAt = Date.now() }
      this.userItems = [...this.userItems]
    },

    async setMyRating(itemId, rating) {
      const u = await this._ensureUserItem(itemId)
      const { error } = await supabase.from('user_items')
        .update({ my_rating: rating, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) throw error
      const local = this.userItems.find(x => x.itemId === itemId)
      if (local) { local.myRating = rating; local.updatedAt = Date.now() }
      this.userItems = [...this.userItems]
    },

    async setMyWatchLink(itemId, link) {
      const u = await this._ensureUserItem(itemId)
      const { error } = await supabase.from('user_items')
        .update({ watch_link: link || '', updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) throw error
      const local = this.userItems.find(x => x.itemId === itemId)
      if (local) { local.watchLink = link || ''; local.updatedAt = Date.now() }
      this.userItems = [...this.userItems]
    },

    async setMyComment(itemId, comment) {
      const u = await this._ensureUserItem(itemId)
      const text = String(comment || '')
      const { error } = await supabase.from('user_items')
        .update({ comment: text, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) throw error
      const local = this.userItems.find(x => x.itemId === itemId)
      if (local) { local.comment = text; local.updatedAt = Date.now() }
      this.userItems = [...this.userItems]
    },

    async setMyWatchedEpisodes(itemId, watched) {
      const u = await this._ensureUserItem(itemId)
      const { error } = await supabase.from('user_items')
        .update({ watched_episodes: watched, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) throw error
      const local = this.userItems.find(x => x.itemId === itemId)
      if (local) { local.watchedEpisodes = watched; local.updatedAt = Date.now() }
      this.userItems = [...this.userItems]
    },

    async toggleMyCollection(itemId, collectionId) {
      const u = await this._ensureUserItem(itemId)
      const cur = [...(u.collectionIds || [])]
      const idx = cur.indexOf(collectionId)
      if (idx >= 0) cur.splice(idx, 1)
      else cur.push(collectionId)
      const { error } = await supabase.from('user_items')
        .update({ collection_ids: cur, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) throw error
      const local = this.userItems.find(x => x.itemId === itemId)
      if (local) { local.collectionIds = cur; local.updatedAt = Date.now() }
      this.userItems = [...this.userItems]
    },

    /* ================== КОЛЛЕКЦИИ ================== */

    async createCollection(name, icon) {
      if (!this.currentUser) throw new Error('Нужен вход')
      if (this.viewingUserId) throw new Error('В чужом профиле нельзя создавать коллекции')
      const { data, error } = await supabase.from('collections')
        .insert({ user_id: this.currentUser.id, name, icon })
        .select().single()
      if (error) throw error
      this.collections = [...this.collections, mapCollectionFromDb(data)]
    },

    async updateCollection(id, patch) {
      const { error } = await supabase.from('collections')
        .update(patch).eq('id', id)
      if (error) throw error
      await this.loadAll()
    },

    async deleteCollection(id) {
      const { error } = await supabase.from('collections').delete().eq('id', id)
      if (error) throw error
      for (const u of this.userItems) {
        if ((u.collectionIds || []).includes(id)) {
          const newIds = (u.collectionIds || []).filter(c => c !== id)
          await supabase.from('user_items')
            .update({ collection_ids: newIds }).eq('id', u.id)
        }
      }
      await this.loadAll()
    },

    /* ================== КОНТЕНТ (админ) ================== */

    async addItem(data) {
      if (!this.effectiveAdmin) throw new Error('Только админ может добавлять карточки')
      const { data: row, error } = await supabase.from('items')
        .insert(mapItemToDb(data)).select().single()
      if (error) throw error
      await this.loadAll()
      return row.id
    },

    async updateItem(id, data) {
      if (!this.effectiveAdmin) throw new Error('Только админ может менять карточки')
      const { error } = await supabase.from('items')
        .update(mapItemToDb(data)).eq('id', id)
      if (error) throw error
      await this.loadAll()
    },

    async deleteItem(id) {
      if (!this.effectiveAdmin) throw new Error('Только админ может удалять карточки')
      const { error } = await supabase.from('items').delete().eq('id', id)
      if (error) throw error
      await this.loadAll()
    },

    /* ================== СВЯЗИ (админ) ================== */

    async addLink(itemId, targetId) {
      if (!this.effectiveAdmin) {
        throw new Error('Только админ может связывать карточки')
      }
      const a = Number(itemId)
      const b = Number(targetId)
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
        throw new Error('Некорректные id карточек')
      }

      const existing = this.links.find(l =>
        (l.itemIds || []).map(Number).includes(a)
      )

      if (existing) {
        const ids = (existing.itemIds || []).map(Number)
        if (!ids.includes(b)) {
          const { error } = await supabase
            .from('links')
            .update({ item_ids: [...ids, b] })
            .eq('id', existing.id)
          if (error) throw error
        }
      } else {
        const { error } = await supabase
          .from('links')
          .insert({ item_ids: [a, b] })
        if (error) throw error
      }

      await this.loadAll()
    },

    async removeLink(itemId, targetId) {
      if (!this.effectiveAdmin) throw new Error('Только админ')

      const a = Number(itemId)
      const b = Number(targetId)
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new Error('Некорректные id карточек')
      }

      const l = this.links.find(x =>
        (x.itemIds || []).map(Number).includes(a)
      )
      if (!l) return

      const newIds = (l.itemIds || []).map(Number).filter(i => i !== b)

      if (newIds.length < 2) {
        const { error } = await supabase.from('links').delete().eq('id', l.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('links')
          .update({ item_ids: newIds })
          .eq('id', l.id)
        if (error) throw error
      }

      await this.loadAll()
    },

    /* ================== ЧУЖОЙ ПРОФИЛЬ ================== */

    async openUserProfile(userId) {
      const prof = await this.getPublicProfile(userId)
      if (!prof) throw new Error('Профиль не найден')
      this.viewingUserId = String(userId)
      this.viewingUserProfile = prof.user
      this.viewingUserItems = prof.userItems || []
      this.viewingUserCollections = prof.collections || []
      // сброс фильтров, чтобы видеть все карточки пользователя
      this.currentCategory = 'all'
      this.currentCollection = null
      this.currentStatuses = []
      this.searchQuery = ''
      this.selected = new Set()
      this.selectionMode = false
    },

    closeUserProfile() {
      this.viewingUserId = null
      this.viewingUserProfile = null
      this.viewingUserItems = []
      this.viewingUserCollections = []
      this.currentStatuses = []
      this.currentCategory = 'all'
      this.currentCollection = null
    },

    async getPublicProfile(userId) {
      const { data: user, error: uErr } = await supabase.from('profiles')
        .select('id, username, role, hidden, super_admin')
        .eq('id', userId).maybeSingle()
      if (uErr || !user) return null
      if (user.hidden && userId !== this.currentUser?.id) {
        return { user: { id: user.id, username: user.username, hidden: true }, denied: true }
      }
      const [uiRes, colRes] = await Promise.all([
        supabase.from('user_items').select('*').eq('user_id', userId),
        supabase.from('collections').select('*').eq('user_id', userId)
      ])
      if (uiRes.error || colRes.error) return null
      return {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          hidden: !!user.hidden,
          superAdmin: !!user.super_admin
        },
        userItems: (uiRes.data || []).map(mapUserItemFromDb),
        collections: (colRes.data || []).map(mapCollectionFromDb),
        denied: false
      }
    },

    /* ================== ПОЛЬЗОВАТЕЛИ (админ) ================== */

    async searchUsers(query) {
      const q = String(query || '').trim()
      let req = supabase.from('profiles')
        .select('id, username, role, super_admin, banned, hidden')
        .neq('id', this.currentUser?.id || '')
      if (q) req = req.ilike('username', `%${q}%`)
      const { data, error } = await req.limit(50)
      if (error) throw error
      return (data || []).map(u => ({
        id: u.id, username: u.username, role: u.role,
        superAdmin: !!u.super_admin, banned: !!u.banned, hidden: !!u.hidden
      }))
    },

    async listAllUsers() {
      const { data, error } = await supabase.from('profiles')
        .select('id, username, role, super_admin, banned, hidden, created_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data || []).map(u => ({
        id: u.id, username: u.username, role: u.role,
        superAdmin: !!u.super_admin, banned: !!u.banned, hidden: !!u.hidden,
        createdAt: u.created_at
      }))
    },

    async setProfileHidden(hidden) {
      if (!this.currentUser) return
      const { error } = await supabase.from('profiles')
        .update({ hidden }).eq('id', this.currentUser.id)
      if (error) throw error
      this.currentUser = { ...this.currentUser, hidden }
    },

    async setUserBanned(userId, banned) {
      if (!this.isAdmin) throw new Error('Только админ')
      if (userId === this.currentUser.id) throw new Error('Нельзя банить себя')
      const target = await this._getProfile(userId)
      if (!target) throw new Error('Пользователь не найден')
      if (target.super_admin) throw new Error('Нельзя банить супер-админа')
      if (target.role === 'admin' && !this.isSuperAdmin) {
        throw new Error('Только супер-админ может банить админов')
      }
      const { error } = await supabase.from('profiles')
        .update({ banned }).eq('id', userId)
      if (error) throw error
    },

    async setUserAdmin(userId, makeAdmin) {
      if (!this.isSuperAdmin) throw new Error('Только супер-админ может менять роли')
      if (userId === this.currentUser.id) throw new Error('Нельзя менять свою роль')
      const target = await this._getProfile(userId)
      if (!target) throw new Error('Пользователь не найден')
      if (target.super_admin) throw new Error('Нельзя менять роль супер-админа')
      const { error } = await supabase.from('profiles')
        .update({ role: makeAdmin ? 'admin' : 'user' }).eq('id', userId)
      if (error) throw error
    },

    async deleteUser(userId) {
      if (!this.isSuperAdmin) throw new Error('Только супер-админ')
      if (userId === this.currentUser.id) throw new Error('Нельзя удалить себя')
      const target = await this._getProfile(userId)
      if (!target) return
      if (target.super_admin) throw new Error('Нельзя удалить супер-админа')
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
    },

    async _getProfile(userId) {
      const { data, error } = await supabase.from('profiles')
        .select('id, username, role, super_admin, banned, hidden')
        .eq('id', userId).maybeSingle()
      if (error) return null
      return data
    },

    /* ================== СООБЩЕНИЯ ================== */

    async sendMessageToAdmin(text) {
      if (!this.currentUser) throw new Error('Нужен вход')
      const { data: admins, error: aErr } = await supabase.from('profiles')
        .select('id').eq('role', 'admin').limit(1)
      if (aErr || !admins?.length) throw new Error('Нет администраторов')
      const { error } = await supabase.from('messages').insert({
        user_id: this.currentUser.id,
        admin_id: admins[0].id,
        text: String(text || '').trim(),
        status: 'new'
      })
      if (error) throw error
    },

    /* ================== ВЫДЕЛЕНИЕ ================== */

    toggleSelectionMode() {
      this.selectionMode = !this.selectionMode
      if (!this.selectionMode) this.selected = new Set()
    },
    exitSelectionMode() {
      this.selectionMode = false
      this.selected = new Set()
    },
    isSelected(id) {
      return this.selected.has(id)
    },
    toggleSelected(id) {
      if (this.selected.has(id)) this.selected.delete(id)
      else this.selected.add(id)
      this.selected = new Set(this.selected)
    },
    selectAllVisible() {
      this.filtered.forEach(it => this.selected.add(it.id))
      this.selected = new Set(this.selected)
    },
    clearSelection() {
      this.selected = new Set()
    },

    /* ================== МАССОВЫЕ ================== */

    async bulkSetStatus(status) {
      const ids = Array.from(this.selected)
      for (const id of ids) await this.setMyStatus(id, status)
      this.clearSelection()
    },

    async bulkAddToCollection(collectionId) {
      const ids = Array.from(this.selected)
      for (const id of ids) {
        const u = await this._ensureUserItem(id)
        const cur = u.collectionIds || []
        if (!cur.includes(collectionId)) {
          const newIds = [...cur, collectionId]
          await supabase.from('user_items')
            .update({ collection_ids: newIds, updated_at: new Date().toISOString() })
            .eq('id', u.id)
        }
      }
      await this.loadAll()
      this.clearSelection()
    },

    async bulkRemoveFromCollection(collectionId) {
      const ids = Array.from(this.selected)
      for (const id of ids) {
        const u = await this._ensureUserItem(id)
        const cur = (u.collectionIds || []).filter(c => c !== collectionId)
        await supabase.from('user_items')
          .update({ collection_ids: cur, updated_at: new Date().toISOString() })
          .eq('id', u.id)
      }
      await this.loadAll()
      this.clearSelection()
    },

    async bulkDelete() {
      if (!this.effectiveAdmin) throw new Error('Удалять карточки может только админ')
      const ids = Array.from(this.selected)
      for (const id of ids) await this.deleteItem(id)
      this.clearSelection()
    },

    /* ================== ПРОГРЕСС СЕРИЙ ================== */

    async saveWatchedEpisodes(itemId, newWatched, status) {
      const id = Number(itemId)
      if (isNaN(id)) return
      if (this.viewingUserId) return
      const prev = episodeWriteQueue.get(id) || Promise.resolve()
      const next = prev.catch(() => {}).then(async () => {
        await this.setMyWatchedEpisodes(id, newWatched)
        if (status) await this.setMyStatus(id, status)
      })
      episodeWriteQueue.set(id, next)
      await next
    },

    async setWatchedEpisodes(itemId, newWatched) {
      if (this.viewingUserId) return     
      const id = Number(itemId)
      const item = this.items.find(i => i.id === id)
      if (!item) return
      const status = this._computeStatus(item, newWatched)
      await this.saveWatchedEpisodes(id, newWatched, status)
    },

    _computeStatus(item, watchedEpisodes) {
      const totalEps = (item.episodes || [])
        .map(n => Number(n)).filter(n => !isNaN(n)).reduce((a, b) => a + b, 0)
      if (!totalEps) return 'not-watched'
      const watched = Object.values(watchedEpisodes || {})
        .reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0)
      if (watched === 0) return 'not-watched'
      if (watched >= totalEps) return 'watched'
      return 'watching'
    }
  }
})