import { reactive } from 'vue'

const CONFIG_PATH = '~/.ranpak/config.json'

/**
 * 远程服务器配置管理。
 * 在服务器 ~/.ranpak/config.json 存放应用级配置，
 * 各模块通过 namespace 隔离（如 nginx、docker）。
 *
 * @param {(cmd: string) => Promise<{code: number, stdout: string, stderr: string}>} execFn
 */
export function useRemoteConfig(execFn) {
  const cache = reactive({})
  let loaded = false

  async function load() {
    const r = await execFn(`cat ${CONFIG_PATH} 2>/dev/null`)
    if (r.code === 0 && r.stdout.trim()) {
      try {
        Object.assign(cache, JSON.parse(r.stdout.trim()))
      } catch { /* ignore */ }
    }
    loaded = true
  }

  async function save() {
    const json = JSON.stringify(cache, null, 2)
    await execFn(`mkdir -p ~/.ranpak && cat > ${CONFIG_PATH} <<'RANPAK_EOF'\n${json}\nRANPAK_EOF`)
  }

  function get(namespace, key, defaultVal = undefined) {
    return cache[namespace]?.[key] ?? defaultVal
  }

  async function set(namespace, key, value) {
    if (!cache[namespace]) cache[namespace] = {}
    cache[namespace][key] = value
    await save()
  }

  async function setMany(namespace, obj) {
    if (!cache[namespace]) cache[namespace] = {}
    Object.assign(cache[namespace], obj)
    await save()
  }

  async function ensureLoaded() {
    if (!loaded) await load()
  }

  return { cache, load, save, get, set, setMany, ensureLoaded }
}
