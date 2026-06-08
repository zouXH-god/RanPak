<template>
  <div class="base-convert-page h-full min-h-0 overflow-auto px-4 pb-4">
    <div class="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header class="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-soft">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-semibold text-gray-900">Base 字符串转换</h1>
            <p class="mt-1 text-sm text-gray-500">将任意字符串或文件转换为指定 Base 编码字符串。</p>
          </div>
          <el-tag effect="light">{{ inputModeText }}</el-tag>
          <el-button :icon="CopyDocument" type="primary" :disabled="!outputText" @click="copyOutput">复制结果</el-button>
          <el-button :icon="Download" :disabled="!outputText" @click="downloadOutput">下载</el-button>
        </div>
      </header>

      <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
        <div class="controls-grid">
          <label class="field-block">
            <span>输入来源</span>
            <el-segmented v-model="inputMode" :options="inputModeOptions" />
          </label>

          <label class="field-block">
            <span>Base 类型</span>
            <el-select v-model="baseType" class="w-full">
              <el-option v-for="option in baseTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </label>

          <label class="field-block">
            <span>字符编码</span>
            <el-select v-model="textEncoding" class="w-full" :disabled="inputMode !== 'text'">
              <el-option label="UTF-8" value="utf-8" />
            </el-select>
          </label>

          <label class="field-block">
            <span>文件头</span>
            <el-switch
              v-model="includeFileHeader"
              active-text="附加"
              inactive-text="不附加"
              :disabled="inputMode !== 'file' || !canAttachFileHeader"
            />
          </label>
        </div>
        <p v-if="inputMode === 'file' && !canAttachFileHeader" class="mt-3 text-xs text-gray-500">
          Data URL 文件头仅适用于 Base64 和 Base64URL。
        </p>
      </section>

      <div class="grid gap-4 xl:grid-cols-2">
        <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-gray-900">输入</h2>
            <el-button v-if="inputMode === 'text'" :icon="Delete" type="danger" plain @click="clearText">清空</el-button>
            <el-button v-else :icon="Upload" @click="pickFile">选择文件</el-button>
          </div>

          <el-input
            v-if="inputMode === 'text'"
            v-model="sourceText"
            type="textarea"
            :autosize="{ minRows: 18, maxRows: 28 }"
            resize="vertical"
            placeholder="在这里输入任意字符串..."
          />

          <div v-else class="file-drop" @click="pickFile" @dragover.prevent @drop.prevent="handleDrop">
            <input ref="fileInputRef" class="hidden" type="file" @change="handleFileChange" />
            <el-icon class="text-4xl text-gray-400"><Upload /></el-icon>
            <div class="mt-3 font-medium text-gray-800">{{ selectedFile?.name || '点击或拖入文件' }}</div>
            <div class="mt-1 text-xs text-gray-500">{{ fileHint }}</div>
          </div>
        </section>

        <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-gray-900">输出</h2>
            <div class="flex flex-wrap items-center gap-2">
              <el-tag type="info" effect="light">{{ stats.inputSize }}</el-tag>
              <el-tag type="success" effect="light">{{ stats.outputSize }}</el-tag>
            </div>
          </div>
          <el-input
            v-model="outputText"
            type="textarea"
            :autosize="{ minRows: 18, maxRows: 28 }"
            resize="vertical"
            readonly
            placeholder="转换结果会显示在这里"
          />
        </section>
      </div>

      <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
        <h2 class="text-sm font-semibold text-gray-900">状态</h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="stat-card">
            <span>输入字节</span>
            <strong>{{ stats.inputBytes }}</strong>
          </div>
          <div class="stat-card">
            <span>输出字符</span>
            <strong>{{ stats.outputCharacters }}</strong>
          </div>
          <div class="stat-card">
            <span>文件类型</span>
            <strong>{{ selectedFile?.type || '-' }}</strong>
          </div>
          <div class="stat-card">
            <span>文件头</span>
            <strong>{{ headerStatus }}</strong>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Delete, Download, Upload } from '@element-plus/icons-vue'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const inputMode = ref('text')
const baseType = ref('base64')
const textEncoding = ref('utf-8')
const includeFileHeader = ref(false)
const sourceText = ref('')
const outputText = ref('')
const selectedFile = ref(null)
const fileBytes = ref(new Uint8Array())
const fileInputRef = ref(null)

const inputModeOptions = [
  { label: '字符串', value: 'text' },
  { label: '文件', value: 'file' },
]

const baseTypeOptions = [
  { label: 'Base64', value: 'base64' },
  { label: 'Base64URL', value: 'base64url' },
  { label: 'Base32', value: 'base32' },
  { label: 'Base16', value: 'base16' },
  { label: 'Base58', value: 'base58' },
]

