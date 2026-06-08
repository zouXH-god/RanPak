<template>
  <div class="tool-page">
    <div class="mx-auto flex max-w-[1200px] flex-col gap-4">
      <header class="tool-header">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-gray-900">时间戳转换</h1>
          <p class="mt-1 text-sm text-gray-500">秒/毫秒时间戳、本地时间和 ISO 时间互转。</p>
        </div>
        <el-button :icon="Clock" type="primary" @click="useNow">当前时间</el-button>
      </header>
      <section class="tool-card">
        <div class="grid gap-4 lg:grid-cols-3">
          <label class="field"><span>秒级时间戳</span><el-input v-model="seconds" @input="fromSeconds" /></label>
          <label class="field"><span>毫秒时间戳</span><el-input v-model="milliseconds" @input="fromMilliseconds" /></label>
          <label class="field"><span>日期时间</span><el-input v-model="dateInput" @input="fromDateInput" /></label>
        </div>
      </section>
      <section class="tool-card">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="info"><span>本地时间</span><strong>{{ parts.local }}</strong></div>
          <div class="info"><span>ISO 时间</span><strong>{{ parts.iso }}</strong></div>
          <div class="info"><span>UTC 字符串</span><strong>{{ parts.utc }}</strong></div>
          <div class="info"><span>时区偏移</span><strong>{{ parts.offset }}</strong></div>
        </div>
        <div class="mt-4 flex gap-2">
          <el-button :icon="CopyDocument" @click="copyText(`${seconds}\\n${milliseconds}\\n${parts.iso}`)">复制</el-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { Clock, CopyDocument } from '@element-plus/icons-vue'
import { copyText } from '../utils/devTools'

const seconds = ref('')
const milliseconds = ref('')
const dateInput = ref('')
const parts = reactive({ local: '-', iso: '-', utc: '-', offset: '-' })

function syncFromDate(date) {
  if (Number.isNaN(date.getTime())) return
  seconds.value = String(Math.floor(date.getTime() / 1000))
  milliseconds.value = String(date.getTime())
  dateInput.value = date.toLocaleString()
  parts.local = date.toLocaleString()
  parts.iso = date.toISOString()
  parts.utc = date.toUTCString()
  const minutes = -date.getTimezoneOffset()
  const sign = minutes >= 0 ? '+' : '-'
  parts.offset = `UTC${sign}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`
}

function useNow() {
  syncFromDate(new Date())
}

function fromSeconds() {
  syncFromDate(new Date(Number(seconds.value) * 1000))
}

function fromMilliseconds() {
  syncFromDate(new Date(Number(milliseconds.value)))
}

function fromDateInput() {
  syncFromDate(new Date(dateInput.value))
}

useNow()
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-header, .tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.tool-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 20px 24px; }
.tool-card { padding: 20px; }
.field { display: grid; gap: 8px; color: #64748b; font-size: 13px; }
.field span { color: #111827; font-weight: 700; }
.info { border: 1px solid #edf2f7; border-radius: 12px; background: #f8fafc; padding: 12px; }
.info span { display: block; color: #64748b; font-size: 12px; }
.info strong { display: block; margin-top: 6px; overflow-wrap: anywhere; color: #111827; }
</style>
