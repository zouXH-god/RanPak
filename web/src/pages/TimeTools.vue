<template>
  <div class="h-full px-4 pb-4">
    <div class="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">{{ pageTitle }}</h1>
          <p class="mt-1 text-sm text-gray-500">{{ pageDescription }}</p>
        </div>
        <div class="flex gap-2">
          <el-button :type="mode === 'alarm' ? 'primary' : 'default'" @click="goMode('alarm')">闹钟</el-button>
          <el-button :type="mode === 'timer' ? 'primary' : 'default'" @click="goMode('timer')">定时器</el-button>
        </div>
      </div>

      <section v-if="mode === 'alarm'" class="tool-panel">
        <div class="panel-header">
          <div>
            <h2>闹钟</h2>
            <p>{{ alarmStatusText }}</p>
          </div>
          <el-switch v-model="form.alarm.enabled" active-text="已启用" inactive-text="已停用" @change="saveConfig" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <el-form-item label="闹铃声音">
            <el-switch v-model="form.alarm.soundEnabled" @change="saveConfig" />
          </el-form-item>
          <el-form-item label="默认铃声文件">
            <div class="sound-picker">
              <el-input v-model="form.alarm.soundPath" placeholder="未选择时使用内置提示音" readonly />
              <el-button @click="selectSound('alarm')">选择</el-button>
              <el-button text type="danger" @click="clearSound('alarm')">清空</el-button>
            </div>
          </el-form-item>
        </div>
        <div class="alarm-list">
          <div v-for="(item, index) in form.alarm.items" :key="item.id" class="alarm-view-row">
            <button class="alarm-view-main" type="button" @click="openEditAlarmDialog(index)">
              <span class="alarm-time">{{ item.time }}</span>
              <span class="alarm-meta">
                <strong>{{ alarmRepeatText(item) }}</strong>
                <small>{{ item.note || '无备注' }}</small>
              </span>
            </button>
            <div class="alarm-view-actions">
              <el-button size="small" text @click="openEditAlarmDialog(index)">编辑</el-button>
              <el-button size="small" text type="danger" :disabled="form.alarm.items.length <= 1" @click="removeAlarmItem(index)">删除</el-button>
            </div>
          </div>
          <el-button class="!self-start" @click="openCreateAlarmDialog">添加闹钟</el-button>
        </div>
      </section>

      <section v-else class="tool-panel">
        <div class="panel-header">
          <div>
            <h2>定时器</h2>
            <p>{{ timerStatusText }}</p>
          </div>
          <el-switch v-model="form.timer.showWindow" active-text="展示窗口" inactive-text="仅主窗口" @change="handleShowWindowChange" />
        </div>
        <div class="timer-display-main" :class="{ finished: timerState.finished }">
          <div class="timer-time">{{ timerDisplay }}</div>
          <div class="timer-message">{{ timerState.finished ? form.timer.message : (timerState.running ? '倒计时中' : '已暂停') }}</div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <el-form-item label="倒计时秒数">
            <el-input-number v-model="form.timer.durationSeconds" :min="1" :max="86400" controls-position="right" @change="resetTimer" />
          </el-form-item>
          <el-form-item label="提示文字">
            <el-input v-model="form.timer.message" @change="saveConfig" />
          </el-form-item>
          <el-form-item label="闹铃声音">
            <el-switch v-model="form.timer.soundEnabled" @change="saveConfig" />
          </el-form-item>
          <el-form-item label="铃声文件">
            <div class="sound-picker">
              <el-input v-model="form.timer.soundPath" placeholder="未选择时使用内置提示音" readonly />
              <el-button @click="selectSound('timer')">选择</el-button>
              <el-button text type="danger" @click="clearSound('timer')">清空</el-button>
            </div>
          </el-form-item>
        </div>
        <div class="action-bar">
          <el-button type="primary" :disabled="timerState.running" @click="startTimer">开始倒计时</el-button>
          <el-button :disabled="!timerState.running" @click="pauseTimer">暂停</el-button>
          <el-button @click="resetTimer">重置</el-button>
          <el-button v-if="form.timer.showWindow" @click="openTimerDisplay">打开展示窗口</el-button>
        </div>
      </section>
    </div>

    <el-dialog v-model="alarmDialogVisible" :title="editingAlarmIndex >= 0 ? '编辑闹钟' : '新增闹钟'" width="560px" append-to-body>
      <el-form label-position="top">
        <div class="alarm-dialog-grid">
          <el-form-item label="时间">
            <el-time-picker v-model="alarmDraft.time" value-format="HH:mm" format="HH:mm" placeholder="选择时间" />
          </el-form-item>
          <el-form-item label="触发周期">
            <el-select v-model="alarmDraft.repeat" @change="normalizeAlarmItemSchedule(alarmDraft)">
              <el-option label="仅一次" value="once" />
              <el-option label="每天" value="daily" />
              <el-option label="每周" value="weekly" />
              <el-option label="每月" value="monthly" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="alarmDraft.repeat === 'once'" label="日期">
            <el-date-picker v-model="alarmDraft.date" value-format="YYYY-MM-DD" type="date" placeholder="选择日期" />
          </el-form-item>
          <el-form-item v-if="alarmDraft.repeat === 'monthly'" label="每月日期">
            <el-input-number v-model="alarmDraft.dayOfMonth" :min="1" :max="31" controls-position="right" />
          </el-form-item>
          <el-form-item v-if="alarmDraft.repeat === 'weekly'" label="星期" class="alarm-dialog-wide">
            <el-checkbox-group v-model="alarmDraft.weekdays">
              <el-checkbox-button v-for="day in weekdayOptions" :key="day.value" :label="day.value">周{{ day.label }}</el-checkbox-button>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item label="备注" class="alarm-dialog-wide">
            <el-input v-model="alarmDraft.note" placeholder="闹钟时间到" />
          </el-form-item>
          <el-form-item label="单独铃声" class="alarm-dialog-wide">
            <div class="sound-picker">
              <el-input v-model="alarmDraft.soundPath" placeholder="未选择时使用默认铃声" readonly />
              <el-button @click="selectAlarmDraftSound">选择</el-button>
              <el-button text type="danger" @click="alarmDraft.soundPath = ''">清空</el-button>
            </div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="alarmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAlarmDialog">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const now = ref(new Date())
