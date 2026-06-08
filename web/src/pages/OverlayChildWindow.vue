<template>
  <div class="child-overlay" :class="{ locked: options.locked, preview: isPreview }" :style="overlayStyle" @dblclick="unlockWindow">
    <div v-if="!options.locked && !isPreview" class="drag-layer"></div>
    <div v-if="!options.locked && !isPreview" class="toolbar" @mousedown.stop @click.stop @dblclick.stop>
      <button class="tool-button" type="button" title="锁定" @click="lockWindow">
        <el-icon><Lock /></el-icon>
      </button>
      <button class="tool-button" type="button" title="关闭" @click="closeWindow">
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <div class="component-stack">
      <section
        v-for="component in orderedComponents"
        :key="component.type"
        class="component-stage"
        :class="`component-${component.type}`"
        :style="componentStageStyle(component)"
      >
        <div v-if="component.type === 'clock'" class="clock-stage" :style="clockStageStyle">
          <div class="clock-content" :style="clockContentStyle">
            <div class="clock-time" :style="clockTimeStyle">{{ timeText }}</div>
            <div v-if="options.clock.showDate || options.clock.showLunarDate" class="clock-meta" :style="clockMetaStyle">
              <div v-if="options.clock.showDate">{{ dateText }}</div>
              <div v-if="options.clock.showLunarDate">{{ lunarDateText }}</div>
            </div>
          </div>
        </div>

        <div v-else-if="component.type === 'weather'" class="weather-stage">
          <div class="weather-card" :style="weatherTextStyle">
        <div class="weather-location">{{ options.weather.locationName || '天气' }}</div>
        <div v-if="weatherState.source" class="weather-source">{{ weatherState.source }}</div>
        <div v-if="weatherState.loading" class="weather-muted">天气加载中...</div>
            <div v-else-if="weatherState.error" class="weather-muted">{{ weatherState.error }}</div>
            <template v-else-if="weatherState.current">
              <div class="weather-main">
                <span class="weather-icon" v-html="weatherIconSvg(weatherState.current.description)"></span>
                <span class="weather-temp">{{ Math.round(weatherState.current.temperature) }}°</span>
                <span class="weather-desc">{{ weatherState.current.description }}</span>
              </div>
              <div class="weather-meta">
                <span v-if="options.weather.showDailyRange && weatherState.daily">高 {{ Math.round(weatherState.daily.max) }}° / 低 {{ Math.round(weatherState.daily.min) }}°</span>
                <span v-if="options.weather.showApparent">体感 {{ Math.round(weatherState.current.apparent) }}°</span>
                <span v-if="options.weather.showHumidity">湿度 {{ Math.round(weatherState.current.humidity) }}%</span>
                <span v-if="options.weather.showWind">风 {{ Math.round(weatherState.current.windSpeed) }} km/h</span>
              </div>
            </template>
          </div>
        </div>

        <div v-else-if="component.type === 'live2d'" class="live2d-stage">
          <div v-if="loading" class="status">Loading Live2D...</div>
          <div v-if="errorMessage" class="status error">{{ errorMessage }}</div>
        </div>

        <div v-else-if="component.type === 'alarm'" class="utility-stage">
          <div class="utility-card" :class="{ ringing: alarmState.ringing }" :style="utilityCardStyle">
            <div class="utility-label">闹钟</div>
            <div class="utility-time">{{ alarmDisplay }}</div>
            <div class="utility-actions" v-if="alarmState.ringing && !isPreview" @mousedown.stop @click.stop @dblclick.stop>
              <button class="utility-button" type="button" @click="dismissAlarm">停止</button>
            </div>
            <div class="utility-message">{{ alarmState.ringing ? alarmState.message : (options.alarm.enabled ? '等待中' : '未启用') }}</div>
          </div>
        </div>

        <div v-else-if="component.type === 'stopwatch'" class="utility-stage">
          <div class="utility-card" :class="{ ringing: stopwatchState.ringing }" :style="utilityCardStyle">
            <div class="utility-label">秒表</div>
            <div class="utility-time">{{ stopwatchDisplay }}</div>
            <div class="utility-actions" v-if="!isPreview" @mousedown.stop @click.stop @dblclick.stop>
              <button class="utility-button" type="button" @click="toggleStopwatch">{{ stopwatchState.running ? '暂停' : '开始' }}</button>
              <button class="utility-button" type="button" @click="resetStopwatch">重置</button>
            </div>
            <div class="utility-message">{{ stopwatchState.ringing ? options.stopwatch.message : (options.stopwatch.enabled ? '倒计时' : '未启用') }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Close, Lock } from '@element-plus/icons-vue'

