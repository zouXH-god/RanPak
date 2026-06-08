<template>
  <div class="live2d-overlay" :class="{ locked: options.locked }" :style="overlayStyle">
    <div class="drag-layer"></div>
    <div v-if="!options.locked" class="toolbar" @mousedown.stop @click.stop>
      <button class="tool-button" type="button" title="锁定" @click="lockWindow">
        <el-icon><Lock /></el-icon>
      </button>
      <button class="tool-button" type="button" title="关闭" @click="closeWindow">
        <el-icon><Close /></el-icon>
      </button>
    </div>
    <div v-if="loading" class="status">Loading Live2D...</div>
    <div v-if="errorMessage" class="status error">{{ errorMessage }}</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Close, Lock } from '@element-plus/icons-vue'

const DEFAULT_WIDGET_URL = '/vendor/live2d-widget/local-autoload.js'
const API_BASE_URL = window.electronAPI?.apiBaseUrl || import.meta.env.VITE_API_BASE || `${window.location.origin}/api`
const LIVE2D_ASSET_BASE_URL = backendUrl('/live2d-assets/')
const LIVE2D_CATALOG_URL = apiUrl('/live2d/catalog')
const options = reactive({
  widgetUrl: DEFAULT_WIDGET_URL,
  backgroundColor: 'rgba(0, 0, 0, 0)',
  opacity: 100,
  modelId: 0,
  textureId: 0,
  locked: false,
})
const loading = ref(true)
const errorMessage = ref('')
let disposeOptions = null
let activeScript = null
let reloadToken = 0

const overlayStyle = computed(() => ({
  background: options.backgroundColor,
  opacity: options.opacity / 100,
}))

onMounted(() => {
  document.documentElement.classList.add('overlay-transparent-root')
  document.body.classList.add('overlay-transparent-root')
  disposeOptions = window.electronAPI?.onLive2dWindowOptions?.((nextOptions) => {
    const next = nextOptions || {}
    const shouldReload =
      normalizeWidgetUrl(next.widgetUrl || options.widgetUrl) !== normalizeWidgetUrl(options.widgetUrl) ||
      Number(next.modelId ?? options.modelId) !== Number(options.modelId) ||
      Number(next.textureId ?? options.textureId) !== Number(options.textureId)
    Object.assign(options, next)
    if (shouldReload) reloadWidget()
  })
  loadSavedConfig()
})

onBeforeUnmount(() => {
  disposeOptions?.()
  cleanupWidget()
  document.documentElement.classList.remove('overlay-transparent-root')
  document.body.classList.remove('overlay-transparent-root')
})

async function loadSavedConfig() {
  const config = await window.electronAPI?.getLive2dWindowConfig?.()
  if (config) Object.assign(options, config)
  reloadWidget()
}

function reloadWidget() {
  cleanupWidget()
  const token = ++reloadToken
  loading.value = true
  errorMessage.value = ''
  window.RAN_PAK_LIVE2D_CONFIG = {
    baseUrl: LIVE2D_ASSET_BASE_URL,
    catalogUrl: withReloadParam(LIVE2D_CATALOG_URL, token),
    modelId: normalizeIndex(options.modelId),
    textureId: normalizeIndex(options.textureId),
  }
  window.localStorage.setItem('modelId', String(window.RAN_PAK_LIVE2D_CONFIG.modelId))
  window.localStorage.setItem('modelTexturesId', String(window.RAN_PAK_LIVE2D_CONFIG.textureId))
  const script = document.createElement('script')
  script.src = withReloadParam(normalizeWidgetUrl(options.widgetUrl), token)
  script.async = true
  script.onload = () => {
    loading.value = false
    window.setTimeout(applyWidgetLayout, 300)
  }
  script.onerror = () => {
    loading.value = false
    errorMessage.value = 'Live2D 加载失败'
  }
  activeScript = script
  document.body.appendChild(script)
}

function apiUrl(path) {
  return `${String(API_BASE_URL).replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`
}

function backendUrl(path) {
  const apiBase = new URL(API_BASE_URL, window.location.href)
  return `${apiBase.origin}/${String(path || '').replace(/^\/+/, '')}`
}

function withReloadParam(url, token) {
  const rawUrl = String(url || '')
  const nextUrl = new URL(url, window.location.href)
  nextUrl.searchParams.set('rpv', String(token))
  return /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
    ? nextUrl.href
    : nextUrl.pathname + nextUrl.search + nextUrl.hash
}

function normalizeWidgetUrl(url) {
  const value = String(url || '')
  if (!value || value.includes('live2d-widgets@1.0.1')) return DEFAULT_WIDGET_URL
  return value
}

function cleanupWidget() {
  activeScript?.remove()
  activeScript = null
  document.querySelectorAll('#waifu, #waifu-toggle, #live2d-widget, .waifu').forEach((node) => node.remove())
  document.querySelectorAll('link[href*="/vendor/live2d-widget/"], script[src*="/vendor/live2d-widget/"]').forEach((node) => node.remove())
}

function applyWidgetLayout() {
  const waifu = document.querySelector('#waifu')
  if (waifu) {
    waifu.style.left = '50%'
    waifu.style.right = 'auto'
    waifu.style.bottom = '0'
    waifu.style.transform = 'translateX(-50%)'
    waifu.style.zIndex = '20'
    waifu.style.pointerEvents = 'auto'
  }
}

function closeWindow() {
  window.electronAPI?.closeCurrentWindow?.()
}

function lockWindow() {
  options.locked = true
  window.electronAPI?.setLive2dWindowLocked?.(true)
}

function normalizeIndex(value) {
  const index = Number.parseInt(value, 10)
  return Number.isFinite(index) ? Math.max(0, index) : 0
}
</script>

<style scoped>
.live2d-overlay {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: transparent;
  user-select: none;
}

.drag-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  -webkit-app-region: drag;
}

.toolbar {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 100;
  display: flex;
  gap: 6px;
  opacity: 0.7;
  -webkit-app-region: no-drag;
}

.toolbar:hover {
  opacity: 1;
}

.tool-button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
  color: #111827;
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-app-region: no-drag;
}

.status {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 10;
  transform: translate(-50%, -50%);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  padding: 8px 12px;
  color: #374151;
  font-size: 13px;
}

.status.error {
  color: #b91c1c;
}

:global(html.overlay-transparent-root),
:global(body.overlay-transparent-root),
:global(body.overlay-transparent-root #app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent !important;
}

:global(#waifu) {
  -webkit-app-region: no-drag;
}
</style>
