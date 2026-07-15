<template>
  <div class="rich-text-editor">
    <div class="rte-toolbar">
      <button type="button" class="rte-btn" :class="{ 'is-active': activeState.bold }" title="加粗" @mousedown.prevent="exec('bold')">
        <strong>B</strong>
      </button>
      <button type="button" class="rte-btn rte-hilite" title="高亮凸显" @mousedown.prevent="applyHighlight">
        <span class="rte-hilite-sample">A</span>
      </button>
      <button type="button" class="rte-btn" title="清除高亮" @mousedown.prevent="clearHighlight">
        <span class="rte-clear">A̶</span>
      </button>
      <span class="rte-divider" />
      <button type="button" class="rte-btn" title="插入图片" @mousedown.prevent="pickImage">
        <el-icon><Picture /></el-icon>
      </button>
      <button type="button" class="rte-btn" title="插入超链接" @mousedown.prevent="insertLink">
        <el-icon><Link /></el-icon>
      </button>
      <button type="button" class="rte-btn" title="插入文件" @mousedown.prevent="insertFile">
        <el-icon><Document /></el-icon>
      </button>
    </div>
    <div
      ref="editorRef"
      class="rte-content"
      :class="{ 'is-drag-over': dragOver }"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="onInput"
      @keyup="saveSelection"
      @mouseup="saveSelection"
      @blur="saveSelection"
      @paste="onPaste"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    />
    <div v-show="dragOver" class="rte-drop-hint">释放以插入图片</div>
    <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onFilePicked" />

    <el-dialog v-model="linkDialog.visible" title="插入超链接" width="460px" append-to-body :close-on-click-modal="false">
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="链接地址">
          <el-input v-model="linkDialog.url" placeholder="https://example.com" clearable @keyup.enter="confirmLink" />
        </el-form-item>
        <el-form-item label="显示文字">
          <el-input v-model="linkDialog.label" placeholder="留空则使用链接地址" clearable @keyup.enter="confirmLink" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="linkDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="confirmLink">插入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture, Link, Document } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '输入节点内容，可加粗、高亮或插入图片' },
})
const emit = defineEmits(['update:modelValue'])

const editorRef = ref(null)
const fileInputRef = ref(null)
const savedRange = ref(null)
const dragOver = ref(false)
const activeState = reactive({ bold: false })
const linkDialog = reactive({ visible: false, url: '', label: '' })
const HIGHLIGHT_COLOR = '#fde047'

onMounted(() => {
  if (editorRef.value) editorRef.value.innerHTML = props.modelValue || ''
})

watch(() => props.modelValue, (value) => {
  if (editorRef.value && editorRef.value.innerHTML !== (value || '')) {
    editorRef.value.innerHTML = value || ''
  }
})

function onInput() {
  emit('update:modelValue', editorRef.value?.innerHTML || '')
  refreshActiveState()
}

function saveSelection() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (editorRef.value && editorRef.value.contains(range.commonAncestorContainer)) {
    savedRange.value = range.cloneRange()
  }
  refreshActiveState()
}

function restoreSelection() {
  editorRef.value?.focus()
  if (!savedRange.value) return
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(savedRange.value)
}

function refreshActiveState() {
  try {
    activeState.bold = document.queryCommandState('bold')
  } catch {
    activeState.bold = false
  }
}

function exec(command, value = null) {
  restoreSelection()
  document.execCommand(command, false, value)
  onInput()
}

function applyHighlight() {
  restoreSelection()
  document.execCommand('styleWithCSS', false, true)
  document.execCommand('hiliteColor', false, HIGHLIGHT_COLOR)
  onInput()
}

function clearHighlight() {
  restoreSelection()
  document.execCommand('styleWithCSS', false, true)
  document.execCommand('hiliteColor', false, 'transparent')
  onInput()
}

