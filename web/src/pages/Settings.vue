<template>
  <div class="h-full min-h-0 overflow-auto px-4 pb-6">
    <div class="mx-auto flex max-w-[1100px] flex-col gap-4">
      <header class="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <h1 class="text-xl font-semibold text-gray-900">设置</h1>
        <p class="mt-1 text-sm text-gray-500">配置外置工具与资源目录，应用会在运行时读取这些路径。</p>
      </header>

      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-gray-900">启动</h2>
          <p class="mt-1 text-sm text-gray-500">配置应用的启动行为。</p>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700">开机自启动</span>
          <el-switch v-model="autoLaunch" @change="toggleAutoLaunch" />
        </div>
      </section>

      <section
        id="settings-ffmpeg"
        ref="ffmpegSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('ffmpeg')"
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900">FFmpeg</h2>
            <p class="mt-1 text-sm text-gray-500">留空表示从系统 PATH 自动查找。</p>
          </div>
          <el-tag :type="ffmpegTagType" effect="plain">{{ ffmpegStatusLabel }}</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="ffmpeg 路径">
            <div class="flex w-full gap-2">
              <el-input v-model="form.ffmpeg.ffmpegPath" placeholder="ffmpeg 或 ffmpeg.exe 的完整路径；留空使用 PATH" clearable />
              <el-button :icon="FolderOpened" @click="selectFfmpeg">选择</el-button>
            </div>
          </el-form-item>
          <el-form-item label="ffprobe 路径">
            <div class="flex w-full gap-2">
              <el-input v-model="form.ffmpeg.ffprobePath" placeholder="ffprobe 或 ffprobe.exe 的完整路径；留空使用 PATH" clearable />
              <el-button :icon="FolderOpened" @click="selectFfprobe">选择</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div v-if="ffmpegResult" class="mb-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-gray-600">
          <div>ffmpeg：{{ ffmpegResult.ffmpeg?.bin || '-' }} · {{ ffmpegResult.ffmpeg?.version || ffmpegResult.ffmpeg?.error || '-' }}</div>
          <div>ffprobe：{{ ffmpegResult.ffprobe?.bin || '-' }} · {{ ffmpegResult.ffprobe?.version || ffmpegResult.ffprobe?.error || '-' }}</div>
        </div>

        <div class="flex justify-end gap-2">
          <el-button :loading="testingFfmpeg" @click="testFfmpeg">测试</el-button>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
        </div>
      </section>

      <section
        id="settings-live2d"
        ref="live2dSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('live2d')"
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900">Live2D 外置资源</h2>
            <p class="mt-1 text-sm text-gray-500">资源目录应包含模型文件，catalog 可使用相对路径引用这些资源。</p>
          </div>
          <el-tag :type="live2dTagType" effect="plain">{{ live2dStatusLabel }}</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="资源目录">
            <div class="flex w-full gap-2">
              <el-input v-model="form.live2d.assetsDir" placeholder="Live2D 数据包目录；留空使用 userData/assets/live2d" clearable />
              <el-button :icon="FolderOpened" @click="selectLive2dDir">选择</el-button>
            </div>
          </el-form-item>
          <el-form-item label="Catalog 文件">
            <div class="flex w-full gap-2">
              <el-input v-model="form.live2d.catalogPath" placeholder="model-catalog.json；留空使用资源目录下的 model-catalog.json" clearable />
              <el-button :icon="Document" @click="selectLive2dCatalog">选择</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div v-if="live2dError" class="mb-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{{ live2dError }}</div>
        <div v-else class="mb-4 rounded-md bg-slate-50 p-3 text-sm text-gray-600">当前可用模型：{{ live2dModelCount }} 个</div>

        <div class="flex justify-end gap-2">
          <el-button :loading="checkingLive2d" @click="checkLive2d">检查 Catalog</el-button>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document, FolderOpened } from '@element-plus/icons-vue'
import { fetchToolsConfig, testFfmpegConfig, testLive2dCatalog, updateToolsConfig } from '../utils/api/tools'

