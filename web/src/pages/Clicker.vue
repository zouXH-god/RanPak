<template>
  <div class="h-full px-4 pb-4">
    <div class="mx-auto max-w-6xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">模拟点击</h1>
          <p class="mt-1 text-sm text-gray-500">后台录制系统全局点击，并按固定间隔或录制节奏回放。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <el-tag :type="statusTag.type" size="large">{{ statusTag.text }}</el-tag>
          <el-tag v-if="lastHotkey" type="info" size="large">热键 {{ lastHotkey }}</el-tag>
        </div>
      </div>

      <el-alert
        v-if="!isAvailable"
        class="mb-4"
        title="模拟点击工具仅支持 Windows Electron 桌面版"
        type="warning"
        :closable="false"
      />
      <el-alert
        v-if="state.error"
        class="mb-4"
        :title="state.error"
        type="error"
        show-icon
        :closable="false"
      />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section class="min-w-0 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold text-gray-800">点击点位</h2>
              <p class="mt-1 text-xs text-gray-500">已记录 {{ state.points.length }} 个点位，坐标为屏幕全局坐标。</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <el-button
                v-if="!state.recording"
                type="primary"
                :icon="VideoPlay"
                :disabled="!isAvailable || state.playing"
                @click="startRecording"
              >
                开始录制
              </el-button>
              <el-button
                v-else
                type="warning"
                :icon="VideoPause"
                @click="stopRecording"
              >
                停止录制
              </el-button>
              <el-button :icon="Delete" :disabled="state.playing || !state.points.length" @click="clearRecording">清空</el-button>
            </div>
          </div>

          <el-table :data="state.points" height="420" border empty-text="暂无点击点位">
            <el-table-column type="index" label="#" width="56" />
            <el-table-column label="坐标" min-width="150">
              <template #default="{ row }">
                <span class="font-mono text-sm">{{ row.x }}, {{ row.y }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="button" label="按钮" width="90">
              <template #default="{ row }">{{ buttonLabel(row.button) }}</template>
            </el-table-column>
            <el-table-column label="间隔" width="110">
              <template #default="{ row }">{{ formatMs(row.delayFromPreviousMs) }}</template>
            </el-table-column>
            <el-table-column label="记录时间" min-width="160">
              <template #default="{ row }">{{ formatTime(row.recordedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ $index }">
                <el-button
                  link
                  type="danger"
                  :disabled="state.playing"
                  @click="deletePoint($index)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <aside class="space-y-4">
          <section class="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <h2 class="mb-4 text-sm font-semibold text-gray-800">播放设置</h2>
            <el-form label-position="top">
              <el-form-item label="播放模式">
                <el-segmented v-model="form.mode" :options="modeOptions" :disabled="state.playing" />
              </el-form-item>
              <el-form-item v-if="form.mode === 'fixed'" label="固定间隔">
                <el-input-number v-model="form.intervalMs" :min="10" :max="60000" :step="10" :disabled="state.playing" />
              </el-form-item>
              <div v-else class="grid grid-cols-2 gap-3">
                <el-form-item label="最小间隔">
                  <el-input-number v-model="form.minRecordedIntervalMs" :min="0" :max="60000" :step="10" :disabled="state.playing" />
                </el-form-item>
                <el-form-item label="最大间隔">
                  <el-input-number v-model="form.maxRecordedIntervalMs" :min="form.minRecordedIntervalMs" :max="120000" :step="100" :disabled="state.playing" />
                </el-form-item>
              </div>
              <el-form-item label="循环">
                <div class="flex w-full items-center gap-3">
                  <el-switch v-model="form.infinite" active-text="无限" :disabled="state.playing" />
                  <el-input-number v-model="form.loopCount" :min="1" :max="100000" :disabled="state.playing || form.infinite" />
                </div>
              </el-form-item>
              <div class="grid grid-cols-2 gap-3">
                <el-form-item label="开始延迟">
                  <el-input-number v-model="form.startDelayMs" :min="0" :max="60000" :step="500" :disabled="state.playing" />
                </el-form-item>
                <el-form-item label="按下时长">
                  <el-input-number v-model="form.downMs" :min="0" :max="5000" :step="10" :disabled="state.playing" />
                </el-form-item>
              </div>
              <el-form-item label="鼠标按钮">
                <div class="flex w-full items-center gap-3">
                  <el-select v-model="form.buttonMode" :disabled="state.playing">
                    <el-option label="使用录制按钮" value="recorded" />
                    <el-option label="统一指定" value="override" />
                  </el-select>
                  <el-select v-model="form.button" :disabled="state.playing || form.buttonMode !== 'override'">
                    <el-option label="左键" value="left" />
                    <el-option label="右键" value="right" />
                    <el-option label="中键" value="middle" />
                  </el-select>
                </div>
              </el-form-item>
            </el-form>
            <div class="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
              <el-button
                v-if="!state.playing"
                type="primary"
                :icon="Pointer"
                :disabled="!canPlay"
                @click="startPlayback"
              >
                开始连点
              </el-button>
              <template v-else>
                <el-button v-if="!state.paused" type="warning" :icon="VideoPause" @click="pausePlayback">暂停</el-button>
                <el-button v-else type="primary" :icon="VideoPlay" @click="resumePlayback">继续</el-button>
                <el-button type="danger" :icon="CircleClose" @click="stopPlayback">停止</el-button>
              </template>
            </div>
          </section>

          <section class="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <h2 class="mb-4 text-sm font-semibold text-gray-800">方案</h2>
            <div class="mb-3 flex gap-2">
              <el-input v-model="profileName" placeholder="方案名称" :disabled="state.playing" />
              <el-button :icon="DocumentAdd" :disabled="state.playing || !state.points.length" @click="saveProfile">保存</el-button>
            </div>
            <el-select v-model="selectedProfileId" class="mb-3 w-full" placeholder="选择已保存方案" :disabled="state.playing" clearable>
              <el-option v-for="profile in profiles" :key="profile.id" :label="profile.name" :value="profile.id" />
            </el-select>
            <div class="flex flex-wrap gap-2">
              <el-button :disabled="state.playing || !selectedProfile" @click="applyProfile">加载</el-button>
              <el-button type="danger" :disabled="state.playing || !selectedProfile" @click="deleteProfile">删除</el-button>
            </div>
          </section>

          <section class="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            <h2 class="mb-3 text-sm font-semibold text-gray-800">热键</h2>
            <div class="space-y-2">
              <div class="flex items-center justify-between"><span>F8</span><span>播放时暂停/继续</span></div>
              <div class="flex items-center justify-between"><span>Esc</span><span>紧急停止录制/播放</span></div>
            </div>
            <div v-if="playbackText" class="mt-4 rounded-md bg-white px-3 py-2 text-xs text-gray-500">{{ playbackText }}</div>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleClose, Delete, DocumentAdd, Pointer, VideoPause, VideoPlay } from '@element-plus/icons-vue'