const DEFAULT_WIDGET_URL = '/vendor/live2d-widget/local-autoload.js'
const FALLBACK_API_BASE_URL = window.electronAPI?.apiBaseUrl || import.meta.env.VITE_API_BASE || `${window.location.origin}/api`
const now = ref(new Date())
const loading = ref(false)
const errorMessage = ref('')
const options = reactive({
  locked: false,
  showClock: true,
  showLive2d: true,
  showWeather: false,
  showAlarm: false,
  showStopwatch: false,
  apiBaseUrl: '',
  components: [
    { type: 'clock', height: 112 },
    { type: 'live2d', height: 360 },
  ],
  common: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    fontColor: '#111827',
    fontFamily: 'system',
    fontWeight: 700,
    fontStyle: 'normal',
    fontSize: 48,
  },
  clock: {
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
    style: {
      fontColor: '',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundOpacity: 0,
      shadowColor: 'rgba(15, 23, 42, 0.16)',
    },
  },
  live2d: {
    widgetUrl: DEFAULT_WIDGET_URL,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 100,
    modelId: 0,
    textureId: 0,
  },
  weather: {
    locationName: '上海',
    latitude: 31.2304,
    longitude: 121.4737,
    nmcStationId: 'Wqsps',
    refreshMinutes: 15,
    position: 'top-left',
    showApparent: true,
    showHumidity: true,
    showWind: true,
    showDailyRange: true,
    style: {
      fontColor: '',
      backgroundColor: 'rgba(255, 255, 255, 0.72)',
      backgroundOpacity: 72,
      shadowEnabled: true,
      shadowColor: 'rgba(15, 23, 42, 0.12)',
      shadowX: 0,
      shadowY: 16,
      shadowBlur: 42,
    },
  },
  alarm: {
    enabled: false,
    time: '08:00',
    message: '闹钟时间到',
    items: [{ time: '08:00', note: '闹钟时间到', repeat: 'daily', date: todayString(), weekdays: [1, 2, 3, 4, 5], dayOfMonth: 1, soundPath: '' }],
    soundEnabled: true,
    soundPath: '',
  },
  stopwatch: {
    enabled: false,
    autoStart: false,
    durationSeconds: 300,
    message: '秒表时间到',
    soundEnabled: true,
    soundPath: '',
  },
})
const weatherState = reactive({
  loading: false,
  error: '',
  current: null,
  daily: null,
  source: '',
})
let timer = null
let weatherTimer = null
let alarmLastTriggerKey = ''
let disposeOptions = null
let disposeReminderAction = null
let activeScript = null
let activeAlertAudio = null
let activeAlert = null
let snoozeTimer = null
let reloadToken = 0
let weatherRequestToken = 0
const isPreview = window.location.pathname.includes('/preview-child-window')

const timeText = computed(() => formatTime(now.value, options.clock.format))
const dateText = computed(() => formatDate(now.value))
const lunarDateText = computed(() => formatLunarDate(now.value))
const overlayStyle = computed(() => ({
  background: options.common.backgroundColor,
  color: options.common.fontColor,
}))
const clockContentStyle = computed(() => ({
  fontFamily: options.common.fontFamily === 'system' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : options.common.fontFamily,
  fontStyle: options.common.fontStyle,
  textShadow: options.clock.textShadowEnabled ? `${options.clock.textShadowX}px ${options.clock.textShadowY}px ${options.clock.textShadowBlur}px ${options.clock.style?.shadowColor || options.clock.textShadowColor}` : 'none',
  transform: `scale(${options.clock.scaleX}, ${options.clock.scaleY}) skewX(${options.clock.skewX}deg) rotate(${options.clock.rotate}deg)`,
}))
const clockTimeStyle = computed(() => ({
  fontWeight: options.common.fontWeight,
  fontSize: `${options.common.fontSize}px`,
  color: options.clock.style?.fontColor || options.common.fontColor,
  letterSpacing: `${options.clock.letterSpacing}px`,
}))
const clockMetaStyle = computed(() => ({
  color: options.clock.style?.fontColor || options.common.fontColor,
  fontSize: `${Math.max(12, Math.round(Number(options.common.fontSize || 48) * 0.28))}px`,
  fontWeight: Math.min(Number(options.common.fontWeight || 700), 600),
}))
const clockStageStyle = computed(() => ({
  background: options.clock.style?.backgroundColor || 'transparent',
}))
const weatherTextStyle = computed(() => ({
  fontFamily: options.common.fontFamily === 'system' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : options.common.fontFamily,
  color: options.weather.style?.fontColor || options.common.fontColor,
  background: options.weather.style?.backgroundColor || 'rgba(255, 255, 255, 0.72)',
  boxShadow: options.weather.style?.shadowEnabled === false ? 'none' : `${options.weather.style?.shadowX ?? 0}px ${options.weather.style?.shadowY ?? 16}px ${options.weather.style?.shadowBlur ?? 42}px ${options.weather.style?.shadowColor || 'rgba(15, 23, 42, 0.12)'}`,
}))
const utilityCardStyle = computed(() => ({
  fontFamily: options.common.fontFamily === 'system' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : options.common.fontFamily,
  color: options.common.fontColor,
}))
const orderedComponents = computed(() => normalizeComponents(options.components, options))
const stopwatchState = reactive({
  running: false,
  remainingSeconds: 300,
  ringing: false,
})
const alarmState = reactive({
  ringing: false,
  message: '',
})
const stopwatchDisplay = computed(() => formatDuration(stopwatchState.remainingSeconds))
const alarmItems = computed(() => normalizeAlarmItems(options.alarm))
const alarmDisplay = computed(() => {
  const items = alarmItems.value
  if (!items.length) return '--:--'
  return items.length === 1 ? items[0].time : `${items[0].time} +${items.length - 1}`
})

