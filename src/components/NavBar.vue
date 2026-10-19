<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../store'
import CollectionModal from './CollectionModal.vue'
import Icon from './Icon.vue'

const store = useStore()
const showCollectionModal = ref(false)
const editingCollection = ref(null)

const categories = [
  { key: 'all',     icon: 'cat-all',     label: 'Все' },
  { key: 'movie',   icon: 'cat-movie',   label: 'Фильмы' },
  { key: 'series',  icon: 'cat-series',  label: 'Сериалы' },
  { key: 'cartoon', icon: 'cat-cartoon', label: 'Мультфильмы' },
  { key: 'anime',   icon: 'cat-anime',   label: 'Аниме' }
]
const counts = computed(() => store.countsByType)
const collectionCounts = computed(() => store.countsByCollection)

const collectionsForNav = computed(() =>
  store.viewingUserId ? store.viewingUserCollections : store.collections
)

function selectCategory(k) {
  store.currentCategory = k
  store.currentCollection = null
}
function selectCollection(id) { store.currentCollection = id }
function openCreate() { editingCollection.value = null; showCollectionModal.value = true }
function openEdit(col) { editingCollection.value = col; showCollectionModal.value = true }
</script>

<template>
  <div class="navbar">
    <div class="row">
      <button
        v-for="c in categories" :key="c.key"
        class="chip"
        :class="{ active: store.currentCategory === c.key && store.currentCollection === null }"
        @click="selectCategory(c.key)"
      >
        <Icon :name="c.icon" :size="16" />
        <span>{{ c.label }}</span>
        <span class="cnt">{{ counts[c.key] || 0 }}</span>
      </button>

      <div class="sep"></div>

      <button
        v-for="col in collectionsForNav" :key="col.id"
        class="chip col"
        :class="{ active: store.currentCollection === col.id }"
        @click="selectCollection(col.id)"
      >
        <img v-if="col.icon?.startsWith('http')" :src="col.icon" alt="" />
        <span v-else>{{ col.icon || '📁' }}</span>
        <span>{{ col.name }}</span>
        <span class="cnt">{{ collectionCounts[col.id] || 0 }}</span>
        <span
          v-if="!store.viewingUserId"
          class="edit"
          @click.stop="openEdit(col)"
          title="Изменить"
        >
          <Icon name="edit" :size="12" />
        </span>
      </button>

      <button
        v-if="!store.viewingUserId"
        class="chip plus"
        @click="openCreate"
        title="Новая коллекция"
      >＋</button>
    </div>

    <CollectionModal
      v-if="showCollectionModal"
      :collection="editingCollection"
      @close="showCollectionModal = false"
    />
  </div>
</template>

<style scoped>
.navbar{
  position:sticky;top:0;z-index:30;background:var(--bg-body);
  padding:6px 0 8px;margin-bottom:12px;border-bottom:1px solid var(--border);
}
.row{display:flex;gap:8px;overflow-x:auto;padding:2px 4px 6px;scrollbar-width:thin;}
.row::-webkit-scrollbar{height:4px;}
.row::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
.chip{
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
  padding:8px 14px;border-radius:20px;background:var(--bg-card);
  border:1px solid var(--border);color:var(--text-secondary);font-size:.85rem;
  cursor:pointer;font-family:inherit;flex-shrink:0;transition:var(--transition);
}
.chip:hover{color:var(--text-primary);border-color:rgba(255,255,255,.15);}
.chip.active{background:rgba(33,150,243,.15);border-color:var(--status-watching);
  color:var(--status-watching);font-weight:600;}
.cnt{font-size:.72rem;background:rgba(255,255,255,.08);padding:1px 7px;border-radius:10px;}
.chip.active .cnt{background:rgba(33,150,243,.3);color:#fff;}
.chip.col img{width:16px;height:16px;object-fit:contain;border-radius:3px;}
.chip.col .edit{opacity:0;margin-left:2px;transition:var(--transition);
  display:inline-flex;align-items:center;}
.chip.col:hover .edit{opacity:.8;}
.chip.plus{font-size:1.1rem;padding:6px 12px;line-height:1;}
.sep{width:1px;background:var(--border);margin:0 4px;flex-shrink:0;}
</style>