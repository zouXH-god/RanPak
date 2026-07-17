<template>
  <div class="h-full min-h-0 overflow-auto bg-[#f8fafc] px-4 pb-4">
    <div class="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header class="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-soft">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-semibold text-gray-900">HTTP 请求工具</h1>
            <p class="mt-1 text-sm text-gray-500">轻量接口调试，支持方法、URL、Headers、Query、Body、curl 导入、响应和历史。</p>
          </div>
          <el-button :icon="DocumentAdd" plain @click="showCurlDialog = true">导入 curl</el-button>
          <el-button :icon="Delete" plain @click="clearRequest">清空</el-button>
          <el-button :icon="Position" type="primary" :loading="loading" @click="sendRequest">发送</el-button>
        </div>
      </header>

      <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
        <div class="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)_140px]">
          <el-select v-model="form.method">
            <el-option v-for="method in methods" :key="method" :label="method" :value="method" />
          </el-select>
          <el-input v-model="form.url" placeholder="https://httpbin.org/get" @keyup.enter="sendRequest" />
          <el-input-number v-model="form.timeoutMs" class="w-full" :min="1000" :max="120000" :step="1000" controls-position="right" />
        </div>
      </section>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="Query" name="query">
              <KeyValueRows v-model="form.queryRows" />
            </el-tab-pane>
            <el-tab-pane label="Headers" name="headers">
              <KeyValueRows v-model="form.headers" />
            </el-tab-pane>
            <el-tab-pane label="Body" name="body">
              <div class="mb-3 flex flex-wrap items-center gap-3">
                <el-radio-group v-model="form.bodyType">
                  <el-radio-button label="none">None</el-radio-button>
                  <el-radio-button label="json">JSON</el-radio-button>
                  <el-radio-button label="text">Text</el-radio-button>
                  <el-radio-button label="form">Form</el-radio-button>
                </el-radio-group>
                <el-button v-if="form.bodyType === 'json'" size="small" @click="formatBody">格式化 JSON</el-button>
              </div>
              <KeyValueRows v-if="form.bodyType === 'form'" v-model="form.formRows" />
              <el-input v-else-if="form.bodyType !== 'none'" v-model="form.body" type="textarea" :autosize="{ minRows: 10, maxRows: 18 }" />
              <el-empty v-else description="当前请求不发送 Body" />
            </el-tab-pane>
          </el-tabs>
        </section>

        <aside class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-900">历史</h2>
            <el-button size="small" text @click="clearHistory">清空</el-button>
          </div>
          <div class="grid max-h-[360px] gap-2 overflow-auto">
            <button v-for="item in history" :key="item.id" class="history-item" @click="applyHistory(item)">
              <span class="font-semibold">{{ item.method }}</span>
              <span class="truncate">{{ item.url }}</span>
            </button>
          </div>
        </aside>
      </div>

      <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">响应</h2>
          <div class="flex flex-wrap items-center gap-2">
            <el-tag v-if="response" :type="response.ok ? 'success' : 'danger'">{{ response.status }} {{ response.statusText }}</el-tag>
            <el-tag v-if="response" type="info">{{ response.durationMs }} ms</el-tag>
            <el-button :icon="Document" :disabled="!responseText" @click="openResponseInJsonEditor">转到 JSON 编辑器</el-button>
            <el-button :icon="CopyDocument" :disabled="!response" @click="copyText(responseText, '响应已复制')">复制响应</el-button>
            <el-button :icon="Download" :disabled="!response" @click="downloadText(responseText, 'http-response.txt')">下载响应</el-button>
          </div>
        </div>
        <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon class="mb-4" />
        <div v-if="response" class="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <el-table :data="response.headers" border height="320">
            <el-table-column prop="key" label="Header" width="150" />
            <el-table-column prop="value" label="Value" />
          </el-table>
          <el-input v-model="response.body" readonly type="textarea" :autosize="{ minRows: 14, maxRows: 24 }" />
        </div>
        <el-empty v-else description="发送请求后查看响应" />
      </section>

      <el-dialog v-model="showCurlDialog" title="导入 curl" width="720px" :close-on-click-modal="false">
        <el-input
          v-model="curlInput"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 16 }"
          placeholder="粘贴 curl 命令，例如：curl 'https://httpbin.org/post' -H 'Content-Type: application/json' --data-raw '{&quot;name&quot;:&quot;ran&quot;}'"
        />
        <template #footer>
          <el-button @click="showCurlDialog = false">取消</el-button>
          <el-button type="primary" @click="importCurl">解析并带入</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { persistentStorage } from '../utils/sqliteStorage'
