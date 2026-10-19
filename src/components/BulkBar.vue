<script setup>
import { ref } from 'vue'
import { useStore } from '../store'

const store = useStore()
const showCollections = ref(false)

async function confirmDelete() {
  const n = store.selected.size
  if (!confirm(`Удалить ${n} карточек безвозвратно?`)) return
  await store.bulkDelete()
}
</script>

<template>
  <transition name="slide-up">
    <div v-if="store.isSelectionMode" class="bulk-bar">
      <div class="bulk-header">
        <span class="bulk-count">Выбрано: <b>{{ store.selected.size }}</b></span>
        <button class="bulk-close" @click="store.exitSelectionMode()">✕</button>
      </div>

      <div class="bulk-actions">
        <button
          class="bulk-btn"
          @click="store.selected.size ? (showCollections = !showCollections) : null"
          :disabled="!store.selected.size"
        >📁 В коллекцию</button>
        <button class="bulk-btn" @click="store.selectAllVisible()">
          ☑ Все ({{ store.filtered.length }})
        </button>
        <button
          v-if="store.effectiveAdmin"
          class="bulk-btn danger"
          @click="store.selected.size ? confirmDelete() : null"
          :disabled="!store.selected.size"
        >🗑 Удалить</button>
      </div>

      <div v-if="showCollections" class="bulk-collections">
        <div v-if="store.currentCollection" class="bulk-row">
          <span>Убрать из текущей коллекции</span>
          <button
            class="bulk-chip danger"
            @click="store.bulkRemoveFromCollection(store.currentCollection); showCollections = false"
          >Убрать</button>
        </div>
        <div v-for="c in store.collections" :key="c.id" class="bulk-row">
          <span>
            <img v-if="c.icon?.startsWith('http')" :src="c.icon"
              style="width:16px;height:16px;vertical-align:middle;margin-right:6px;" alt="">
            <template v-else>{{ c.icon || '📁' }}</template>
            {{ c.name }}
          </span>
          <button class="bulk-chip" @click="store.bulkAddToCollection(c.id); showCollections = false">
            Добавить
          </button>
        </div>
        <p v-if="!store.collections.length" class="bulk-empty">Нет коллекций</p>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.bulk-bar{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
  background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:12px 16px;
  box-shadow:var(--shadow-hover);z-index:50;display:flex;flex-direction:column;gap:10px;
  min-width:320px;max-width:calc(100vw - 24px);}
.bulk-header{display:flex;align-items:center;justify-content:space-between;}
.bulk-count{font-size:.9rem;color:var(--text-secondary);}
.bulk-count b{color:var(--status-watching);font-size:1rem;}
.bulk-close{background:none;border:none;color:var(--text-muted);font-size:1.1rem;cursor:pointer;padding:4px 8px;}
.bulk-actions{display:flex;gap:8px;flex-wrap:wrap;}
.bulk-btn{padding:8px 14px;border-radius:20px;border:1px solid var(--border);background:var(--bg-body);
  color:var(--text-primary);font-size:.82rem;cursor:pointer;font-family:inherit;flex:1;white-space:nowrap;}
.bulk-btn:hover:not(:disabled){background:var(--bg-card-hover);}
.bulk-btn:disabled{opacity:.4;cursor:not-allowed;}
.bulk-btn.danger{background:var(--status-wont-watch);border-color:var(--status-wont-watch);color:#fff;}
.bulk-collections{background:var(--bg-body);border-radius:10px;padding:10px;
  max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;}
.bulk-row{display:flex;justify-content:space-between;align-items:center;font-size:.82rem;padding:6px 4px;}
.bulk-chip{padding:4px 10px;border-radius:14px;border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-primary);font-size:.78rem;cursor:pointer;font-family:inherit;}
.bulk-chip.danger{background:var(--status-wont-watch);border-color:var(--status-wont-watch);color:#fff;}
.bulk-empty{font-size:.8rem;color:var(--text-muted);text-align:center;}
.slide-up-enter-active,.slide-up-leave-active{transition:all .3s ease;}
.slide-up-enter-from,.slide-up-leave-to{opacity:0;transform:translate(-50%,20px);}
@media (max-width:640px){
  .bulk-bar{bottom:10px;left:10px;right:10px;transform:none;min-width:0;max-width:none;padding:10px 12px;}
  .slide-up-enter-from,.slide-up-leave-to{opacity:0;transform:translateY(20px);}
  .bulk-btn{font-size:.78rem;padding:7px 10px;}
}
</style>