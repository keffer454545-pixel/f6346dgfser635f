import Dexie from 'dexie'

export const db = new Dexie('MovieCollection')

db.version(6).stores({
  users:       '++id, &username, role, hidden, superAdmin, banned',
  items:       '++id, type, titleRu, titleOrig, year, updatedAt, createdBy',
  userItems:   '++id, &[userId+itemId], userId, itemId, status',
  collections: '++id, userId, name, createdAt',
  links:       '++id, *itemIds',
  messages:    '++id, userId, adminId, status, createdAt'
})

db.on('versionchange', () => db.close())

export async function resetDatabase() {
  await db.delete()
  location.reload()
}