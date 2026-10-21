<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useStore } from './store'
import Topbar from './components/Topbar.vue'
import NavBar from './components/NavBar.vue'
import MovieCard from './components/MovieCard.vue'
import ViewModal from './components/ViewModal.vue'
import BulkBar from './components/BulkBar.vue'
import AuthModal from './components/AuthModal.vue'
import Icon from './components/Icon.vue'

const store = useStore()
const booted = ref(false)
const viewStack = ref([])

const validStack = computed(() =>
  viewStack.value.filter(id =>
    store.items.some(i => String(i.id) === String(id)) ||
    store.decoratedItems.some(i => String(i.id) === String(id))
  )
)

function openItem(item) {
  if (!item || item.id == null) return
  const id = String(item.id)
  if (viewStack.value[viewStack.value.length - 1] === id) return
  viewStack.value.push(id)
}
function closeTop() { viewStack.value.pop() }
function closeAll() { viewStack.value = [] }

/* ---------- Адаптивное количество колонок ---------- */
const winWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
function onResize() { winWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize, { passive: true }))
onUnmounted(() => window.removeEventListener('resize', onResize))

function tileMinForWidth(w) {
  if (w < 480) return 85
  if (w < 768) return 120
  if (w < 1200) return 160
  return 200
}
function maxColsForWidth(w) {
  const tileMin = tileMinForWidth(w)
  const containerMax = store.containerWide ? w : Math.min(w, 2000)
  const padding = w < 640 ? 28 : 48
  const inner = Math.max(240, containerMax - padding)
  const gap = w < 640 ? 10 : (w < 860 ? 12 : 24)
  let cols = Math.floor((inner + gap) / (tileMin + gap))
  const minCols = w < 768 ? 3 : 2
  return Math.max(minCols, Math.min(10, cols))
}
const effectiveCols = computed(() => {
  if (store.viewMode === 'list') return 1
  if (store.autoCols) return maxColsForWidth(winWidth.value)
  const manual = Math.max(2, Math.min(10, store.gridCols || 5))
  const cap = maxColsForWidth(winWidth.value)
  return Math.min(manual, cap)
})
const gridStyle = computed(() => ({ '--cols': effectiveCols.value }))

/* ---------- Skeleton ---------- */
// сколько силуэтов карточек нарисовать (примерно как реальная сетка)
const skeletonCount = computed(() => {
  const cols = effectiveCols.value || 5
  return Math.max(6, cols * 2)
})
// силуэты категорий (Навбар)
const skeletonCats = 5
// силуэты коллекций
const skeletonCols = 3

onMounted(async () => {
  await store.loadCurrentUser()
  if (store.currentUser) {
    store.loadViewPrefs()
    await store.loadAll()
  }
  booted.value = true
})
</script>

<template>
  <!-- Skeleton на время самой первой загрузки -->
  <div v-if="!booted" class="app-shell">
    <main class="main">
      <div class="container">
        <!-- Topbar skeleton -->
        <div class="sk-topbar">
          <div class="sk-search"></div>
          <div class="sk-right">
            <div class="sk-btn"></div>
            <div class="sk-btn"></div>
            <div class="sk-btn"></div>
            <div class="sk-avatar"></div>
          </div>
        </div>

        <!-- NavBar skeleton: категории + коллекции -->
        <div class="sk-nav">
          <div
            v-for="n in skeletonCats" :key="'cat' + n"
            class="sk-chip"
            :style="{ width: (60 + n * 12) + 'px' }"
          ></div>
          <div class="sk-sep"></div>
          <div
            v-for="n in skeletonCols" :key="'col' + n"
            class="sk-chip col"
            :style="{ width: (80 + n * 10) + 'px' }"
          ></div>
        </div>

        <!-- Grid skeleton -->
        <div class="grid" :style="gridStyle">
          <div
            v-for="n in skeletonCount" :key="'card' + n"
            class="sk-card"
          >
            <div class="sk-poster"></div>
            <div class="sk-lines">
              <div class="sk-line w80"></div>
              <div class="sk-line w50"></div>
              <div class="sk-line w30"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Auth -->
  <div v-else-if="!store.currentUser" class="auth-wrap">
    <AuthModal @authed="() => {}" />
  </div>

  <!-- Основное приложение -->
  <main v-else class="main" :class="{ wide: store.containerWide }">
    <div class="container">
      <Topbar />
      <NavBar />

      <!-- Пока данные грузятся уже после логина — skeleton, а не пустота -->
      <div
        v-if="store.loading && !store.filtered.length"
        class="grid"
        :style="gridStyle"
      >
        <div v-for="n in skeletonCount" :key="'lc' + n" class="sk-card">
          <div class="sk-poster"></div>
          <div class="sk-lines">
            <div class="sk-line w80"></div>
            <div class="sk-line w50"></div>
            <div class="sk-line w30"></div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="grid"
        :class="{
          'grid-list': store.viewMode === 'list',
          'grid-posters': store.viewMode === 'posters'
        }"
        :style="gridStyle"
      >
        <MovieCard
          v-for="it in store.filtered"
          :key="it.id"
          :item="it"
          @open="openItem"
        />
        <div v-if="!store.filtered.length" class="empty">
          <div class="empty-icon">
            <Icon name="cat-movie" :size="48" />
          </div>
          <p v-if="store.isViewingOther">
            У пользователя нет карточек с метками
          </p>
          <p v-else>Ничего не найдено</p>
        </div>
      </div>
    </div>

    <ViewModal
      v-for="(id, i) in validStack"
      :key="'vm-' + id + '-' + i"
      :item-id="id"
      :z-index="100 + i * 5"
      :depth="i"
      @close="closeAll"
      @back="closeTop"
      @open="openItem"
    />

    <BulkBar />
  </main>