let tickTimer = null
let activeAlertAudio = null
let activeAlert = null
let lastAlarmTriggerKey = ''
let disposeReminderAction = null
let alarmItemId = 1

const weekdayOptions = [
  { label: '日', value: 0 },
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
]

const form = reactive({
  alarm: {
    enabled: false,
    time: '08:00',
    message: '闹钟时间到',
    items: [{ id: 1, time: '08:00', note: '闹钟时间到', repeat: 'daily', date: todayString(), weekdays: [1, 2, 3, 4, 5], dayOfMonth: 1, soundPath: '' }],
    soundEnabled: true,
    soundPath: '',
  },
  timer: {
    enabled: false,
    autoStart: false,
    durationSeconds: 300,
    message: '定时器时间到',
    soundEnabled: true,
    soundPath: '',
    showWindow: false,
  },
})

const timerState = reactive({
  running: false,
  remainingSeconds: 300,
  finished: false,
})
const alarmDialogVisible = ref(false)
const editingAlarmIndex = ref(-1)
const alarmDraft = reactive(createAlarmItem({ id: 0, time: '08:00', note: '' }))

const mode = computed(() => route.path === '/time-tools-timer' ? 'timer' : 'alarm')
const pageTitle = computed(() => mode.value === 'timer' ? '定时器' : '闹钟')
const pageDescription = computed(() => mode.value === 'timer'
  ? '在主窗口设置、开始和暂停倒计时，可选择独立展示窗口。'
  : '在主窗口定义闹钟，不再依附于桌面部件子窗口。')
const timerDisplay = computed(() => formatDuration(timerState.remainingSeconds))
const timerStatusText = computed(() => timerState.finished ? form.timer.message : `${formatDuration(timerState.remainingSeconds)} / ${formatDuration(form.timer.durationSeconds)}`)
const alarmStatusText = computed(() => form.alarm.enabled ? `已启用 ${form.alarm.items.length} 个闹钟` : '闹钟已停用')

