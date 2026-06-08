<template>
  <div
    class="clock-overlay"
    :class="{ locked }"
    :style="overlayStyle"
    @dblclick="unlock"
  >
    <div v-if="!locked" class="clock-toolbar" @mousedown.stop @click.stop @dblclick.stop>
      <button class="clock-tool-button" type="button" title="锁定窗口" @mousedown.stop @click.stop="lockWindow">
        <el-icon class="clock-tool-icon"><Lock /></el-icon>
      </button>
      <button class="clock-tool-button" type="button" title="关闭" @mousedown.stop @click.stop="closeWindow">
        <el-icon class="clock-tool-icon"><Close /></el-icon>
      </button>
    </div>
    <div class="clock-stage">
      <div class="clock-content" :class="{ draggable: !locked }" :style="clockContentStyle">
        <div class="clock-time" :style="clockTimeStyle">{{ timeText }}</div>
        <div v-if="options.showDate || options.showLunarDate" class="clock-meta" :style="clockMetaStyle">
          <div v-if="options.showDate">{{ dateText }}</div>
          <div v-if="options.showLunarDate">{{ lunarDateText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Close, Lock } from '@element-plus/icons-vue'

const locked = ref(false)
const now = ref(new Date())
const options = reactive({
  backgroundColor: 'rgba(0, 0, 0, 0)',
  fontColor: '#111827',
  fontFamily: 'system',
  fontWeight: 700,
  fontStyle: 'normal',
  fontSize: 48,
  letterSpacing: 0,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  rotate: 0,
  textShadowEnabled: true,
  textShadowColor: 'rgba(15, 23, 42, 0.16)',
  textShadowX: 0,
  textShadowY: 10,
  textShadowBlur: 28,
  format: '24',
  showDate: false,
  showLunarDate: false,
})
let timer = null
let disposeOptions = null

const timeText = computed(() => formatTime(now.value, options.format))
const dateText = computed(() => formatDate(now.value))
const lunarDateText = computed(() => formatLunarDate(now.value))
const overlayStyle = computed(() => ({
  background: options.backgroundColor,
  color: options.fontColor,
}))
const clockContentStyle = computed(() => ({
  fontFamily: options.fontFamily === 'system' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : options.fontFamily,
  fontStyle: options.fontStyle,
  textShadow: options.textShadowEnabled ? `${options.textShadowX}px ${options.textShadowY}px ${options.textShadowBlur}px ${options.textShadowColor}` : 'none',
  transform: `scale(${options.scaleX}, ${options.scaleY}) skewX(${options.skewX}deg) rotate(${options.rotate}deg)`,
}))
const clockTimeStyle = computed(() => ({
  fontWeight: options.fontWeight,
  fontSize: `${options.fontSize}px`,
  letterSpacing: `${options.letterSpacing}px`,
}))
const clockMetaStyle = computed(() => ({
  fontSize: `${Math.max(12, Math.round(Number(options.fontSize || 48) * 0.28))}px`,
  fontWeight: Math.min(Number(options.fontWeight || 700), 600),
}))

onMounted(() => {
  document.documentElement.classList.add('overlay-transparent-root')
  document.body.classList.add('overlay-transparent-root')
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
  disposeOptions = window.electronAPI?.onClockWindowOptions?.((nextOptions) => {
    const next = nextOptions || {}
    Object.assign(options, next)
    if (typeof next.locked === 'boolean') locked.value = next.locked
  })
  loadSavedConfig()
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  disposeOptions?.()
  document.documentElement.classList.remove('overlay-transparent-root')
  document.body.classList.remove('overlay-transparent-root')
})

function unlock() {
  locked.value = false
}

function lockWindow() {
  locked.value = true
}

function closeWindow() {
  window.electronAPI?.closeCurrentWindow?.()
}

function formatTime(date, format) {
  let hours = date.getHours()
  const suffix = hours >= 12 ? 'PM' : 'AM'
  if (format === '12') hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}${format === '12' ? ` ${suffix}` : ''}`
}

function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}

function formatLunarDate(date) {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).formatToParts(date)
    const yearName = parts.find((part) => part.type === 'yearName')?.value || ''
    const month = parts.find((part) => part.type === 'month')?.value || ''
    const day = lunarDayName(parts.find((part) => part.type === 'day')?.value)
    return ['农历', yearName ? `${yearName}年` : '', month, day].filter(Boolean).join(' ')
  } catch {
    return ''
  }
}

function lunarDayName(day) {
  const value = Number(day)
  const names = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
  return names[value - 1] || String(day || '')
}

async function loadSavedConfig() {
  const config = await window.electronAPI?.getClockWindowConfig?.()
  if (!config) return
  Object.assign(options, config)
  locked.value = Boolean(config.locked)
}

watch(locked, (value) => {
  window.electronAPI?.setClockWindowLocked?.(value)
})
</script>

<style scoped>
.clock-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  border-radius: 12px;
  user-select: none;
  background: transparent;
}

.clock-stage {
  position: absolute;
  inset: 0;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  z-index: 1;
}

.clock-content {
  padding: 12px 18px;
  text-align: center;
  transform-origin: center;
}

.clock-content.draggable {
  -webkit-app-region: drag;
}

.clock-time {
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.clock-meta {
  display: grid;
  gap: 3px;
  margin-top: 8px;
  line-height: 1.25;
  opacity: 0.82;
}

.clock-toolbar {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 100;
  display: flex;
  gap: 4px;
  opacity: 0.68;
  transition: opacity 160ms ease;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.clock-toolbar,
.clock-toolbar * {
  -webkit-app-region: no-drag;
}

.clock-overlay:hover .clock-toolbar {
  opacity: 1;
}

.clock-overlay.locked .clock-toolbar {
  display: none;
}

.clock-tool-button {
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
  font-size: 14px;
  line-height: 1;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.clock-tool-button:hover {
  background: rgba(224, 242, 254, 0.9);
}

.clock-tool-icon {
  width: 14px;
  height: 14px;
  font-size: 14px;
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
</style>
