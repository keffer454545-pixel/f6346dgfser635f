<script setup>
import { ref } from 'vue'
import { useStore } from '../store'
import Icon from './Icon.vue'

const props = defineProps({ collection: Object })
const emit = defineEmits(['close'])
const store = useStore()

const name = ref(props.collection?.name || '')
const icon = ref(props.collection?.icon || '📁')

async function save() {
  if (!name.value.trim()) return alert('Введите название')
  if (props.collection) {
    await store.updateCollection(props.collection.id, { name: name.value, icon: icon.value })
  } else {
    await store.createCollection(name.value, icon.value)
  }
  emit('close')
}

async function remove() {
  if (!confirm(`Удалить коллекцию «${props.collection.name}»? Карточки останутся.`)) return
  await store.deleteCollection(props.collection.id)
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>{{ collection ? 'Изменить коллекцию' : 'Новая коллекция' }}</h3>
      <div class="field">
        <label>Название *</label>
        <input v-model="name" type="text" placeholder="Например: Marvel" autofocus>
      </div>
      <div class="field">
        <label>Иконка (эмодзи или URL)</label>
        <input v-model="icon" type="text" placeholder="📁 или https://...">
        <div class="hint">Можно вставить эмодзи или прямую ссылку на картинку.</div>
      </div>
      <div class="icon-preview">
        <img v-if="icon.startsWith('http')" :src="icon">
        <span v-else>{{ icon }}</span>
      </div>
      <div class="modal-actions">
        <button v-if="collection" class="btn btn-danger" @click="remove">Удалить</button>
        <button class="btn" @click="emit('close')">Отмена</button>
        <button class="btn btn-primary" @click="save">Сохранить</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:200;padding:20px;}
.modal{background:var(--bg-modal);border-radius:var(--radius);border:1px solid var(--border);
  padding:28px;width:100%;max-width:440px;}
.modal h3{margin-bottom:20px;font-size:1.2rem;}
.field{margin-bottom:14px;}
.field label{display:block;font-size:.8rem;color:var(--text-secondary);margin-bottom:4px;}
.field input{width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-primary);font-size:.9rem;outline:none;font-family:inherit;}
.field input:focus{border-color:var(--status-watching);}
.hint{font-size:.72rem;color:var(--text-muted);margin-top:4px;}
.icon-preview{width:80px;height:80px;border-radius:12px;background:var(--bg-card);
  border:1px solid var(--border);display:flex;align-items:center;justify-content:center;
  font-size:2rem;margin:10px auto;}
.icon-preview img{width:100%;height:100%;object-fit:contain;border-radius:12px;}
.modal-actions{display:flex;gap:10px;margin-top:20px;}
.modal-actions .btn{flex:1;justify-content:center;}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);
  font-size:.9rem;cursor:pointer;font-family:inherit;}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.btn-danger{background:var(--status-wont-watch);border-color:var(--status-wont-watch);color:#fff;}
</style>