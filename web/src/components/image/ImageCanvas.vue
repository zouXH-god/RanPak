<template>
  <div
    ref="wrapperRef"
    class="image-canvas-wrapper relative h-full w-full min-h-[200px] min-w-0 rounded-lg bg-gray-100"
  >
    <!-- 未加载图：铺满区域，避免画布尺寸为 0 -->
    <div
      v-if="!imageLoaded"
      class="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 text-gray-400"
    >
      <el-icon :size="48"><Upload /></el-icon>
      <span class="text-sm">拖拽图片到此处或点击上传</span>
      <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileSelect" />
      <el-button type="primary" @click="fileInputRef?.click()">选择图片</el-button>
    </div>
    <!-- 铺满父级，Fabric 才能收到完整区域的鼠标事件 -->
    <canvas
      ref="canvasRef"
      v-show="imageLoaded"
      class="absolute inset-0 z-[2] block h-full w-full touch-manipulation"
    />
    <ImageCoordinateAxes
      v-if="imageLoaded && imageFrame"
      :frame="imageFrame"
      :natural-width="naturalWidth"
      :natural-height="naturalHeight"
    />
    <div
      v-if="imageLoaded"
      class="pointer-events-none absolute top-2 right-2 z-[6] rounded bg-black/65 px-2 py-1 text-xs font-mono text-white tabular-nums shadow"
    >
      {{ pointerCoordText }}
    </div>
    <div
      v-if="!imageLoaded"
      class="absolute inset-0 z-0"
      @dragover.prevent
      @drop.prevent="handleDrop"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import * as fabric from 'fabric'
import ImageCoordinateAxes from './ImageCoordinateAxes.vue'
import {
  scenePointToImagePixel,
  isInsideImagePixel,
  getImageFrameRelativeToWrapper,
} from './utils/imageCoordinateUtils.js'
import { createEditableTextbox, isFabricTextOverlay } from './utils/fabricOverlayText.js'
import { renderWorkflowPreview } from './utils/frontendPreview.js'

const props = defineProps({
  previewUrl: { type: String, default: '' },
  displayScaleMode: { type: String, default: 'fit' },
})

const emit = defineEmits(['image-loaded', 'canvas-ready', 'load-error', 'file-selected'])

const canvasRef = ref(null)
const wrapperRef = ref(null)
const fileInputRef = ref(null)
const imageLoaded = ref(false)

const naturalWidth = ref(0)
const naturalHeight = ref(0)
const imageFrame = ref(null)
const pointerCoordText = ref('移动鼠标查看坐标')

let fabricCanvas = null
let bgImage = null
let originalImageUrl = ''
let generatedPreviewUrl = ''
let previewRequestId = 0
let cropRect = null
let cropAspectRatio = null
let cropAspectRatioLabel = ''
/** 监听包裹层尺寸变化，解决 flex 布局下初始 clientWidth 为 0 的问题 */
let resizeObserver = null
/** 坐标轴布局刷新：用 rAF 合并，避免 after:render 每帧触发 Vue 更新拖垮 Fabric 文字交互 */
let imageFrameRaf = null

/**
 * 根据当前背景图与画布，刷新图片在包裹层中的屏幕矩形（供坐标轴定位）
 */
function updateImageFrame() {
  if (!wrapperRef.value || !fabricCanvas || !bgImage) {
    imageFrame.value = null
    return
  }
  bgImage.setCoords()
  imageFrame.value = getImageFrameRelativeToWrapper(fabricCanvas, bgImage, wrapperRef.value)
}

/**
 * 在下一帧刷新坐标轴包围盒（拖拽文字时不要每帧同步改 Vue，否则 IText 无法稳定选中）
 */
function scheduleUpdateImageFrame() {
  if (imageFrameRaf != null) return
  imageFrameRaf = requestAnimationFrame(() => {
    imageFrameRaf = null
    updateImageFrame()
  })
}

/**
 * 画布 mouse:move：将指针换算为图片内相对像素坐标
 * @param {import('fabric').TPointerEventInfo} opt
 */
function onCanvasMouseMove(opt) {
  if (!fabricCanvas || !bgImage || !opt?.e) {
    return
  }
  const scene = fabricCanvas.getScenePoint(opt.e)
  const local = scenePointToImagePixel(bgImage, scene.x, scene.y)
  if (isInsideImagePixel(local, bgImage)) {
    pointerCoordText.value = `X: ${Math.round(local.x)}  Y: ${Math.round(local.y)}`
  } else {
    pointerCoordText.value = '不在图片内'
  }
}

