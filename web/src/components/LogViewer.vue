<template>
  <div class="log-viewer">
    <div class="log-toolbar">
      <el-input-number v-model="lines" :min="50" :max="5000" :step="50" size="small" class="w-[120px]" />
      <el-button size="small" :icon="Refresh" @click="doRefresh" :loading="loading">刷新</el-button>
      <el-divider direction="vertical" />
      <el-input v-model="keyword" size="small" placeholder="关键词筛选 (grep)" clearable class="w-[200px]" :prefix-icon="Search" @keyup.enter="doRefresh" @clear="doRefresh" />
      <el-checkbox v-model="grepIgnoreCase" size="small" @change="doRefresh">忽略大小写</el-checkbox>
      <el-divider direction="vertical" />
      <el-checkbox v-model="autoRefresh" size="small">自动刷新</el-checkbox>
      <el-select v-if="autoRefresh" v-model="refreshInterval" size="small" class="w-[90px]">
        <el-option :value="3" label="3 秒" /><el-option :value="5" label="5 秒" /><el-option :value="10" label="10 秒" /><el-option :value="30" label="30 秒" />
      </el-select>
      <el-divider direction="vertical" />
      <el-checkbox v-model="stickBottom" size="small">自动底部</el-checkbox>
    </div>
    <div ref="logContainer" class="log-content" @scroll="onScroll">
      <pre v-if="!keyword.trim()">{{ content }}</pre>
      <pre v-else v-html="highlightedContent"></pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'

const props = defineProps({
  fetchLog: { type: Function, required: true },
  visible: { type: Boolean, default: true },
})

const lines = ref(200)
const keyword = ref('')
const grepIgnoreCase = ref(true)
const content = ref('')
const loading = ref(false)
const autoRefresh = ref(false)
const refreshInterval = ref(5)
const stickBottom = ref(true)
const logContainer = ref(null)

let timer = null

const highlightedContent = computed(() => {
  const kw = keyword.value.trim()
  if (!kw || !content.value) return ''
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const flags = grepIgnoreCase.value ? 'gi' : 'g'
  const regex = new RegExp(`(${escaped})`, flags)
  return content.value
    .split('\n')
    .map((line) => line.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(regex, '<span class="log-highlight">$1</span>'))
    .join('\n')
})

async function doRefresh() {
  loading.value = true
  try {
    content.value = await props.fetchLog(lines.value, keyword.value.trim(), grepIgnoreCase.value)
  } catch { content.value = '（加载失败）' }
  loading.value = false
  if (stickBottom.value) await scrollToBottom()
}

async function scrollToBottom() {
  await nextTick()
  const el = logContainer.value
  if (el) el.scrollTop = el.scrollHeight
}

function onScroll() {
  const el = logContainer.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
  if (!atBottom && stickBottom.value) stickBottom.value = false
}

function startTimer() {
  stopTimer()
  if (autoRefresh.value && props.visible) {
    timer = setInterval(doRefresh, refreshInterval.value * 1000)
  }
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

watch(autoRefresh, (v) => { if (v) startTimer(); else stopTimer() })
watch(refreshInterval, () => { if (autoRefresh.value) startTimer() })
watch(() => props.visible, (v) => {
  if (v) { doRefresh(); if (autoRefresh.value) startTimer() }
  else { stopTimer(); autoRefresh.value = false }
})

onMounted(() => { if (props.visible) doRefresh() })
onBeforeUnmount(() => stopTimer())

defineExpose({ refresh: doRefresh })
</script>

<style scoped>
.log-viewer { display: flex; flex-direction: column; gap: 8px; }
.log-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.log-content {
  background: #0f172a; color: #e5e7eb; border-radius: 8px; padding: 12px;
  max-height: 450px; overflow-y: auto; font-family: Consolas, monospace; font-size: 12px;
}
.log-content pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
.log-content :deep(.log-highlight) { background: #facc15; color: #0f172a; padding: 0 2px; border-radius: 2px; }
</style>
