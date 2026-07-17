<template>
  <div class="json-editor-page h-full min-h-0 overflow-auto px-4 pb-4">
    <div class="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header class="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-soft">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-semibold text-gray-900">JSON 编辑器</h1>
            <p class="mt-1 text-sm text-gray-500">编辑、格式化、校验、压缩、排序和导入导出 JSON。</p>
          </div>
          <el-tag :type="statusTagType" effect="light">{{ statusText }}</el-tag>
          <el-button :icon="Upload" @click="pickJsonFile">导入</el-button>
          <el-button :icon="Download" type="primary" :disabled="!isValid" @click="downloadJson">下载</el-button>
          <input ref="fileInputRef" class="hidden" type="file" accept=".json,application/json" @change="handleFileChange" />
        </div>
      </header>

      <section class="rounded-2xl border border-gray-100 bg-white p-3 shadow-soft">
        <div class="toolbar">
          <el-button-group>
            <el-button :icon="MagicStick" @click="formatJson">格式化</el-button>
            <el-button :icon="Fold" @click="compactJson">压缩</el-button>
            <el-button :icon="Sort" @click="sortJson">排序</el-button>
            <el-button :icon="Crop" @click="trimArrays">列表留一项</el-button>
            <el-button :icon="RefreshRight" @click="repairJson">修复</el-button>
          </el-button-group>
          <el-button-group>
            <el-button :icon="CopyDocument" @click="copyJson">复制</el-button>
            <el-button :icon="DocumentAdd" @click="loadExample">示例</el-button>
            <el-button :icon="Delete" type="danger" plain @click="clearEditor">清空</el-button>
          </el-button-group>
        </div>
      </section>

      <div class="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section class="editor-shell rounded-2xl border border-gray-100 bg-white shadow-soft">
          <div ref="editorRef" class="json-editor-host"></div>
        </section>

        <aside class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
          <h2 class="text-sm font-semibold text-gray-900">状态</h2>
          <div class="mt-4 grid gap-3">
            <div class="stat-row">
              <span>校验</span>
              <strong :class="isValid ? 'text-emerald-600' : 'text-rose-600'">{{ statusText }}</strong>
            </div>
            <div class="stat-row">
              <span>字符数</span>
              <strong>{{ stats.characters }}</strong>
            </div>
            <div class="stat-row">
              <span>行数</span>
              <strong>{{ stats.lines }}</strong>
            </div>
            <div class="stat-row">
              <span>格式化大小</span>
              <strong>{{ stats.prettySize }}</strong>
            </div>
          </div>

          <div class="mt-5 rounded-xl border border-gray-100 bg-[#f8fafc] p-3">
            <div class="text-xs font-semibold text-gray-500">错误信息</div>
            <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-gray-500">
              {{ errorMessage || '当前 JSON 有效。' }}
            </p>
          </div>
        </aside>
      </div>
      <SourceCredit :sources="sources" />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { persistentStorage } from '../utils/sqliteStorage'
import {
  CopyDocument,
  Crop,
  Delete,
  DocumentAdd,
  Download,
  Fold,
  MagicStick,
  RefreshRight,
  Sort,
  Upload,
} from '@element-plus/icons-vue'
import { createJSONEditor, Mode } from 'vanilla-jsoneditor'
import SourceCredit from '../components/SourceCredit.vue'

const DRAFT_KEY = 'ranpak:json-editor:draft'
const sources = [
  { name: 'vanilla-jsoneditor', url: 'https://github.com/josdejong/svelte-jsoneditor' },
]
const SAMPLE_JSON = {
  name: 'RanTerminal',
  type: 'json-editor',
  enabled: true,
  features: ['format', 'compact', 'sort', 'validate', 'tree-view'],
  meta: {
    createdBy: 'JSON 编辑器',
    version: 1,
  },
}

const editorRef = ref(null)
const fileInputRef = ref(null)
const isValid = ref(true)
const errorMessage = ref('')
const currentText = ref(JSON.stringify(SAMPLE_JSON, null, 2))
const stats = reactive({
  characters: 0,
  lines: 0,
  prettySize: '0 B',
})

let editor = null
let content = { json: SAMPLE_JSON }
let localizationObserver = null

const statusText = computed(() => isValid.value ? 'JSON 有效' : 'JSON 无效')
const statusTagType = computed(() => isValid.value ? 'success' : 'danger')

