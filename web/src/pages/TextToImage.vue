<template>
  <div class="text-image-page flex h-full min-h-0 flex-col gap-2 overflow-hidden px-4 pb-4">
    <div class="flex min-h-0 flex-1 gap-4">
      <section class="min-w-0 flex-1 overflow-hidden rounded-lg bg-gray-100">
        <div class="flex h-full items-center justify-center overflow-auto p-5">
          <div class="preview-stage" :style="stageStyle">
            <div ref="previewRef" class="export-frame" :style="frameStyle">
              <template v-if="form.mode === 'code'">
                <div class="code-window" :class="[`code-theme-${form.codeTheme}`]" :style="codeWindowStyle">
                  <div v-if="form.codeHeader" class="code-titlebar">
                    <span class="dot red"></span>
                    <span class="dot yellow"></span>
                    <span class="dot green"></span>
                    <span class="code-title">{{ form.language || 'text' }}</span>
                  </div>
                  <pre class="code-block" :class="{ 'wrap-code': form.wrapCode, 'no-lines': !form.lineNumbers }" :style="codeStyle"><code v-html="highlightedCode"></code></pre>
                </div>
              </template>
              <div v-else class="content-shell" :class="[`style-${form.style}`]" :style="shellStyle">
                <template v-if="form.mode === 'plain'">
                  <div class="plain-content" :style="textStyle">{{ form.content }}</div>
                </template>
                <template v-else>
                  <article class="markdown-body" :style="textStyle" v-html="markdownHtml"></article>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="flex w-[390px] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-4 py-3">
          <h1 class="text-base font-semibold text-gray-800">文本转图片</h1>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <el-form label-position="top">
            <el-form-item label="内容类型">
              <el-segmented v-model="form.mode" :options="modeOptions" />
            </el-form-item>
            <el-form-item label="文本内容">
              <el-input
                v-model="form.content"
                type="textarea"
                :rows="12"
                resize="vertical"
                spellcheck="false"
              />
            </el-form-item>
            <div v-if="form.mode === 'code'" class="grid grid-cols-2 gap-3">
              <el-form-item label="代码语言">
                <el-select v-model="form.language">
                  <el-option v-for="item in languageOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="行号">
                <el-switch v-model="form.lineNumbers" />
              </el-form-item>
            </div>
            <div v-if="form.mode === 'code'" class="grid grid-cols-3 gap-3">
              <el-form-item label="代码主题">
                <el-select v-model="form.codeTheme">
                  <el-option label="深色" value="dark" />
                  <el-option label="浅色" value="light" />
                  <el-option label="终端" value="terminal" />
                </el-select>
              </el-form-item>
              <el-form-item label="标题栏">
                <el-switch v-model="form.codeHeader" />
              </el-form-item>
              <el-form-item label="自动换行">
                <el-switch v-model="form.wrapCode" />
              </el-form-item>
            </div>

            <el-divider />

            <el-form-item label="风格">
              <el-select v-model="form.style">
                <el-option v-for="item in styleOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <div class="grid grid-cols-2 gap-3">
              <el-form-item label="画布宽度">
                <el-input-number v-model="form.width" :min="360" :max="2400" :step="40" controls-position="right" />
              </el-form-item>
              <el-form-item label="内边距">
                <el-input-number v-model="form.padding" :min="16" :max="160" :step="4" controls-position="right" />
              </el-form-item>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <el-form-item label="字体大小">
                <el-input-number v-model="form.fontSize" :min="12" :max="64" controls-position="right" />
              </el-form-item>
              <el-form-item label="行高">
                <el-input-number v-model="form.lineHeight" :min="1" :max="2.4" :step="0.05" :precision="2" controls-position="right" />
              </el-form-item>
            </div>
            <el-form-item label="字体">
              <el-select v-model="form.fontFamily">
                <el-option label="系统默认" value="system" />
                <el-option label="微软雅黑" value="Microsoft YaHei, system-ui, sans-serif" />
                <el-option label="宋体" value="SimSun, serif" />
                <el-option label="等宽代码" value="Consolas, Monaco, monospace" />
              </el-select>
            </el-form-item>
            <div class="grid grid-cols-3 gap-3">
              <el-form-item label="文字">
                <el-color-picker v-model="form.textColor" />
              </el-form-item>
              <el-form-item label="卡片">
                <el-color-picker v-model="form.cardColor" show-alpha />
              </el-form-item>
              <el-form-item label="背景">
                <el-color-picker v-model="form.backgroundColor" show-alpha />
              </el-form-item>
            </div>
            <el-form-item label="背景样式">
              <el-select v-model="form.backgroundMode">
                <el-option label="纯色" value="solid" />
                <el-option label="柔和渐变" value="soft" />
                <el-option label="网格纸" value="grid" />
                <el-option label="图片" value="image" />
                <el-option label="透明" value="transparent" />
              </el-select>
            </el-form-item>
            <div v-if="form.backgroundMode === 'image'" class="grid grid-cols-2 gap-3">
              <el-form-item label="背景图片">
                <div class="flex gap-2">
                  <el-button @click="backgroundInputRef?.click()">选择</el-button>
                  <el-button :disabled="!backgroundImage" @click="clearBackgroundImage">清除</el-button>
                </div>
              </el-form-item>
              <el-form-item label="图片适配">
                <el-select v-model="form.backgroundSize">
                  <el-option label="覆盖" value="cover" />
                  <el-option label="完整显示" value="contain" />
                  <el-option label="拉伸" value="100% 100%" />
                  <el-option label="原始" value="auto" />
                </el-select>
              </el-form-item>
            </div>
            <el-form-item v-if="form.backgroundMode === 'image'" label="图片遮罩">
              <el-slider v-model="form.backgroundOverlay" :min="0" :max="100" />
            </el-form-item>

            <el-divider />

            <div class="grid grid-cols-2 gap-3">
              <el-form-item label="文件名">
                <el-input v-model="form.fileName" />
              </el-form-item>
              <el-form-item label="格式">
                <el-select v-model="form.fileType">
                  <el-option label="PNG" value="png" />
                  <el-option label="JPEG" value="jpeg" />
                </el-select>
              </el-form-item>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <el-form-item label="导出倍率">
                <el-select v-model="form.scale">
                  <el-option label="1x" :value="1" />
                  <el-option label="2x" :value="2" />
                  <el-option label="3x" :value="3" />
                </el-select>
              </el-form-item>
              <el-form-item label="质量">
                <el-slider v-model="form.quality" :min="0.1" :max="1" :step="0.05" :disabled="form.fileType === 'png'" />
              </el-form-item>
            </div>
          </el-form>
        </div>
        <div class="border-t border-gray-100 p-4">
          <div class="flex gap-2">
            <el-button :icon="Refresh" @click="applySample">示例</el-button>
            <el-button type="primary" :icon="DocumentCopy" :loading="copying" @click="copyImage">复制图片</el-button>
            <el-button class="flex-1" type="primary" :icon="Download" :loading="exporting" @click="exportImage">导出图片</el-button>
          </div>
        </div>
      </aside>
    </div>
    <SourceCredit :sources="sources" />
    <input ref="backgroundInputRef" type="file" class="hidden" accept="image/*" @change="onBackgroundFileChange" />
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy, Download, Refresh } from '@element-plus/icons-vue'
import html2canvas from 'html2canvas'
import SourceCredit from '../components/SourceCredit.vue'

