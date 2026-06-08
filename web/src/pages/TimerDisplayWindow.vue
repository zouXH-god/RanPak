<template>
  <div class="timer-display" :class="{ finished: state.finished }">
    <div class="drag-layer"></div>
    <div class="toolbar" @mousedown.stop @click.stop @dblclick.stop>
      <button class="tool-button" type="button" title="关闭" @click="closeWindow">
        <el-icon><Close /></el-icon>
      </button>
    </div>
    <main class="timer-card">
      <div class="timer-title">{{ state.title }}</div>
      <div class="timer-time">{{ displayText }}</div>
      <div class="progress-track">
        <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
      </div>
      <div class="timer-status">{{ statusText }}</div>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { Close } from '@element-plus/icons-vue'

const state = reactive({
  title: '定时器',
  remainingSeconds: 0,
  totalSeconds: 1,
  running: false,
  finished: false,
  message: '定时器时间到',
  source: 'timer',
  phase: 'work',
  completedRounds: 0,
  workSeconds: 25 * 60,
  breakSeconds: 5 * 60,
  soundEnabled: true,
  soundPath: '',
})
let disposeOptions = null
let disposeReminderAction = null
let tickTimer = null
let deadlineAt = 0
let activeAlert = null
let activeAlertAudio = null

const displayText = computed(() => formatDuration(state.remainingSeconds))
const progress = computed(() => {
  const total = Math.max(1, Number(state.totalSeconds || 1))
  const remaining = Math.min(total, Math.max(0, Number(state.remainingSeconds || 0)))
  return Math.round(((total - remaining) / total) * 100)
})
const statusText = computed(() => {
  if (state.finished) return state.message || '定时器时间到'
  return state.running ? '倒计时中' : '已暂停'
})

onMounted(async () => {
  document.documentElement.classList.add('overlay-transparent-root')
  document.body.classList.add('overlay-transparent-root')
  disposeOptions = window.electronAPI?.onTimerDisplayOptions?.(mergeOptions)
  disposeReminderAction = window.electronAPI?.onReminderWindowAction?.(handleReminderAction)
  const config = await window.electronAPI?.getTimerDisplayConfig?.()
  if (config) mergeOptions(config)
})

onBeforeUnmount(() => {
  disposeOptions?.()
  disposeReminderAction?.()
  stopTicking()
  stopAlertSound()
  document.documentElement.classList.remove('overlay-transparent-root')
  document.body.classList.remove('overlay-transparent-root')
})

function mergeOptions(options = {}) {
  const command = String(options.command || 'sync')
  const nextSource = options.source === 'pomodoro' ? 'pomodoro' : 'timer'
  Object.assign(state, {
    title: String(options.title || state.title),
    remainingSeconds: state.running && command === 'sync' ? state.remainingSeconds : Math.max(0, Number(options.remainingSeconds ?? state.remainingSeconds)),
    totalSeconds: Math.max(1, Number(options.totalSeconds ?? state.totalSeconds)),
    running: command === 'sync' ? state.running : Boolean(options.running),
    finished: command === 'sync' ? state.finished : Boolean(options.finished),
    message: String(options.message || state.message),
    source: nextSource,
    phase: ['work', 'break'].includes(options.phase) ? options.phase : state.phase,
    completedRounds: Math.max(0, Number(options.completedRounds ?? state.completedRounds) || 0),
    workSeconds: Math.max(1, Number(options.workSeconds ?? state.workSeconds)),
    breakSeconds: Math.max(1, Number(options.breakSeconds ?? state.breakSeconds)),
    soundEnabled: options.soundEnabled !== false,
    soundPath: String(options.soundPath || ''),
  })
  if (command === 'start' || command === 'next') {
    state.running = true
    state.finished = false
    startDeadline()
    return
  }
  if (command === 'pause') {
    refreshRemaining()
    state.running = false
    deadlineAt = 0
    stopTicking()
    emitState('pause')
    return
  }
  if (command === 'reset') {
    state.running = false
    state.finished = false
    deadlineAt = 0
    stopTicking()
    stopAlertSound()
    emitState('reset')
    return
  }
  if (state.running && !deadlineAt) startDeadline()
}

function startDeadline() {
  activeAlert = null
  stopAlertSound()
  deadlineAt = Date.now() + Math.max(0, state.remainingSeconds) * 1000
  startTicking()
  emitState('start')
}

function startTicking() {
  if (tickTimer) return
  tickTimer = window.setInterval(tick, 250)
}

