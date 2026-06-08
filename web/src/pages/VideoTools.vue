<template>
  <div class="h-full min-h-0 overflow-auto px-4 pb-4">
    <div class="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header class="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-semibold text-gray-900">{{ activeModule.label }}</h1>
            <p class="mt-1 text-sm text-gray-500">{{ activeModule.summary }}</p>
          </div>
          <el-tag :type="capabilityTagType" effect="plain">{{ capabilityLabel }}</el-tag>
          <el-button :icon="Setting" @click="openSettings">FFmpeg 设置</el-button>
          <el-button :icon="FolderOpened" @click="selectOutputDir">输出目录</el-button>
          <el-button :icon="Upload" type="primary" @click="selectMedia">选择文件</el-button>
        </div>
      </header>

      <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div class="flex min-w-0 flex-col gap-4">
          <MediaPicker
            :module="activeModule"
            :files="selectedFiles"
            :preview-url="previewUrl"
            :probe-info="probeInfo"
            @pick="selectMedia"
          />

          <section v-if="activeModule.key === 'probe'" class="rounded-lg border border-gray-200 bg-white p-4">
            <h2 class="mb-3 text-sm font-semibold text-gray-900">详细信息</h2>
            <div v-if="streamRows.length" class="grid gap-2 md:grid-cols-2">
              <div v-for="stream in streamRows" :key="stream.id" class="rounded-md bg-slate-50 p-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-800">{{ stream.title }}</span>
                  <el-tag size="small" effect="plain">{{ stream.codec }}</el-tag>
                </div>
                <div class="mt-1 text-xs leading-5 text-gray-500">{{ stream.detail }}</div>
              </div>
            </div>
            <div v-else class="rounded-md border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">选择文件后显示编码、分辨率、音轨和字幕信息</div>
          </section>

          <TaskQueue :jobs="jobs" @refresh="loadJobs" @cancel="cancelJob" />
        </div>

        <ModuleForm
          v-model="form"
          :module="activeModule"
          :output-directory="outputDirectory"
          :submitting="submitting"
          :disabled="submitDisabled"
          @pick-output="selectOutputDir"
          @submit="submitCurrent"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FolderOpened, Setting, Upload } from '@element-plus/icons-vue'
import MediaPicker from '../components/video/MediaPicker.vue'
import ModuleForm from '../components/video/ModuleForm.vue'
import TaskQueue from '../components/video/TaskQueue.vue'
import { moduleByKey } from '../components/video/videoToolModules'
import {
  cancelVideoJob,
  createVideoJob,
  fetchVideoBlob,
  fetchVideoCapabilities,
  fetchVideoJobs,
  probeVideo,
} from '../utils/api/video'

const route = useRoute()
const router = useRouter()
const activeTool = ref(String(route.query.tool || 'convert'))
const selectedFiles = ref([])
const outputDirectory = ref('')
const previewUrl = ref('')
const probeInfo = ref(null)
const capabilities = ref(null)
const jobs = ref([])
const submitting = ref(false)
const form = reactive({})
let jobTimer = null

const activeModule = computed(() => moduleByKey(activeTool.value))
const capabilityLabel = computed(() => {
  if (!capabilities.value) return '正在检测 FFmpeg'
  return capabilities.value.available ? 'FFmpeg 可用' : '未检测到 FFmpeg'
})
const capabilityTagType = computed(() => capabilities.value?.available ? 'success' : 'warning')
const submitDisabled = computed(() => {
  if (activeModule.value.infoOnly) return !selectedFiles.value.length
  if (!capabilities.value?.available) return true
  if (activeModule.value.key === 'concat') return selectedFiles.value.length < 2
  return !selectedFiles.value.length
})
const streamRows = computed(() => (probeInfo.value?.streams || []).map((stream) => ({
  id: stream.index,
  title: `#${stream.index} ${stream.codec_type || 'stream'}`,
  codec: stream.codec_name || 'unknown',
  detail: [
    stream.width && stream.height ? `${stream.width}x${stream.height}` : '',
    stream.r_frame_rate && stream.r_frame_rate !== '0/0' ? `${stream.r_frame_rate} fps` : '',
    stream.channels ? `${stream.channels} 声道` : '',
    stream.bit_rate ? `${Math.round(Number(stream.bit_rate) / 1000)} kbps` : '',
    stream.tags?.language ? `语言 ${stream.tags.language}` : '',
  ].filter(Boolean).join(' · ') || '无详细信息',
})))

onMounted(() => {
  resetForm()
  loadCapabilities()
  loadJobs()
  jobTimer = window.setInterval(loadJobs, 2000)
})

