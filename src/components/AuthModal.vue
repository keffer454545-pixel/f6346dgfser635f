<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useStore } from '../store'

const emit = defineEmits(['authed', 'close'])
const store = useStore()

const mode = ref('login')       // 'login' | 'register'
const email = ref('')
const password = ref('')
const password2 = ref('')
const username = ref('')
const error = ref('')
const info = ref('')
const busy = ref(false)

/* ---------- Хелперы ---------- */
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
}

async function ensureProfile(user, desiredUsername) {
  // Проверяем, есть ли профиль
  const { data: existing, error: selErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (selErr) throw selErr
  if (existing) return

  const uname = (desiredUsername || user.email?.split('@')[0] || 'user').trim()
  const { error: insErr } = await supabase.from('profiles').insert({
    id: user.id,
    username: uname,
    role: 'user',
    super_admin: false,
    banned: false,
    hidden: false
  })
  // Если username занят — пробуем с суффиксом
  if (insErr) {
    if (insErr.code === '23505') {
      const alt = uname + '_' + Math.floor(Math.random() * 1000)
      const { error: insErr2 } = await supabase.from('profiles').insert({
        id: user.id,
        username: alt,
        role: 'user',
        super_admin: false,
        banned: false,
        hidden: false
      })
      if (insErr2) throw insErr2
    } else {
      throw insErr
    }
  }
}

/* ---------- Основной сабмит ---------- */
async function submit() {
  error.value = ''
  info.value = ''
  busy.value = true

  try {
    if (mode.value === 'register') {
      const mail = email.value.trim().toLowerCase()
      if (!isValidEmail(mail)) throw new Error('Некорректный email')
      if (password.value.length < 6) throw new Error('Пароль — минимум 6 символов')
      if (password.value !== password2.value) throw new Error('Пароли не совпадают')

      const { data, error: e } = await supabase.auth.signUp({
        email: mail,
        password: password.value
      })
      if (e) throw e

      // Если email-подтверждение включено — пользователь есть, но сессии ещё нет
      if (!data.session) {
        info.value =
          'Аккаунт создан. Проверьте почту и подтвердите email, затем войдите.'
        mode.value = 'login'
        return
      }

      await ensureProfile(data.user, username.value)
      await store.afterLogin()

      // Проверка бана
      if (store.currentUser?.banned) {
        await supabase.auth.signOut()
        throw new Error('Ваш аккаунт забанен')
      }

      emit('authed')
    } else {
      const mail = email.value.trim().toLowerCase()
      if (!isValidEmail(mail)) throw new Error('Некорректный email')
      if (!password.value) throw new Error('Введите пароль')

      const { data, error: e } = await supabase.auth.signInWithPassword({
        email: mail,
        password: password.value
      })
      if (e) throw e

      // Профиль может отсутствовать, если регистрация была давно — создадим
      await ensureProfile(data.user, null)

      await store.afterLogin()

      if (store.currentUser?.banned) {
        await supabase.auth.signOut()
        throw new Error('Ваш аккаунт забанен администратором')
      }

      emit('authed')
    }
  } catch (e) {
    console.error('Auth error:', e)
    // Приводим частые ошибки Supabase к понятным сообщениям
    const msg = e?.message || String(e)
    if (msg.includes('Invalid login credentials')) {
      error.value = 'Неверный email или пароль'
    } else if (msg.includes('Email not confirmed')) {
      error.value = 'Email не подтверждён. Проверьте почту.'
    } else if (msg.includes('User already registered')) {
      error.value = 'Этот email уже зарегистрирован'
    } else {
      error.value = msg
    }
  } finally {
    busy.value = false
  }
}

function switchMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
  info.value = ''
}
</script>

<template>
  <div class="modal-overlay">
    <div class="modal">
      <h3>{{ mode === 'login' ? 'Вход' : 'Регистрация' }}</h3>

      <div class="field">
        <label>Email</label>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          @keyup.enter="submit"
        />
      </div>

      <div class="field">
        <label>Пароль</label>
        <input
          v-model="password"
          type="password"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          placeholder="Минимум 6 символов"
          @keyup.enter="submit"
        />
      </div>

      <div v-if="mode === 'register'" class="field">
        <label>Пароль ещё раз</label>
        <input
          v-model="password2"
          type="password"
          autocomplete="new-password"
          @keyup.enter="submit"
        />
      </div>

      <div v-if="mode === 'register'" class="field">
        <label>Имя пользователя (необязательно)</label>
        <input
          v-model="username"
          type="text"
          placeholder="Например: keffer"
          @keyup.enter="submit"
        />
        <div class="hint">Если не указать — возьмётся из email до @.</div>
      </div>

      <p v-if="error" class="error">⚠️ {{ error }}</p>
      <p v-if="info" class="info">ℹ️ {{ info }}</p>

      <div class="actions">
        <button class="btn" type="button" @click="switchMode">
          {{ mode === 'login' ? 'Создать аккаунт' : 'У меня есть аккаунт' }}
        </button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="busy"
          @click="submit"
        >
          {{ busy ? '...' : (mode === 'login' ? 'Войти' : 'Зарегистрироваться') }}
        </button>
      </div>

      <p v-if="mode === 'register'" class="hint center">
        После регистрации попросите администратора назначить вам роль, если нужно.
      </p>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:300;padding:20px;
}
.modal{
  background:var(--bg-modal);border:1px solid var(--border);border-radius:var(--radius);
  padding:28px;width:100%;max-width:420px;
}
.modal h3{margin-bottom:20px;font-size:1.2rem;}
.field{margin-bottom:12px;}
.field label{
  display:block;font-size:.8rem;color:var(--text-secondary);margin-bottom:4px;
}
.field input{
  width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);
  background:var(--bg-body);color:var(--text-primary);outline:none;
  font-family:inherit;font-size:.92rem;transition:var(--transition);
}
.field input:focus{border-color:var(--status-watching);}
.hint{font-size:.72rem;color:var(--text-muted);margin-top:4px;}
.hint.center{text-align:center;margin-top:14px;}
.actions{display:flex;gap:10px;margin-top:18px;}
.actions .btn{flex:1;justify-content:center;}
.btn{
  display:inline-flex;align-items:center;justify-content:center;
  padding:10px 16px;border-radius:30px;border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-primary);cursor:pointer;
  font-family:inherit;font-size:.9rem;transition:var(--transition);
}
.btn:hover:not(:disabled){background:var(--bg-card-hover);}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn-primary{
  background:var(--status-watching);border-color:var(--status-watching);color:#fff;
}
.error{
  color:var(--status-wont-watch);font-size:.85rem;margin-top:10px;
  background:rgba(244,67,54,.1);padding:8px 12px;border-radius:8px;
  border:1px solid rgba(244,67,54,.3);
}
.info{
  color:var(--status-watching);font-size:.85rem;margin-top:10px;
  background:rgba(33,150,243,.1);padding:8px 12px;border-radius:8px;
  border:1px solid rgba(33,150,243,.3);
}
</style>