/**
 * 叠加对象变换后刷新坐标轴位置
 */
function onOverlayTransformed(opt) {
  if (opt?.target === cropRect) {
    constrainCropRect()
  }
  scheduleUpdateImageFrame()
}

function attachCoordinateHandlers() {
  if (!fabricCanvas) return
  fabricCanvas.on('mouse:move', onCanvasMouseMove)
  fabricCanvas.on('object:moving', onOverlayTransformed)
  fabricCanvas.on('object:scaling', onOverlayTransformed)
  fabricCanvas.on('object:rotating', onOverlayTransformed)
  fabricCanvas.on('object:modified', onOverlayTransformed)
  fabricCanvas.on('mouse:up', scheduleUpdateImageFrame)
}

function detachCoordinateHandlers() {
  if (!fabricCanvas) return
  fabricCanvas.off('mouse:move', onCanvasMouseMove)
  fabricCanvas.off('object:moving', onOverlayTransformed)
  fabricCanvas.off('object:scaling', onOverlayTransformed)
  fabricCanvas.off('object:rotating', onOverlayTransformed)
  fabricCanvas.off('object:modified', onOverlayTransformed)
  fabricCanvas.off('mouse:up', scheduleUpdateImageFrame)
}

function initCanvas() {
  if (!canvasRef.value) return
  fabricCanvas = new fabric.Canvas(canvasRef.value, {
    backgroundColor: '#f3f4f6',
    selection: true,
    preserveObjectStacking: true,
  })
  attachCoordinateHandlers()
  emit('canvas-ready', fabricCanvas)
}

/**
 * 将 Fabric 画布设为与包裹层同宽高，并重新居中背景图
 * 使用 wrapperRef 而非 canvas 父节点，避免 flex 居中导致量错尺寸
 */
function resizeCanvas() {
  if (!fabricCanvas || !wrapperRef.value) return
  const w = Math.floor(wrapperRef.value.clientWidth)
  const h = Math.floor(wrapperRef.value.clientHeight)
  if (w < 2 || h < 2) return

  fabricCanvas.setDimensions({ width: w, height: h })
  if (bgImage) {
    centerBackground(bgImage)
  }
  nextTick(scheduleUpdateImageFrame)
}

function resolveDisplayScale(cw, ch, iw, ih) {
  const fit = Math.min(cw / iw, ch / ih)
  if (props.displayScaleMode === 'fit') {
    const MAX_UPSCALE = 16
    return Math.min(MAX_UPSCALE, fit)
  }
  if (props.displayScaleMode === 'actual') {
    return 1
  }
  if (props.displayScaleMode === '100') {
    return 1
  }
  return Math.min(16, fit)
}

/**
 * 将背景图缩放后居中「包含」在画布内。
 * 小图会放大填满可用区域（旧逻辑用 Math.min(..., 1) 导致始终不超过 100% 显得很小）；
 * 极大放大倍数用 MAX_UPSCALE 限制，避免图标级像素被拉得过度模糊。
 * @param {import('fabric').FabricImage} img
 */
function centerBackground(img) {
  if (!fabricCanvas) return
  const cw = fabricCanvas.getWidth()
  const ch = fabricCanvas.getHeight()
  const iw = img.width || 1
  const ih = img.height || 1
  const scale = resolveDisplayScale(cw, ch, iw, ih)
  img.set({
    scaleX: scale,
    scaleY: scale,
    left: (cw - iw * scale) / 2,
    top: (ch - ih * scale) / 2,
    selectable: false,
    evented: false,
  })
  fabricCanvas.renderAll()
}

/**
 * 从 URL 加载背景图（推荐 blob:，以便携带鉴权后的二进制；普通 http + Bearer 无法用 img 加载）
 * @param {string} url
 */
async function loadImage(url) {
  if (!fabricCanvas || !url) return

  try {
    // blob: 同源，无需 anonymous；跨域 URL 再设 crossOrigin 以免污染 canvas
    const isBlob = url.startsWith('blob:')
    const img = await fabric.FabricImage.fromURL(
      url,
      isBlob ? {} : { crossOrigin: 'anonymous' }
    )

    if (bgImage) {
      fabricCanvas.backgroundImage = undefined
    }
    bgImage = img
    bgImage.set({ selectable: false, evented: false })
    fabricCanvas.backgroundImage = bgImage

    await nextTick()
    resizeCanvas()
    centerBackground(bgImage)

    imageLoaded.value = true
    naturalWidth.value = img.width || 0
    naturalHeight.value = img.height || 0
    pointerCoordText.value = '移动鼠标查看坐标'
    nextTick(scheduleUpdateImageFrame)

    emit('image-loaded', {
      width: img.width,
      height: img.height,
    })
  } catch (err) {
    console.error('loadImage failed', err)
    imageLoaded.value = false
    emit('load-error', err)
  }
}