</template>

<style scoped>
.auth-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }

.main {
  flex: 1;
  padding: 16px 24px 100px;
  overflow-x: hidden;
  min-width: 0;
  width: 100%;
}
.container {
  max-width: 2000px;
  margin: 0 auto;
  width: 100%;
}
.main.wide .container { max-width: 100%; }

/* ---------- Сетка ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr));
  gap: 24px;
}
.grid.grid-list {
  grid-template-columns: 1fr;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
}
.grid.grid-posters {
  grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr));
}

.empty {
  grid-column: 1/-1;
  text-align: center;
  padding: 80px 20px;
  color: var(--text-muted);
}
.empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
  display: flex;
  justify-content: center;
}

/* ---------- Skeleton: общий shimmer ---------- */
@keyframes sk-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.sk-search,
.sk-btn,
.sk-avatar,
.sk-chip,
.sk-sep,
.sk-card .sk-poster,
.sk-card .sk-line {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,.04) 0%,
    rgba(255,255,255,.10) 50%,
    rgba(255,255,255,.04) 100%
  );
  background-size: 800px 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
  border-radius: 8px;
}

/* Topbar skeleton */
.sk-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  width: 100%;
}
.sk-search {
  flex: 1 1 0;
  max-width: 420px;
  height: 38px;
  border-radius: 30px;
  margin: 0 auto; /* по центру левой половины */
}
.sk-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.sk-btn { width: 38px; height: 38px; border-radius: 50%; }
.sk-avatar { width: 40px; height: 40px; border-radius: 50%; }

/* NavBar skeleton */
.sk-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 8px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.sk-chip { height: 34px; border-radius: 20px; flex-shrink: 0; }
.sk-chip.col { height: 32px; border-radius: 18px; }
.sk-sep {
  width: 1px;
  height: 24px;
  border-radius: 0;
  flex-shrink: 0;
}

/* Card skeleton */
.sk-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.sk-card .sk-poster {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 0;
}
.sk-card .sk-lines {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sk-card .sk-line { height: 10px; border-radius: 6px; }
.sk-card .sk-line.w80 { width: 80%; }
.sk-card .sk-line.w50 { width: 50%; }
.sk-card .sk-line.w30 { width: 30%; }

/* список — компактнее */
.grid.grid-list .sk-card {
  display: flex;
  align-items: stretch;
}
.grid.grid-list .sk-card .sk-poster {
  width: 110px;
  min-width: 110px;
  aspect-ratio: 2/3;
}
.grid.grid-list .sk-card .sk-lines { flex: 1; justify-content: center; }

/* без надписей — без строк */
.grid.grid-posters .sk-card .sk-lines { display: none; }
.grid.grid-posters .sk-card .sk-poster { aspect-ratio: 2/3; }

@media (max-width: 860px) {
  .main { padding: 12px 14px 100px; }
  .grid { gap: 12px; }
  .sk-search { max-width: none; }
  .grid.grid-list .sk-card .sk-poster { width: 90px; min-width: 90px; }
}
@media (max-width: 640px) {
  .grid { gap: 10px; }
  .sk-btn { width: 34px; height: 34px; }
  .sk-avatar { width: 36px; height: 36px; }
  .sk-chip { height: 30px; }
  .sk-chip.col { height: 28px; }
}
</style>