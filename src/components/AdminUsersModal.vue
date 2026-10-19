<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store'

const emit = defineEmits(['close'])
const store = useStore()

const users = ref([])
const query = ref('')
const error = ref('')

const isSuper = computed(() => store.isSuperAdmin)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return users.value.filter(u => !q || u.username.toLowerCase().includes(q))
})

async function load() {
  users.value = await store.listAllUsers()
}

function canBan(u) {
  if (!store.isAdmin) return false
  if (u.id === store.currentUser.id) return false
  if (u.superAdmin) return false
  if (u.role === 'admin' && !isSuper.value) return false
  return true
}

function canChangeRole(u) {
  if (!isSuper.value) return false
  if (u.id === store.currentUser.id) return false
  if (u.superAdmin) return false
  return true
}

function canDelete(u) {
  if (!isSuper.value) return false
  if (u.id === store.currentUser.id) return false
  if (u.superAdmin) return false
  return true
}

async function toggleBan(u) {
  error.value = ''
  try {
    await store.setUserBanned(u.id, !u.banned)
    await load()
  } catch (e) { error.value = e.message }
}

async function toggleAdmin(u) {
  error.value = ''
  try {
    await store.setUserAdmin(u.id, u.role !== 'admin')
    await load()
  } catch (e) { error.value = e.message }
}

async function removeUser(u) {
  if (!confirm(`Удалить пользователя ${u.username}? Все его метки/коллекции/письма будут удалены.`)) return
  error.value = ''
  try {
    await store.deleteUser(u.id)
    await load()
  } catch (e) { error.value = e.message }
}

onMounted(load)
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>Пользователи ({{ users.length }})</h3>

      <input v-model="query" placeholder="Поиск по нику..." class="search-input" />

      <p v-if="error" class="error">{{ error }}</p>

      <div class="list">
        <div v-for="u in filtered" :key="u.id" class="u-row">
          <div class="ava">{{ u.username.charAt(0).toUpperCase() }}</div>
          <div class="info">
            <div class="name">
              {{ u.username }}
              <span v-if="u.superAdmin" class="tag gold">👑 супер-админ</span>
              <span v-else-if="u.role === 'admin'" class="tag blue">админ</span>
              <span v-if="u.banned" class="tag red">забанен</span>
            </div>
            <div class="sub">Регистрация: {{ new Date(u.createdAt).toLocaleDateString() }}</div>
          </div>

          <div class="acts">
            <button
              v-if="canChangeRole(u)"
              class="btn tiny"
              :class="u.role === 'admin' ? '' : 'ok'"
              @click="toggleAdmin(u)"
            >
              {{ u.role === 'admin' ? 'Снять админа' : 'Сделать админом' }}
            </button>
            <button
              v-if="canBan(u)"
              class="btn tiny"
              :class="u.banned ? 'ok' : 'danger'"
              @click="toggleBan(u)"
            >
              {{ u.banned ? 'Разбанить' : 'Забанить' }}
            </button>
            <button
              v-if="canDelete(u)"
              class="btn tiny danger"
              @click="removeUser(u)"
            >Удалить</button>
          </div>
        </div>

        <p v-if="!filtered.length" class="hint">Никого не найдено</p>
      </div>

      <div class="footer">
        <button class="btn" @click="emit('close')">Закрыть</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;
  justify-content:center;z-index:400;padding:20px;}
.modal{background:var(--bg-modal);border:1px solid var(--border);border-radius:var(--radius);
  padding:22px;width:100%;max-width:640px;max-height:88vh;overflow-y:auto;}
.modal h3{margin-bottom:14px;}
.search-input{width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);
  background:var(--bg-body);color:var(--text-primary);outline:none;margin-bottom:12px;font-family:inherit;}
.error{color:var(--status-wont-watch);font-size:.85rem;margin-bottom:10px;}
.list{display:flex;flex-direction:column;gap:6px;}
.u-row{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;
  background:var(--bg-body);border:1px solid var(--border);}
.ava{width:36px;height:36px;border-radius:50%;background:var(--status-watching);color:#fff;
  font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.info{flex:1;min-width:0;}
.name{font-weight:600;font-size:.92rem;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.sub{font-size:.72rem;color:var(--text-muted);}
.tag{font-size:.65rem;padding:1px 8px;border-radius:10px;}
.tag.gold{background:#b8860b;color:#fff;}
.tag.blue{background:var(--status-watching);color:#fff;}
.tag.red{background:var(--status-wont-watch);color:#fff;}
.acts{display:flex;flex-wrap:wrap;gap:4px;}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:7px 12px;
  border-radius:20px;border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-primary);font-size:.78rem;cursor:pointer;font-family:inherit;}
.btn:hover{background:var(--bg-card-hover);}
.btn.tiny{padding:5px 10px;font-size:.72rem;}
.btn.ok{background:var(--status-watched);border-color:var(--status-watched);color:#fff;}
.btn.danger{background:var(--status-wont-watch);border-color:var(--status-wont-watch);color:#fff;}
.footer{display:flex;justify-content:flex-end;margin-top:14px;}
.hint{text-align:center;color:var(--text-muted);font-size:.85rem;padding:14px;}
</style>