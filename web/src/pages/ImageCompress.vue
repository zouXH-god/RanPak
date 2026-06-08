<template>
  <div class="image-tool-page h-full min-h-0 overflow-hidden px-4 pb-4">
    <div class="flex h-full min-h-0 gap-4">
      <section class="min-w-0 flex-1 overflow-hidden rounded-lg bg-gray-100">
        <div class="flex h-full items-center justify-center p-5">
          <div class="w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
            <div class="mb-5 flex items-center justify-between">
              <div>
                <h1 class="text-lg font-semibold text-gray-800">图片压缩</h1>
                <p class="mt-1 text-sm text-gray-500">批量压缩 JPEG、WebP、TIFF 等格式，输出文件会自动下载。</p>
              </div>
              <el-button type="primary" :icon="Upload" @click="fileInputRef?.click()">选择图片</el-button>
            </div>

            <div v-if="!files.length" class="rounded-lg border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
              请选择需要压缩的图片
            </div>
            <div v-else class="space-y-2">
              <div class="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                <span>已选择 {{ files.length }} 张图片</span>
                <el-button size="small" text @click="files = []">清空</el-button>
              </div>
              <div class="max-h-[420px] overflow-y-auto space-y-2">
                <div v-for="(item, index) in fileRows" :key="`${item.file.name}-${index}`" class="flex items-center gap-3 rounded border border-gray-200 px-3 py-2">
                  <el-icon><Picture /></el-icon>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm text-gray-700">{{ item.file.name }}</div>
                    <div class="text-xs text-gray-400">{{ formatSize(item.file.size) }}{{ item.resultSize ? ` -> ${formatSize(item.resultSize)}` : '' }}</div>
                  </div>
                  <el-tag v-if="item.status" size="small" :type="item.status === '成功' ? 'success' : item.status === '失败' ? 'danger' : 'info'">
                    {{ item.status }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="flex w-[360px] shrink-0 flex-col rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-4 py-3">
          <h2 class="text-base font-semibold text-gray-800">压缩参数</h2>
        </div>
        <div class="flex-1 p-4">
          <el-form label-width="92px" label-position="left">
            <el-form-item label="输出格式">
              <el-select v-model="form.format">
                <el-option label="保持原格式" value="ORIGINAL" />
                <el-option v-for="item in supportedFormats" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="质量">
              <el-slider v-model="form.quality" :min="1" :max="100" />
            </el-form-item>
            <el-form-item label="缩放">
              <el-switch v-model="form.resizeEnabled" />
            </el-form-item>
            <el-form-item v-if="form.resizeEnabled" label="百分比">
              <el-input-number v-model="form.percent" :min="1" :max="100" controls-position="right" />
            </el-form-item>
            <el-form-item label="文件后缀">
              <el-input v-model="form.suffix" />
            </el-form-item>
          </el-form>
        </div>
        <div class="border-t border-gray-100 p-4">
          <el-button class="w-full" type="primary" :loading="processing" :disabled="!files.length" @click="processFiles">
            开始压缩
          </el-button>
        </div>
      </aside>
    </div>
    <input ref="fileInputRef" type="file" class="hidden" accept="image/*" multiple @change="onFileChange" />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture, Upload } from '@element-plus/icons-vue'
import { uploadImage, processImageBlob } from '../utils/api/image'
import { downloadExtensionForFormat } from '../components/image/config/exportFormats'

const supportedFormats = [
  { value: 'JPEG', label: 'JPEG' },
  { value: 'WEBP', label: 'WebP' },
  { value: 'PNG', label: 'PNG' },
  { value: 'TIFF', label: 'TIFF' },
]

const fileInputRef = ref(null)
const files = ref([])
const rowState = ref([])
const processing = ref(false)
const form = reactive({
  format: 'ORIGINAL',
  quality: 75,
  resizeEnabled: false,
  percent: 80,
  suffix: '-compressed',
})

const fileRows = computed(() => files.value.map((file, index) => ({ file, ...(rowState.value[index] || {}) })))

function onFileChange(event) {
  files.value = Array.from(event.target.files || [])
  rowState.value = files.value.map(() => ({ status: '', resultSize: 0 }))
  event.target.value = ''
}

async function processFiles() {
  processing.value = true
  const steps = form.resizeEnabled ? [{ type: 'resize', params: { mode: 'percent', percent: form.percent } }] : []
  let success = 0

  for (let i = 0; i < files.value.length; i += 1) {
    const file = files.value[i]
    rowState.value[i] = { ...rowState.value[i], status: '处理中' }
    const uploaded = await uploadImage(file)
    if (uploaded?.code !== 200 || !uploaded.data?.image_id) {
      rowState.value[i] = { ...rowState.value[i], status: '失败' }
      continue
    }
    const outputFormat = form.format === 'ORIGINAL' ? normalizeFormat(uploaded.data.format) : form.format
    const blob = await processImageBlob(uploaded.data.image_id, steps, outputFormat, form.quality)
    if (!blob) {
      rowState.value[i] = { ...rowState.value[i], status: '失败' }
      continue
    }
    downloadBlob(blob, buildName(file.name, form.suffix, downloadExtensionForFormat(outputFormat)))
    rowState.value[i] = { status: '成功', resultSize: blob.size }
    success += 1
  }

  processing.value = false
  ElMessage.success(`压缩完成：${success}/${files.value.length}`)
}

function normalizeFormat(format) {
  const value = String(format || 'PNG').toUpperCase()
  if (value === 'JPG') return 'JPEG'
  if (!supportedFormats.some(item => item.value === value)) return 'JPEG'
  return value
}

function buildName(name, suffix, ext) {
  const dot = name.lastIndexOf('.')
  const base = dot > -1 ? name.slice(0, dot) : name
  return `${base}${suffix || ''}.${ext}`
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function formatSize(size) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}
</script>
