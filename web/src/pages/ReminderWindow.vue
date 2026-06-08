<template>
  <main class="reminder-shell" :class="payload.kind">
    <header class="reminder-titlebar">
      <div class="window-title">
        <span class="title-dot"></span>
        <span>RanPak Reminder</span>
      </div>
      <button class="icon-button" type="button" title="关闭" @click="sendAction('dismiss')">
        <el-icon><Close /></el-icon>
      </button>
    </header>

    <section class="reminder-body">
      <div class="illustration-stage" aria-hidden="true">
        <img class="times-up-illustration" :src="timesUpImage" alt="" />
      </div>
      <div class="content-panel">
        <div class="reminder-content">
          <div class="reminder-badge">{{ reminderKindText }}</div>
          <h1>{{ payload.title }}</h1>
          <p>{{ payload.message }}</p>
          <div v-if="payload.timeText" class="reminder-time">{{ payload.timeText }}</div>
        </div>

        <footer class="reminder-actions">
          <button v-if="payload.kind === 'alarm'" class="secondary-button" type="button" @click="sendAction('snooze')">
            5 分钟后提醒
          </button>
          <button v-if="payload.kind === 'stopwatch'" class="secondary-button" type="button" @click="sendAction('restart')">
            重新开始
          </button>
          <button v-if="payload.kind === 'pomodoro'" class="secondary-button" type="button" @click="sendAction('stop')">关闭番茄钟</button>
          <button v-if="payload.kind === 'pomodoro'" class="primary-button" type="button" @click="sendAction('next')">开始下一阶段</button>
          <button v-else class="primary-button" type="button" @click="sendAction('dismiss')">停止提醒</button>
        </footer>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { Close } from '@element-plus/icons-vue'
import timesUpImage from '../static/images/times-up.png'

const payload = reactive({
  id: '',
  kind: 'alarm',
  title: '提醒',
  message: '时间到',
  timeText: '',
})

let disposePayload = null
const reminderKindText = computed(() => {
  if (payload.kind === 'pomodoro') return '番茄钟'
  return payload.kind === 'stopwatch' ? '定时器' : '闹钟'
})

onMounted(async () => {
  document.documentElement.classList.add('reminder-root')
  document.body.classList.add('reminder-root')
  disposePayload = window.electronAPI?.onReminderWindowPayload?.(mergePayload)
  const initialPayload = await window.electronAPI?.getReminderWindowPayload?.()
  if (initialPayload) mergePayload(initialPayload)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  disposePayload?.()
  window.removeEventListener('keydown', handleKeydown)
  document.documentElement.classList.remove('reminder-root')
  document.body.classList.remove('reminder-root')
})

function mergePayload(next = {}) {
  payload.id = String(next.id || '')
  payload.kind = ['alarm', 'stopwatch', 'pomodoro'].includes(next.kind) ? next.kind : 'alarm'
  payload.title = String(next.title || (payload.kind === 'pomodoro' ? '番茄钟提醒' : (payload.kind === 'stopwatch' ? '定时器提醒' : '闹钟提醒')))
  payload.message = String(next.message || '时间到')
  payload.timeText = String(next.timeText || '')
}

function handleKeydown(event) {
  if (event.key === 'Enter' && payload.kind === 'pomodoro') {
    sendAction('next')
    return
  }
  if (event.key === 'Escape' || event.key === 'Enter') sendAction('dismiss')
}

function sendAction(action) {
  window.electronAPI?.sendReminderWindowAction?.({
    id: payload.id,
    kind: payload.kind,
    action,
  })
}
</script>

<style scoped>
.reminder-shell {
  position: relative;
  display: grid;
  width: 100vw;
  height: 100vh;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: #1f2937;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.reminder-shell.alarm {
  box-shadow: none;
}

.reminder-shell.stopwatch {
  box-shadow: none;
}

.reminder-titlebar {
  position: relative;
  z-index: 2;
  display: flex;
  height: 44px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 0 18px;
  border-bottom: 0;
  background: transparent;
  -webkit-app-region: drag;
}

.window-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(31, 41, 55, 0.58);
  font-size: 13px;
  font-weight: 800;
}

.title-dot {
  width: 10px;
  height: 10px;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: #ffb48e;
  box-shadow: 0 0 0 3px rgba(255, 180, 142, 0.18);
}

.icon-button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.68);
  color: #6b7280;
  cursor: pointer;
  backdrop-filter: blur(14px);
  -webkit-app-region: no-drag;
}

.icon-button:hover {
  background: rgba(255, 247, 243, 0.88);
  color: #ff6a3d;
}

.reminder-body {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  gap: 0;
  padding: 0 18px 18px;
}

.illustration-stage {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: end center;
  overflow: visible;
  pointer-events: none;
}

.illustration-stage::before {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 0;
  height: 18px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.08);
  content: "";
  filter: blur(10px);
}

.times-up-illustration {
  position: relative;
  display: block;
  width: min(430px, calc(100vw - 44px));
  height: min(430px, calc(100vh - 204px));
  object-fit: contain;
  filter: drop-shadow(0 18px 30px rgba(17, 24, 39, 0.16));
}

.content-panel {
  display: grid;
  min-width: 0;
  grid-template-rows: 1fr auto;
  align-self: end;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 18px 46px rgba(17, 24, 39, 0.16);
  backdrop-filter: blur(22px) saturate(1.18);
  -webkit-backdrop-filter: blur(22px) saturate(1.18);
}

.reminder-content {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 8px;
  padding: 18px 20px 12px;
}

.reminder-badge {
  width: fit-content;
  border: 1px solid #ffece5;
  border-radius: 999px;
  background: #fff7f3;
  color: #ff6a3d;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.04);
}

h1 {
  margin: 0;
  color: #1f2937;
  font-size: 28px;
  font-weight: 900;
  line-height: 1.15;
}

p {
  margin: 0;
  color: #4b5563;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.48;
  overflow-wrap: anywhere;
}

.reminder-time {
  width: fit-content;
  border-radius: 10px;
  background: #f3f4f6;
  color: #1f2937;
  padding: 5px 10px;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.reminder-actions {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 14px 14px;
  border-top: 1px solid rgba(229, 231, 235, 0.72);
  background: rgba(249, 250, 251, 0.42);
}

.primary-button,
.secondary-button {
  min-width: 104px;
  height: 36px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.primary-button {
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
}

.secondary-button {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
}

.primary-button:hover,
.secondary-button:hover {
  transform: translateY(-1px);
}

:global(html.reminder-root),
:global(body.reminder-root),
:global(body.reminder-root #app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent !important;
}
</style>