import { ElMessage } from 'element-plus'
import { CopyDocument, Delete, Document, DocumentAdd, Download, Position } from '@element-plus/icons-vue'
import KeyValueRows from '../components/devtools/KeyValueRows.vue'
import { copyText, downloadText, formatJson, loadDevToolStore, saveDevToolStore } from '../utils/devTools'

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const JSON_EDITOR_DRAFT_KEY = 'ranpak:json-editor:draft'
const router = useRouter()
const activeTab = ref('query')
const loading = ref(false)
const response = ref(null)
const errorMessage = ref('')
const history = ref([])
const showCurlDialog = ref(false)
const curlInput = ref('')
const form = reactive({
  method: 'GET',
  url: 'https://httpbin.org/get',
  timeoutMs: 30000,
  queryRows: [{ key: '', value: '' }],
  headers: [{ key: '', value: '' }],
  bodyType: 'none',
  body: '',
  formRows: [{ key: '', value: '' }],
})

const responseText = computed(() => response.value?.body || '')

onMounted(async () => {
  const store = await loadDevToolStore()
  history.value = store.httpHistory || []
  if (store.httpLastRequest) Object.assign(form, store.httpLastRequest)
})

async function persist() {
  const store = await loadDevToolStore()
  await saveDevToolStore({
    ...store,
    httpHistory: history.value.map((item) => ({
      id: item.id,
      method: item.method,
      url: item.url,
      request: normalizeRequest(item.request),
    })),
    httpLastRequest: requestSnapshot(),
  })
}

async function sendRequest() {
  if (!form.url.trim()) {
    ElMessage.error('请输入请求 URL')
    return
  }
  loading.value = true
  errorMessage.value = ''
  response.value = null
  try {
    const request = requestSnapshot()
    const result = await window.electronAPI?.devTools?.httpRequest?.(request)
    if (!result?.ok) {
      errorMessage.value = result?.error || '请求失败'
      return
    }
    response.value = result.data
    history.value = [{ id: Date.now(), method: request.method, url: request.url, request }, ...history.value].slice(0, 30)
    await persist()
  } finally {
    loading.value = false
  }
}

function applyHistory(item) {
  Object.assign(form, normalizeRequest(item.request))
}

function normalizeRows(rows) {
  return Array.isArray(rows)
    ? rows.map((row) => ({ key: String(row?.key || ''), value: String(row?.value ?? '') }))
    : [{ key: '', value: '' }]
}

function normalizeRequest(request = {}) {
  return {
    method: String(request.method || 'GET'),
    url: String(request.url || ''),
    timeoutMs: Number(request.timeoutMs || 30000),
    queryRows: normalizeRows(request.queryRows),
    headers: normalizeRows(request.headers),
    bodyType: String(request.bodyType || 'none'),
    body: String(request.body || ''),
    formRows: normalizeRows(request.formRows),
  }
}

function requestSnapshot() {
  return normalizeRequest(form)
}

async function clearHistory() {
  history.value = []
  await persist()
}

function clearRequest() {
  Object.assign(form, {
    method: 'GET',
    url: '',
    timeoutMs: 30000,
    queryRows: [{ key: '', value: '' }],
    headers: [{ key: '', value: '' }],
    bodyType: 'none',
    body: '',
    formRows: [{ key: '', value: '' }],
  })
  response.value = null
  errorMessage.value = ''
}

function formatBody() {
  form.body = formatJson(form.body)
}

function openResponseInJsonEditor() {
  if (!responseText.value) return
  persistentStorage.setItem(JSON_EDITOR_DRAFT_KEY, responseText.value)
  router.push('/json-editor')
}