const previewRef = ref(null)
const backgroundInputRef = ref(null)
const exporting = ref(false)
const copying = ref(false)
const backgroundImage = ref('')

const modeOptions = [
  { label: '普通文本', value: 'plain' },
  { label: '代码块', value: 'code' },
  { label: 'Markdown', value: 'markdown' },
]
const languageOptions = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Shell', value: 'shell' },
  { label: 'Plain Text', value: 'text' },
]
const styleOptions = [
  { label: '清爽卡片', value: 'clean' },
  { label: '暗色代码', value: 'dark' },
  { label: '便签纸', value: 'note' },
  { label: '海报标题', value: 'poster' },
  { label: '终端窗口', value: 'terminal' },
]
const sources = [
  { name: 'html2canvas', url: 'https://github.com/niklasvh/html2canvas' },
]

const samples = {
  plain: '把想法整理成图片，适合分享长文本、公告、摘录和灵感片段。\n\n可以自定义字体、颜色、背景和导出尺寸。',
  code: `function createImage(text) {\n  const canvas = document.createElement('canvas')\n  return render(text, { theme: 'dark', lineNumbers: true })\n}`,
  markdown: `# 文本转图片\n\n支持 **Markdown**、普通文本和 \`代码块\`。\n\n- 标题、列表、引用\n- 粗体、斜体、链接\n- 表格和分割线\n\n> 导出前可以选择不同风格。`,
}