const clicker = window.electronAPI?.clicker
const isAvailable = computed(() => Boolean(clicker) && window.electronAPI?.platform === 'win32')
const state = reactive({
  supported: false,
  recording: false,
  playing: false,
  paused: false,
  points: [],
  error: '',
  playback: null,
})
const form = reactive({
  mode: 'fixed',
  intervalMs: 100,
  loopCount: 1,
  infinite: false,
  startDelayMs: 3000,
  buttonMode: 'recorded',
  button: 'left',
  downMs: 30,
  minRecordedIntervalMs: 20,
  maxRecordedIntervalMs: 60000,
})
const modeOptions = [
  { label: '固定间隔', value: 'fixed' },
  { label: '录制间隔', value: 'recorded' },
]
const profiles = ref([])
const profileName = ref('')
const selectedProfileId = ref('')
const lastHotkey = ref('')
const scheduledDelay = ref(0)
let unsubscribe = null

const selectedProfile = computed(() => profiles.value.find((profile) => profile.id === selectedProfileId.value))
const canPlay = computed(() => isAvailable.value && state.points.length > 0 && !state.recording)
const statusTag = computed(() => {
  if (!isAvailable.value) return { text: '不可用', type: 'warning' }
  if (state.recording) return { text: '录制中', type: 'danger' }
  if (state.playing && state.paused) return { text: '已暂停', type: 'warning' }
  if (state.playing) return { text: '播放中', type: 'success' }
  return { text: '待机', type: 'info' }
})
const playbackText = computed(() => {
  if (scheduledDelay.value > 0 && state.playing) return `下一次动作将在 ${formatMs(scheduledDelay.value)} 后执行`
  if (!state.playback) return ''
  const total = state.playback.totalLoops === null ? '无限' : state.playback.totalLoops
  return `第 ${state.playback.loopIndex + 1} / ${total} 轮，点位 ${state.playback.pointIndex + 1}`
})

