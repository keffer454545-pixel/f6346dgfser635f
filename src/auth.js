import { db } from './db'

const SESSION_KEY = 'movie_session_userId'

function randomSalt() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}
async function sha256(text) {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}
export async function hashPassword(password, salt) {
  return sha256(salt + ':' + password)
}

/** Гарантирует, что у первого админа есть флаг superAdmin, если его ещё ни у кого нет. */
async function ensureSuperAdmin() {
  const any = await db.users.filter(u => u.superAdmin === true).count()
  if (any > 0) return
  const firstAdmin = await db.users.filter(u => u.role === 'admin').first()
  if (firstAdmin) await db.users.update(firstAdmin.id, { superAdmin: true })
}

export async function register(username, password) {
  const name = String(username || '').trim()
  if (name.length < 3) throw new Error('Логин — минимум 3 символа')
  if (password.length < 4) throw new Error('Пароль — минимум 4 символа')

  const exists = await db.users.where('username').equals(name).first()
  if (exists) throw new Error('Такой логин уже занят')

  const count = await db.users.count()
  const isFirst = count === 0
  const salt = randomSalt()
  const passwordHash = await hashPassword(password, salt)

  const id = await db.users.add({
    username: name,
    salt,
    passwordHash,
    role: isFirst ? 'admin' : 'user',
    superAdmin: isFirst,
    banned: false,
    hidden: false,
    createdAt: Date.now()
  })

  localStorage.setItem(SESSION_KEY, String(id))
  return await db.users.get(id)
}

export async function login(username, password) {
  const name = String(username || '').trim()
  const user = await db.users.where('username').equals(name).first()
  if (!user) throw new Error('Пользователь не найден')
  if (user.banned) throw new Error('Вы забанены администратором')

  const hash = await hashPassword(password, user.salt)
  if (hash !== user.passwordHash) throw new Error('Неверный пароль')

  localStorage.setItem(SESSION_KEY, String(user.id))
  return user
}

export function logout() { localStorage.removeItem(SESSION_KEY) }

export async function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const id = Number(raw)
  if (!id) return null
  await ensureSuperAdmin()
  const u = await db.users.get(id)
  if (!u) { logout(); return null }
  if (u.banned) { logout(); return null }
  return u
}

export function isAdmin(user) { return user?.role === 'admin' }
export function isSuperAdmin(user) { return !!user?.superAdmin }