function stopTicking() {
  if (!tickTimer) return
  window.clearInterval(tickTimer)
  tickTimer = null
}

function tick() {
  if (!state.running || state.finished) {
    stopTicking()
    return
  }
  refreshRemaining()
  emitState('tick')
  if (state.remainingSeconds > 0) return
  completeTimer()
}

function refreshRemaining() {
  if (!deadlineAt) return
  state.remainingSeconds = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000))
}

function completeTimer() {
  state.running = false
  state.finished = true
  deadlineAt = 0
  stopTicking()
  emitState('complete')
  triggerAlert()
}

function emitState(type) {
  window.electronAPI?.sendTimerDisplayEvent?.({
    type,
    source: state.source,
    remainingSeconds: state.remainingSeconds,
    totalSeconds: state.totalSeconds,
    running: state.running,
    finished: state.finished,
    phase: state.phase,
    completedRounds: state.completedRounds,
  })
}

function triggerAlert() {
  const completedPhase = state.phase
  activeAlert = {
    id: `${state.source}:${Date.now()}`,
    kind: state.source === 'pomodoro' ? 'pomodoro' : 'stopwatch',
  }
  stopAlertSound()
  if (state.soundEnabled) playAlertSound(state.soundPath)
  window.electronAPI?.openReminderWindow?.({
    id: activeAlert.id,
    kind: activeAlert.kind,
    title: state.source === 'pomodoro' ? (completedPhase === 'work' ? '工作时间结束' : '休憩时间结束') : '定时器提醒',
    message: state.source === 'pomodoro' ? (completedPhase === 'work' ? '确认后开始休憩时间' : '确认后开始下一轮工作') : state.message,
    timeText: state.source === 'pomodoro' ? (completedPhase === 'work' ? '工作完成' : '休憩完成') : formatDuration(state.totalSeconds),
    createdAt: Date.now(),
  })
}

function handleReminderAction(payload = {}) {
  if (!activeAlert || payload.id !== activeAlert.id) return
  stopAlertSound()
  activeAlert = null
  if (state.source === 'pomodoro') {
    if (payload.action === 'next') startNextPomodoroPhase()
    else resetPomodoro()
    return
  }
  if (payload.action === 'restart') restartTimer()
}

function restartTimer() {
  state.remainingSeconds = state.totalSeconds
  state.finished = false
  state.running = true
  startDeadline()
}

function resetPomodoro() {
  state.phase = 'work'
  state.completedRounds = 0
  state.remainingSeconds = state.workSeconds
  state.totalSeconds = state.workSeconds
  state.running = false
  state.finished = false
  deadlineAt = 0
  stopTicking()
  emitState('reset')
}

function startNextPomodoroPhase() {
  if (state.phase === 'work') {
    state.phase = 'break'
    state.remainingSeconds = state.breakSeconds
    state.totalSeconds = state.breakSeconds
  } else {
    state.phase = 'work'
    state.completedRounds += 1
    state.remainingSeconds = state.workSeconds
    state.totalSeconds = state.workSeconds
  }
  state.title = `番茄钟 - ${state.phase === 'break' ? '休憩时间' : '工作时间'}`
  state.message = state.phase === 'break' ? '休憩时间' : '工作时间'
  state.finished = false
  state.running = true
  startDeadline()
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

function formatDuration(totalSeconds) {
  const total = Math.max(0, Number.parseInt(totalSeconds, 10) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function closeWindow() {
  if (state.running) return
  window.electronAPI?.closeCurrentWindow?.()
}
</script>

<style scoped>
.timer-display {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  color: #111827;
  user-select: none;
}

.timer-display.finished .timer-card {
  border-color: #fca5a5;
  background: #fff;
}

.drag-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  -webkit-app-region: drag;
}

.timer-card {
  position: relative;
  z-index: 2;
  width: min(320px, calc(100vw - 24px));
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 20px 22px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.08);
}

.timer-title {
  overflow: hidden;
  color: #475569;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timer-time {
  margin-top: 8px;
  color: #0f172a;
  font-size: 46px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.progress-track {
  height: 8px;
  margin-top: 18px;
  overflow: hidden;
  border-radius: 999px;
  background: #f3f4f6;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: #409eff;
  transition: width 0.2s ease;
}

.timer-status {
  margin-top: 10px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.4;
}

.toolbar {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 10;
  -webkit-app-region: no-drag;
}

.tool-button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  place-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(17, 24, 39, 0.08);
}

.tool-button:hover {
  border-color: #d1d5db;
  background: #f9fafb;
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