const form = reactive({
  mode: 'markdown',
  content: samples.markdown,
  language: 'javascript',
  lineNumbers: true,
  codeTheme: 'dark',
  codeHeader: true,
  wrapCode: true,
  style: 'clean',
  width: 920,
  padding: 52,
  fontSize: 24,
  lineHeight: 1.55,
  fontFamily: 'system',
  textColor: '#1f2937',
  cardColor: '#ffffff',
  backgroundColor: '#f3f4f6',
  backgroundMode: 'soft',
  backgroundSize: 'cover',
  backgroundOverlay: 18,
  fileName: '文本图片',
  fileType: 'png',
  quality: 0.92,
  scale: 2,
})

watch(() => form.mode, (mode) => {
  if (!form.content || Object.values(samples).includes(form.content)) form.content = samples[mode]
})

const stageStyle = computed(() => ({
  width: `${form.width}px`,
  maxWidth: '100%',
}))

const frameStyle = computed(() => ({
  width: `${form.width}px`,
  boxSizing: 'border-box',
  background: backgroundValue.value,
  backgroundSize: form.backgroundMode === 'image' && backgroundImage.value ? `100% 100%, ${form.backgroundSize}` : undefined,
  backgroundPosition: form.backgroundMode === 'image' ? 'center, center' : undefined,
  backgroundRepeat: form.backgroundMode === 'image' ? 'no-repeat, no-repeat' : undefined,
  padding: `${Math.max(0, Math.round(form.padding / 2))}px`,
}))

const shellStyle = computed(() => ({
  minHeight: '160px',
  padding: `${form.padding}px`,
  color: form.textColor,
  background: form.cardColor,
  fontFamily: resolvedFont.value,
}))

const codeWindowStyle = computed(() => ({
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  background: form.codeTheme === 'light' ? form.cardColor : undefined,
}))

const textStyle = computed(() => ({
  color: form.textColor,
  fontSize: `${form.fontSize}px`,
  lineHeight: form.lineHeight,
  fontFamily: resolvedFont.value,
}))

const codeStyle = computed(() => ({
  fontSize: `${form.fontSize}px`,
  lineHeight: form.lineHeight,
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
}))

const resolvedFont = computed(() => (
  form.fontFamily === 'system'
    ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    : form.fontFamily
))

const backgroundValue = computed(() => {
  if (form.backgroundMode === 'transparent') return 'rgba(0, 0, 0, 0)'
  if (form.backgroundMode === 'image') {
    if (!backgroundImage.value) return form.backgroundColor
    const alpha = form.backgroundOverlay / 100
    return `linear-gradient(rgba(255,255,255,${alpha}), rgba(255,255,255,${alpha})), url("${backgroundImage.value}")`
  }
  if (form.backgroundMode === 'grid') {
    return `linear-gradient(rgba(255,255,255,.42) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.42) 1px, transparent 1px), ${form.backgroundColor}`
  }
  if (form.backgroundMode === 'soft') {
    return `linear-gradient(135deg, ${form.backgroundColor}, ${mixColor(form.backgroundColor, '#ffffff', 0.36)})`
  }
  return form.backgroundColor
})