onMounted(() => {
  document.documentElement.classList.add('overlay-transparent-root')
  document.body.classList.add('overlay-transparent-root')
  timer = window.setInterval(() => {
    now.value = new Date()
    checkAlarm()
    tickStopwatch()
  }, 1000)
  if (isPreview) {
    window.addEventListener('message', handlePreviewMessage)
    window.parent?.postMessage({ type: 'ran-pak-child-preview-ready' }, '*')
    return
  }
  disposeOptions = window.electronAPI?.onChildWindowOptions?.((nextOptions) => {
    const shouldReload = shouldReloadLive2d(nextOptions || {})
    mergeOptions(nextOptions || {})
    refreshWeatherNow()
    syncStopwatchFromOptions(false)
    if (!options.showLive2d) cleanupWidget()
    else if (shouldReload) reloadWidget()
    else window.setTimeout(applyWidgetLayout, 0)
  })
  disposeReminderAction = window.electronAPI?.onReminderWindowAction?.(handleReminderAction)
  loadSavedConfig()
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  stopWeatherTimer()
  clearSnoozeTimer()
  stopAlertSound()
  disposeOptions?.()
  disposeReminderAction?.()
  if (isPreview) window.removeEventListener('message', handlePreviewMessage)
  cleanupWidget()
  document.documentElement.classList.remove('overlay-transparent-root')
  document.body.classList.remove('overlay-transparent-root')
})

async function loadSavedConfig() {
  const config = await window.electronAPI?.getChildWindowConfig?.()
  if (config) mergeOptions(config)
  refreshWeatherNow()
  syncStopwatchFromOptions(true)
  if (options.showLive2d) reloadWidget()
  else window.setTimeout(applyWidgetLayout, 0)
}

function handlePreviewMessage(event) {
  const payload = event.data || {}
  if (payload.type !== 'ran-pak-child-preview-options') return
  const nextOptions = payload.options || {}
  const shouldReload = shouldReloadLive2d(nextOptions)
  mergeOptions(nextOptions)
  refreshWeatherNow()
  syncStopwatchFromOptions(true)
  if (!options.showLive2d) cleanupWidget()
  else if (shouldReload) reloadWidget()
  else scheduleWidgetLayout()
}

function mergeOptions(next) {
  const oldClock = next.clock || {}
  Object.assign(options, {
    ...next,
    common: {
      ...options.common,
      backgroundColor: oldClock.backgroundColor || options.common.backgroundColor,
      fontColor: oldClock.fontColor || options.common.fontColor,
      fontFamily: oldClock.fontFamily || options.common.fontFamily,
      fontWeight: oldClock.fontWeight ?? options.common.fontWeight,
      fontStyle: oldClock.fontStyle || options.common.fontStyle,
      fontSize: oldClock.fontSize ?? options.common.fontSize,
      ...(next.common || {}),
    },
    clock: { ...options.clock, ...(next.clock || {}), style: { ...(options.clock.style || {}), ...(next.clock?.style || {}) } },
    live2d: { ...options.live2d, ...(next.live2d || {}) },
    weather: { ...options.weather, ...(next.weather || {}), style: { ...(options.weather.style || {}), ...(next.weather?.style || {}) } },
    alarm: { ...options.alarm, ...(next.alarm || {}) },
    stopwatch: { ...options.stopwatch, ...(next.stopwatch || {}) },
  })
  options.components = normalizeComponents(next.components || options.components, options)
  options.showClock = options.components.some((component) => component.type === 'clock')
  options.showLive2d = options.components.some((component) => component.type === 'live2d')
  options.showWeather = options.components.some((component) => component.type === 'weather')
  options.showAlarm = options.components.some((component) => component.type === 'alarm')
  options.showStopwatch = options.components.some((component) => component.type === 'stopwatch')
}

