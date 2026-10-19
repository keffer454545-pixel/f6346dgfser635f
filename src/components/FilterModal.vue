<script setup>
import { computed } from 'vue'
import { useStore } from '../store'
import Icon from './Icon.vue'

const emit = defineEmits(['close'])
const store = useStore()

const viewingOther = computed(() => !!store.viewingUserId)

const statuses = computed(() => {
  const all = [
    { k: 'watched', l: 'Смотрел' },
    { k: 'watching', l: 'Смотрю' },
    { k: 'want', l: 'Хочу' },
    { k: 'not-watched', l: 'Не смотрел' },
    { k: 'wont-watch', l: 'Не заинтересован' }
  ]
  return viewingOther.value ? all.filter(s => s.k !== 'not-watched') : all
})

const allKeys = computed(() => statuses.value.map(s => s.k))

const isAllSelected = computed(() => {
  const cur = new Set(store.currentStatuses)
  return allKeys.value.every(k => cur.has(k)) && cur.size === allKeys.value.length
})

function toggleStatus(k) {
  const cur = new Set(store.currentStatuses)
  if (cur.has(k)) cur.delete(k)
  else cur.add(k)

  if (cur.size === allKeys.value.length && allKeys.value.every(x => cur.has(x))) {
    store.currentStatuses = []
  } else {
    store.currentStatuses = Array.from(cur)
  }
}

function clearStatuses() {
  store.currentStatuses = []
}

const sorts = [
  { k: 'default', l: 'По умолчанию' },
  { k: 'updated', l: 'По дате изменения' },
  { k: 'rating', l: 'По рейтингу' },
  { k: 'year', l: 'По году' },
  { k: 'title', l: 'По названию' }
]

function reset() {
  store.currentStatuses = []
  store.currentSort = 'default'
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>
        <Icon name="filter" :size="20" />
        Фильтр
      </h3>

      <div class="group">
        <label>
          Статус
          <button
            v-if="store.currentStatuses.length"
            class="inline-clear"
            @click="clearStatuses"
          >Сбросить</button>
        </label>
        <div class="chips">
          <span
            class="chip"
            :class="{ active: isAllSelected || store.currentStatuses.length === 0 }"
            @click="clearStatuses"
          >Все</span>
          <span
            v-for="s in statuses"
            :key="s.k"
            class="chip"
            :class="{ active: store.currentStatuses.includes(s.k) }"
            @click="toggleStatus(s.k)"
          >{{ s.l }}</span>
        </div>
        <div v-if="viewingOther && store.currentStatuses.includes('not-watched')" class="hint">
          «Не смотрел» не отображается в чужом профиле.
        </div>
      </div>

      <div class="group">
        <label>Сортировка</label>
        <div class="chips">
          <span
            v-for="s in sorts" :key="s.k"
            class="chip"
            :class="{ active: store.currentSort === s.k }"
            @click="store.currentSort = s.k"
          >{{ s.l }}</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn" @click="reset">Сбросить</button>
        <button class="btn btn-primary" @click="emit('close')">Готово</button>
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
  border:1px solid var(--border);
  padding:28px;width:100%;max-width:520px;
}
.modal h3{
  margin-bottom:20px;display:flex;align-items:center;gap:8px;
  font-size:1.1rem;
}
.group{margin-bottom:16px;}
.group label{
  font-size:.85rem;color:var(--text-secondary);
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:8px;
}
.inline-clear{
  background:none;border:none;color:var(--status-watching);
  font-size:.75rem;cursor:pointer;font-family:inherit;padding:0;
}
.chips{display:flex;flex-wrap:wrap;gap:8px;}
.chip{
  padding:6px 14px;border-radius:20px;border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-secondary);
  font-size:.8rem;cursor:pointer;transition:var(--transition);
}
.chip:hover{border-color:rgba(255,255,255,.2);}
.chip.active{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.hint{font-size:.75rem;color:var(--text-muted);margin-top:6px;}
.actions{display:flex;gap:10px;margin-top:20px;}
.actions .btn{flex:1;justify-content:center;}
.btn{
  display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-primary);font-size:.9rem;cursor:pointer;font-family:inherit;
}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
</style>