/**
 * 记录原图，并恢复画布背景为原图。单图预览的后续步骤都从该 URL 重新计算。
 * @param {string} url
 * @param {object} [_info]
 */
async function setOriginalImage(url, _info = {}) {
  originalImageUrl = url || ''
  if (generatedPreviewUrl) {
    URL.revokeObjectURL(generatedPreviewUrl)
    generatedPreviewUrl = ''
  }
  if (originalImageUrl) {
    await loadImage(originalImageUrl)
  }
}

/**
 * 在浏览器端应用工作流步骤并替换背景预览，不修改可交互文字等叠加对象。
 * @param {{ type: string, params?: object }[]} steps
 */
async function applyPreviewSteps(steps = []) {
  if (!originalImageUrl) return
  const requestId = ++previewRequestId

  if (!steps.length) {
    if (generatedPreviewUrl) {
      URL.revokeObjectURL(generatedPreviewUrl)
      generatedPreviewUrl = ''
    }
    await loadImage(originalImageUrl)
    return
  }

  const result = await renderWorkflowPreview(originalImageUrl, steps)
  if (requestId !== previewRequestId) {
    if (result.url) URL.revokeObjectURL(result.url)
    return
  }

  const previous = generatedPreviewUrl
  generatedPreviewUrl = result.url
  await loadImage(result.url)
  if (previous) URL.revokeObjectURL(previous)
}

function getImageSceneBounds() {
  if (!bgImage) return null
  return {
    left: bgImage.left || 0,
    top: bgImage.top || 0,
    width: (bgImage.width || 1) * (bgImage.scaleX || 1),
    height: (bgImage.height || 1) * (bgImage.scaleY || 1),
  }
}

function setCropControlMode() {
  if (!cropRect) return
  cropRect.set({
    lockRotation: true,
    lockScalingFlip: true,
    lockUniScaling: Boolean(cropAspectRatio),
  })
  cropRect.setControlsVisibility?.({
    mtr: false,
    mt: !cropAspectRatio,
    mb: !cropAspectRatio,
    ml: !cropAspectRatio,
    mr: !cropAspectRatio,
    tl: true,
    tr: true,
    bl: true,
    br: true,
  })
}

function constrainCropRect() {
  if (!cropRect || !bgImage) return
  const bounds = getImageSceneBounds()
  if (!bounds) return

  const minSize = 12
  let width = Math.max(minSize, (cropRect.width || minSize) * (cropRect.scaleX || 1))
  let height = Math.max(minSize, (cropRect.height || minSize) * (cropRect.scaleY || 1))

  if (cropAspectRatio) {
    const scale = Math.min(
      width / (cropRect.width || minSize),
      height / (cropRect.height || minSize),
      bounds.width / (cropRect.width || minSize),
      bounds.height / (cropRect.height || minSize)
    )
    cropRect.set({ scaleX: scale, scaleY: scale })
    width = (cropRect.width || minSize) * scale
    height = (cropRect.height || minSize) * scale
  } else {
    if (width > bounds.width) {
      cropRect.set({ scaleX: bounds.width / (cropRect.width || minSize) })
      width = bounds.width
    }
    if (height > bounds.height) {
      cropRect.set({ scaleY: bounds.height / (cropRect.height || minSize) })
      height = bounds.height
    }
  }

  const left = Math.min(
    Math.max(cropRect.left || bounds.left, bounds.left),
    bounds.left + bounds.width - width
  )
  const top = Math.min(
    Math.max(cropRect.top || bounds.top, bounds.top),
    bounds.top + bounds.height - height
  )
  cropRect.set({ left, top })
  cropRect.setCoords()
  fabricCanvas?.requestRenderAll()
}

/**
 * 进入或更新裁剪框模式。
 * @param {{ aspectRatio?: number | null, aspectRatioLabel?: string }} options
 */
