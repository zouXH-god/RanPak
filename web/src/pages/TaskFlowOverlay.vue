<template>
  <div class="task-flow-overlay" :style="overlayStyle">
    <div class="drag-bar" />

    <div class="overlay-content">
      <!-- 路径面包屑 -->
      <div v-if="breadcrumb.length" class="breadcrumb">
        <template v-for="(crumb, i) in breadcrumb" :key="crumb.key">
          <button class="crumb" :class="{ 'is-current': i === breadcrumb.length - 1 }" @click="goToDepth(crumb.depth)">
            {{ crumb.name }}
          </button>
          <span v-if="i < breadcrumb.length - 1" class="crumb-sep">/</span>
        </template>
      </div>

      <!-- 当前节点信息 -->
      <div class="node-content">
        <h2 class="node-title">{{ currentTitle }}</h2>
        <div
          v-if="currentContent"
          ref="contentRef"
          class="node-description rich"
          v-html="currentContent"
          @click="onContentClick"
        />
        <div v-else class="node-description empty">暂无内容</div>
      </div>

      <!-- 子节点选项：多个子节点时才展示选择 -->
      <div v-if="childOptions.length > 1" class="branch-options">
        <div class="branch-title">{{ currentNode ? '下一步选择' : '选择起点' }}</div>
        <div class="branch-buttons">
          <button
            v-for="child in childOptions"
            :key="child.id"
            class="branch-btn"
            @click="enterChild(child)"
          >
            <span class="branch-btn-name">{{ child.name || '未命名节点' }}</span>
            <span v-if="child.children && child.children.length" class="branch-btn-count">{{ child.children.length }} 分支</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="overlay-footer">
      <span class="step-indicator">{{ depthLabel }}</span>
      <button class="btn btn-prev" :disabled="!canGoBack" @click="goBack">上一级</button>
      <button v-if="childOptions.length === 1" class="btn btn-next" @click="enterChild(childOptions[0])">下一步</button>
      <button v-if="childOptions.length === 0" class="btn btn-finish" @click="finish">完成</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const nodes = ref([])
const flowName = ref('任务流')
const pathIds = ref([])
const backgroundColor = ref('rgba(15, 23, 42, 0.82)')
const fontColor = ref('#f1f5f9')
const contentRef = ref(null)

const baseDepth = computed(() => (nodes.value.length === 1 ? 1 : 0))

const nodeMap = computed(() => {
  const map = {}
  const walk = (list) => (list || []).forEach((node) => { map[node.id] = node; walk(node.children) })
  walk(nodes.value)
  return map
})

function effectiveChildren(node) {
  if (!node) return nodes.value
  const embedded = node.children || []
  const linked = (node.linkIds || []).map((id) => nodeMap.value[id]).filter(Boolean)
  return [...embedded, ...linked]
}

function nodeByPath(ids) {
  let list = nodes.value
  let node = null
  for (const id of ids) {
    node = list.find((n) => n.id === id)
    if (!node) return null
    list = effectiveChildren(node)
  }
  return node
}

const currentNode = computed(() => (pathIds.value.length ? nodeByPath(pathIds.value) : null))
const childOptions = computed(() => effectiveChildren(currentNode.value))
const currentTitle = computed(() => currentNode.value?.name || flowName.value || '任务流')
const currentContent = computed(() => currentNode.value?.content || '')
const canGoBack = computed(() => pathIds.value.length > baseDepth.value)

const breadcrumb = computed(() => {
  const crumbs = [{ key: 'root', name: flowName.value || '任务流', depth: 0 }]
  let list = nodes.value
  for (let i = 0; i < pathIds.value.length; i++) {
    const id = pathIds.value[i]
    const node = list.find((n) => n.id === id)
    if (!node) break
    crumbs.push({ key: node.id, name: node.name || '未命名节点', depth: i + 1 })
    list = effectiveChildren(node)
  }
  if (baseDepth.value === 1) return crumbs.slice(1)
  return crumbs
})

const depthLabel = computed(() => `第 ${pathIds.value.length} 层`)

const overlayStyle = computed(() => ({
  background: backgroundColor.value,
  color: fontColor.value,
}))

let unsubscribe = null

function defaultPath() {
  return nodes.value.length === 1 ? [nodes.value[0].id] : []
}

function applyOptions(options) {
  if (!options) return
  if (options.nodes) nodes.value = options.nodes
  if (options.flowName) flowName.value = options.flowName
  if (options.backgroundColor) backgroundColor.value = options.backgroundColor
  if (options.fontColor) fontColor.value = options.fontColor
  if (Array.isArray(options.currentPath) && options.currentPath.length) {
    pathIds.value = options.currentPath
  }
  // 校验路径有效性，无效则回退到默认
  if (!isPathValid(pathIds.value)) pathIds.value = defaultPath()
}

