<template>
  <div class="image-viewer" @wheel.prevent="onWheel">
    <header class="viewer-toolbar">
      <div class="viewer-meta">
        <span class="viewer-mark"><el-icon><PictureFilled /></el-icon></span>
        <span class="viewer-name">{{ name || '图片查看' }}</span>
      </div>
      <div class="viewer-tools">
        <button class="tool-btn" title="缩小" @click="zoomBy(-0.2)"><el-icon><ZoomOut /></el-icon></button>
        <span class="zoom-label">{{ Math.round(scale * 100) }}%</span>
        <button class="tool-btn" title="放大" @click="zoomBy(0.2)"><el-icon><ZoomIn /></el-icon></button>
        <button class="tool-btn" title="还原" @click="resetView"><el-icon><RefreshRight /></el-icon></button>
        <span class="tool-divider" />
        <button class="tool-btn close" title="关闭" @click="close"><el-icon><Close /></el-icon></button>
      </div>
    </header>

    <div class="viewer-stage" @mousedown="onPanStart">
      <img
        v-if="src"
        :src="src"
        class="viewer-image"
        :style="imageStyle"
        draggable="false"
        alt=""
      />
      <div v-else class="viewer-empty">
        <el-icon :size="40"><Picture /></el-icon>
        <span>未找到图片</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ZoomIn, ZoomOut, RefreshRight, Close, Picture, PictureFilled } from '@element-plus/icons-vue'

const src = ref('')
const name = ref('')
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)

const panning = ref(false)
let panStartX = 0
let panStartY = 0
let panOriginX = 0
let panOriginY = 0

const imageStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
}))

function onWheel(e) {
  zoomBy(e.deltaY > 0 ? -0.15 : 0.15)
}

function zoomBy(delta) {
  scale.value = Math.min(8, Math.max(0.1, +(scale.value + delta).toFixed(2)))
}

function resetView() {
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0
}

function onPanStart(e) {
  if (e.button !== 0) return
  panning.value = true
  panStartX = e.clientX
  panStartY = e.clientY
  panOriginX = offsetX.value
  panOriginY = offsetY.value
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', onPanEnd)
}

function onPanMove(e) {
  if (!panning.value) return
  offsetX.value = panOriginX + (e.clientX - panStartX)
  offsetY.value = panOriginY + (e.clientY - panStartY)
}

function onPanEnd() {
  panning.value = false
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanEnd)
}

function close() {
  window.electronAPI?.closeCurrentWindow?.()
}

function onKeyDown(e) {
  if (e.key === 'Escape') close()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  const data = await window.electronAPI?.getImageViewerData?.()
  if (data) {
    src.value = data.src || ''
    name.value = data.name || ''
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  onPanEnd()
})
</script>

<style scoped>
.image-viewer {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f8fafc, #eef2f7);
  overflow: hidden;
  user-select: none;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

/* 顶部工具栏：与项目浅色主题一致的磨砂面板 */
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 54px;
  padding: 0 16px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92));
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.06);
  backdrop-filter: blur(12px);
  flex-shrink: 0;
  -webkit-app-region: drag;
}
.viewer-tools,
.viewer-mark {
  -webkit-app-region: no-drag;
}
.viewer-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.viewer-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: #ffffff;
  font-size: 16px;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.24);
  flex-shrink: 0;
}
.viewer-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.viewer-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(203, 213, 225, 0.85);
  border-radius: 10px;
  background: #ffffff;
  color: #475569;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
}
.tool-btn:hover {
  background: #eff6ff;
  border-color: rgba(37, 99, 235, 0.5);
  color: #2563eb;
  transform: translateY(-1px);
}
.tool-btn.close:hover {
  background: #fef2f2;
  border-color: rgba(248, 113, 113, 0.7);
  color: #dc2626;
}
.tool-divider {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: rgba(148, 163, 184, 0.4);
}
.zoom-label {
  min-width: 52px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

/* 图片舞台：浅色棋盘底纹，便于查看任意明暗图片 */
.viewer-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 24px;
  cursor: grab;
  background-color: #eef2f7;
  background-image:
    linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.12) 75%);
  background-size: 22px 22px;
  background-position: 0 0, 0 11px, 11px -11px, -11px 0;
}
.viewer-stage:active { cursor: grabbing; }
.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.22);
  transition: transform 0.05s linear;
  will-change: transform;
}
.viewer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
  font-size: 14px;
}
</style>
