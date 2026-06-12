<template>
  <div class="task-flow-overlay" :style="overlayStyle" @wheel.prevent="onWheel">
    <div class="drag-bar" />

    <div class="overlay-content">
      <!-- 进度条 -->
      <div class="progress-track">
        <template v-for="(node, i) in nodes" :key="i">
          <div class="progress-dot" :class="{ 'is-active': i === currentIndex, 'is-done': i < currentIndex }" @click="goTo(i)">
            <span class="dot-inner" />
            <span class="dot-label">{{ node.name || `步骤 ${i + 1}` }}</span>
          </div>
          <div v-if="i < nodes.length - 1" class="progress-line" :class="{ 'is-done': i < currentIndex }" />
        </template>
      </div>

      <!-- 当前节点信息 -->
      <div class="node-content">
        <h2 class="node-title">{{ currentNode?.name || '未命名节点' }}</h2>
        <div class="node-description">{{ currentNode?.description || '暂无描述' }}</div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="overlay-footer">
      <span class="step-indicator">{{ currentIndex + 1 }} / {{ nodes.length }}</span>
      <button class="btn btn-prev" :disabled="currentIndex === 0" @click="prev">上一步</button>
      <button v-if="isLastStep" class="btn btn-finish" @click="finish">完成</button>
      <button v-else class="btn btn-next" @click="next">下一步</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const nodes = ref([])
const currentIndex = ref(0)
const backgroundColor = ref('rgba(15, 23, 42, 0.82)')
const fontColor = ref('#f1f5f9')

const currentNode = computed(() => nodes.value[currentIndex.value] || null)
const isLastStep = computed(() => currentIndex.value >= nodes.value.length - 1)
const overlayStyle = computed(() => ({
  background: backgroundColor.value,
  color: fontColor.value,
}))

const SCALE_STEP = 0.05
const MIN_SIZE = 240
const MAX_SIZE = 1600

let unsubscribe = null

function applyOptions(options) {
  if (!options) return
  if (options.nodes) nodes.value = options.nodes
  if (typeof options.currentIndex === 'number') currentIndex.value = options.currentIndex
  if (options.backgroundColor) backgroundColor.value = options.backgroundColor
  if (options.fontColor) fontColor.value = options.fontColor
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
  window.electronAPI?.updateTaskFlowSession?.({ currentIndex: currentIndex.value })
}

function prev() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    syncSession()
  }
}

function next() {
  if (currentIndex.value < nodes.value.length - 1) {
    currentIndex.value++
    syncSession()
  }
}

function goTo(index) {
  if (index >= 0 && index < nodes.value.length) {
    currentIndex.value = index
    syncSession()
  }
}

function finish() {
  window.electronAPI?.sendTaskFlowEvent?.({ action: 'done' })
  window.electronAPI?.closeCurrentWindow?.()
}

function onWheel(e) {
  const factor = e.deltaY > 0 ? (1 - SCALE_STEP) : (1 + SCALE_STEP)
  const curW = window.outerWidth
  const curH = window.outerHeight
  const w = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, curW * factor)))
  const h = Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, curH * factor)))
  window.resizeTo(w, h)
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

.progress-track {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 2px 0 4px;
  overflow-x: auto;
  flex-shrink: 0;
}

.progress-dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  cursor: pointer;
}
.progress-dot:hover .dot-inner {
  border-color: #60a5fa;
  transform: scale(1.15);
}

.dot-inner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.4);
  border: 2px solid rgba(148, 163, 184, 0.6);
  transition: all 0.25s ease;
}

.progress-dot.is-active .dot-inner {
  background: #3b82f6;
  border-color: #60a5fa;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
  transform: scale(1.2);
}

.progress-dot.is-done .dot-inner {
  background: #22c55e;
  border-color: #4ade80;
}

.dot-label {
  font-size: 10px;
  color: rgba(148, 163, 184, 0.7);
  max-width: 64px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-dot.is-active .dot-label {
  color: #93c5fd;
  font-weight: 600;
}

.progress-line {
  flex: 1;
  min-width: 16px;
  height: 2px;
  background: rgba(148, 163, 184, 0.3);
  margin: 0 3px;
  margin-bottom: 16px;
  border-radius: 1px;
  transition: background 0.25s ease;
}

.progress-line.is-done {
  background: #4ade80;
}

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
  opacity: 0.85;
  white-space: pre-wrap;
  word-break: break-word;
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