const route = useRoute()
const form = reactive({
  ffmpeg: {
    ffmpegPath: '',
    ffprobePath: '',
  },
  live2d: {
    assetsDir: '',
    catalogPath: '',
  },
})
const autoLaunch = ref(false)
const saving = ref(false)
const testingFfmpeg = ref(false)
const checkingLive2d = ref(false)
const ffmpegResult = ref(null)
const live2dModelCount = ref(0)
const live2dError = ref('')
const ffmpegSection = ref(null)
const live2dSection = ref(null)
const activeSection = ref('')

const ffmpegStatusLabel = computed(() => {
  if (!ffmpegResult.value) return '未检测'
  return ffmpegResult.value.available ? '可用' : '不可用'
})
const ffmpegTagType = computed(() => ffmpegResult.value?.available ? 'success' : ffmpegResult.value ? 'danger' : 'info')
const live2dStatusLabel = computed(() => live2dError.value ? '不可用' : live2dModelCount.value ? `${live2dModelCount.value} 个模型` : '未检测')
const live2dTagType = computed(() => live2dError.value ? 'danger' : live2dModelCount.value ? 'success' : 'info')

onMounted(async () => {
  autoLaunch.value = await window.electronAPI?.getAutoLaunch?.() || false
  await loadConfig()
  await testFfmpeg()
  await checkLive2d()
  await scrollToRequestedSection()
})

watch(() => route.query.section, () => {
  scrollToRequestedSection()
})

async function loadConfig() {
  const res = await fetchToolsConfig()
  if (res?.code !== 200 || !res.data) return
  Object.assign(form.ffmpeg, res.data.ffmpeg || {})
  Object.assign(form.live2d, res.data.live2d || {})
}

async function saveConfig() {
  saving.value = true
  const res = await updateToolsConfig({
    ffmpeg: { ...form.ffmpeg },
    live2d: { ...form.live2d },
  })
  saving.value = false
  if (res?.code === 200) {
    ElMessage.success('配置已保存')
    await testFfmpeg()
    await checkLive2d()
  } else {
    ElMessage.error(res?.message || '保存失败')
  }
}

async function testFfmpeg() {
  testingFfmpeg.value = true
  const res = await testFfmpegConfig({ ...form.ffmpeg })
  testingFfmpeg.value = false
  ffmpegResult.value = res?.data || null
  if (ffmpegResult.value?.available) ElMessage.success('FFmpeg 检测通过')
}

async function checkLive2d() {
  checkingLive2d.value = true
  live2dError.value = ''
  const res = await testLive2dCatalog({ ...form.live2d })
  checkingLive2d.value = false
  if (res?.code === 200 && Array.isArray(res.data)) {
    live2dModelCount.value = res.data.length
    if (res.data.length) ElMessage.success('Live2D catalog 可用')
  } else {
    live2dModelCount.value = 0
    live2dError.value = res?.message || 'Live2D catalog 不可用'
  }
}

async function selectFfmpeg() {
  const selected = await window.electronAPI?.selectFfmpegBinary?.()
  if (selected) form.ffmpeg.ffmpegPath = selected
}

async function selectFfprobe() {
  const selected = await window.electronAPI?.selectFfprobeBinary?.()
  if (selected) form.ffmpeg.ffprobePath = selected
}

async function selectLive2dDir() {
  const selected = await window.electronAPI?.selectLive2dDirectory?.()
  if (selected) form.live2d.assetsDir = selected
}

async function selectLive2dCatalog() {
  const selected = await window.electronAPI?.selectLive2dCatalogFile?.()
  if (selected) form.live2d.catalogPath = selected
}

async function scrollToRequestedSection() {
  const section = String(route.query.section || '')
  const target = {
    ffmpeg: ffmpegSection,
    live2d: live2dSection,
  }[section]
  if (!target?.value) return
  activeSection.value = section
  await nextTick()
  target.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.setTimeout(() => {
    if (activeSection.value === section) activeSection.value = ''
  }, 1800)
}

async function toggleAutoLaunch(value) {
  await window.electronAPI?.setAutoLaunch?.(value)
}

function sectionHighlightClass(section) {
  return activeSection.value === section ? 'ring-2 ring-blue-300 ring-offset-2' : ''
}
</script>
