<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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

const settingsWrap = ref(null)

function toggleViewSettings() {
  store.showViewSettings = !store.showViewSettings
}
function setMode(mode) { store.viewMode = mode }
function setCols(n) { if (n >= 2 && n <= 10) store.gridCols = n }

// закрытие поповера по клику вне
function onDocClick(e) {
  if (!store.showViewSettings) return
  if (settingsWrap.value && !settingsWrap.value.contains(e.target)) {
    store.showViewSettings = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

watch(
  () => [store.viewMode, store.gridCols, store.containerWide],
  () => { try { store.saveViewPrefs?.() } catch {} }
)
</script>

<template>
  <div class="topbar">
    <!-- ЛЕВАЯ ЧАСТЬ: поиск по центру левой половины -->
    <div class="left">
      <div class="search-box" :class="{ 'has-text': store.searchQuery }">
        <Icon name="search" :size="16" class="search-icon" />
        <input
          v-model="store.searchQuery"
          type="text"
          placeholder="Поиск..."
        />
        <button
          v-if="store.searchQuery"
          class="clear-btn"
          type="button"
          title="Очистить"
          @click="store.searchQuery = ''"
        >
          <Icon name="close" :size="14" />
        </button>
      </div>
    </div>

    <!-- ПРАВАЯ ЧАСТЬ: кнопки и профиль -->
    <div class="right">
      <div ref="settingsWrap" class="view-settings-wrap">
        <button
          class="btn mini icon-only"
          :class="{ active: store.showViewSettings }"
          title="Настройки показа"
          @click.stop="toggleViewSettings"
        >
          <Icon name="settings" :size="18" />
        </button>

        <div v-if="store.showViewSettings" class="view-popover" @click.stop>
          <div class="pop-row">
            <button
              class="icon-btn"
              :class="{ active: store.viewMode === 'grid' }"
              title="Плитка"
              @click="setMode('grid')"
            >
              <Icon name="grid" :size="18" />
            </button>
            <button
              class="icon-btn"
              :class="{ active: store.viewMode === 'list' }"
              title="Список"
              @click="setMode('list')"
            >
              <Icon name="list" :size="18" />
            </button>
            <button
              class="icon-btn"
              :class="{ active: store.viewMode === 'posters' }"
              title="Без надписей"
              @click="setMode('posters')"
            >
              <Icon name="image" :size="18" />
            </button>
          </div>

          <div class="pop-row cols-row">
            <button
              class="icon-btn"
              title="Меньше плиток"
              :disabled="store.gridCols <= 2"
              @click="setCols(store.gridCols - 1)"
            >
              <Icon name="minus" :size="16" />
            </button>
            <span class="cols-val">{{ store.gridCols }}</span>
            <button
              class="icon-btn"
              title="Больше плиток"
              :disabled="store.gridCols >= 10"
              @click="setCols(store.gridCols + 1)"
            >
              <Icon name="plus" :size="16" />
            </button>
          </div>

          <div class="pop-row">
            <button
              class="icon-btn wide"
              :class="{ active: store.containerWide }"
              :title="store.containerWide ? 'С отступами' : 'На всю ширину'"
              @click="store.containerWide = !store.containerWide"
            >
              <Icon :name="store.containerWide ? 'collapse' : 'expand'" :size="18" />
            </button>
          </div>
        </div>
      </div>

      <button class="btn mini icon-only" title="Фильтр" @click="showFilter = true">
        <Icon name="filter" :size="18" />
      </button>

      <template v-if="viewing">
        <div class="viewing-name" :title="viewingName">
          <Icon name="user" :size="16" />
          <span class="name-text">{{ viewingName }}</span>
        </div>
        <button class="btn mini icon-only" title="Вернуться" @click="store.closeUserProfile()">
          <Icon name="back" :size="18" />
        </button>
      </template>

      <template v-else>
        <button
          v-if="canSelect"
          class="btn mini icon-only"
          :class="{ active: store.selectionMode }"
          :title="store.selectionMode ? 'Отменить выделение' : 'Выделить'"
          @click="store.toggleSelectionMode()"
        >
          <Icon :name="store.selectionMode ? 'close' : 'select'" :size="18" />
        </button>

        <button
          v-if="canAdd"
          class="btn btn-primary mini icon-only"
          title="Добавить"
          @click="showEdit = true"
        >
          <Icon name="edit" :size="18" />
        </button>

        <button
          v-if="store.isAdmin"
          class="btn mini icon-only role"
          :title="store.adminViewMode === 'admin' ? 'Режим админа' : 'Режим пользователя'"
          @click="store.adminViewMode = store.adminViewMode === 'admin' ? 'user' : 'admin'"
        >
          <Icon :name="store.adminViewMode === 'admin' ? 'admin' : 'user'" :size="18" />
        </button>

        <button class="avatar" title="Профиль" @click="showProfile = true">
          {{ avatarLetter }}
        </button>
      </template>
    </div>
  </div>

  <EditModal v-if="showEdit" @close="showEdit = false" />
  <FilterModal v-if="showFilter" @close="showFilter = false" />
  <ProfileModal v-if="showProfile" @close="showProfile = false" />
</template>

<style scoped>
/* ---- Полоса целиком ---- */
.topbar{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:8px;
  width:100%;
}

/* ---- Левая половина: поиск по центру своей зоны ---- */
.left{
  flex:1 1 0;
  min-width:0;
  display:flex;
  justify-content:center;   /* поиск по центру левой половины */
}
.search-box{
  position:relative;
  display:flex;
  align-items:center;
  width:100%;
  max-width:420px;           /* не растягивается на всю половину */
}
.search-icon{
  position:absolute;left:14px;color:var(--text-muted);pointer-events:none;
}
.search-box input{
  width:100%;
  padding:10px 34px 10px 38px;
  border-radius:30px;
  border:1px solid var(--border);
  background:var(--bg-card);
  color:var(--text-primary);
  font-size:.9rem;
  outline:none;
  font-family:inherit;
  transition:var(--transition);
}
.search-box input:focus{border-color:var(--status-watching);}
.clear-btn{
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  width:22px;height:22px;border-radius:50%;border:none;background:transparent;
  color:var(--text-muted);display:flex;align-items:center;justify-content:center;
  cursor:pointer;padding:0;
}
.clear-btn:hover{color:var(--text-primary);background:rgba(255,255,255,.08);}

/* ---- Правая половина: всё прижато вправо ---- */
.right{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  gap:8px;
  margin-left:auto;          /* прижимает группу вправо */
}

/* ---- Кнопки ---- */
.btn{
  display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:30px;
  border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);
  font-size:.85rem;cursor:pointer;font-family:inherit;white-space:nowrap;
  transition:var(--transition);
}
.btn:hover{background:var(--bg-card-hover);}
.btn.mini{padding:9px 11px;}
.btn.icon-only{padding:9px;gap:0;}
.btn.active,.btn.mini.active{
  background:var(--status-watching);border-color:var(--status-watching);color:#fff;
}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}

