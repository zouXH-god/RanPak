import assert from 'node:assert/strict'

globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail } }
const legacy = new Map([['ran-terminal.favorite-features', '["ssh"]']])
const localStorage = {
  get length() { return legacy.size },
  key(index) { return [...legacy.keys()][index] ?? null },
  getItem(key) { return legacy.get(key) ?? null },
  removeItem(key) { legacy.delete(key) },
}
const db = new Map()
let changed
let changeEvents = 0
globalThis.window = {
  localStorage,
  dispatchEvent(event) { if (event.type === 'ranpak-storage-changed') changeEvents++ },
  electronAPI: { storage: {
    migrateLegacyLocalStorage: async entries => ({ ok: true, data: { migrated: true, count: entries.length } }),
    list: async () => ({ ok: true, data: [] }),
    get: async (_type, key) => ({ ok: true, data: db.get(key) ?? null }),
    put: async (_type, key, value) => { db.set(key, value); queueMicrotask(() => changed?.({ type: 'local_storage', id: key, origin: 'local' })); return { ok: true } },
    delete: async (_type, key) => { db.delete(key); queueMicrotask(() => changed?.({ type: 'local_storage', id: key, deleted: true, origin: 'local' })); return { ok: true } },
    onChanged(callback) { changed = callback },
  } },
}

const { initializeSqliteStorage, persistentStorage } = await import('../src/utils/sqliteStorage.js?test')
await initializeSqliteStorage()
assert.equal(legacy.size, 0, 'legacy localStorage must be removed after its backed-up migration')
assert.equal(persistentStorage.getItem('ran-terminal.favorite-features'), null, 'a deleted SQLite key must not resurrect from legacy localStorage')
await persistentStorage.setItem('draft', 'value')
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(changeEvents, 0, 'an unchanged echo from the main process must not trigger a renderer write loop')
console.log('sqlite storage tests passed')