function normalizeComponents(components, fallback = {}) {
  const rules = {
    clock: { min: 64, max: 260, height: 112 },
    live2d: { min: 160, max: 900, height: 360 },
    weather: { min: 96, max: 360, height: 150 },
    alarm: { min: 80, max: 220, height: 120 },
    stopwatch: { min: 80, max: 220, height: 120 },
  }
  const source = Array.isArray(components)
    ? components
    : [
        ...(fallback.showClock !== false ? [{ type: 'clock', height: 112 }] : []),
        ...(fallback.showLive2d !== false ? [{ type: 'live2d', height: 360 }] : []),
        ...(fallback.showWeather ? [{ type: 'weather', height: 150 }] : []),
        ...(fallback.showAlarm ? [{ type: 'alarm', height: 120 }] : []),
        ...(fallback.showStopwatch ? [{ type: 'stopwatch', height: 120 }] : []),
      ]
  const seen = new Set()
  return source
    .map((component) => {
      const type = typeof component === 'string' ? component : component?.type
      const rule = rules[type]
      if (!rule || seen.has(type)) return null
      seen.add(type)
      const height = Math.min(Math.max(Number(component?.height || rule.height), rule.min), rule.max)
      return { type, height }
    })
    .filter(Boolean)
}

function componentStageStyle(component) {
  return {
    height: `${component.height}px`,
  }
}

function refreshWeatherNow() {
  stopWeatherTimer()
  if (!options.showWeather) {
    weatherState.loading = false
    weatherState.error = ''
    return
  }
  fetchWeather()
  const minutes = Math.max(5, Number(options.weather.refreshMinutes || 15))
  weatherTimer = window.setInterval(fetchWeather, minutes * 60 * 1000)
}

function stopWeatherTimer() {
  if (weatherTimer) window.clearInterval(weatherTimer)
  weatherTimer = null
}

async function fetchWeather() {
  const latitude = Number(options.weather.latitude)
  const longitude = Number(options.weather.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    weatherState.error = '经纬度无效'
    return
  }
  const token = ++weatherRequestToken
  const hasWeatherData = Boolean(weatherState.current)
  weatherState.loading = !hasWeatherData
  if (!hasWeatherData) weatherState.error = ''
  try {
    const data = await requestWeatherForecast(latitude, longitude)
    if (token !== weatherRequestToken) return
    weatherState.current = {
      temperature: Number(data.current?.temperature_2m ?? 0),
      apparent: Number(data.current?.apparent_temperature ?? 0),
      humidity: Number(data.current?.relative_humidity_2m ?? 0),
      windSpeed: Number(data.current?.wind_speed_10m ?? 0),
      description: data.current?.weather_text || weatherCodeText(data.current?.weather_code),
    }
    weatherState.daily = {
      max: Number(data.daily?.temperature_2m_max?.[0] ?? weatherState.current.temperature),
      min: Number(data.daily?.temperature_2m_min?.[0] ?? weatherState.current.temperature),
    }
    weatherState.source = data.source === 'nmc' ? '中央气象台' : 'Open-Meteo'
    weatherState.error = ''
  } catch (error) {
    if (token !== weatherRequestToken) return
    if (!hasWeatherData) {
      weatherState.error = error?.message || '天气暂不可用'
      weatherState.source = ''
    }
  } finally {
    if (token === weatherRequestToken) weatherState.loading = false
  }
}

