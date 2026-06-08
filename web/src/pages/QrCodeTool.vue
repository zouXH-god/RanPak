<template>
  <div class="tool-page">
    <div class="mx-auto grid max-w-[1400px] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section class="tool-card">
        <div class="mb-3">
          <h1 class="text-xl font-semibold text-gray-900">二维码生成</h1>
          <p class="mt-1 text-sm text-gray-500">生成二维码 PNG，支持大小、边距、纠错级别和颜色。</p>
        </div>
        <el-input v-model="text" type="textarea" :autosize="{ minRows: 8, maxRows: 16 }" placeholder="输入二维码内容..." />
        <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label class="field"><span>大小</span><el-input-number v-model="size" class="w-full" :min="96" :max="2048" :step="32" /></label>
          <label class="field"><span>边距</span><el-input-number v-model="margin" class="w-full" :min="0" :max="10" /></label>
          <label class="field"><span>纠错级别</span><el-select v-model="level"><el-option label="L" value="L" /><el-option label="M" value="M" /><el-option label="Q" value="Q" /><el-option label="H" value="H" /></el-select></label>
          <label class="field"><span>颜色</span><div class="flex gap-2"><el-color-picker v-model="dark" /><el-color-picker v-model="light" /></div></label>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <el-button type="primary" @click="generate">生成</el-button>
          <el-button :icon="CopyDocument" :disabled="!dataUrl" @click="copyText(dataUrl, 'Data URL 已复制')">复制 Data URL</el-button>
          <el-button :icon="Download" :disabled="!dataUrl" @click="downloadPng">下载 PNG</el-button>
        </div>
      </section>
      <section class="tool-card qr-preview">
        <img v-if="dataUrl" :src="dataUrl" alt="二维码" />
        <el-empty v-else description="生成后预览二维码" />
      </section>
    </div>
    <SourceCredit :sources="sources" class="mx-auto mt-3 max-w-[1400px]" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import QRCode from 'qrcode'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download } from '@element-plus/icons-vue'
import { copyText } from '../utils/devTools'
import SourceCredit from '../components/SourceCredit.vue'

const sources = [
  { name: 'node-qrcode', url: 'https://github.com/soldair/node-qrcode' },
]
const text = ref('https://example.com')
const size = ref(320)
const margin = ref(2)
const level = ref('M')
const dark = ref('#111827')
const light = ref('#ffffff')
const dataUrl = ref('')

watch([size, margin, level, dark, light], () => {
  if (dataUrl.value) generate()
})

async function generate() {
  if (!text.value) {
    dataUrl.value = ''
    return
  }
  try {
    dataUrl.value = await QRCode.toDataURL(text.value, {
      width: size.value,
      margin: margin.value,
      errorCorrectionLevel: level.value,
      color: { dark: dark.value, light: light.value },
    })
  } catch (error) {
    ElMessage.error(error?.message || '二维码生成失败')
  }
}

function downloadPng() {
  const link = document.createElement('a')
  link.href = dataUrl.value
  link.download = 'qrcode.png'
  link.click()
}

generate()
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; padding: 20px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.field { display: grid; gap: 8px; color: #64748b; font-size: 13px; }
.field span { color: #111827; font-weight: 700; }
.qr-preview { min-height: 420px; display: grid; place-items: center; }
.qr-preview img { max-width: 100%; border-radius: 12px; border: 1px solid #edf2f7; }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