const highlightedCode = computed(() => {
  const lines = form.content.replace(/\s+$/g, '').split('\n')
  return lines.map((line, index) => {
    const code = highlightLine(line, form.language)
    if (!form.lineNumbers) return `<span class="code-line code-line-no-number"><span class="code-text">${code || ' '}</span></span>`
    return `<span class="code-line"><span class="line-no">${index + 1}</span><span class="code-text">${code || ' '}</span></span>`
  }).join('')
})

const markdownHtml = computed(() => renderMarkdown(form.content))

function applySample() {
  form.content = samples[form.mode]
}

async function exportImage() {
  if (!previewRef.value || exporting.value) return
  exporting.value = true
  try {
    const canvas = await renderCanvas()
    const link = document.createElement('a')
    link.href = canvas.toDataURL(`image/${form.fileType}`, form.quality)
    link.download = `${form.fileName || '文本图片'}.${form.fileType}`
    link.click()
  } catch (error) {
    console.error(error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

async function copyImage() {
  if (!previewRef.value || copying.value) return
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    ElMessage.warning('当前环境不支持复制图片到剪贴板')
    return
  }
  copying.value = true
  try {
    const canvas = await renderCanvas()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('图片生成失败')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    ElMessage.success('图片已复制到剪贴板')
  } catch (error) {
    console.error(error)
    ElMessage.error('复制失败')
  } finally {
    copying.value = false
  }
}

async function renderCanvas() {
  await nextTick()
  if (document.fonts?.ready) await document.fonts.ready
  const host = document.createElement('div')
  const clone = previewRef.value.cloneNode(true)
  host.className = 'text-image-export-host'
  host.style.position = 'fixed'
  host.style.left = '0'
  host.style.top = '0'
  host.style.width = `${form.width}px`
  host.style.height = 'auto'
  host.style.pointerEvents = 'none'
  host.style.zIndex = '-1'
  host.style.contain = 'layout style paint'
  clone.style.position = 'relative'
  clone.style.width = `${form.width}px`
  clone.style.maxWidth = 'none'
  clone.style.boxSizing = 'border-box'
  clone.style.transform = 'none'
  clone.style.margin = '0'
  host.appendChild(clone)
  document.body.appendChild(host)
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return await html2canvas(clone, {
      scale: form.scale,
      backgroundColor: form.backgroundMode === 'transparent' ? null : undefined,
      useCORS: true,
      windowWidth: form.width,
      windowHeight: Math.ceil(clone.getBoundingClientRect().height),
      scrollX: 0,
      scrollY: 0,
    })
  } finally {
    host.remove()
  }
}

function onBackgroundFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    backgroundImage.value = String(reader.result || '')
    form.backgroundMode = 'image'
  }
  reader.onerror = () => ElMessage.error('背景图片读取失败')
  reader.readAsDataURL(file)
}

function clearBackgroundImage() {
  backgroundImage.value = ''
  if (form.backgroundMode === 'image') form.backgroundMode = 'soft'
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const html = []
  let listType = ''
  let listIndex = 1
  let tableBuffer = []

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = ''
      listIndex = 1
    }
  }
  const flushTable = () => {
    if (!tableBuffer.length) return
    html.push(renderTable(tableBuffer))
    tableBuffer = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (isTableLine(line) && isTableDivider(lines[index + 1] || '')) {
      closeList()
      tableBuffer = [line, lines[index + 1]]
      index += 1
      while (isTableLine(lines[index + 1] || '')) {
        tableBuffer.push(lines[index + 1])
        index += 1
      }
      flushTable()
      continue
    }
    if (!line.trim()) {
      closeList()
      flushTable()
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      closeList()
      flushTable()
      html.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`)
      continue
    }
    if (/^---+$/.test(line.trim())) {
      closeList()
      flushTable()
      html.push('<hr />')
      continue
    }
    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      closeList()
      flushTable()
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`)
      continue
    }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      flushTable()
      const nextType = unordered ? 'ul' : 'ol'
      if (listType !== nextType) {
        closeList()
        listType = nextType
        listIndex = 1
        html.push(`<${listType}>`)
      }
      const marker = unordered ? '•' : `${listIndex}.`
      listIndex += 1
      html.push(`<li><span class="md-marker">${marker}</span><span class="md-li-content">${inlineMarkdown((unordered || ordered)[1])}</span></li>`)
      continue
    }
    closeList()
    flushTable()
    html.push(`<p>${inlineMarkdown(line)}</p>`)
  }
  closeList()
  flushTable()
  return html.join('')
}