async function requestWeatherForecast(latitude, longitude) {
  if (window.electronAPI?.weather?.forecast) {
    const result = await window.electronAPI.weather.forecast({ latitude, longitude, nmcStationId: options.weather.nmcStationId })
    if (result?.ok === false) throw new Error(result.error || '天气暂不可用')
    return result?.data || result
  }
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m')
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min')
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('timezone', 'auto')
  const response = await fetch(url.toString())
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

function shouldReloadLive2d(next) {
  if (typeof next.showLive2d === 'boolean' && next.showLive2d !== options.showLive2d) return true
  const live2d = next.live2d || {}
  const hasWaifu = Boolean(document.querySelector('#waifu'))
  return (
    Boolean(options.showLive2d && !hasWaifu) ||
    normalizeWidgetUrl(live2d.widgetUrl || options.live2d.widgetUrl) !== normalizeWidgetUrl(options.live2d.widgetUrl) ||
    Number(live2d.modelId ?? options.live2d.modelId) !== Number(options.live2d.modelId) ||
    Number(live2d.textureId ?? options.live2d.textureId) !== Number(options.live2d.textureId)
  )
}

function reloadWidget() {
  cleanupWidget()
  if (!options.showLive2d) return
  const token = ++reloadToken
  loading.value = true
  errorMessage.value = ''
  window.RAN_PAK_LIVE2D_CONFIG = {
    baseUrl: live2dAssetBaseUrl(),
    catalogUrl: withReloadParam(apiUrl('/live2d/catalog'), token),
    modelId: normalizeIndex(options.live2d.modelId),
    textureId: normalizeIndex(options.live2d.textureId),
  }
  window.localStorage.setItem('modelId', String(window.RAN_PAK_LIVE2D_CONFIG.modelId))
  window.localStorage.setItem('modelTexturesId', String(window.RAN_PAK_LIVE2D_CONFIG.textureId))
  if (normalizeWidgetUrl(options.live2d.widgetUrl) === DEFAULT_WIDGET_URL && typeof window.RAN_PAK_INIT_LIVE2D === 'function') {
    delete window.__RAN_PAK_LIVE2D_LAST_KEY__
    window.RAN_PAK_INIT_LIVE2D()
      .then(() => {
        if (token !== reloadToken) return
        loading.value = false
        scheduleWidgetLayout()
      })
      .catch(() => {
        if (token !== reloadToken) return
        loading.value = false
        errorMessage.value = 'Live2D 加载失败'
      })
    return
  }

  const script = document.createElement('script')
  script.src = withReloadParam(normalizeWidgetUrl(options.live2d.widgetUrl), token)
  script.async = true
  script.onload = () => {
    if (token !== reloadToken) return
    loading.value = false
    scheduleWidgetLayout()
  }
  script.onerror = () => {
    if (token !== reloadToken) return
    loading.value = false
    errorMessage.value = 'Live2D 加载失败'
  }
  activeScript = script
  document.body.appendChild(script)
}

function normalizeWidgetUrl(url) {
  const value = String(url || '')
  if (!value || value.includes('live2d-widgets@1.0.1')) return DEFAULT_WIDGET_URL
  return value
}

function cleanupWidget() {
  reloadToken += 1
  loading.value = false
  activeScript?.remove()
  activeScript = null
  document.querySelectorAll('#waifu, #waifu-toggle, #live2d-widget, .waifu').forEach((node) => node.remove())
}

function applyWidgetLayout() {
  const waifu = document.querySelector('#waifu')
  if (!waifu) return
  const live2d = document.querySelector('#live2d')
  const tips = document.querySelector('#waifu-tips')
  const tool = document.querySelector('#waifu-tool')
  const live2dStage = document.querySelector('.component-live2d')
  const rect = live2dStage?.getBoundingClientRect()
  const availableHeight = Math.max(160, rect?.height || window.innerHeight)
  const availableWidth = Math.max(160, rect?.width || window.innerWidth)
  const modelSize = Math.floor(Math.min(availableWidth, availableHeight, isPreview ? 220 : 380))
  waifu.style.position = 'fixed'
  waifu.style.left = `${(rect?.left || 0) + availableWidth / 2}px`
  waifu.style.right = 'auto'
  waifu.style.top = `${(rect?.top || 0) + availableHeight - modelSize}px`
  waifu.style.bottom = 'auto'
  waifu.style.transform = 'translateX(-50%)'
  waifu.style.zIndex = '20'
  waifu.style.pointerEvents = 'auto'
  waifu.style.maxWidth = `${availableWidth}px`
  waifu.style.maxHeight = `${availableHeight}px`
  waifu.style.opacity = String(Math.max(0.2, Math.min(1, Number(options.live2d.opacity || 100) / 100)))
  if (tips) tips.style.display = 'none'
  if (tool) tool.style.display = 'none'
  if (live2d) {
    live2d.style.width = `${modelSize}px`
    live2d.style.height = `${modelSize}px`
  }
}

function scheduleWidgetLayout() {
  ;[80, 240, 600, 1000].forEach((delay) => {
    window.setTimeout(applyWidgetLayout, delay)
  })
}

function withReloadParam(url, token) {
  const rawUrl = String(url || '')
  const nextUrl = new URL(url, window.location.href)
  nextUrl.searchParams.set('rpv', String(token))
  return /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
    ? nextUrl.href
    : nextUrl.pathname + nextUrl.search + nextUrl.hash
}

function currentApiBaseUrl() {
  return String(options.apiBaseUrl || FALLBACK_API_BASE_URL || `${window.location.origin}/api`)
}

function apiUrl(path) {
  return `${currentApiBaseUrl().replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`
}

function backendUrl(path) {
  const apiBase = new URL(currentApiBaseUrl(), window.location.href)
  return `${apiBase.origin}/${String(path || '').replace(/^\/+/, '')}`
}

function live2dAssetBaseUrl() {
  return backendUrl('/live2d-assets/')
}

function checkAlarm() {
  if (!options.showAlarm || !options.alarm.enabled) {
    alarmState.ringing = false
    alarmState.message = ''
    clearSnoozeTimer()
    stopAlertSound()
    return
  }
  const currentTime = `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`
  const matched = alarmItems.value.find((item) => item.time === currentTime && matchesAlarmSchedule(item, now.value))
  if (!matched) return
  const triggerKey = `${dateString(now.value)} ${matched.time} ${matched.note} ${matched.repeat}`
  if (alarmLastTriggerKey !== triggerKey) {
    alarmLastTriggerKey = triggerKey
    alarmState.ringing = true
    alarmState.message = matched.note || '闹钟时间到'
    triggerAlert({
      id: triggerKey,
      kind: 'alarm',
      title: '闹钟提醒',
      message: alarmState.message,
      timeText: matched.time,
      soundEnabled: options.alarm.soundEnabled,
      soundPath: matched.soundPath || options.alarm.soundPath,
    })
  }
}

function normalizeAlarmItems(alarm = {}) {
  const source = Array.isArray(alarm.items) && alarm.items.length
    ? alarm.items
    : [{ time: alarm.time || '08:00', note: alarm.message || '闹钟时间到', repeat: 'daily', soundPath: alarm.soundPath || '' }]
  return source
    .map((item) => ({
      time: /^\d{2}:\d{2}$/.test(String(item.time || '')) ? String(item.time) : '',
      note: String(item.note ?? item.message ?? '').trim(),
      repeat: ['once', 'daily', 'weekly', 'monthly'].includes(item.repeat) ? item.repeat : 'daily',
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : todayString(),
      weekdays: Array.isArray(item.weekdays) && item.weekdays.length ? item.weekdays.map(Number).filter((day) => day >= 0 && day <= 6) : [1, 2, 3, 4, 5],
      dayOfMonth: Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31),
      soundPath: String(item.soundPath || ''),
    }))
    .filter((item) => item.time)
}