onMounted(() => {
  loadConfig()
  tickTimer = window.setInterval(() => {
    now.value = new Date()
    checkAlarms()
    tickCountdown()
  }, 1000)
  disposeReminderAction = window.electronAPI?.onReminderWindowAction?.(handleReminderAction)
})

onBeforeUnmount(() => {
  if (tickTimer) window.clearInterval(tickTimer)
  disposeReminderAction?.()
  stopAlertSound()
})

watch(() => form.alarm, saveConfig, { deep: true })
watch(() => form.timer, saveConfig, { deep: true })

function goMode(nextMode) {
  router.push(nextMode === 'timer' ? '/time-tools-timer' : '/time-tools-alarm')
}

async function loadConfig() {
  const config = await window.electronAPI?.getTimeToolsConfig?.()
  if (!config) return
  Object.assign(form.alarm, config.alarm || {})
  form.alarm.items = normalizeAlarmItems(form.alarm)
  Object.assign(form.timer, config.timer || config.stopwatch || {})
  timerState.remainingSeconds = Math.max(1, Number(form.timer.durationSeconds || 1))
  updateTimerDisplay()
}

function saveConfig() {
  window.electronAPI?.updateTimeToolsConfig?.(buildConfig())
  updateTimerDisplay()
}

function buildConfig() {
  const alarmItems = normalizeAlarmItems(form.alarm)
  return {
    alarm: {
      ...form.alarm,
      items: alarmItems.map(({ time, note, repeat, date, weekdays, dayOfMonth, soundPath }) => ({ time, note, repeat, date, weekdays, dayOfMonth, soundPath })),
      time: alarmItems[0]?.time || '08:00',
      message: alarmItems[0]?.note || '闹钟时间到',
      soundEnabled: Boolean(form.alarm.soundEnabled),
      soundPath: String(form.alarm.soundPath || ''),
    },
    timer: {
      ...form.timer,
      durationSeconds: Math.max(1, Number(form.timer.durationSeconds || 1)),
      message: form.timer.message || '定时器时间到',
      soundEnabled: Boolean(form.timer.soundEnabled),
      soundPath: String(form.timer.soundPath || ''),
      showWindow: Boolean(form.timer.showWindow),
    },
  }
}

function checkAlarms() {
  if (!form.alarm.enabled) return
  const currentTime = `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`
  const matched = normalizeAlarmItems(form.alarm).find((item) => item.time === currentTime && matchesAlarmSchedule(item, now.value))
  if (!matched) return
  const triggerKey = `${dateString(now.value)} ${matched.time} ${matched.note} ${matched.repeat}`
  if (lastAlarmTriggerKey === triggerKey) return
  lastAlarmTriggerKey = triggerKey
  triggerAlert({
    id: triggerKey,
    kind: 'alarm',
    title: '闹钟提醒',
    message: matched.note || '闹钟时间到',
    timeText: matched.time,
    soundEnabled: form.alarm.soundEnabled,
    soundPath: matched.soundPath || form.alarm.soundPath,
  })
}

function tickCountdown() {
  if (!timerState.running || timerState.finished) return
  timerState.remainingSeconds = Math.max(0, timerState.remainingSeconds - 1)
  updateTimerDisplay()
  if (timerState.remainingSeconds > 0) return
  timerState.running = false
  timerState.finished = true
  updateTimerDisplay()
  triggerAlert({
    id: `timer:${Date.now()}`,
    kind: 'stopwatch',
    title: '定时器提醒',
    message: form.timer.message,
    timeText: formatDuration(form.timer.durationSeconds),
    soundEnabled: form.timer.soundEnabled,
    soundPath: form.timer.soundPath,
  })
}

function startTimer() {
  if (timerState.finished || timerState.remainingSeconds <= 0) resetTimer(false)
  timerState.running = true
  timerState.finished = false
  form.timer.enabled = true
  openTimerDisplay()
  saveConfig()
}

function pauseTimer() {
  timerState.running = false
  saveConfig()
}