function startCropSelection(options = {}) {
  if (!fabricCanvas || !bgImage) return false
  const bounds = getImageSceneBounds()
  if (!bounds) return false

  cropAspectRatio = Number(options.aspectRatio) > 0 ? Number(options.aspectRatio) : null
  cropAspectRatioLabel = options.aspectRatioLabel || ''

  if (!cropRect) {
    let width = bounds.width * 0.7
    let height = bounds.height * 0.7
    if (cropAspectRatio) {
      if (width / height > cropAspectRatio) {
        width = height * cropAspectRatio
      } else {
        height = width / cropAspectRatio
      }
    }

    cropRect = new fabric.Rect({
      left: bounds.left + (bounds.width - width) / 2,
      top: bounds.top + (bounds.height - height) / 2,
      width,
      height,
      fill: 'rgba(37, 99, 235, 0.14)',
      stroke: '#2563eb',
      strokeWidth: 2,
      strokeUniform: true,
      cornerColor: '#2563eb',
      cornerStrokeColor: '#ffffff',
      cornerSize: 10,
      transparentCorners: false,
      objectCaching: false,
      selectable: true,
      evented: true,
    })
    fabricCanvas.add(cropRect)
  } else if (cropAspectRatio) {
    const currentWidth = cropRect.getScaledWidth()
    cropRect.set({
      width: currentWidth,
      height: currentWidth / cropAspectRatio,
      scaleX: 1,
      scaleY: 1,
    })
  }

  setCropControlMode()
  constrainCropRect()
  fabricCanvas.bringObjectToFront(cropRect)
  fabricCanvas.setActiveObject(cropRect)
  fabricCanvas.requestRenderAll()
  return true
}

function cancelCropSelection() {
  if (!fabricCanvas || !cropRect) return
  fabricCanvas.remove(cropRect)
  cropRect = null
  cropAspectRatio = null
  cropAspectRatioLabel = ''
  fabricCanvas.discardActiveObject()
  fabricCanvas.requestRenderAll()
}

function confirmCropSelection() {
  if (!fabricCanvas || !bgImage || !cropRect) return null
  constrainCropRect()
  const left = cropRect.left || 0
  const top = cropRect.top || 0
  const right = left + cropRect.getScaledWidth()
  const bottom = top + cropRect.getScaledHeight()
  const topLeft = scenePointToImagePixel(bgImage, left, top)
  const bottomRight = scenePointToImagePixel(bgImage, right, bottom)
  const x = Math.max(0, Math.round(topLeft.x))
  const y = Math.max(0, Math.round(topLeft.y))
  const width = Math.max(1, Math.round(bottomRight.x - topLeft.x))
  const height = Math.max(1, Math.round(bottomRight.y - topLeft.y))
  const params = { x, y, width, height }
  if (cropAspectRatioLabel) {
    params.aspect_ratio_label = cropAspectRatioLabel
  }
  cancelCropSelection()
  return params
}

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) emit('file-selected', file)
}

function handleDrop(e) {
  const file = e.dataTransfer.files?.[0]
  if (file && file.type.startsWith('image/')) {
    emit('file-selected', file)
  }
}

/**
 * 添加可编辑文字：Textbox 支持拖动、改宽、单击/双击进入编辑
 * @param {object} [options]
 */
function addText(options = {}) {
  if (!fabricCanvas) return
  const text = createEditableTextbox({
    content: options.content,
    left: options.x ?? 120,
    top: options.y ?? 120,
    fontSize: options.size ?? 24,
    fill: options.color,
  })
  fabricCanvas.add(text)
  fabricCanvas.bringObjectToFront(text)
  fabricCanvas.setActiveObject(text)
  text.setCoords()
  fabricCanvas.requestRenderAll()
  scheduleUpdateImageFrame()
}

/** 添加贴纸图片到画布 */
async function addSticker(url, options = {}) {
  if (!fabricCanvas) return
  const isBlob = url.startsWith('blob:')
  const img = await fabric.FabricImage.fromURL(
    url,
    isBlob ? {} : { crossOrigin: 'anonymous' }
  )
  img.set({
    left: options.x || 100,
    top: options.y || 100,
    scaleX: (options.width || 80) / img.width,
    scaleY: (options.height || 80) / img.height,
    angle: options.angle || 0,
    stickerImageId: options.imageId || '',
    objectCaching: false,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockScalingFlip: true,
  })
  fabricCanvas.add(img)
  fabricCanvas.bringObjectToFront(img)
  fabricCanvas.setActiveObject(img)
  img.setCoords()
  fabricCanvas.requestRenderAll()
}

