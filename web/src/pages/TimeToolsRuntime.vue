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
          <el-button :type="mode === 'pomodoro' ? 'primary' : 'default'" @click="goMode('pomodoro')">番茄钟</el-button>
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

      <section v-else-if="mode === 'timer'" class="tool-panel">
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

      <section v-else class="tool-panel">
        <div class="panel-header">
          <div>
            <h2>番茄钟</h2>
            <p>{{ pomodoroStatusText }}</p>
          </div>
          <el-switch v-model="form.pomodoro.showWindow" active-text="展示窗口" inactive-text="仅主窗口" @change="handleShowWindowChange('pomodoro')" />
        </div>
        <div class="timer-display-main" :class="{ finished: pomodoroState.awaitingConfirmation }">
          <div class="timer-time">{{ pomodoroDisplay }}</div>
          <div class="timer-message">{{ pomodoroState.awaitingConfirmation ? '等待确认下一阶段' : pomodoroPhaseText() }}</div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <el-form-item label="工作时间（分钟）">
            <el-input-number v-model="pomodoroWorkMinutes" :min="1" :max="240" controls-position="right" @change="applyPomodoroMinutes" />
          </el-form-item>
          <el-form-item label="休憩时间（分钟）">
            <el-input-number v-model="pomodoroBreakMinutes" :min="1" :max="120" controls-position="right" @change="applyPomodoroMinutes" />
          </el-form-item>
          <el-form-item label="提示文字">
            <el-input v-model="form.pomodoro.message" @change="saveConfig" />
          </el-form-item>
          <el-form-item label="闹铃声音">
            <el-switch v-model="form.pomodoro.soundEnabled" @change="saveConfig" />
          </el-form-item>
          <el-form-item label="铃声文件" class="sm:col-span-2">
            <div class="sound-picker">
              <el-input v-model="form.pomodoro.soundPath" placeholder="未选择时使用内置提示音" readonly />
              <el-button @click="selectSound('pomodoro')">选择</el-button>
              <el-button text type="danger" @click="clearSound('pomodoro')">清空</el-button>
            </div>
          </el-form-item>
        </div>
        <div class="action-bar">
          <el-button v-if="pomodoroState.awaitingConfirmation" type="primary" @click="startNextPomodoroPhase">开始下一阶段</el-button>
          <el-button type="primary" :disabled="pomodoroState.running || pomodoroState.awaitingConfirmation" @click="startPomodoro">开始番茄钟</el-button>
          <el-button :disabled="!pomodoroState.running" @click="pausePomodoro">暂停</el-button>
          <el-button @click="resetPomodoro">重置</el-button>
          <el-button v-if="form.pomodoro.showWindow" @click="openTimerDisplay('pomodoro')">打开展示窗口</el-button>
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
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTimeToolsRuntime, weekdayOptions } from '../utils/timeToolsRuntime'

const route = useRoute()
const router = useRouter()
const runtime = useTimeToolsRuntime()
const {
  form,
  timerState,
  pomodoroState,
  alarmDialogVisible,
  editingAlarmIndex,
  alarmDraft,
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
  pomodoroPhaseText,
} = runtime

const pomodoroWorkMinutes = ref(Math.max(1, Math.round(Number(form.pomodoro.workSeconds || 1500) / 60)))
const pomodoroBreakMinutes = ref(Math.max(1, Math.round(Number(form.pomodoro.breakSeconds || 300) / 60)))
const mode = computed(() => {
  if (route.path === '/time-tools-timer') return 'timer'
  if (route.path === '/time-tools-pomodoro') return 'pomodoro'
  return 'alarm'
})
const pageTitle = computed(() => ({ alarm: '闹钟', timer: '定时器', pomodoro: '番茄钟' }[mode.value]))
const pageDescription = computed(() => ({
  alarm: '在主窗口定义闹钟，启用后页面切换不会终止提醒。',
  timer: '在主窗口设置、开始和暂停倒计时，可选择独立展示窗口；页面切换不会终止运行。',
  pomodoro: '自定义工作与休憩时间，阶段完成后确认再进入下一阶段。',
}[mode.value]))
const timerDisplay = computed(() => formatDuration(timerState.remainingSeconds))
const timerStatusText = computed(() => timerState.finished ? form.timer.message : `${formatDuration(timerState.remainingSeconds)} / ${formatDuration(form.timer.durationSeconds)}`)
const alarmStatusText = computed(() => form.alarm.enabled ? `已启用 ${form.alarm.items.length} 个闹钟` : '闹钟已停用')
const pomodoroDisplay = computed(() => formatDuration(pomodoroState.remainingSeconds))
const pomodoroStatusText = computed(() => {
  const roundText = `已完成 ${pomodoroState.completedRounds} 轮`
  if (pomodoroState.awaitingConfirmation) return `${pomodoroPhaseText()}完成，等待确认 · ${roundText}`
  return `${pomodoroPhaseText()} · ${roundText}`
})

watch(() => form.alarm, saveConfig, { deep: true })
watch(() => form.timer, saveConfig, { deep: true })
watch(() => form.pomodoro, saveConfig, { deep: true })
watch(() => form.pomodoro.workSeconds, (seconds) => {
  pomodoroWorkMinutes.value = Math.max(1, Math.round(Number(seconds || 60) / 60))
})
watch(() => form.pomodoro.breakSeconds, (seconds) => {
  pomodoroBreakMinutes.value = Math.max(1, Math.round(Number(seconds || 60) / 60))
})

function goMode(nextMode) {
  router.push(nextMode === 'timer' ? '/time-tools-timer' : (nextMode === 'pomodoro' ? '/time-tools-pomodoro' : '/time-tools-alarm'))
}

function applyPomodoroMinutes() {
  form.pomodoro.workSeconds = Math.max(1, Number(pomodoroWorkMinutes.value || 1)) * 60
  form.pomodoro.breakSeconds = Math.max(1, Number(pomodoroBreakMinutes.value || 1)) * 60
  handlePomodoroDurationChange()
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