function resetTimer(showMessage = true) {
  timerState.running = false
  timerState.finished = false
  timerState.remainingSeconds = Math.max(1, Number(form.timer.durationSeconds || 1))
  stopAlertSound()
  saveConfig()
  if (showMessage) ElMessage.success('定时器已重置')
}

async function handleShowWindowChange() {
  saveConfig()
  if (form.timer.showWindow) await openTimerDisplay()
  else await window.electronAPI?.closeTimerDisplayWindow?.()
}

async function openTimerDisplay() {
  if (!form.timer.showWindow) return
  if (!window.electronAPI?.openTimerDisplayWindow) {
    ElMessage.error('当前运行环境无法打开展示窗口')
    return
  }
  await window.electronAPI.openTimerDisplayWindow(timerPayload())
}

function updateTimerDisplay() {
  if (!form.timer.showWindow) return
  window.electronAPI?.updateTimerDisplayWindow?.(timerPayload())
}

function timerPayload() {
  return {
    title: '定时器',
    remainingSeconds: timerState.remainingSeconds,
    totalSeconds: Math.max(1, Number(form.timer.durationSeconds || 1)),
    running: timerState.running,
    finished: timerState.finished,
    message: form.timer.message || '定时器时间到',
  }
}

async function selectSound(target) {
  const filePath = await window.electronAPI?.selectAlarmSound?.()
  if (!filePath) return
  form[target].soundPath = filePath
  form[target].soundEnabled = true
}

function clearSound(target) {
  form[target].soundPath = ''
  saveConfig()
}

async function selectAlarmDraftSound() {
  const filePath = await window.electronAPI?.selectAlarmSound?.()
  if (!filePath) return
  alarmDraft.soundPath = filePath
  form.alarm.soundEnabled = true
}

function openCreateAlarmDialog() {
  editingAlarmIndex.value = -1
  assignAlarmDraft(createAlarmItem({ id: 0, time: '08:00', note: '' }))
  alarmDialogVisible.value = true
}

function openEditAlarmDialog(index) {
  const item = form.alarm.items[index]
  if (!item) return
  editingAlarmIndex.value = index
  assignAlarmDraft(item)
  alarmDialogVisible.value = true
}

function saveAlarmDialog() {
  const item = createAlarmItem(alarmDraft)
  if (!item.time) {
    ElMessage.warning('请选择闹钟时间')
    return
  }
  if (editingAlarmIndex.value >= 0) form.alarm.items.splice(editingAlarmIndex.value, 1, item)
  else {
    alarmItemId += 1
    item.id = alarmItemId
    form.alarm.items.push(item)
  }
  alarmDialogVisible.value = false
  saveConfig()
}

function assignAlarmDraft(item) {
  Object.assign(alarmDraft, createAlarmItem(item))
}

function removeAlarmItem(index) {
  if (form.alarm.items.length <= 1) return
  form.alarm.items.splice(index, 1)
  saveConfig()
}

function normalizeAlarmItems(alarm = {}) {
  const source = Array.isArray(alarm.items) && alarm.items.length
    ? alarm.items
    : [{ time: alarm.time || '08:00', note: alarm.message || '闹钟时间到', repeat: 'daily', soundPath: alarm.soundPath || '' }]
  const items = source.map((item) => createAlarmItem(item)).filter((item) => item.time)
  const normalized = items.length ? items : [createAlarmItem({ time: '08:00', note: '闹钟时间到' })]
  normalized.forEach((item) => {
    if (!item.id) {
      alarmItemId += 1
      item.id = alarmItemId
    }
    alarmItemId = Math.max(alarmItemId, item.id)
  })
  return normalized
}

function createAlarmItem(item = {}) {
  const repeat = ['once', 'daily', 'weekly', 'monthly'].includes(item.repeat) ? item.repeat : 'daily'
  const next = {
    id: Number(item.id || 0),
    time: /^\d{2}:\d{2}$/.test(String(item.time || '')) ? String(item.time) : '08:00',
    note: String(item.note ?? item.message ?? '').trim(),
    repeat,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : todayString(),
    weekdays: Array.isArray(item.weekdays) && item.weekdays.length ? item.weekdays.map(Number).filter((day) => day >= 0 && day <= 6) : [1, 2, 3, 4, 5],
    dayOfMonth: Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31),
    soundPath: String(item.soundPath || ''),
  }
  normalizeAlarmItemSchedule(next)
  return next
}

