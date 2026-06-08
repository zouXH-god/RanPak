<template>
  <div class="tool-page">
    <div class="mx-auto flex max-w-[1200px] flex-col gap-4">
      <header class="tool-header">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-gray-900">UUID 生成</h1>
          <p class="mt-1 text-sm text-gray-500">批量生成 UUID v4。</p>
        </div>
        <el-button :icon="RefreshRight" type="primary" @click="generate">生成</el-button>
      </header>
      <section class="tool-card">
        <div class="grid gap-4 md:grid-cols-3">
          <label class="field"><span>数量</span><el-input-number v-model="count" class="w-full" :min="1" :max="1000" /></label>
          <label class="field"><span>格式</span><el-select v-model="format"><el-option label="标准小写" value="lower" /><el-option label="大写" value="upper" /><el-option label="无连字符" value="compact" /></el-select></label>
          <label class="field"><span>复制格式</span><el-select v-model="separator"><el-option label="每行一个" value="\n" /><el-option label="逗号分隔" value=", " /></el-select></label>
        </div>
      </section>
      <section class="tool-card">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">结果</h2>
          <div class="flex gap-2">
            <el-button :icon="CopyDocument" :disabled="!output" @click="copyText(output)">复制</el-button>
            <el-button :icon="Download" :disabled="!output" @click="downloadText(output, 'uuids.txt')">下载</el-button>
          </div>
        </div>
        <el-input v-model="output" readonly type="textarea" :autosize="{ minRows: 18, maxRows: 28 }" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { CopyDocument, Download, RefreshRight } from '@element-plus/icons-vue'
import { copyText, downloadText } from '../utils/devTools'

const count = ref(20)
const format = ref('lower')
const separator = ref('\n')
const output = ref('')

function fallbackUuid() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function normalize(value) {
  if (format.value === 'upper') return value.toUpperCase()
  if (format.value === 'compact') return value.replace(/-/g, '')
  return value
}

function generate() {
  output.value = Array.from({ length: count.value }, () => normalize(crypto.randomUUID?.() || fallbackUuid())).join(separator.value)
}
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-header, .tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.tool-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 20px 24px; }
.tool-card { padding: 20px; }
.field { display: grid; gap: 8px; color: #64748b; font-size: 13px; }
.field span { color: #111827; font-weight: 700; }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