function isPathValid(ids) {
  if (ids.length === 0) return baseDepth.value === 0
  let list = nodes.value
  for (const id of ids) {
    const node = list.find((n) => n.id === id)
    if (!node) return false
    list = effectiveChildren(node)
  }
  return true
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    window.electronAPI?.closeCurrentWindow?.()
  }
}

onMounted(async () => {
  document.documentElement.classList.add('overlay-transparent-root')
  document.body.classList.add('overlay-transparent-root')
  window.addEventListener('keydown', onKeyDown)
  unsubscribe = window.electronAPI?.onTaskFlowOptions?.((options) => applyOptions(options))
  const initial = await window.electronAPI?.getTaskFlowOptions?.()
  applyOptions(initial)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  window.removeEventListener('keydown', onKeyDown)
  document.documentElement.classList.remove('overlay-transparent-root')
  document.body.classList.remove('overlay-transparent-root')
})

function syncSession() {
  window.electronAPI?.updateTaskFlowSession?.({ currentPath: pathIds.value })
}

function enterChild(child) {
  pathIds.value = [...pathIds.value, child.id]
  syncSession()
}

function goBack() {
  if (!canGoBack.value) return
  pathIds.value = pathIds.value.slice(0, -1)
  syncSession()
}

function goToDepth(depth) {
  if (depth < baseDepth.value) return
  pathIds.value = pathIds.value.slice(0, depth)
  syncSession()
}

async function onContentClick(event) {
  const target = event.target
  const anchor = target?.closest?.('a')
  if (anchor) {
    event.preventDefault()
    const filePath = anchor.getAttribute('data-file')
    if (filePath) {
      await window.electronAPI?.openPath?.(filePath)
    } else {
      const href = anchor.getAttribute('href')
      if (href) window.electronAPI?.openExternal?.(href)
    }
    return
  }
  if (target && target.tagName === 'IMG') {
    const src = target.currentSrc || target.src
    if (src) window.electronAPI?.openImageViewer?.({ src, name: currentTitle.value })
  }
}

function finish() {
  window.electronAPI?.sendTaskFlowEvent?.({ action: 'done' })
  window.electronAPI?.closeCurrentWindow?.()
}
</script>

<style scoped>
.task-flow-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(16px);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.drag-bar {
  -webkit-app-region: drag;
  height: 20px;
  min-height: 20px;
  cursor: move;
}

.overlay-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 18px;
  overflow-y: auto;
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 0 4px;
  flex-shrink: 0;
}
.crumb {
  background: none;
  border: none;
  padding: 2px 4px;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.85);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.crumb:hover { color: #93c5fd; background: rgba(148, 163, 184, 0.12); }
.crumb.is-current { color: #93c5fd; font-weight: 600; }
.crumb-sep { font-size: 11px; color: rgba(148, 163, 184, 0.5); }

.node-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.node-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 700;
  color: inherit;
}

.node-description {
  font-size: 14px;
  line-height: 1.7;
  color: inherit;
  opacity: 0.9;
  word-break: break-word;
}
.node-description.empty { opacity: 0.5; }
.node-description.rich :deep(img) {
  display: inline-block;
  max-width: 100%;
  max-height: 100px;
  width: auto;
  height: auto;
  object-fit: contain;
  vertical-align: middle;
  border-radius: 6px;
  margin: 2px 4px;
  cursor: zoom-in;
  transition: transform 0.15s;
}
.node-description.rich :deep(img:hover) {
  transform: scale(1.01);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.node-description.rich :deep(b),
.node-description.rich :deep(strong) { font-weight: 700; }
.node-description.rich :deep(a) {
  color: #60a5fa;
  text-decoration: underline;
  cursor: pointer;
  word-break: break-all;
}
.node-description.rich :deep(a.rte-file-link) {
  text-decoration: none;
  padding: 1px 8px 1px 6px;
  border-radius: 6px;
  background: rgba(96, 165, 250, 0.16);
  border: 1px solid rgba(96, 165, 250, 0.4);
}
.node-description.rich :deep(a.rte-file-link)::before {
  content: "\1F4CE";
  margin-right: 4px;
}

.branch-options {
  flex-shrink: 0;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.branch-title {
  font-size: 11px;
  opacity: 0.55;
  margin-bottom: 8px;
}
.branch-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.branch-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.12);
  color: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.branch-btn:hover {
  background: #3b82f6;
  border-color: #60a5fa;
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
}
.branch-btn-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  opacity: 0.85;
}

.overlay-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.step-indicator {
  margin-right: auto;
  font-size: 12px;
  color: inherit;
  opacity: 0.6;
}

.btn {
  padding: 6px 16px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-prev {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}
.btn-prev:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.35);
  transform: translateY(-1px);
}
.btn-prev:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-next {
  background: #3b82f6;
  color: #fff;
}
.btn-next:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
}

.btn-finish {
  background: #22c55e;
  color: #fff;
}
.btn-finish:hover {
  background: #16a34a;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.3);
}

:global(html.overlay-transparent-root),
:global(body.overlay-transparent-root),
:global(body.overlay-transparent-root #app) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent !important;
}
</style>