onBeforeUnmount(() => {
  if (jobTimer) window.clearInterval(jobTimer)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

watch(() => route.query.tool, (tool) => {
  activeTool.value = String(tool || 'convert')
  resetForm()
})

watch(activeTool, () => {
  resetForm()
})

function resetForm() {
  Object.keys(form).forEach((key) => delete form[key])
  Object.assign(form, {
    container: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 23,
    preset: 'medium',
    hardwareAccel: 'none',
    resolution: 'source',
    fps: 0,
    startTime: '',
    endTime: '',
    ...activeModule.value.defaults,
  })
}

async function loadCapabilities() {
  const res = await fetchVideoCapabilities()
  capabilities.value = res?.data || null
}

function openSettings() {
  router.push({ path: '/settings', query: { section: 'ffmpeg' } })
}

async function loadJobs() {
  const res = await fetchVideoJobs()
  jobs.value = res?.data || []
}

async function selectMedia() {
  const paths = await window.electronAPI?.selectVideoFiles?.()
  if (!paths?.length) return
  selectedFiles.value = activeModule.value.multi ? paths : [paths[0]]
  await refreshProbeAndPreview()
}

async function refreshProbeAndPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  probeInfo.value = null
  const first = selectedFiles.value[0]
  if (!first) return
  const blob = await fetchVideoBlob(first)
  if (blob) previewUrl.value = URL.createObjectURL(blob)
  const res = await probeVideo(first)
  if (res?.code === 200) probeInfo.value = res.data
}

async function selectOutputDir() {
  const dir = await window.electronAPI?.selectOutputDirectory?.()
  if (dir) outputDirectory.value = dir
}

async function submitCurrent() {
  if (activeModule.value.infoOnly) {
    await refreshProbeAndPreview()
    ElMessage.success('视频信息已读取')
    return
  }
  submitting.value = true
  const workflows = buildWorkflows()
  let success = 0
  for (const workflow of workflows) {
    const res = await createVideoJob(workflow)
    if (res?.code === 200) success += 1
  }
  submitting.value = false
  await loadJobs()
  if (success) ElMessage.success(`已创建 ${success} 个任务`)
  else ElMessage.error('任务创建失败')
}

function buildWorkflows() {
  const module = activeModule.value
  if (module.key === 'gif-speed-batch' && form.subMode === 'batch') {
    return selectedFiles.value.map((file) => buildWorkflowForFile(file, 'convert'))
  }
  const mode = module.key === 'gif-speed-batch' ? form.subMode : module.key
  if (mode === 'concat') return [buildConcatWorkflow()]
  return [buildWorkflowForFile(selectedFiles.value[0], mode)]
}

function buildWorkflowForFile(file, mode) {
  const output = buildOutput(file, mode)
  return {
    mode,
    inputs: [{ type: 'file', path: file }],
    output,
    operations: buildOperations(mode),
  }
}

function buildConcatWorkflow() {
  return {
    mode: 'concat',
    inputs: selectedFiles.value.map((file) => ({ type: 'file', path: file })),
    output: buildOutput(selectedFiles.value[0], 'concat'),
    operations: [],
  }
}

function buildOutput(file, mode) {
  const container = containerForMode(mode)
  return {
    mode,
    container,
    outputPath: outputPathFor(file, mode),
    videoCodec: form.videoCodec,
    audioCodec: form.audioCodec,
    audioBitrate: form.audioBitrate,
    crf: form.crf,
    preset: form.preset,
    resolution: form.resolution,
    fps: form.fps,
    startTime: form.startTime,
    endTime: form.endTime,
    hardwareAccel: form.hardwareAccel,
    watermarkText: form.watermarkText,
    watermarkSize: form.watermarkSize,
    watermarkColor: form.watermarkColor,
    subtitlePath: form.subtitlePath,
    subtitleMode: form.subtitleMode,
    rotate: form.rotate,
    width: form.width,
    speed: form.speed,
    durationSeconds: Number(probeInfo.value?.format?.duration || 0),
  }
}

function buildOperations(mode) {
  if (mode === 'watermark') {
    const position = watermarkPosition()
    return [{
      type: 'drawtext',
      params: {
        text: form.watermarkText,
        x: position.x,
        y: position.y,
        size: form.watermarkSize,
        color: form.watermarkColor || 'white',
      },
    }]
  }
  if (mode === 'subtitle' && form.subtitlePath && form.subtitleMode !== 'copy') {
    return [{ type: 'subtitles', params: { path: form.subtitlePath } }]
  }
  return []
}

function containerForMode(mode) {
  if (mode === 'snapshot') return 'image2'
  if (mode === 'gif') return 'gif'
  if (mode === 'extract-audio') {
    if (form.audioCodec === 'libopus') return 'ogg'
    if (form.audioCodec === 'aac') return 'adts'
    return 'mp3'
  }
  return form.container || 'mp4'
}

function extensionForMode(mode) {
  if (mode === 'snapshot') return form.imageFormat || 'jpg'
  if (mode === 'gif') return 'gif'
  if (mode === 'extract-audio') {
    if (form.audioCodec === 'libopus') return 'ogg'
    if (form.audioCodec === 'aac') return 'aac'
    return 'mp3'
  }
  if (form.container === 'matroska') return 'mkv'
  if (form.container === 'mpegts') return 'ts'
  return form.container || 'mp4'
}

function outputPathFor(file, mode) {
  if (!outputDirectory.value || !file) return ''
  return `${outputDirectory.value}\\${fileBase(file)}-${mode}.${extensionForMode(mode)}`
}

function watermarkPosition() {
  const map = {
    leftTop: { x: 24, y: 24 },
    rightTop: { x: 'w-tw-24', y: 24 },
    leftBottom: { x: 24, y: 'h-th-24' },
    rightBottom: { x: 'w-tw-24', y: 'h-th-24' },
  }
  return map[form.watermarkPosition] || map.leftTop
}

async function cancelJob(id) {
  await cancelVideoJob(id)
  await loadJobs()
}

function fileName(path) {
  return String(path || '').split(/[\\/]/).pop() || path
}

function fileBase(path) {
  const name = fileName(path)
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(0, index) : name
}
</script>
