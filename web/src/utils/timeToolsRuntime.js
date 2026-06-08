import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

let runtime = null

export const weekdayOptions = [
  { label: '日', value: 0 },
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
]

export function useTimeToolsRuntime() {
  if (!runtime) runtime = createRuntime()
  runtime.init()
  return runtime
}

function createRuntime() {
  const now = ref(new Date())
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
    pomodoro: {
      workSeconds: 25 * 60,
      breakSeconds: 5 * 60,
      message: '番茄钟阶段完成',
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
  const pomodoroState = reactive({
    running: false,
    phase: 'work',
    remainingSeconds: 25 * 60,
    completedRounds: 0,
    awaitingConfirmation: false,
  })
  const alarmDialogVisible = ref(false)
  const editingAlarmIndex = ref(-1)
  const alarmDraft = reactive(createAlarmItem({ id: 0, time: '08:00', note: '' }))
  let started = false
  let loading = false
  let loaded = false
  let tickTimer = null
  let disposeReminderAction = null
  let disposeTimerDisplayEvent = null
  let activeAlertAudio = null
  let activeAlert = null
  let lastAlarmTriggerKey = ''
  let alarmItemId = 1

  async function init() {
    if (started) return
    started = true
    await loadConfig()
    tickTimer = window.setInterval(runTick, 1000)
    document.addEventListener('visibilitychange', handleRuntimeWake)
    window.addEventListener('focus', handleRuntimeWake)
    disposeReminderAction = window.electronAPI?.onReminderWindowAction?.(handleReminderAction)
    disposeTimerDisplayEvent = window.electronAPI?.onTimerDisplayEvent?.(handleTimerDisplayEvent)
  }

  function runTick() {
    now.value = new Date()
    checkAlarms()
  }

  function handleRuntimeWake() {
    runTick()
  }

  async function loadConfig() {
    if (loading || loaded) return
    loading = true
    try {
      const config = await window.electronAPI?.getTimeToolsConfig?.()
      if (!config) return
      Object.assign(form.alarm, config.alarm || {})
      form.alarm.items = normalizeAlarmItems(form.alarm)
      Object.assign(form.timer, config.timer || config.stopwatch || {})
      Object.assign(form.pomodoro, config.pomodoro || {})
      if (!timerState.running && !timerState.finished) {
        timerState.remainingSeconds = Math.max(1, Number(form.timer.durationSeconds || 1))
      }
      if (!pomodoroState.running && !pomodoroState.awaitingConfirmation) {
        pomodoroState.remainingSeconds = pomodoroPhaseDuration(pomodoroState.phase)
      }
      updateTimerDisplay()
      loaded = true
    } finally {
      loading = false
    }
  }

  function saveConfig() {
    window.electronAPI?.updateTimeToolsConfig?.(buildConfig())
    updateTimerDisplay('sync')
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
      pomodoro: {
        ...form.pomodoro,
        workSeconds: Math.max(1, Number(form.pomodoro.workSeconds || 1)),
        breakSeconds: Math.max(1, Number(form.pomodoro.breakSeconds || 1)),
        message: form.pomodoro.message || '番茄钟阶段完成',
        soundEnabled: Boolean(form.pomodoro.soundEnabled),
        soundPath: String(form.pomodoro.soundPath || ''),
        showWindow: Boolean(form.pomodoro.showWindow),
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

  async function startTimer() {
    if (timerState.finished || timerState.remainingSeconds <= 0) resetTimer(false)
    form.timer.showWindow = true
    timerState.running = true
    timerState.finished = false
    form.timer.enabled = true
    await openTimerDisplay('timer', 'start')
    saveConfig()
  }

  function pauseTimer() {
    timerState.running = false
    updateTimerDisplay('pause', 'timer')
    saveConfig()
  }

  function resetTimer(showMessage = true) {
    timerState.running = false
    timerState.finished = false
    timerState.remainingSeconds = Math.max(1, Number(form.timer.durationSeconds || 1))
    updateTimerDisplay('reset', 'timer')
    stopAlertSound()
    saveConfig()
    if (showMessage) ElMessage.success('定时器已重置')
  }

  async function startPomodoro() {
    if (pomodoroState.awaitingConfirmation) return
    form.pomodoro.showWindow = true
    pomodoroState.running = true
    if (pomodoroState.remainingSeconds <= 0) pomodoroState.remainingSeconds = pomodoroPhaseDuration(pomodoroState.phase)
    await openTimerDisplay('pomodoro', 'start')
    saveConfig()
  }

  function pausePomodoro() {
    pomodoroState.running = false
    updateTimerDisplay('pause', 'pomodoro')
    saveConfig()
  }

  function resetPomodoro(showMessage = true) {
    pomodoroState.running = false
    pomodoroState.phase = 'work'
    pomodoroState.completedRounds = 0
    pomodoroState.awaitingConfirmation = false
    pomodoroState.remainingSeconds = pomodoroPhaseDuration('work')
    updateTimerDisplay('reset', 'pomodoro')
    stopAlertSound()
    saveConfig()
    if (showMessage) ElMessage.success('番茄钟已重置')
  }

  async function startNextPomodoroPhase() {
    const completedPhase = pomodoroState.phase
    if (completedPhase === 'work') {
      pomodoroState.phase = 'break'
    } else {
      pomodoroState.phase = 'work'
      pomodoroState.completedRounds += 1
    }
    pomodoroState.awaitingConfirmation = false
    pomodoroState.remainingSeconds = pomodoroPhaseDuration(pomodoroState.phase)
    pomodoroState.running = true
    form.pomodoro.showWindow = true
    await openTimerDisplay('pomodoro', 'next')
    saveConfig()
  }

  function handlePomodoroDurationChange() {
    if (!pomodoroState.running && !pomodoroState.awaitingConfirmation) {
      pomodoroState.remainingSeconds = pomodoroPhaseDuration(pomodoroState.phase)
    }
    saveConfig()
  }

  async function handleShowWindowChange(target = 'timer') {
    saveConfig()
    if (target === 'pomodoro') {
      if (pomodoroState.running || pomodoroState.awaitingConfirmation) form.pomodoro.showWindow = true
      if (form.pomodoro.showWindow) await openTimerDisplay('pomodoro', 'sync')
      else await window.electronAPI?.closeTimerDisplayWindow?.()
      return
    }
    if (timerState.running || timerState.finished) form.timer.showWindow = true
    if (form.timer.showWindow) await openTimerDisplay('timer', 'sync')
    else await window.electronAPI?.closeTimerDisplayWindow?.()
  }

  async function openTimerDisplay(source = 'timer', command = 'sync') {
    if (!window.electronAPI?.openTimerDisplayWindow) {
      ElMessage.error('当前运行环境无法打开展示窗口')
      return
    }
    if (source === 'pomodoro') form.pomodoro.showWindow = true
    else form.timer.showWindow = true
    await window.electronAPI.openTimerDisplayWindow(timerPayload(source, command))
  }

  function updateTimerDisplay(command = 'sync', source = '') {
    if (pomodoroState.running || pomodoroState.awaitingConfirmation) {
      if (form.pomodoro.showWindow) window.electronAPI?.updateTimerDisplayWindow?.(timerPayload('pomodoro', source === 'pomodoro' ? command : 'sync'))
      return
    }
    if (form.timer.showWindow) window.electronAPI?.updateTimerDisplayWindow?.(timerPayload('timer', source === 'timer' ? command : 'sync'))
  }

  function timerPayload(source = 'timer', command = 'sync') {
    if (source === 'pomodoro') {
      return {
        source: 'pomodoro',
        command,
        title: `番茄钟 - ${pomodoroPhaseText()}`,
        remainingSeconds: pomodoroState.remainingSeconds,
        totalSeconds: pomodoroPhaseDuration(pomodoroState.phase),
        running: pomodoroState.running,
        finished: pomodoroState.awaitingConfirmation,
        message: pomodoroState.awaitingConfirmation ? '等待确认下一阶段' : pomodoroPhaseText(),
        phase: pomodoroState.phase,
        completedRounds: pomodoroState.completedRounds,
        workSeconds: Math.max(1, Number(form.pomodoro.workSeconds || 1)),
        breakSeconds: Math.max(1, Number(form.pomodoro.breakSeconds || 1)),
        soundEnabled: form.pomodoro.soundEnabled,
        soundPath: form.pomodoro.soundPath,
      }
    }
    return {
      source: 'timer',
      command,
      title: '定时器',
      remainingSeconds: timerState.remainingSeconds,
      totalSeconds: Math.max(1, Number(form.timer.durationSeconds || 1)),
      running: timerState.running,
      finished: timerState.finished,
      message: form.timer.message || '定时器时间到',
      soundEnabled: form.timer.soundEnabled,
      soundPath: form.timer.soundPath,
    }
  }

  function pomodoroPhaseDuration(phase = pomodoroState.phase) {
    return Math.max(1, Number(phase === 'break' ? form.pomodoro.breakSeconds : form.pomodoro.workSeconds || 1))
  }

  function pomodoroPhaseText() {
    return pomodoroState.phase === 'break' ? '休憩时间' : '工作时间'
  }

  function handleTimerDisplayEvent(payload = {}) {
    if (!payload || !payload.type) return
    if (payload.source === 'pomodoro') {
      pomodoroState.remainingSeconds = Math.max(0, Number(payload.remainingSeconds ?? pomodoroState.remainingSeconds))
      pomodoroState.running = Boolean(payload.running)
      pomodoroState.awaitingConfirmation = Boolean(payload.finished)
      if (['work', 'break'].includes(payload.phase)) pomodoroState.phase = payload.phase
      if (Number.isFinite(Number(payload.completedRounds))) pomodoroState.completedRounds = Math.max(0, Number(payload.completedRounds))
      return
    }
    timerState.remainingSeconds = Math.max(0, Number(payload.remainingSeconds ?? timerState.remainingSeconds))
    timerState.running = Boolean(payload.running)
    timerState.finished = Boolean(payload.finished)
  }

  async function selectSound(target) {
    const filePath = await window.electronAPI?.selectAlarmSound?.()
    if (!filePath) return
    form[target].soundPath = filePath
    form[target].soundEnabled = true
    saveConfig()
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

  function triggerAlert(payload) {
    const kind = ['alarm', 'stopwatch', 'pomodoro'].includes(payload.kind) ? payload.kind : 'alarm'
    activeAlert = {
      id: String(payload.id || Date.now()),
      kind,
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
    if (activeAlert.kind === 'pomodoro') {
      stopAlertSound()
      activeAlert = null
      if (payload.action === 'stop') {
        resetPomodoro(false)
        return
      }
      if (payload.action === 'next') startNextPomodoroPhase()
      return
    }
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

  return {
    form,
    timerState,
    pomodoroState,
    alarmDialogVisible,
    editingAlarmIndex,
    alarmDraft,
    init,
    saveConfig,
    startTimer,
    pauseTimer,
    resetTimer,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    startNextPomodoroPhase,
    handlePomodoroDurationChange,
    handleShowWindowChange,
    openTimerDisplay,
    pomodoroPhaseText,
    selectSound,
    clearSound,
    selectAlarmDraftSound,
    openCreateAlarmDialog,
    openEditAlarmDialog,
    saveAlarmDialog,
    removeAlarmItem,
    normalizeAlarmItemSchedule,
    alarmRepeatText,
    formatDuration,
    dispose: () => {
      if (tickTimer) window.clearInterval(tickTimer)
      document.removeEventListener('visibilitychange', handleRuntimeWake)
      window.removeEventListener('focus', handleRuntimeWake)
      disposeReminderAction?.()
      disposeTimerDisplayEvent?.()
      stopAlertSound()
      runtime = null
    },
  }
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