function pickImage() {
  saveSelection()
  fileInputRef.value?.click()
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

function insertImageDataUrl(dataUrl) {
  editorRef.value?.focus()
  document.execCommand('insertImage', false, dataUrl)
  // 插入后将光标记录到图片之后，便于连续插入
  const selection = window.getSelection()
  if (selection && selection.rangeCount && editorRef.value?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    savedRange.value = selection.getRangeAt(0).cloneRange()
  }
  onInput()
}

async function insertImageFiles(files) {
  const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
  for (const file of images) {
    const dataUrl = await fileToDataUrl(file)
    insertImageDataUrl(dataUrl)
  }
}

function onFilePicked(event) {
  const files = event.target.files
  const list = files ? Array.from(files) : []
  event.target.value = ''
  if (!list.length) return
  restoreSelection()
  insertImageFiles(list)
}

function getSelectedText() {
  if (savedRange.value) return savedRange.value.toString()
  const selection = window.getSelection()
  return selection ? selection.toString() : ''
}

function insertHtmlAtCursor(html) {
  editorRef.value?.focus()
  restoreSelection()
  document.execCommand('insertHTML', false, html)
  const selection = window.getSelection()
  if (selection && selection.rangeCount && editorRef.value?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    savedRange.value = selection.getRangeAt(0).cloneRange()
  }
  onInput()
}

function buildAnchorHtml({ href, label, filePath = '' }) {
  const anchor = document.createElement('a')
  anchor.textContent = label
  anchor.setAttribute('href', href)
  anchor.setAttribute('target', '_blank')
  anchor.setAttribute('rel', 'noopener noreferrer')
  // 设为不可编辑，使链接在编辑器中作为整体块进行删除
  anchor.setAttribute('contenteditable', 'false')
  if (filePath) {
    anchor.setAttribute('data-file', filePath)
    anchor.className = 'rte-file-link'
  } else {
    anchor.className = 'rte-web-link'
  }
  return `${anchor.outerHTML}&nbsp;`
}

function insertLink() {
  saveSelection()
  const selectedText = getSelectedText()
  linkDialog.url = /^https?:\/\//i.test(selectedText) ? selectedText : ''
  linkDialog.label = /^https?:\/\//i.test(selectedText) ? '' : selectedText
  linkDialog.visible = true
}

function confirmLink() {
  let url = String(linkDialog.url || '').trim()
  if (!url) {
    ElMessage.warning('请输入链接地址')
    return
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `https://${url}`
  const label = String(linkDialog.label || '').trim() || url
  linkDialog.visible = false
  insertHtmlAtCursor(buildAnchorHtml({ href: url, label }))
}

async function insertFile() {
  saveSelection()
  const filePath = await window.electronAPI?.selectAnyFile?.()
  if (!filePath) {
    if (!window.electronAPI?.selectAnyFile) ElMessage.warning('文件选择仅在桌面端可用')
    return
  }
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  insertHtmlAtCursor(buildAnchorHtml({ href: filePath, label: fileName, filePath }))
}

async function onPaste(event) {
  const items = event.clipboardData?.items ? Array.from(event.clipboardData.items) : []
  const imageFiles = items
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)
  if (imageFiles.length) {
    event.preventDefault()
    await insertImageFiles(imageFiles)
  }
}

function onDragOver(event) {
  if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  dragOver.value = true
}

function onDragLeave(event) {
  // 离开编辑器范围（而非进入内部子元素）时才隐藏提示
  if (event.currentTarget.contains(event.relatedTarget)) return
  dragOver.value = false
}

async function onDrop(event) {
  const files = event.dataTransfer?.files
  dragOver.value = false
  if (!files || files.length === 0) return
  if (!Array.from(files).some((file) => file.type.startsWith('image/'))) return
  event.preventDefault()
  // 将光标定位到拖放位置
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY)
  if (range) {
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    savedRange.value = range.cloneRange()
  } else {
    restoreSelection()
  }
  await insertImageFiles(files)
}
</script>

<style scoped>
.rich-text-editor {
  position: relative;
  width: 100%;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
}
.rte-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  background: #f8fafc;
}
.rte-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.rte-btn:hover { background: #eef2ff; }
.rte-btn.is-active { background: #dbeafe; border-color: rgba(37, 99, 235, 0.35); color: #1d4ed8; }
.rte-hilite-sample {
  padding: 0 3px;
  border-radius: 3px;
  background: #fde047;
  color: #1f2937;
  font-weight: 700;
}
.rte-clear { font-weight: 700; opacity: 0.7; }
.rte-divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: rgba(148, 163, 184, 0.5);
}
.rte-content {
  min-height: 320px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.7;
  color: #1f2937;
  outline: none;
  transition: box-shadow 0.15s, background 0.15s;
}
.rte-content.is-drag-over {
  background: rgba(239, 246, 255, 0.5);
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.45);
}
.rte-content:empty::before {
  content: attr(data-placeholder);
  color: #94a3b8;
}
.rte-drop-hint {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.92);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
  pointer-events: none;
  z-index: 6;
}
.rte-content :deep(a) {
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
  word-break: break-all;
}
.rte-content :deep(a.rte-file-link) {
  text-decoration: none;
  padding: 1px 8px 1px 6px;
  border-radius: 6px;
  background: #eff6ff;
  border: 1px solid rgba(37, 99, 235, 0.25);
}
.rte-content :deep(a.rte-file-link)::before {
  content: "\1F4CE";
  margin-right: 4px;
}
.rte-content :deep(img) {
  display: inline-block;
  max-width: 100%;
  max-height: 90px;
  width: auto;
  height: auto;
  object-fit: contain;
  vertical-align: middle;
  border-radius: 6px;
  margin: 2px 4px;
}
.hidden { display: none; }
</style>
