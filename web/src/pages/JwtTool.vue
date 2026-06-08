<template>
  <div class="tool-page">
    <div class="mx-auto grid max-w-[1400px] gap-4 xl:grid-cols-2">
      <section class="tool-card">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">JWT 工具</h1>
            <p class="mt-1 text-sm text-gray-500">解码 JWT，并可用 HMAC secret 校验 HS 系列签名。</p>
          </div>
          <el-button :icon="Delete" plain @click="clear">清空</el-button>
        </div>
        <el-input v-model="token" type="textarea" :autosize="{ minRows: 9, maxRows: 16 }" placeholder="粘贴 JWT..." />
        <div class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <el-input v-model="secret" placeholder="HMAC secret，可选" show-password />
          <el-button type="primary" @click="decode">解码/校验</el-button>
        </div>
        <el-alert v-if="errorMessage" class="mt-4" :title="errorMessage" type="error" show-icon />
      </section>

      <section class="tool-card">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">状态</h2>
          <el-button :icon="CopyDocument" :disabled="!decodedText" @click="copyText(decodedText)">复制 JSON</el-button>
        </div>
        <div class="grid gap-3">
          <div class="info"><span>算法</span><strong>{{ header.alg || '-' }}</strong></div>
          <div class="info"><span>类型</span><strong>{{ header.typ || '-' }}</strong></div>
          <div class="info"><span>过期时间</span><strong>{{ expiresText }}</strong></div>
          <div class="info"><span>签名校验</span><strong>{{ verifyText }}</strong></div>
        </div>
      </section>

      <section class="tool-card">
        <h2 class="mb-3 text-sm font-semibold text-gray-900">Header</h2>
        <el-input v-model="headerText" readonly type="textarea" :autosize="{ minRows: 10, maxRows: 18 }" />
      </section>
      <section class="tool-card">
        <h2 class="mb-3 text-sm font-semibold text-gray-900">Payload</h2>
        <el-input v-model="payloadText" readonly type="textarea" :autosize="{ minRows: 10, maxRows: 18 }" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { CopyDocument, Delete } from '@element-plus/icons-vue'
import { base64UrlToText, bytesToBase64Url, copyText, formatJson, textToBytes } from '../utils/devTools'

const token = ref('')
const secret = ref('')
const errorMessage = ref('')
const header = ref({})
const payload = ref({})
const headerText = ref('')
const payloadText = ref('')
const verified = ref(null)

const decodedText = computed(() => headerText.value || payloadText.value ? JSON.stringify({ header: header.value, payload: payload.value }, null, 2) : '')
const expiresText = computed(() => {
  if (!payload.value.exp) return '-'
  const date = new Date(Number(payload.value.exp) * 1000)
  const state = date.getTime() < Date.now() ? '已过期' : '未过期'
  return `${date.toLocaleString()} (${state})`
})
const verifyText = computed(() => verified.value === null ? '未校验' : (verified.value ? '通过' : '失败'))

async function decode() {
  errorMessage.value = ''
  verified.value = null
  try {
    const parts = token.value.trim().split('.')
    if (parts.length !== 3) throw new Error('JWT 必须包含 header、payload、signature 三段')
    header.value = JSON.parse(base64UrlToText(parts[0]))
    payload.value = JSON.parse(base64UrlToText(parts[1]))
    headerText.value = formatJson(header.value)
    payloadText.value = formatJson(payload.value)
    if (secret.value && ['HS256', 'HS384', 'HS512'].includes(header.value.alg)) {
      const algorithm = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }[header.value.alg]
      verified.value = await verifySignature(parts, algorithm)
    }
  } catch (error) {
    errorMessage.value = error?.message || 'JWT 解析失败'
    header.value = {}
    payload.value = {}
    headerText.value = ''
    payloadText.value = ''
  }
}

async function verifySignature(parts, algorithm) {
  const key = await crypto.subtle.importKey('raw', textToBytes(secret.value), { name: 'HMAC', hash: algorithm }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, textToBytes(`${parts[0]}.${parts[1]}`))
  return bytesToBase64Url(new Uint8Array(signature)) === parts[2]
}

function clear() {
  token.value = ''
  secret.value = ''
  errorMessage.value = ''
  header.value = {}
  payload.value = {}
  headerText.value = ''
  payloadText.value = ''
  verified.value = null
}
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; padding: 20px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.info { border: 1px solid #edf2f7; border-radius: 12px; background: #f8fafc; padding: 12px; }
.info span { display: block; color: #64748b; font-size: 12px; }
.info strong { display: block; margin-top: 6px; overflow-wrap: anywhere; color: #111827; }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