function importCurl() {
  try {
    const request = parseCurlCommand(curlInput.value)
    Object.assign(form, normalizeRequest(request))
    activeTab.value = request.bodyType === 'none' ? 'headers' : 'body'
    showCurlDialog.value = false
    ElMessage.success('curl 已解析')
  } catch (error) {
    ElMessage.error(error?.message || 'curl 解析失败')
  }
}

function parseCurlCommand(command) {
  const tokens = tokenizeCurl(command)
  if (tokens.length === 0) throw new Error('请输入 curl 命令')
  if (tokens[0].toLowerCase() === 'curl') tokens.shift()
  const request = {
    method: 'GET',
    url: '',
    timeoutMs: form.timeoutMs,
    queryRows: [],
    headers: [],
    bodyType: 'none',
    body: '',
    formRows: [{ key: '', value: '' }],
  }
  let explicitMethod = false
  let useDataAsQuery = false
  const bodyParts = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (token === '-X' || token === '--request') {
      request.method = String(tokens[++index] || 'GET').toUpperCase()
      explicitMethod = true
      continue
    }
    if (token.startsWith('-X') && token.length > 2) {
      request.method = token.slice(2).toUpperCase()
      explicitMethod = true
      continue
    }
    if (['-H', '--header'].includes(token)) {
      addHeader(request.headers, normalizeCurlToken(tokens[++index] || ''))
      continue
    }
    if (token.startsWith('--header=')) {
      addHeader(request.headers, normalizeCurlToken(token.slice('--header='.length)))
      continue
    }
    if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode'].includes(token)) {
      bodyParts.push(normalizeCurlToken(tokens[++index] || ''))
      continue
    }
    if (token.startsWith('--data-raw=')) {
      bodyParts.push(normalizeCurlToken(token.slice('--data-raw='.length)))
      continue
    }
    if (token.startsWith('--data=')) {
      bodyParts.push(normalizeCurlToken(token.slice('--data='.length)))
      continue
    }
    if (token === '--url') {
      request.url = tokens[++index] || ''
      continue
    }
    if (token.startsWith('--url=')) {
      request.url = token.slice('--url='.length)
      continue
    }
    if (token === '-A' || token === '--user-agent') {
      addHeader(request.headers, `User-Agent: ${normalizeCurlToken(tokens[++index] || '')}`)
      continue
    }
    if (token === '-b' || token === '--cookie') {
      addHeader(request.headers, `Cookie: ${normalizeCurlToken(tokens[++index] || '')}`)
      continue
    }
    if (token === '-I' || token === '--head') {
      request.method = 'HEAD'
      explicitMethod = true
      continue
    }
    if (token === '-G' || token === '--get') {
      useDataAsQuery = true
      request.method = 'GET'
      explicitMethod = true
      continue
    }
    if (!token.startsWith('-') && !request.url) {
      request.url = token
    }
  }

  if (!request.url) throw new Error('未找到请求 URL')
  applyUrlToRequest(request)
  if (bodyParts.length > 0) {
    if (useDataAsQuery) {
      bodyParts.forEach((part) => appendQueryString(request.queryRows, part))
    } else {
      request.body = bodyParts.join('&')
      if (!explicitMethod) request.method = 'POST'
      inferBodyType(request)
    }
  }
  if (request.headers.length === 0) request.headers = [{ key: '', value: '' }]
  if (request.queryRows.length === 0) request.queryRows = [{ key: '', value: '' }]
  return request
}

function tokenizeCurl(command) {
  const normalized = String(command || '')
    .replace(/\r?\n\s*\\/g, ' ')
    .replace(/\r?\n\s*\^/g, ' ')
  const tokens = []
  let current = ''
  let quote = ''
  let escaping = false
  for (const char of normalized) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }
    if (char === '\\' && quote !== "'") {
      escaping = true
      continue
    }
    if ((char === '"' || char === "'") && !quote) {
      quote = char
      continue
    }
    if (char === quote) {
      quote = ''
      continue
    }
    if (/\s/.test(char) && !quote) {
      if (current) tokens.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (quote) throw new Error('curl 命令存在未闭合的引号')
  if (escaping) current += '\\'
  if (current) tokens.push(current)
  return tokens
}

function normalizeCurlToken(token) {
  const value = String(token || '')
  if (!value.startsWith('$')) return value
  return decodeBackslashEscapes(value.slice(1))
}