function matchesAlarmSchedule(item, date) {
  if (item.repeat === 'once') return item.date === dateString(date)
  if (item.repeat === 'weekly') return item.weekdays.includes(date.getDay())
  if (item.repeat === 'monthly') return Number(item.dayOfMonth) === date.getDate()
  return true
}

function dateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayString() {
  return dateString(new Date())
}

function syncStopwatchFromOptions(allowAutoStart) {
  const duration = Math.max(1, Number(options.stopwatch.durationSeconds || 1))
  if (!options.showStopwatch || !options.stopwatch.enabled) {
    stopwatchState.running = false
    stopwatchState.ringing = false
    stopAlertSound()
    stopwatchState.remainingSeconds = duration
    return
  }
  if (stopwatchState.remainingSeconds <= 0 || stopwatchState.remainingSeconds > duration) {
    stopwatchState.remainingSeconds = duration
  }
  if (allowAutoStart && options.stopwatch.autoStart && !stopwatchState.ringing) {
    stopwatchState.running = true
  }
}

function tickStopwatch() {
  if (!options.showStopwatch || !options.stopwatch.enabled || !stopwatchState.running || stopwatchState.ringing) return
  stopwatchState.remainingSeconds = Math.max(0, stopwatchState.remainingSeconds - 1)
  if (stopwatchState.remainingSeconds === 0) {
    stopwatchState.running = false
    stopwatchState.ringing = true
    triggerAlert({
      id: `stopwatch ${Date.now()}`,
      kind: 'stopwatch',
      title: '秒表提醒',
      message: options.stopwatch.message,
      timeText: formatDuration(options.stopwatch.durationSeconds),
      soundEnabled: options.stopwatch.soundEnabled,
      soundPath: options.stopwatch.soundPath,
    })
  }
}

function toggleStopwatch() {
  if (!options.stopwatch.enabled) return
  if (stopwatchState.ringing || stopwatchState.remainingSeconds <= 0) resetStopwatch()
  stopwatchState.running = !stopwatchState.running
}

function resetStopwatch() {
  stopwatchState.running = false
  stopwatchState.ringing = false
  stopAlertSound()
  stopwatchState.remainingSeconds = Math.max(1, Number(options.stopwatch.durationSeconds || 1))
}

function triggerAlert(payload) {
  if (isPreview) return
  const alertPayload = typeof payload === 'string'
    ? { id: String(Date.now()), kind: 'alarm', title: '提醒', message: payload, soundEnabled: true, soundPath: '' }
    : payload
  activeAlert = {
    id: String(alertPayload.id || Date.now()),
    kind: alertPayload.kind === 'stopwatch' ? 'stopwatch' : 'alarm',
    message: String(alertPayload.message || '时间到'),
    soundEnabled: alertPayload.soundEnabled !== false,
    soundPath: String(alertPayload.soundPath || ''),
  }
  unlockForAlert()
  stopAlertSound()
  if (activeAlert.soundEnabled) playAlertSound(activeAlert.soundPath)
  window.electronAPI?.openReminderWindow?.({
    id: activeAlert.id,
    kind: activeAlert.kind,
    title: alertPayload.title || (activeAlert.kind === 'stopwatch' ? '秒表提醒' : '闹钟提醒'),
    message: activeAlert.message,
    timeText: alertPayload.timeText || '',
    createdAt: Date.now(),
  })
  if (activeAlert.message && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(activeAlert.message)
  }
}

function dismissAlarm() {
  alarmState.ringing = false
  stopAlertSound()
}

function dismissStopwatchAlert() {
  stopwatchState.ringing = false
  stopAlertSound()
}