function normalizeAlarmItemSchedule(item) {
  if (item.repeat === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ''))) item.date = todayString()
  if (item.repeat === 'weekly' && (!Array.isArray(item.weekdays) || !item.weekdays.length)) item.weekdays = [1, 2, 3, 4, 5]
  if (item.repeat === 'monthly') item.dayOfMonth = Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31)
}

function matchesAlarmSchedule(item, date) {
  if (item.repeat === 'once') return item.date === dateString(date)
  if (item.repeat === 'weekly') return item.weekdays.includes(date.getDay())
  if (item.repeat === 'monthly') return Number(item.dayOfMonth) === date.getDate()
  return true
}

function alarmRepeatText(item) {
  const repeat = item?.repeat || 'daily'
  if (repeat === 'once') return `仅一次 ${item.date || todayString()}`
  if (repeat === 'monthly') return `每月 ${Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31)} 日`
  if (repeat === 'weekly') {
    const selected = Array.isArray(item.weekdays) ? item.weekdays.map(Number) : []
    const labels = weekdayOptions.filter((day) => selected.includes(day.value)).map((day) => `周${day.label}`).join('、')
    return labels ? `每周 ${labels}` : '每周'
  }
  return '每天'
}

function triggerAlert(payload) {
  activeAlert = {
    id: String(payload.id || Date.now()),
    kind: payload.kind === 'stopwatch' ? 'stopwatch' : 'alarm',
    soundEnabled: payload.soundEnabled !== false,
    soundPath: String(payload.soundPath || ''),
  }
  stopAlertSound()
  if (activeAlert.soundEnabled) playAlertSound(activeAlert.soundPath)
  window.electronAPI?.openReminderWindow?.({
    id: activeAlert.id,
    kind: activeAlert.kind,
    title: payload.title || '提醒',
    message: payload.message || '时间到',
    timeText: payload.timeText || '',
    createdAt: Date.now(),
  })
}

function handleReminderAction(payload = {}) {
  if (!activeAlert || payload.id !== activeAlert.id) return
  if (payload.action === 'restart' && activeAlert.kind === 'stopwatch') {
    stopAlertSound()
    activeAlert = null
    resetTimer(false)
    startTimer()
    return
  }
  stopAlertSound()
  activeAlert = null
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
    // AudioContext can be restricted until the user interacts with the page.
  }
}

function dateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayString() {
  return dateString(new Date())
}

function formatDuration(totalSeconds) {
  const total = Math.max(0, Number.parseInt(totalSeconds, 10) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
</script>

<style scoped>
.tool-panel {
  display: grid;
  gap: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  padding: 18px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-header h2 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.panel-header p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.sound-picker {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
}

.alarm-list {
  display: grid;
  width: 100%;
  gap: 10px;
}

.alarm-view-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
}

.alarm-view-main {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.alarm-time {
  color: #111827;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.alarm-meta {
  display: grid;
  min-width: 0;
  gap: 4px;
  color: #64748b;
  line-height: 1.35;
}

.alarm-meta strong,
.alarm-meta small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alarm-meta strong {
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.alarm-meta small {
  font-size: 12px;
}

.alarm-view-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.timer-display-main {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 22px;
  text-align: center;
}

.timer-display-main.finished {
  border-color: #fecaca;
  background: #fef2f2;
}

.timer-time {
  color: #0f172a;
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.timer-message {
  margin-top: 10px;
  color: #64748b;
  font-size: 14px;
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  border-top: 1px solid #e5e7eb;
  padding-top: 14px;
}

.alarm-dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 16px;
}

.alarm-dialog-wide {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .panel-header,
  .alarm-view-row,
  .alarm-view-main,
  .alarm-dialog-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    align-items: flex-start;
  }

  .alarm-view-actions {
    justify-content: flex-end;
  }

  .timer-time {
    font-size: 42px;
  }
}
</style>
