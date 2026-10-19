<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../db'
import { useStore } from '../store'
import Icon from './Icon.vue'

const emit = defineEmits(['close'])
const store = useStore()

const messages = ref([])
const users = ref({})
const selected = ref(new Set())

const grouped = computed(() => {
  const g = {}
  for (const m of messages.value) {
    if (!g[m.userId]) g[m.userId] = []
    g[m.userId].push(m)
  }
  return g
})
const selectedCount = computed(() => selected.value.size)

async function load() {
  messages.value = await db.messages.orderBy('createdAt').reverse().toArray()
  const ids = [...new Set(messages.value.map(m => m.userId))]
  const list = ids.length ? await db.users.where('id').anyOf(ids).toArray() : []
  users.value = Object.fromEntries(list.map(u => [u.id, u]))
}

function toggle(id) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  selected.value = new Set(selected.value)
}

async function accept(id) {
  await db.messages.update(id, { status: 'accepted' })
  await load()
}
async function removeOne(id) {
  await db.messages.delete(id)
  selected.value.delete(id)
  selected.value = new Set(selected.value)
  await load()
}
async function removeSelected() {
  if (!selected.value.size) return
  if (!confirm(`Удалить ${selected.value.size} сообщений?`)) return
  for (const id of selected.value) await db.messages.delete(id)
  selected.value = new Set()
  await load()
}
async function removeAllFromUser(userId) {
  const name = users.value[userId]?.username || 'пользователя'
  if (!confirm(`Удалить все сообщения от ${name}?`)) return
  await db.messages.where('userId').equals(userId).delete()
  await load()
}

onMounted(load)
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>
        <Icon name="messages" :size="20" />
        Сообщения админу ({{ messages.length }})
      </h3>

      <div class="bulk">
        <button class="btn" :disabled="!selectedCount" @click="removeSelected">
          🗑 Удалить выбранные ({{ selectedCount }})
        </button>
        <button class="btn" @click="emit('close')">Закрыть</button>
      </div>

      <div v-for="(list, userId) in grouped" :key="userId" class="user-block">
        <div class="user-head">
          <span class="uname">{{ users[userId]?.username || '—' }}</span>
          <button class="btn tiny" @click="removeAllFromUser(Number(userId))">
            Удалить все его письма
          </button>
        </div>
        <div
          v-for="m in list" :key="m.id"
          class="msg"
          :class="{ selected: selected.has(m.id), accepted: m.status === 'accepted' }"
        >
          <input type="checkbox" :checked="selected.has(m.id)" @change="toggle(m.id)" />
          <div class="body">
            <div class="text">{{ m.text }}</div>
            <div class="meta">
              {{ new Date(m.createdAt).toLocaleString() }}
              <span v-if="m.status === 'accepted'" class="acc">✓ принято</span>
            </div>
          </div>
          <div class="acts">
            <button class="btn tiny ok" :disabled="m.status === 'accepted'" @click="accept(m.id)">Принять</button>
            <button class="btn tiny danger" @click="removeOne(m.id)">Удалить</button>
          </div>
        </div>
      </div>

      <p v-if="!messages.length" class="hint">Сообщений нет</p>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;
  justify-content:center;z-index:400;padding:20px;}
.modal{background:var(--bg-modal);border:1px solid var(--border);border-radius:var(--radius);
  padding:22px;width:100%;max-width:640px;max-height:88vh;overflow-y:auto;}
.modal h3{
  margin-bottom:14px;display:flex;align-items:center;gap:8px;font-size:1.05rem;
}
.bulk{display:flex;gap:8px;margin-bottom:14px;}
.user-block{margin-bottom:16px;border:1px solid var(--border);border-radius:10px;padding:10px;}
.user-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.uname{font-weight:700;font-size:.92rem;color:var(--status-watching);}
.msg{display:flex;gap:10px;padding:8px;border-radius:8px;background:var(--bg-card);
  margin-bottom:6px;align-items:flex-start;}
.msg.selected{outline:2px solid var(--status-watching);}
.msg.accepted{opacity:.7;}
.body{flex:1;min-width:0;}
.text{font-size:.88rem;line-height:1.4;word-break:break-word;}
.meta{font-size:.72rem;color:var(--text-muted);margin-top:4px;}
.acc{color:var(--status-watched);margin-left:6px;}
.acts{display:flex;flex-direction:column;gap:4px;}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;
  border-radius:20px;border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-primary);font-size:.82rem;cursor:pointer;font-family:inherit;}
.btn:hover{background:var(--bg-card-hover);}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn.tiny{padding:5px 10px;font-size:.75rem;}
.btn.danger{background:var(--status-wont-watch);border-color:var(--status-wont-watch);color:#fff;}
.btn.ok{background:var(--status-watched);border-color:var(--status-watched);color:#fff;}
.hint{text-align:center;color:var(--text-muted);font-size:.85rem;padding:14px;}
</style>