function handleReminderAction(payload = {}) {
  if (!payload.id || !activeAlert || payload.id !== activeAlert.id) return
  if (payload.action === 'snooze' && activeAlert.kind === 'alarm') {
    snoozeActiveAlert()
    return
  }
  if (payload.action === 'restart' && activeAlert.kind === 'stopwatch') {
    resetStopwatch()
    stopwatchState.running = Boolean(options.stopwatch.enabled)
    activeAlert = null
    return
  }
  if (activeAlert.kind === 'alarm') dismissAlarm()
  else dismissStopwatchAlert()
  activeAlert = null
}

function snoozeActiveAlert() {
  if (!activeAlert) return
  const snoozed = { ...activeAlert, id: `${activeAlert.id}:snooze:${Date.now()}` }
  alarmState.ringing = false
  stopAlertSound()
  activeAlert = null
  clearSnoozeTimer()
  snoozeTimer = window.setTimeout(() => {
    alarmState.ringing = true
    alarmState.message = snoozed.message
    triggerAlert({
      ...snoozed,
      title: '闹钟提醒',
      timeText: '稍后提醒',
    })
  }, 5 * 60 * 1000)
}

function clearSnoozeTimer() {
  if (snoozeTimer) window.clearTimeout(snoozeTimer)
  snoozeTimer = null
}

function unlockForAlert() {
  if (!options.locked) return
  options.locked = false
  window.electronAPI?.setChildWindowLocked?.(false)
}

async function playAlertSound(soundPath = '') {
  if (await playCustomAlertSound(soundPath)) return
  playBuiltinAlertSound()
}

async function playCustomAlertSound(soundPath = '') {
  const fileUrl = await window.electronAPI?.alarmSoundDataUrl?.(soundPath)
  if (!fileUrl) return false
  try {
    const audio = new Audio(fileUrl)
    audio.loop = true
    audio.volume = 0.9
    activeAlertAudio = audio
    audio.play().catch(() => {
      if (activeAlertAudio === audio) {
        activeAlertAudio = null
        playBuiltinAlertSound()
      }
    })
    return true
  } catch {
    activeAlertAudio = null
    return false
  }
}

function stopAlertSound() {
  if (!activeAlertAudio) return
  activeAlertAudio.pause()
  activeAlertAudio.currentTime = 0
  activeAlertAudio = null
}

function playBuiltinAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const context = new AudioContext()
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.24, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8)
    gain.connect(context.destination)
    ;[0, 0.22, 0.44].forEach((offset) => {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, context.currentTime + offset)
      oscillator.connect(gain)
      oscillator.start(context.currentTime + offset)
      oscillator.stop(context.currentTime + offset + 0.14)
    })
    window.setTimeout(() => context.close(), 1000)
  } catch {
    // Audio can be unavailable in preview or restricted environments.
  }
}