const UI_TRANSLATIONS = {
  text: '文本',
  tree: '树形',
  table: '表格',
  'view': '查看',
  'Tree': '树形',
  'Text': '文本',
  'Table': '表格',
  'View': '查看',
  'Change mode': '切换模式',
  'Switch to tree mode': '切换到树形模式',
  'Switch to text mode': '切换到文本模式',
  'Switch to table mode': '切换到表格模式',
  'Switch to view mode': '切换到查看模式',
  'Format': '格式化',
  'Compact': '压缩',
  'Repair JSON': '修复 JSON',
  'Transform': '转换',
  'Sort': '排序',
  'Sort array items': '排序数组项',
  'Sort object keys': '排序对象键',
  'ascending': '升序',
  'descending': '降序',
  'Search': '搜索',
  'Open search box': '打开搜索',
  'Close search box': '关闭搜索',
  'Find': '查找',
  'Next': '下一个',
  'Previous': '上一个',
  'Undo': '撤销',
  'Redo': '重做',
  'Copy': '复制',
  'Cut': '剪切',
  'Paste': '粘贴',
  'Duplicate': '复制一份',
  'Remove': '删除',
  'Edit': '编辑',
  'Insert': '插入',
  'Append': '追加',
  'Extract': '提取',
  'Expand': '展开',
  'Collapse': '折叠',
  'Expand all': '全部展开',
  'Collapse all': '全部折叠',
  'Select all': '全选',
  'Clear': '清空',
  'Cancel': '取消',
  'Apply': '应用',
  'Ok': '确定',
  'Close': '关闭',
  'Refresh': '刷新',
  'JSON is valid': 'JSON 有效',
  'JSON is invalid': 'JSON 无效',
  'No search results': '没有搜索结果',
  'No results': '没有结果',
  'contents': '内容',
  'key': '键名',
  'value': '值',
  'array': '数组',
  'object': '对象',
  'string': '字符串',
  'number': '数字',
  'boolean': '布尔值',
  'null': '空值',
  'Insert value': '插入值',
  'Insert object': '插入对象',
  'Insert array': '插入数组',
  'Insert string': '插入字符串',
  'Insert number': '插入数字',
  'Insert boolean': '插入布尔值',
  'Insert null': '插入空值',
  'Edit value': '编辑值',
  'Edit key': '编辑键名',
  'Edit nested content': '编辑嵌套内容',
  '(document root)': '文档根节点',
  'document root': '文档根节点',
}

onMounted(async () => {
  await nextTick()
  const draft = persistentStorage.getItem(DRAFT_KEY)
  content = draft === null ? { json: SAMPLE_JSON } : { text: draft }
  editor = createJSONEditor({
    target: editorRef.value,
    props: {
      content,
      mode: Mode.tree,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true,
      askToFormat: true,
      onRenderMenu: localizeMenuItems,
      onRenderContextMenu: localizeMenuItems,
      onChange: handleEditorChange,
    },
  })
  refreshState(content)
  setupEditorLocalization()
})

onBeforeUnmount(() => {
  localizationObserver?.disconnect?.()
  localizationObserver = null
  editor?.destroy?.()
  editor = null
})

function handleEditorChange(updatedContent) {
  content = updatedContent
  refreshState(updatedContent)
}

function refreshState(nextContent = getEditorContent()) {
  const text = contentToText(nextContent)
  currentText.value = text
  persistentStorage.setItem(DRAFT_KEY, text)
  stats.characters = text.length
  stats.lines = text ? text.split(/\r\n|\r|\n/).length : 0
  try {
    const parsed = parseContent(nextContent)
    isValid.value = true
    errorMessage.value = ''
    stats.prettySize = formatBytes(JSON.stringify(parsed, null, 2).length)
  } catch (error) {
    isValid.value = false
    errorMessage.value = error?.message || 'JSON 解析失败'
    stats.prettySize = '不可用'
  }
}

function getEditorContent() {
  return editor?.get?.() || content
}

function setEditorContent(nextContent) {
  content = nextContent
  editor?.set?.(nextContent)
  refreshState(nextContent)
}

function parseContent(nextContent = getEditorContent()) {
  if (Object.prototype.hasOwnProperty.call(nextContent, 'json')) return nextContent.json
  const text = String(nextContent.text ?? '')
  if (!text.trim()) throw new Error('内容为空')
  return JSON.parse(text)
}

function contentToText(nextContent = getEditorContent()) {
  if (Object.prototype.hasOwnProperty.call(nextContent, 'text')) return String(nextContent.text ?? '')
  return JSON.stringify(nextContent.json, null, 2)
}

