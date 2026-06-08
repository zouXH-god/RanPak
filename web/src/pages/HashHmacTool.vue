<template>
  <div class="tool-page">
    <div class="mx-auto grid max-w-[1400px] gap-4 xl:grid-cols-2">
      <section class="tool-card">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">哈希 / HMAC</h1>
            <p class="mt-1 text-sm text-gray-500">生成 SHA 哈希或 HMAC 签名，支持 hex/base64 输出。</p>
          </div>
          <el-button :icon="RefreshRight" type="primary" @click="calculate">计算</el-button>
        </div>
        <div class="mb-4 grid gap-3 md:grid-cols-3">
          <el-select v-model="mode"><el-option label="Hash" value="hash" /><el-option label="HMAC" value="hmac" /></el-select>
          <el-select v-model="algorithm"><el-option v-for="item in algorithms" :key="item" :label="item" :value="item" /></el-select>
          <el-select v-model="outputType"><el-option label="hex" value="hex" /><el-option label="base64" value="base64" /></el-select>
        </div>
        <el-input v-if="mode === 'hmac'" v-model="secret" class="mb-4" placeholder="HMAC secret" show-password />
        <el-input v-model="source" type="textarea" :autosize="{ minRows: 14, maxRows: 24 }" placeholder="输入待计算文本..." />
      </section>
      <section class="tool-card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">结果</h2>
          <div class="flex gap-2">
            <el-button :icon="CopyDocument" :disabled="!output" @click="copyText(output)">复制</el-button>
            <el-button :icon="Download" :disabled="!output" @click="downloadText(output, 'hash.txt')">下载</el-button>
          </div>
        </div>
        <el-input v-model="output" readonly type="textarea" :autosize="{ minRows: 14, maxRows: 24 }" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download, RefreshRight } from '@element-plus/icons-vue'
import { copyText, digestText, downloadText, hmacText } from '../utils/devTools'

const algorithms = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']
const mode = ref('hash')
const algorithm = ref('SHA-256')
const outputType = ref('hex')
const secret = ref('')
const source = ref('')
const output = ref('')

watch([mode, algorithm, outputType], () => {
  if (source.value) calculate()
})

async function calculate() {
  try {
    output.value = mode.value === 'hmac'
      ? await hmacText(algorithm.value, secret.value, source.value, outputType.value)
      : await digestText(algorithm.value, source.value, outputType.value)
  } catch (error) {
    ElMessage.error(error?.message || '计算失败')
  }
}
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; padding: 20px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
