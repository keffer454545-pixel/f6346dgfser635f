<script setup>
import { onMounted, ref, computed } from 'vue'
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

// динамические CSS-переменные для сетки
const gridStyle = computed(() => {
  if (store.viewMode === 'list') {
    return { '--cols': 1 }
  }
  return { '--cols': store.gridCols }
})

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
  <div v-if="!booted" class="boot">Загрузка…</div>

  <div v-else-if="!store.currentUser" class="auth-wrap">
    <AuthModal @authed="() => {}" />
  </div>

  <main v-else class="main" :class="{ wide: store.containerWide }">
    <div class="container">
      <Topbar />
      <NavBar />

      <div
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
.boot { padding: 40px; text-align: center; color: var(--text-muted); }
.auth-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }

.main {
  flex: 1;
  padding: 16px 24px 100px;
  overflow-x: hidden;
  min-width: 0;
  width: 100%;
}

/* контейнер: с отступами (как у большинства сайтов) или на всю ширину */
.container {
  max-width: 2000px;
  margin: 0 auto;
  width: 100%;
}
.main.wide .container {
  max-width: 100%;
}

/* сетка */
.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr));
  gap: 24px;
}

/* список — одна колонка */
.grid.grid-list {
  grid-template-columns: 1fr;
  gap: 12px;
  max-width: 900px;
  margin: 0 auto;
}

/* без надписей — та же сетка, но без info */
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

@media (max-width: 860px) {
  .main { padding: 12px 14px 100px; }
  .grid { gap: 12px; }
}
@media (max-width: 480px) {
  /* на очень узких экранах принудительно 2 колонки в grid/posters */
  .grid:not(.grid-list) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
</style>