function formatJson() {
  try {
    const parsed = parseContent()
    setEditorContent({ text: JSON.stringify(parsed, null, 2) })
    ElMessage.success('JSON 已格式化')
  } catch (error) {
    showJsonError(error)
  }
}

function compactJson() {
  try {
    const parsed = parseContent()
    setEditorContent({ text: JSON.stringify(parsed) })
    ElMessage.success('JSON 已压缩')
  } catch (error) {
    showJsonError(error)
  }
}

function sortJson() {
  try {
    const parsed = parseContent()
    setEditorContent({ json: sortJsonValue(parsed) })
    ElMessage.success('JSON 键名已排序')
  } catch (error) {
    showJsonError(error)
  }
}

function trimArrays() {
  try {
    const parsed = parseContent()
    const { value, trimmedCount } = trimArrayItems(parsed)
    setEditorContent({ json: value })
    ElMessage.success(trimmedCount > 0 ? `已删减 ${trimmedCount} 个列表项` : '没有需要删减的列表')
  } catch (error) {
    showJsonError(error)
  }
}

function repairJson() {
  try {
    const repaired = editor?.acceptAutoRepair?.()
    if (!repaired) throw new Error('当前内容无法自动修复')
    setEditorContent(repaired)
    ElMessage.success('JSON 已修复')
  } catch (error) {
    showJsonError(error)
  }
}

async function copyJson() {
  try {
    const parsed = parseContent()
    await navigator.clipboard.writeText(JSON.stringify(parsed, null, 2))
    ElMessage.success('JSON 已复制')
  } catch (error) {
    showJsonError(error)
  }
}

function clearEditor() {
  setEditorContent({ text: '' })
  persistentStorage.setItem(DRAFT_KEY, '')
  ElMessage.success('内容已清空')
}

function loadExample() {
  setEditorContent({ json: SAMPLE_JSON })
  ElMessage.success('已加载示例 JSON')
}

function pickJsonFile() {
  fileInputRef.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result || '')
    setEditorContent({ text })
    ElMessage.success(`已导入 ${file.name}`)
  }
  reader.onerror = () => ElMessage.error('文件读取失败')
  reader.readAsText(file, 'utf-8')
}

function downloadJson() {
  try {
    const parsed = parseContent()
    const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'data.json'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    showJsonError(error)
  }
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort((a, b) => a.localeCompare(b)).reduce((acc, key) => {
    acc[key] = sortJsonValue(value[key])
    return acc
  }, {})
}

function trimArrayItems(value) {
  if (Array.isArray(value)) {
    const firstTrimmed = value.length > 0 ? trimArrayItems(value[0]) : { value: undefined, trimmedCount: 0 }
    return {
      value: value.length > 0 ? [firstTrimmed.value] : [],
      trimmedCount: Math.max(0, value.length - 1) + firstTrimmed.trimmedCount,
    }
  }
  if (!value || typeof value !== 'object') return { value, trimmedCount: 0 }
  return Object.entries(value).reduce((acc, [key, item]) => {
    const trimmed = trimArrayItems(item)
    acc.value[key] = trimmed.value
    acc.trimmedCount += trimmed.trimmedCount
    return acc
  }, { value: {}, trimmedCount: 0 })
}

function showJsonError(error) {
  isValid.value = false
  errorMessage.value = translateErrorMessage(error?.message || 'JSON 解析失败')
  ElMessage.error(errorMessage.value)
}

function formatBytes(bytes) {
  const size = Math.max(0, Number(bytes || 0))
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function localizeMenuItems(items) {
  return items.map(localizeMenuItem)
}

function localizeMenuItem(item) {
  if (!item || typeof item !== 'object') return item
  const nextItem = { ...item }
  if ('text' in nextItem) nextItem.text = translateEditorText(nextItem.text)
  if ('title' in nextItem) nextItem.title = translateEditorText(nextItem.title)
  if (nextItem.type === 'dropdown-button') {
    nextItem.main = localizeMenuItem(nextItem.main)
    nextItem.items = nextItem.items?.map(localizeMenuItem) || []
  }
  if (Array.isArray(nextItem.items)) {
    nextItem.items = nextItem.items.map(localizeMenuItem)
  }
  return nextItem
}

function setupEditorLocalization() {
  localizeEditorChrome()
  localizationObserver = new MutationObserver(() => localizeEditorChrome())
  localizationObserver.observe(editorRef.value, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['title', 'aria-label', 'placeholder'],
  })
}