function formatDuration(totalSeconds) {
  const total = Math.max(0, Number.parseInt(totalSeconds, 10) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function lockWindow() {
  options.locked = true
  window.electronAPI?.setChildWindowLocked?.(true)
}

function unlockWindow() {
  if (!options.locked) return
  options.locked = false
  window.electronAPI?.setChildWindowLocked?.(false)
}

function closeWindow() {
  window.electronAPI?.closeCurrentWindow?.()
}

function normalizeIndex(value) {
  const index = Number.parseInt(value, 10)
  return Number.isFinite(index) ? Math.max(0, index) : 0
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

function weatherCodeText(code) {
  const value = Number(code)
  const map = {
    0: '晴',
    1: '大部晴朗',
    2: '局部多云',
    3: '阴',
    45: '雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '强毛毛雨',
    56: '冻毛毛雨',
    57: '强冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '强冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '小阵雨',
    81: '阵雨',
    82: '强阵雨',
    85: '小阵雪',
    86: '强阵雪',
    95: '雷暴',
    96: '雷暴冰雹',
    99: '强雷暴冰雹',
  }
  return map[value] || '未知'
}

function weatherIconSvg(text) {
  const value = String(text || '')
  if (value.includes('雷')) return iconThunder()
  if (value.includes('雪')) return iconSnow()
  if (value.includes('雨')) return iconRain()
  if (value.includes('雾') || value.includes('霾')) return iconFog()
  if (value.includes('阴')) return iconCloud()
  if (value.includes('云')) return iconPartlyCloudy()
  if (value.includes('晴')) return iconSun()
  return iconThermometer()
}

function svgIcon(body) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`
}

function iconSun() {
  return svgIcon(`
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="24" cy="24" r="8" fill="rgba(251, 191, 36, 0.28)"></circle>
      <path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.6 3.6M33.8 33.8l3.6 3.6M37.4 10.6l-3.6 3.6M14.2 33.8l-3.6 3.6"></path>
    </g>
  `)
}

function iconCloud() {
  return svgIcon(`
    <path d="M15 36h21a8 8 0 0 0 .6-16A12 12 0 0 0 13.8 17 9.5 9.5 0 0 0 15 36Z" fill="rgba(148, 163, 184, 0.24)" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
  `)
}

function iconPartlyCloudy() {
  return svgIcon(`
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18" cy="18" r="7" fill="rgba(251, 191, 36, 0.24)"></circle>
      <path d="M18 5v4M18 27v4M5 18h4M27 18h4M8.8 8.8l2.8 2.8M24.4 24.4l2.8 2.8M27.2 8.8l-2.8 2.8"></path>
      <path d="M16 38h21a7.5 7.5 0 0 0 .5-15A11 11 0 0 0 16 22.5 8 8 0 0 0 16 38Z" fill="rgba(148, 163, 184, 0.24)"></path>
    </g>
  `)
}

function iconRain() {
  return svgIcon(`
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 29h22a7.5 7.5 0 0 0 .5-15A11 11 0 0 0 15 13.5 8 8 0 0 0 14 29Z" fill="rgba(96, 165, 250, 0.2)"></path>
      <path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5"></path>
    </g>
  `)
}

function iconSnow() {
  return svgIcon(`
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 27h22a7.5 7.5 0 0 0 .5-15A11 11 0 0 0 15 11.5 8 8 0 0 0 14 27Z" fill="rgba(125, 211, 252, 0.18)"></path>
      <path d="M18 35h.1M25 39h.1M32 35h.1M22 32h.1M29 32h.1"></path>
    </g>
  `)
}

function iconThunder() {
  return svgIcon(`
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 27h22a7.5 7.5 0 0 0 .5-15A11 11 0 0 0 15 11.5 8 8 0 0 0 14 27Z" fill="rgba(250, 204, 21, 0.18)"></path>
      <path d="M26 28l-6 10h7l-3 7 9-11h-7l3-6z" fill="rgba(250, 204, 21, 0.35)"></path>
    </g>
  `)
}

function iconFog() {
  return svgIcon(`
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 26h22a7.5 7.5 0 0 0 .5-15A11 11 0 0 0 15 10.5 8 8 0 0 0 14 26Z" fill="rgba(203, 213, 225, 0.2)"></path>
      <path d="M10 33h28M14 39h20"></path>
    </g>
  `)
}

function iconThermometer() {
  return svgIcon(`
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M25 27.5V10a5 5 0 0 0-10 0v17.5a9 9 0 1 0 10 0Z" fill="rgba(248, 113, 113, 0.18)"></path>
      <path d="M20 33V17"></path>
    </g>
  `)
}
</script>

<style scoped>
.child-overlay {
  position: fixed;
  inset: 0;
  overflow: hidden;
  border-radius: 12px;
  user-select: none;
  background: transparent;
}

.child-overlay.preview {
  border-radius: 0;
}

.drag-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  -webkit-app-region: drag;
}

.component-stack {
  position: relative;
  z-index: 10;
  display: flex;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  pointer-events: none;
}

.component-stage {
  position: relative;
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  pointer-events: none;
}

.clock-stage {
  height: 100%;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.clock-content {
  padding: 12px 18px;
  text-align: center;
  transform-origin: center;
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

.live2d-stage {
  position: relative;
  height: 100%;
  pointer-events: none;
}

.weather-stage {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  pointer-events: none;
}

.weather-card {
  min-width: 220px;
  max-width: min(360px, calc(100vw - 36px));
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  padding: 12px 14px;
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(16px);
}

.weather-location {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.72;
}

.weather-source {
  margin-top: 2px;
  font-size: 11px;
  opacity: 0.48;
}

.weather-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 2px;
}

.weather-icon {
  display: inline-grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: currentColor;
}

.weather-icon :deep(svg) {
  width: 34px;
  height: 34px;
  display: block;
}

.weather-temp {
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
}

.weather-desc {
  font-size: 15px;
  font-weight: 600;
}

.weather-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.78;
}

.weather-muted {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.72;
}

.utility-stage {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  pointer-events: none;
}

.utility-card {
  min-width: 210px;
  max-width: min(360px, calc(100vw - 36px));
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  padding: 12px 14px;
  text-align: center;
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(16px);
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.utility-card.ringing {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(254, 242, 242, 0.9);
}

.utility-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.72;
}

.utility-time {
  margin-top: 2px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.utility-message {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.72;
}

.utility-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  -webkit-app-region: no-drag;
}

.utility-button {
  border: 1px solid rgba(148, 163, 184, 0.36);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.86);
  color: #111827;
  cursor: pointer;
  padding: 3px 10px;
  font-size: 12px;
  -webkit-app-region: no-drag;
}

.toolbar {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 100;
  display: flex;
  gap: 6px;
  opacity: 0.72;
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

:global(#waifu-tool),
:global(#waifu-toggle) {
  display: none !important;
}
</style>