const inputModeText = computed(() => inputMode.value === 'text' ? '字符串输入' : '文件输入')
const canAttachFileHeader = computed(() => ['base64', 'base64url'].includes(baseType.value))
const headerStatus = computed(() => {
  if (inputMode.value !== 'file') return '-'
  return includeFileHeader.value && canAttachFileHeader.value ? '已附加' : '未附加'
})
const fileHint = computed(() => {
  if (!selectedFile.value) return '支持任意文件，按原始字节编码'
  return `${formatBytes(selectedFile.value.size)} · ${selectedFile.value.type || '未知类型'}`
})
const stats = computed(() => {
  const inputBytes = inputMode.value === 'text'
    ? encodeText(sourceText.value).length
    : fileBytes.value.length
  return {
    inputBytes,
    outputCharacters: outputText.value.length,
    inputSize: `输入 ${formatBytes(inputBytes)}`,
    outputSize: `输出 ${formatBytes(outputText.value.length)}`,
  }
})

watch([inputMode, baseType, includeFileHeader, sourceText, fileBytes], convertInput, { immediate: true })

watch(baseType, () => {
  if (!canAttachFileHeader.value) includeFileHeader.value = false
})

function convertInput() {
  const bytes = inputMode.value === 'text' ? encodeText(sourceText.value) : fileBytes.value
  if (bytes.length === 0) {
    outputText.value = ''
    return
  }
  const encoded = encodeBytes(bytes, baseType.value)
  outputText.value = buildFileHeader() + encoded
}

function encodeText(text) {
  return new TextEncoder().encode(text)
}

function encodeBytes(bytes, type) {
  if (type === 'base64') return encodeBase64(bytes)
  if (type === 'base64url') return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  if (type === 'base32') return encodeBase32(bytes)
  if (type === 'base16') return encodeBase16(bytes)
  if (type === 'base58') return encodeBase58(bytes)
  return encodeBase64(bytes)
}

function encodeBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function encodeBase16(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function encodeBase32(bytes) {
  let output = ''
  let buffer = 0
  let bitsLeft = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bitsLeft += 8
    while (bitsLeft >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bitsLeft - 5)) & 31]
      bitsLeft -= 5
    }
  }
  if (bitsLeft > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31]
  }
  while (output.length % 8 !== 0) output += '='
  return output
}

function encodeBase58(bytes) {
  if (bytes.length === 0) return ''
  let leadingZeros = 0
  for (const byte of bytes) {
    if (byte !== 0) break
    leadingZeros += 1
  }
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8
      digits[index] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  if (leadingZeros === bytes.length) return BASE58_ALPHABET[0].repeat(leadingZeros)
  let output = ''
  output += BASE58_ALPHABET[0].repeat(leadingZeros)
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    output += BASE58_ALPHABET[digits[index]]
  }
  return output
}

function buildFileHeader() {
  if (inputMode.value !== 'file' || !includeFileHeader.value || !canAttachFileHeader.value) return ''
  const mimeType = selectedFile.value?.type || 'application/octet-stream'
  return `data:${mimeType};base64,`
}

function pickFile() {
  fileInputRef.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) loadFile(file)
}

function handleDrop(event) {
  const file = event.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

function loadFile(file) {
  const reader = new FileReader()
  reader.onload = () => {
    selectedFile.value = file
    fileBytes.value = new Uint8Array(reader.result || new ArrayBuffer(0))
    ElMessage.success(`已读取 ${file.name}`)
  }
  reader.onerror = () => ElMessage.error('文件读取失败')
  reader.readAsArrayBuffer(file)
}

function clearText() {
  sourceText.value = ''
  ElMessage.success('内容已清空')
}

async function copyOutput() {
  if (!outputText.value) return
  await navigator.clipboard.writeText(outputText.value)
  ElMessage.success('转换结果已复制')
}

function downloadOutput() {
  if (!outputText.value) return
  const blob = new Blob([outputText.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const baseName = selectedFile.value?.name ? `${selectedFile.value.name}.base.txt` : 'base-string.txt'
  link.href = url
  link.download = baseName
  link.click()
  URL.revokeObjectURL(url)
}

function formatBytes(bytes) {
  const size = Math.max(0, Number(bytes || 0))
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<style scoped>
.base-convert-page {
  background: #f8fafc;
}

.shadow-soft {
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  align-items: end;
}

.field-block {
  display: grid;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
}

.field-block > span {
  font-weight: 700;
  color: #111827;
}

.file-drop {
  min-height: 390px;
  display: grid;
  place-content: center;
  justify-items: center;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  background: #f8fafc;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.file-drop:hover {
  border-color: #409eff;
  background: #f5fbff;
}

.stat-card {
  min-width: 0;
  border: 1px solid #edf2f7;
  border-radius: 14px;
  background: #f8fafc;
  padding: 14px;
}

.stat-card span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.stat-card strong {
  margin-top: 6px;
  display: block;
  overflow-wrap: anywhere;
  color: #111827;
  font-size: 15px;
}

:deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.55;
}
</style>