function renderTable(rows) {
  const [head, , ...body] = rows
  const headers = splitTableRow(head).map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')
  const bodyRows = body.map((row) => `<tr>${splitTableRow(row).map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a>$1</a>')
}

function isTableLine(line) {
  return line.includes('|')
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function highlightLine(line, language) {
  const tokenPattern = /(\/\/.*$|#.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b\d+(?:\.\d+)?\b)/g
  let html = ''
  let lastIndex = 0
  for (const match of line.matchAll(tokenPattern)) {
    html += highlightPlainSegment(line.slice(lastIndex, match.index), language)
    const token = match[0]
    const className = /^\/\//.test(token) || /^#/.test(token) ? 'tok-comment'
      : /^\d/.test(token) ? 'tok-number'
        : 'tok-string'
    html += `<span class="${className}">${escapeHtml(token)}</span>`
    lastIndex = match.index + token.length
  }
  html += highlightPlainSegment(line.slice(lastIndex), language)
  return html
}

function highlightPlainSegment(segment, language) {
  const escaped = escapeHtml(segment)
  if (language === 'text') return escaped
  if (['javascript', 'typescript'].includes(language)) {
    return escaped.replace(/\b(const|let|var|function|return|if|else|for|while|import|from|export|async|await|new|class|try|catch|throw|true|false|null|undefined)\b/g, '<span class="tok-keyword">$1</span>')
  }
  if (language === 'css') {
    return escaped.replace(/\b([a-z-]+)(?=\s*:)/gi, '<span class="tok-keyword">$1</span>')
  }
  if (language === 'html') {
    return escaped.replace(/(&lt;\/?)([a-z0-9-]+)/gi, '$1<span class="tok-keyword">$2</span>')
  }
  if (language === 'json') {
    return escaped.replace(/(&quot;[^&]+&quot;)(?=\s*:)/g, '<span class="tok-keyword">$1</span>')
  }
  if (language === 'shell') {
    return escaped.replace(/\b(cd|ls|npm|node|git|curl|echo|mkdir|rm|cp|mv)\b/g, '<span class="tok-keyword">$1</span>')
  }
  return escaped
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mixColor(color, fallback, amount) {
  const rgb = parseHex(color) || parseHex(fallback)
  if (!rgb) return fallback
  const target = parseHex(fallback) || { r: 255, g: 255, b: 255 }
  const r = Math.round(rgb.r + (target.r - rgb.r) * amount)
  const g = Math.round(rgb.g + (target.g - rgb.g) * amount)
  const b = Math.round(rgb.b + (target.b - rgb.b) * amount)
  return `rgb(${r}, ${g}, ${b})`
}

function parseHex(color) {
  const match = String(color || '').match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return null
  const value = match[1].length === 3 ? match[1].split('').map((char) => char + char).join('') : match[1]
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}
</script>

<style scoped>
.preview-stage {
  transform-origin: center;
}

.export-frame {
  box-sizing: border-box;
  background-size: 28px 28px;
}

.content-shell {
  box-sizing: border-box;
  width: 100%;
  overflow-wrap: anywhere;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
}

.style-clean {
  border-radius: 8px;
}

.style-dark,
.style-terminal {
  border-radius: 8px;
  background: #111827 !important;
  color: #e5e7eb !important;
}

.style-note {
  border-radius: 6px;
  border: 1px solid #f1d58a;
  box-shadow: 0 14px 30px rgba(120, 89, 28, 0.16);
}

.style-poster {
  border-radius: 0;
  border: 10px solid rgba(17, 24, 39, 0.9);
}

.plain-content {
  white-space: pre-wrap;
}

.code-window {
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  background: #0f172a;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.16);
}

.code-theme-light {
  border: 1px solid #d1d5db;
  background: #ffffff;
}

.code-theme-terminal {
  background: #050505;
}

.code-titlebar {
  display: flex;
  height: 42px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding: 0 16px;
  color: #94a3b8;
  font-size: 13px;
}

.code-theme-light .code-titlebar {
  border-bottom-color: #e5e7eb;
  color: #64748b;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red { background: #ff5f57; }
.dot.yellow { background: #febc2e; }
.dot.green { background: #28c840; }

.code-title {
  margin-left: 8px;
}

.code-block {
  margin: 0;
  overflow: visible;
  padding: 18px 0;
  color: #dbeafe;
  white-space: pre;
}

.code-theme-light .code-block {
  color: #1f2937;
}

.code-block :deep(.code-line) {
  display: grid;
  grid-template-columns: auto 1fr;
  min-height: 1.4em;
}

.code-block :deep(.code-line-no-number) {
  grid-template-columns: 1fr;
}

.code-block :deep(.line-no) {
  min-width: 54px;
  padding: 0 16px;
  text-align: right;
  color: #64748b;
  user-select: none;
}

.code-block :deep(.code-text) {
  padding-right: 24px;
  min-width: 0;
  white-space: pre;
}

.code-block.wrap-code :deep(.code-text) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.code-block :deep(.tok-keyword) { color: #93c5fd; }
.code-block :deep(.tok-string) { color: #86efac; }
.code-block :deep(.tok-number) { color: #fbbf24; }
.code-block :deep(.tok-comment) { color: #64748b; }

.code-theme-light .code-block :deep(.tok-keyword) { color: #2563eb; }
.code-theme-light .code-block :deep(.tok-string) { color: #15803d; }
.code-theme-light .code-block :deep(.tok-number) { color: #b45309; }
.code-theme-light .code-block :deep(.tok-comment) { color: #64748b; }

.markdown-body {
  color: inherit;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 0 0 0.65em;
  color: inherit;
  font-weight: 760;
  line-height: 1.18;
}

.markdown-body :deep(h1) { font-size: 1.9em; }
.markdown-body :deep(h2) { font-size: 1.45em; }
.markdown-body :deep(h3) { font-size: 1.2em; }

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(table) {
  margin: 0 0 0.85em;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  list-style: none;
  padding-left: 0;
}

.markdown-body :deep(li + li) {
  margin-top: 0.3em;
}

.markdown-body :deep(li) {
  display: flex;
  align-items: baseline;
  gap: 0.45em;
}

.markdown-body :deep(.md-marker) {
  flex: 0 0 1.1em;
  text-align: right;
}

.markdown-body :deep(.md-li-content) {
  min-width: 0;
  flex: 1 1 auto;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid currentColor;
  opacity: 0.86;
  padding: 0.15em 0 0.15em 0.9em;
}

.markdown-body :deep(code) {
  border-radius: 5px;
  background: rgba(15, 23, 42, 0.08);
  padding: 0.1em 0.35em;
  font-family: Consolas, Monaco, monospace;
  font-size: 0.9em;
}

.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(148, 163, 184, 0.45);
  padding: 0.45em 0.6em;
  text-align: left;
}

.markdown-body :deep(hr) {
  border: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.45);
  margin: 1.2em 0;
}

.style-dark .markdown-body :deep(code),
.style-terminal .markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.12);
}
</style>