/* ---- Панель настроек ---- */
.view-settings-wrap{position:relative;flex-shrink:0;}
.view-popover{
  position:absolute;top:calc(100% + 6px);right:0;z-index:40;
  background:var(--bg-modal);border:1px solid var(--border);border-radius:12px;
  padding:8px;box-shadow:var(--shadow-hover);display:flex;flex-direction:column;gap:6px;
  min-width:180px;
}
.pop-row{display:flex;align-items:center;justify-content:center;gap:6px;}
.icon-btn{
  width:36px;height:36px;border-radius:8px;border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-secondary);cursor:pointer;
  display:flex;align-items:center;justify-content:center;padding:0;
}
.icon-btn:hover{background:var(--bg-card-hover);color:var(--text-primary);}
.icon-btn.active{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.icon-btn:disabled{opacity:.4;cursor:not-allowed;}
.icon-btn.wide{width:100%;}
.cols-row{gap:8px;}
.cols-val{min-width:20px;text-align:center;font-weight:700;font-size:.9rem;}

/* ---- Аватар ---- */
.avatar{
  width:40px;height:40px;border-radius:50%;
  background:var(--status-watching);color:#fff;font-weight:700;font-size:1rem;
  border:none;cursor:pointer;flex-shrink:0;font-family:inherit;
}
.avatar:hover{transform:scale(1.05);}

/* ---- Чужой профиль ---- */
.viewing-name{
  display:inline-flex;align-items:center;gap:6px;
  font-size:.85rem;color:var(--text-secondary);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;
}
.name-text{overflow:hidden;text-overflow:ellipsis;}

@media (max-width:860px){
  .topbar{gap:8px;}
  .left{justify-content:flex-start;}
  .search-box{max-width:none;}
}
@media (max-width:640px){
  .search-box input{padding:9px 30px 9px 32px;font-size:.85rem;}
  .search-icon{left:11px;}
  .btn{padding:9px 11px;}
  .viewing-name{max-width:100px;font-size:.78rem;}
  .avatar{width:36px;height:36px;}
}
</style>