function decodeBackslashEscapes(value) {
  return String(value || '').replace(/\\([\\'"abfnrtv]|x[0-9a-fA-F]{2})/g, (match, sequence) => {
    if (sequence === '\\') return '\\'
    if (sequence === "'") return "'"
    if (sequence === '"') return '"'
    if (sequence === 'a') return '\u0007'
    if (sequence === 'b') return '\b'
    if (sequence === 'f') return '\f'
    if (sequence === 'n') return '\n'
    if (sequence === 'r') return '\r'
    if (sequence === 't') return '\t'
    if (sequence === 'v') return '\v'
    if (sequence.startsWith('x')) return String.fromCharCode(Number.parseInt(sequence.slice(1), 16))
    return match
  })
}

function addHeader(headers, rawHeader) {
  const text = String(rawHeader || '')
  const colonIndex = text.indexOf(':')
  if (colonIndex <= 0) return
  headers.push({
    key: text.slice(0, colonIndex).trim(),
    value: text.slice(colonIndex + 1).trim(),
  })
}

function applyUrlToRequest(request) {
  try {
    const url = new URL(request.url)
    url.searchParams.forEach((value, key) => request.queryRows.push({ key, value }))
    url.search = ''
    request.url = url.toString()
  } catch {
    // Let the request sender surface invalid or relative URLs.
  }
}

function appendQueryString(queryRows, text) {
  const params = new URLSearchParams(String(text || ''))
  params.forEach((value, key) => queryRows.push({ key, value }))
}

function inferBodyType(request) {
  const rawContentType = request.headers.find((item) => item.key.toLowerCase() === 'content-type')?.value || ''
  const normalizedContentType = rawContentType.toLowerCase()
  if (normalizedContentType.includes('application/json') || looksLikeJson(request.body)) {
    request.bodyType = 'json'
    return
  }
  if (normalizedContentType.includes('multipart/form-data')) {
    const formRows = parseMultipartFormData(request.body, rawContentType)
    if (formRows.length > 0) {
      request.bodyType = 'form'
      request.formRows = formRows
      request.body = ''
      removeHeader(request.headers, 'content-type')
      return
    }
  }
  if (normalizedContentType.includes('application/x-www-form-urlencoded')) {
    request.bodyType = 'form'
    request.formRows = []
    appendQueryString(request.formRows, request.body)
    request.body = ''
    if (request.formRows.length === 0) request.formRows = [{ key: '', value: '' }]
    return
  }
  request.bodyType = 'text'
}

function removeHeader(headers, headerName) {
  const target = String(headerName || '').toLowerCase()
  const index = headers.findIndex((item) => item.key.toLowerCase() === target)
  if (index >= 0) headers.splice(index, 1)
}

function parseMultipartFormData(body, contentType) {
  const boundaryMatch = String(contentType || '').match(/boundary=([^;]+)/i)
  const boundary = boundaryMatch?.[1]?.trim().replace(/^"|"$/g, '')
  if (!boundary) return []
  const delimiter = `--${boundary}`
  return String(body || '')
    .split(delimiter)
    .map((part) => part.replace(/^\r?\n/, '').replace(/\r?\n$/, ''))
    .filter((part) => part && part !== '--')
    .map((part) => {
      const separator = part.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n'
      const separatorIndex = part.indexOf(separator)
      if (separatorIndex < 0) return null
      const rawHeaders = part.slice(0, separatorIndex)
      const value = part.slice(separatorIndex + separator.length).replace(/\r?\n--$/, '').replace(/\r?\n$/, '')
      const nameMatch = rawHeaders.match(/name="([^"]+)"/i)
      if (!nameMatch) return null
      return { key: nameMatch[1], value }
    })
    .filter(Boolean)
}

function looksLikeJson(text) {
  const value = String(text || '').trim()
  if (!value || !['{', '['].includes(value[0])) return false
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}
</script>

<style scoped>
.shadow-soft { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.history-item {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 8px;
  border: 1px solid #edf2f7;
  border-radius: 10px;
  padding: 8px 10px;
  text-align: left;
  color: #334155;
}
.history-item:hover { background: #f8fafc; }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
