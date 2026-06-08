<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="批量处理"
    width="560px"
    :close-on-click-modal="false"
  >
    <div class="space-y-4">
      <!-- 工作流预览 -->
      <div>
        <div class="text-sm font-medium text-gray-600 mb-2">
          当前工作流（{{ steps.length }} 步）
        </div>
        <div class="flex flex-wrap gap-1.5">
          <el-tag v-for="(step, i) in steps" :key="i" size="small" type="info">
            {{ i + 1 }}. {{ labelMap[step.type] || step.type }}
          </el-tag>
        </div>
      </div>

      <!-- 图片文件选择 -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-medium text-gray-600">图片文件</div>
          <div class="flex gap-2">
            <el-button size="small" @click="selectFiles">选择图片</el-button>
            <el-button size="small" :disabled="!hasBatchInput" @click="clearFiles">清空</el-button>
          </div>
        </div>
        <div v-if="!hasBatchInput" class="rounded border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
          请选择需要批处理的图片文件
        </div>
        <div v-else class="rounded border border-gray-200 bg-gray-50">
          <div class="border-b border-gray-200 px-3 py-2 text-xs text-gray-500">
            已选择 {{ selectedItems.length }} 个文件
          </div>
          <div class="max-h-40 overflow-y-auto p-2 space-y-1">
            <div
              v-for="(item, i) in selectedItems"
              :key="`${item.name}-${i}`"
              class="flex items-center gap-2 rounded bg-white px-2 py-1.5 text-xs text-gray-600"
            >
              <el-icon :size="14"><Picture /></el-icon>
              <span class="min-w-0 flex-1 truncate" :title="item.name">{{ item.name }}</span>
              <el-button size="small" text :icon="Close" @click="removeFile(i)" />
            </div>
          </div>
        </div>
      </div>

      <!-- 输出目录 -->
      <div>
        <div class="text-sm font-medium text-gray-600 mb-2">输出目录（可选）</div>
        <div class="flex gap-2">
          <div class="min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            <span v-if="outputDir" class="block truncate" :title="outputDir">{{ outputDir }}</span>
            <span v-else class="text-gray-400">留空则使用默认临时目录</span>
          </div>
          <el-button @click="selectOutputDir">选择目录</el-button>
          <el-button :disabled="!outputDir" @click="outputDir = ''">清空</el-button>
        </div>
      </div>

      <!-- 输出格式 -->
      <div class="flex items-center gap-4">
        <div class="text-sm font-medium text-gray-600">输出格式</div>
        <el-select v-model="format" size="small" class="!w-40">
          <el-option
            v-for="opt in IMAGE_EXPORT_FORMAT_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <div class="text-sm font-medium text-gray-600 ml-4">质量</div>
        <el-input-number v-model="quality" :min="1" :max="100" size="small" />
      </div>

      <!-- 结果展示 -->
      <div v-if="result" class="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div class="text-sm font-medium mb-2">处理结果</div>
        <div class="flex gap-4 text-sm">
          <span class="text-gray-600">总数: {{ result.total }}</span>
          <span class="text-green-600">成功: {{ result.success }}</span>
          <span class="text-red-500">失败: {{ result.failed }}</span>
        </div>
        <div v-if="result.results?.length" class="mt-2 max-h-40 overflow-y-auto space-y-1">
          <div v-for="(item, i) in result.results" :key="i"
               class="text-xs flex items-center gap-2 py-0.5"
               :class="item.success ? 'text-gray-600' : 'text-red-500'">
            <el-icon :size="12">
              <component :is="item.success ? 'CircleCheck' : 'CircleClose'" />
            </el-icon>
            <span class="truncate flex-1">{{ item.source }}</span>
            <span v-if="item.error" class="text-red-400">{{ item.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">关闭</el-button>
      <el-button type="primary" :loading="processing" @click="runBatch" :disabled="!hasBatchInput">
        开始批处理
      </el-button>
    </template>
    <input ref="fallbackFileInputRef" type="file" class="hidden" accept="image/*" multiple @change="onFallbackFilesChange" />
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose, Close, Picture } from '@element-plus/icons-vue'
import { batchProcess, batchProcessFiles } from '../../utils/api/image'
import { IMAGE_EXPORT_FORMAT_OPTIONS } from './config/exportFormats.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  steps: { type: Array, default: () => [] },
  outputFormat: { type: String, default: 'PNG' },
})

defineEmits(['update:visible'])

const selectedFilePaths = ref([])
const selectedFiles = ref([])
const fallbackFileInputRef = ref(null)
const outputDir = ref('')
const format = ref(props.outputFormat)
const quality = ref(95)
const processing = ref(false)
const result = ref(null)

const filePaths = computed(() => selectedFilePaths.value)
const selectedItems = computed(() => {
  if (selectedFilePaths.value.length) return selectedFilePaths.value.map(name => ({ name }))
  return selectedFiles.value.map(file => ({ name: file.name }))
})
const hasBatchInput = computed(() => filePaths.value.length > 0 || selectedFiles.value.length > 0)

const labelMap = {
  crop: '裁剪', rotate: '旋转', resize: '缩放', flip: '翻转',
  brightness: '亮度', contrast: '对比度', saturation: '饱和度',
  blur: '模糊', sharpen: '锐化', grayscale: '灰度', text: '文字',
  sticker: '贴纸', format: '格式转换',
}

watch(() => props.visible, (v) => {
  if (v) {
    result.value = null
    format.value = props.outputFormat
  }
})

async function runBatch() {
  processing.value = true
  result.value = null

  const steps = props.steps.map(s => ({ type: s.type, params: s.params }))
  const res = filePaths.value.length
    ? await batchProcess(filePaths.value, steps, outputDir.value, format.value, quality.value)
    : await batchProcessFiles(selectedFiles.value, steps, outputDir.value, format.value, quality.value)

  if (res?.code === 200 && res.data) {
    result.value = res.data
    ElMessage.success(`批处理完成: ${res.data.success}/${res.data.total} 成功`)
  } else {
    ElMessage.error('批处理失败')
  }

  processing.value = false
}

async function selectFiles() {
  if (!window.electronAPI?.selectImageFiles) {
    fallbackFileInputRef.value?.click()
    return
  }
  const paths = await window.electronAPI.selectImageFiles()
  if (!Array.isArray(paths) || !paths.length) return
  selectedFilePaths.value = [...new Set([...selectedFilePaths.value, ...paths])]
  selectedFiles.value = []
}

async function selectOutputDir() {
  if (!window.electronAPI?.selectDirectory) {
    ElMessage.error('当前环境不支持目录选择器')
    return
  }
  const dir = await window.electronAPI.selectDirectory()
  if (dir) outputDir.value = dir
}

function removeFile(index) {
  if (selectedFilePaths.value.length) {
    selectedFilePaths.value = selectedFilePaths.value.filter((_, i) => i !== index)
  } else {
    selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index)
  }
}

function clearFiles() {
  selectedFilePaths.value = []
  selectedFiles.value = []
}

function onFallbackFilesChange(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return
  selectedFiles.value = files
  selectedFilePaths.value = []
}
</script>
