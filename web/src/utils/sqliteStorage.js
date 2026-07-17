const cache = new Map()
const TRANSIENT_KEYS = new Set(['modelId', 'modelTexturesId'])
let ready = false

function decode(record) {
  return record?.encoding === 'string' ? String(record.value ?? '') : JSON.stringify(record?.value ?? null)
}

function encode(raw) {
  try { return { encoding: 'json', value: JSON.parse(raw) } }
  catch { return { encoding: 'string', value: raw } }
}

function reportWriteError(error, key) {
  window.dispatchEvent(new CustomEvent('ranpak-storage-error', { detail: { key, error: error?.message || String(error) } }))
}

function persist(action, key, value) {
  if (!ready || TRANSIENT_KEYS.has(key)) return Promise.resolve({ ok: true })
  const api = window.electronAPI?.storage
  const request = action === 'put' ? api?.put('local_storage', key, encode(value)) : api?.delete('local_storage', key)
  return Promise.resolve(request).then(result => {
    if (!result?.ok) throw new Error(result?.error || 'SQLite 持久数据写入失败')
    return result
  }).catch(error => { reportWriteError(error, key); return { ok: false, error: error.message } })
}

export const persistentStorage = {
  getItem(key) { return cache.has(String(key)) ? cache.get(String(key)) : null },
  setItem(key, value) { key = String(key); value = String(value); cache.set(key, value); return persist('put', key, value) },
  removeItem(key) { key = String(key); cache.delete(key); return persist('delete', key) },
  key(index) { return Array.from(cache.keys())[index] ?? null },
  get length() { return cache.size },
}

export async function initializeSqliteStorage() {
  const api = window.electronAPI?.storage
  if (!api) return
  const legacyEntries = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key || TRANSIENT_KEYS.has(key)) continue
    const value = window.localStorage.getItem(key)
    if (value != null) legacyEntries.push({ key, value })
  }
  const migration = await api.migrateLegacyLocalStorage?.(legacyEntries)
  if (migration && !migration.ok) throw new Error(migration.error || '旧 localStorage 迁移失败')
  if (migration?.ok) for (const { key } of legacyEntries) window.localStorage.removeItem(key)

  const rows = await api.list('local_storage')
  if (!rows?.ok) throw new Error(rows?.error || 'SQLite 持久数据加载失败')
  cache.clear()
  for (const row of rows.data || []) cache.set(row.id, decode(row.value))
  ready = true

  api.onChanged?.(async change => {
    if (change?.type === 'local_storage') {
      const result = await api.get('local_storage', change.id)
      if (!result?.ok) { reportWriteError(new Error(result?.error || 'SQLite 持久数据刷新失败'), change.id); return }
      const next = result.data == null ? null : decode(result.data)
      const previous = cache.has(change.id) ? cache.get(change.id) : null
      if (next === previous) return
      if (next == null) cache.delete(change.id)
      else cache.set(change.id, next)
    }
    window.dispatchEvent(new CustomEvent('ranpak-storage-changed', { detail: change }))
  })
  window.dispatchEvent(new CustomEvent('ranpak-storage-ready'))
}