function localizeEditorChrome() {
  const root = editorRef.value
  if (!root) return
  const chromeRoots = root.querySelectorAll([
    '.jse-menu',
    '.jse-navigation-bar',
    '.jse-status-bar',
    '.jse-context-menu',
    '.jse-modal',
    '.cm-panels',
  ].join(','))
  chromeRoots.forEach((chromeRoot) => {
    chromeRoot.querySelectorAll('[title]').forEach((node) => {
      setTranslatedAttribute(node, 'title')
    })
    chromeRoot.querySelectorAll('[aria-label]').forEach((node) => {
      setTranslatedAttribute(node, 'aria-label')
    })
    chromeRoot.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((node) => {
      setTranslatedAttribute(node, 'placeholder')
    })
    chromeRoot.querySelectorAll('button, label, span, div').forEach((node) => {
      if (node.children.length > 0) return
      const text = node.textContent?.trim()
      if (!text) return
      const translated = translateEditorText(text)
      if (translated !== text) node.textContent = translated
    })
  })
}

function setTranslatedAttribute(node, attribute) {
  const currentValue = node.getAttribute(attribute)
  const translated = translateEditorText(currentValue)
  if (translated !== currentValue) node.setAttribute(attribute, translated)
}

function translateEditorText(text) {
  if (!text) return text
  const normalized = String(text).trim()
  if (UI_TRANSLATIONS[normalized]) return UI_TRANSLATIONS[normalized]
  return normalized
    .replace(/^Search\.\.\.$/, '搜索...')
    .replace(/^Search$/, '搜索')
    .replace(/^(\d+) result$/, '$1 个结果')
    .replace(/^(\d+) results$/, '$1 个结果')
    .replace(/^Line (\d+), column (\d+)$/, '第 $1 行，第 $2 列')
    .replace(/^Ln (\d+), Col (\d+)$/, '第 $1 行，第 $2 列')
    .replace(/^Edit nested content(.*)$/, '编辑嵌套内容$1')
    .replace(/^Unexpected token (.*) in JSON at position (\d+)$/, 'JSON 第 $2 个字符附近存在意外内容：$1')
    .replace(/^Unexpected end of JSON input$/, 'JSON 内容意外结束')
}

function translateErrorMessage(message) {
  return translateEditorText(message)
}
</script>

<style scoped>
.json-editor-page {
  background: #f8fafc;
}

.shadow-soft {
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.editor-shell {
  min-width: 0;
  min-height: 640px;
  overflow: hidden;
}

.json-editor-host {
  width: 100%;
  height: 100%;
  min-height: 640px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 10px;
  color: #64748b;
  font-size: 13px;
}

.stat-row strong {
  color: #111827;
  font-weight: 700;
}

:deep(.jse-main) {
  border: 0;
  background: #fff;
}

:deep(.jse-theme-default),
:deep(.jse-main) {
  --jse-theme-color: #409eff;
  --jse-theme-color-highlight: #ecf5ff;
  --jse-selection-background-color: #ecf5ff;
  --jse-selection-background-inactive-color: #f1f5f9;
  --jse-menu-color: #1f2329;
  --jse-menu-button-size: 32px;
  --jse-font-size: 13px;
  --jse-font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  --jse-font-family-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

:deep(.jse-menu) {
  border-bottom: 1px solid #edf2f7;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  color: #1f2329;
}

:deep(.jse-menu button),
:deep(.jse-menu .jse-button) {
  border-radius: 8px;
}

:deep(.jse-menu button:hover),
:deep(.jse-menu .jse-button:hover) {
  background: #ecf5ff;
  color: #409eff;
}

:deep(.jse-navigation-bar),
:deep(.jse-status-bar) {
  border-color: #edf2f7;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
}

:deep(.jse-contents),
:deep(.cm-editor) {
  background: #fff;
}

:deep(.jse-key),
:deep(.jse-value) {
  border-radius: 5px;
}

:deep(.jse-key) {
  color: #1f2329;
}

:deep(.jse-string) {
  color: #047857;
}

:deep(.jse-number) {
  color: #2563eb;
}

:deep(.jse-boolean),
:deep(.jse-null) {
  color: #9333ea;
}

:deep(.jse-context-menu),
:deep(.jse-modal) {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
}

:deep(.jse-modal .jse-header) {
  background: #f8fafc;
  color: #1f2329;
}
</style>