/** 获取画布上所有叠加物的信息（用于传给后端） */
function getOverlays() {
  if (!fabricCanvas) return []
  const objs = fabricCanvas.getObjects()
  const overlays = []
  for (const obj of objs) {
    if (isFabricTextOverlay(obj)) {
      overlays.push({
        type: 'text',
        content: obj.text,
        x: Math.round(obj.left),
        y: Math.round(obj.top),
        size: Math.round(obj.fontSize * (obj.scaleX || 1)),
        color: obj.fill,
      })
    }
  }
  return overlays
}

/** 获取后端导出可用的叠加物参数，坐标映射到当前预览图片的像素空间 */
function getExportOverlays() {
  if (!fabricCanvas || !bgImage) return []
  const overlays = []
  for (const obj of fabricCanvas.getObjects()) {
    if (!isFabricTextOverlay(obj)) continue

    const local = scenePointToImagePixel(bgImage, obj.left || 0, obj.top || 0)
    overlays.push({
      type: 'text',
      content: obj.text,
      x: Math.round(local.x),
      y: Math.round(local.y),
      size: Math.max(1, Math.round((obj.fontSize || 24) * (obj.scaleY || 1) / (bgImage.scaleY || 1))),
      color: obj.fill,
      font: obj.fontFamily,
    })
  }
  for (const obj of fabricCanvas.getObjects()) {
    if (isFabricTextOverlay(obj) || !obj.stickerImageId) continue

    const left = obj.left || 0
    const top = obj.top || 0
    const local = scenePointToImagePixel(bgImage, left, top)
    overlays.push({
      type: 'sticker',
      image_id: obj.stickerImageId,
      x: Math.round(local.x),
      y: Math.round(local.y),
      width: Math.max(1, Math.round(obj.getScaledWidth() / (bgImage.scaleX || 1))),
      height: Math.max(1, Math.round(obj.getScaledHeight() / (bgImage.scaleY || 1))),
      angle: obj.angle || 0,
    })
  }
  return overlays
}

/** 清除所有叠加物 */
function clearOverlays() {
  if (!fabricCanvas) return
  const objs = fabricCanvas.getObjects()
  objs.forEach(o => fabricCanvas.remove(o))
  cropRect = null
  fabricCanvas.renderAll()
}

/** 重置画布 */
function reset() {
  if (fabricCanvas) {
    fabricCanvas.clear()
    fabricCanvas.backgroundColor = '#f3f4f6'
    fabricCanvas.backgroundImage = undefined
    fabricCanvas.renderAll()
  }
  bgImage = null
  cropRect = null
  cropAspectRatio = null
  cropAspectRatioLabel = ''
  originalImageUrl = ''
  if (generatedPreviewUrl) {
    URL.revokeObjectURL(generatedPreviewUrl)
    generatedPreviewUrl = ''
  }
  imageLoaded.value = false
  naturalWidth.value = 0
  naturalHeight.value = 0
  imageFrame.value = null
  pointerCoordText.value = '移动鼠标查看坐标'
}

watch(
  () => props.previewUrl,
  (url) => {
    if (url) loadImage(url)
    else reset()
  }
)

watch(
  () => props.displayScaleMode,
  () => {
    if (bgImage) {
      centerBackground(bgImage)
      nextTick(scheduleUpdateImageFrame)
    }
  }
)

onMounted(() => {
  initCanvas()
  nextTick(() => {
    resizeCanvas()
    if (wrapperRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas()
      })
      resizeObserver.observe(wrapperRef.value)
    }
    // watch 默认不在挂载时用初值触发，此处补上「进入页面时已有 previewUrl」的情况
    if (props.previewUrl) {
      loadImage(props.previewUrl)
    }
  })
  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  resizeObserver?.disconnect()
  resizeObserver = null
  if (imageFrameRaf != null) {
    cancelAnimationFrame(imageFrameRaf)
    imageFrameRaf = null
  }
  if (fabricCanvas) {
    detachCoordinateHandlers()
    fabricCanvas.dispose()
    fabricCanvas = null
  }
  if (generatedPreviewUrl) {
    URL.revokeObjectURL(generatedPreviewUrl)
    generatedPreviewUrl = ''
  }
})

defineExpose({
  loadImage,
  setOriginalImage,
  applyPreviewSteps,
  addText,
  addSticker,
  getOverlays,
  getExportOverlays,
  startCropSelection,
  cancelCropSelection,
  confirmCropSelection,
  clearOverlays,
  reset,
  getCanvas: () => fabricCanvas,
})
</script>