onMounted(async () => {
  if (!clicker) return
  unsubscribe = clicker.onClickerEvent?.(handleClickerEvent)
  await refreshState()
  await refreshProfiles()
})

onBeforeUnmount(() => {
  unsubscribe?.()
})

async function refreshState() {
  const next = await clicker?.getClickerState?.()
  if (next) assignState(next)
}

async function refreshProfiles() {
  profiles.value = await clicker?.loadClickProfiles?.() || []
}

function assignState(next) {
  state.supported = Boolean(next.supported)
  state.recording = Boolean(next.recording)
  state.playing = Boolean(next.playing)
  state.paused = Boolean(next.paused)
  state.points = Array.isArray(next.points) ? next.points : []
  state.error = next.error || ''
  state.playback = next.playback || null
}

function handleClickerEvent(payload) {
  if (payload?.state) assignState(payload.state)
  if (payload?.type === 'hotkey') lastHotkey.value = payload.key
  if (payload?.type === 'error' && payload.message) ElMessage.error(payload.message)
  if (payload?.type === 'profiles-updated') profiles.value = payload.profiles || []
  if (payload?.type === 'playback-scheduled' || payload?.type === 'playback-countdown') scheduledDelay.value = Number(payload.delayMs || 0)
  if (['playback-step', 'playback-paused', 'playback-resumed', 'playback-completed', 'playback-stopped'].includes(payload?.type)) scheduledDelay.value = 0
}

async function startRecording() {
  await runAction(() => clicker.startClickRecording(), '已开始后台录制')
}

async function stopRecording() {
  await runAction(() => clicker.stopClickRecording(), '录制已停止')
}

async function clearRecording() {
  await runAction(() => clicker.clearClickRecording(), '点位已清空')
}

async function deletePoint(index) {
  await runAction(() => clicker.deleteClickPoint(index))
}

async function startPlayback() {
  await runAction(() => clicker.startClickPlayback({ ...form }), '连点将在延迟后开始')
}

async function pausePlayback() {
  await runAction(() => clicker.pauseClickPlayback())
}

async function resumePlayback() {
  await runAction(() => clicker.resumeClickPlayback())
}

async function stopPlayback() {
  await runAction(() => clicker.stopClickPlayback())
}

async function saveProfile() {
  const saved = await clicker?.saveClickProfile?.({
    name: profileName.value || `点击方案 ${profiles.value.length + 1}`,
    points: state.points,
    config: { ...form },
  })
  if (saved) {
    selectedProfileId.value = saved.id
    profileName.value = saved.name
    ElMessage.success('方案已保存')
    await refreshProfiles()
  }
}

async function applyProfile() {
  if (!selectedProfile.value) return
  assignForm(selectedProfile.value.config || {})
  const next = await clicker?.applyClickProfile?.(selectedProfile.value)
  if (next) assignState(next)
  profileName.value = selectedProfile.value.name
}

async function deleteProfile() {
  if (!selectedProfile.value) return
  await clicker?.deleteClickProfile?.(selectedProfile.value.id)
  selectedProfileId.value = ''
  await refreshProfiles()
}

async function runAction(action, successText = '') {
  try {
    const next = await action()
    if (next?.points) assignState(next)
    if (successText) ElMessage.success(successText)
  } catch (error) {
    ElMessage.error(error?.message || '操作失败')
  }
}

function assignForm(config) {
  Object.keys(form).forEach((key) => {
    if (config[key] !== undefined) form[key] = config[key]
  })
}

function buttonLabel(button) {
  return ({ left: '左键', right: '右键', middle: '中键' })[button] || '左键'
}

function formatMs(value) {
  const ms = Math.max(0, Number(value) || 0)
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} 秒`
  return `${ms} ms`
}

function formatTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString()
}
</script>
