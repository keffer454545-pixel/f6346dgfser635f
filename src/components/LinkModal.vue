<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../store'

const props = defineProps({ item: Object })
const emit = defineEmits(['close'])
const store = useStore()
const query = ref('')

const existingLink = computed(() =>
  store.links.find(l => l.itemIds.includes(props.item.id))
)
const linkedIds = computed(() => existingLink.value?.itemIds || [])

const candidates = computed(() => {
  const q = query.value.toLowerCase().trim()
  return store.items
    .filter(it => it.id !== props.item.id && !linkedIds.value.includes(it.id))
    .filter(it => !q || (it.titleRu || '').toLowerCase().includes(q))
    .slice(0, 20)
})

async function addLink(target) {
  await store.addLink(props.item.id, target.id)
}
async function removeLink(id) {
  await store.removeLink(props.item.id, id)
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>Связи «{{ item.titleRu }}»</h3>

      <div class="section-title">Уже связано</div>
      <div v-if="linkedIds.length" class="linked-list">
        <div v-for="id in linkedIds" :key="id" class="linked-item">
          <template v-if="id !== item.id">
            <span>{{ store.items.find(i => i.id === id)?.titleRu }}</span>
            <button @click="removeLink(id)">✕</button>
          </template>
        </div>
      </div>
      <p v-else class="empty-hint">Пока ни с чем не связано</p>

      <div class="section-title">Добавить связь</div>
      <input v-model="query" type="text" placeholder="Поиск карточки..." class="search-input">
      <div class="candidates">
        <div v-for="c in candidates" :key="c.id" class="candidate" @click="addLink(c)">
          <img :src="c.poster || 'https://via.placeholder.com/60x90/2a2a2a/757575'">
          <div>
            <div class="c-title">{{ c.titleRu }}</div>
            <div class="c-year">{{ c.year }}</div>
          </div>
          <button class="add-btn">+</button>
        </div>
        <div v-if="!candidates.length" class="empty-hint">Ничего не найдено</div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-primary" @click="emit('close')">Готово</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
.modal{background:var(--bg-modal);border-radius:var(--radius);border:1px solid var(--border);
  padding:24px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;}
.modal h3{margin-bottom:16px;font-size:1.1rem;}
.section-title{font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;
  color:var(--text-muted);margin:14px 0 8px;}
.linked-list{display:flex;flex-direction:column;gap:6px;}
.linked-item{display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px;background:var(--bg-body);border-radius:8px;font-size:.88rem;}
.linked-item button{background:none;border:none;color:var(--status-wont-watch);font-size:1rem;cursor:pointer;}
.empty-hint{font-size:.85rem;color:var(--text-muted);padding:8px 0;}
.search-input{width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);
  background:var(--bg-body);color:var(--text-primary);font-size:.9rem;outline:none;
  margin-bottom:10px;font-family:inherit;}
.candidates{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;}
.candidate{display:flex;gap:10px;align-items:center;padding:6px;border-radius:8px;cursor:pointer;}
.candidate:hover{background:var(--bg-card-hover);}
.candidate img{width:36px;height:54px;object-fit:cover;border-radius:4px;}
.c-title{font-size:.88rem;font-weight:600;}
.c-year{font-size:.75rem;color:var(--text-muted);}
.add-btn{margin-left:auto;width:28px;height:28px;border-radius:50%;
  background:var(--status-watching);border:none;color:#fff;font-size:1rem;cursor:pointer;}
.modal-actions{display:flex;gap:10px;margin-top:20px;}
.modal-actions .btn{flex:1;justify-content:center;}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);
  font-size:.9rem;cursor:pointer;font-family:inherit;}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
</style>