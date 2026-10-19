<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../store'
import EditModal from './EditModal.vue'
import FilterModal from './FilterModal.vue'
import ProfileModal from './ProfileModal.vue'
import Icon from './Icon.vue'

const store = useStore()
const showEdit = ref(false)
const showFilter = ref(false)
const showProfile = ref(false)

const avatarLetter = computed(() =>
  (store.currentUser?.username || '?').charAt(0).toUpperCase()
)
const canAdd = computed(() => store.effectiveAdmin)
const canSelect = computed(() => store.filtered.length > 0)
const viewing = computed(() => !!store.viewingUserId)
const viewingName = computed(() => store.viewingUserProfile?.username || '')
</script>

<template>
  <div class="topbar">
    <div class="search-box">
      <Icon name="search" :size="16" class="search-icon" />
      <input v-model="store.searchQuery" type="text" placeholder="Поиск по названию..." />
    </div>

    <!-- Фильтр виден всегда (и в чужом профиле) -->
    <button class="btn mini" @click="showFilter = true">
      <Icon name="filter" :size="18" />
      <span class="btn-text">Фильтр</span>
    </button>

    <!-- В чужом профиле -->
    <template v-if="viewing">
      <div class="viewing-name" :title="viewingName">
        <Icon name="user" :size="16" />
        <span class="name-text">{{ viewingName }}</span>
      </div>
      <button class="btn mini" @click="store.closeUserProfile()">
        ← <span class="btn-text">Вернуться</span>
      </button>
    </template>

    <!-- В своём профиле -->
    <template v-else>
      <button
        v-if="canSelect"
        class="btn mini"
        :class="{ active: store.selectionMode }"
        @click="store.toggleSelectionMode()"
      >
        <Icon :name="store.selectionMode ? 'close' : 'select'" :size="18" />
        <span class="btn-text">{{ store.selectionMode ? 'Отменить' : 'Выделить' }}</span>
      </button>

      <button v-if="canAdd" class="btn btn-primary mini" @click="showEdit = true">
        <Icon name="edit" :size="18" />
        <span class="btn-text">Добавить</span>
      </button>

      <button
        v-if="store.isAdmin"
        class="btn mini role"
        :title="store.adminViewMode === 'admin' ? 'Режим админа' : 'Режим пользователя'"
        @click="store.adminViewMode = store.adminViewMode === 'admin' ? 'user' : 'admin'"
      >
        <Icon :name="store.adminViewMode === 'admin' ? 'admin' : 'user'" :size="18" />
      </button>

      <button class="avatar" @click="showProfile = true" :title="store.currentUser?.username">
        {{ avatarLetter }}
      </button>
    </template>
  </div>

  <EditModal v-if="showEdit" @close="showEdit = false" />
  <FilterModal v-if="showFilter" @close="showFilter = false" />
  <ProfileModal v-if="showProfile" @close="showProfile = false" />
</template>

<style scoped>
.topbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:nowrap;}
.search-box{
  flex:1;min-width:0;position:relative;display:flex;align-items:center;
}
.search-icon{
  position:absolute;left:14px;color:var(--text-muted);pointer-events:none;
}
.search-box input{
  width:100%;padding:10px 16px 10px 38px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);
  color:var(--text-primary);font-size:.9rem;outline:none;
  font-family:inherit;transition:var(--transition);
}
.search-box input:focus{border-color:var(--status-watching);}
.btn{
  display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);
  font-size:.85rem;cursor:pointer;font-family:inherit;white-space:nowrap;
  transition:var(--transition);
}
.btn:hover{background:var(--bg-card-hover);}
.btn.mini.active{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.btn.role{padding:9px 12px;}
.avatar{
  width:40px;height:40px;border-radius:50%;
  background:var(--status-watching);color:#fff;font-weight:700;font-size:1rem;
  border:none;cursor:pointer;flex-shrink:0;font-family:inherit;
}
.avatar:hover{transform:scale(1.05);}
.viewing-name{
  display:inline-flex;align-items:center;gap:6px;
  font-size:.85rem;color:var(--text-secondary);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;
}
.name-text{overflow:hidden;text-overflow:ellipsis;}
@media (max-width:640px){
  .btn-text{display:none;}
  .search-box input{padding:9px 12px 9px 32px;font-size:.85rem;}
  .search-icon{left:11px;}
  .btn{padding:9px 11px;}
  .viewing-name{max-width:100px;font-size:.78rem;}
}
</style>