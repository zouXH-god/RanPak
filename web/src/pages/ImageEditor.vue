<template>
  <div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
    <div class="flex min-h-0 flex-1 overflow-hidden">
      <!-- 左侧：工具面板 -->
      <ToolPanel
        class="w-72 shrink-0 border-r border-gray-200 bg-white"
        @add-step="addStep"
        @add-sticker="triggerStickerUpload"
        @start-crop="startCropMode"
      />

    <!-- 中间：画布区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶部工具栏 -->
      <div class="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
        <el-button :icon="Upload" size="small" @click="triggerUpload">上传图片</el-button>
        <el-button :icon="RefreshLeft" size="small" @click="undoStep" :disabled="!workflowSteps.length">撤销</el-button>
        <el-button :icon="Delete" size="small" @click="clearAll">清空</el-button>
        <span class="text-xs text-gray-500 ml-2">显示</span>
        <el-select v-model="displayScaleMode" size="small" class="!w-28">
          <el-option label="适应屏幕" value="fit" />
          <el-option label="百分百" value="100" />
          <el-option label="实际大小" value="actual" />
        </el-select>
        <div class="flex-1" />
        <el-button type="primary" size="small" :icon="Download" @click="handleExport" :disabled="!imageId">
          导出
        </el-button>
        <el-button size="small" @click="showBatch = true" :disabled="!workflowSteps.length">批处理</el-button>
      </div>

      <div
        v-if="cropMode"
        class="border-b border-blue-100 bg-blue-50 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0"
      >
        <span class="text-sm font-medium text-blue-700">裁剪比例</span>
        <el-select v-model="cropRatioKey" size="small" class="!w-32" @change="applyCropRatio">
          <el-option
            v-for="item in CROP_RATIO_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <template v-if="cropRatioKey === 'custom'">
          <el-input-number
            v-model="customCropRatioWidth"
            :min="1"
            :max="100"
            size="small"
            controls-position="right"
            class="!w-24"
            @change="applyCropRatio"
          />
          <span class="text-blue-500">:</span>
          <el-input-number
            v-model="customCropRatioHeight"
            :min="1"
            :max="100"
            size="small"
            controls-position="right"
            class="!w-24"
            @change="applyCropRatio"
          />
        </template>
        <div class="flex-1" />
        <el-button size="small" @click="cancelCropMode">取消</el-button>
        <el-button type="primary" size="small" @click="confirmCropMode">应用裁剪</el-button>
      </div>

      <!-- 画布 -->
      <div class="flex-1 min-h-0 p-4 overflow-hidden">
        <ImageCanvas
          ref="canvasRef"
          :preview-url="previewUrl"
          :display-scale-mode="displayScaleMode"
          @file-selected="handleUpload"
          @image-loaded="onImageLoaded"
          @load-error="onCanvasLoadError"
        />
      </div>
    </div>

      <!-- 右侧：工作流面板 -->
      <WorkflowPanel
        class="w-72 shrink-0 border-l border-gray-200 bg-white"
        :steps="workflowSteps"
        :loading="previewing"
        @remove-step="removeStep"
        @reorder="reorderSteps"
        @update-step="updateStepParams"
        @preview="requestPreview"
      />
    </div>

    <SourceCredit :sources="sources" class="shrink-0 py-1" />

    <!-- 批处理弹窗 -->
    <BatchDialog
      v-model:visible="showBatch"
      :steps="workflowSteps"
      :output-format="outputFormat"
    />

    <ExportDialog
      v-model:visible="showExport"
      :output-format="outputFormat"
      :loading="exporting"
      @confirm="confirmExport"
    />

    <!-- 隐藏的文件上传 -->
    <input ref="uploadRef" type="file" accept="image/*" class="hidden" @change="onFileInputChange" />
    <input ref="stickerUploadRef" type="file" accept="image/*" class="hidden" @change="onStickerInputChange" />
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, nextTick } from 'vue'
import { Upload, Download, RefreshLeft, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ImageCanvas from '../components/image/ImageCanvas.vue'
import ToolPanel from '../components/image/ToolPanel.vue'
import WorkflowPanel from '../components/image/WorkflowPanel.vue'
import BatchDialog from '../components/image/BatchDialog.vue'
import ExportDialog from '../components/image/ExportDialog.vue'
import SourceCredit from '../components/SourceCredit.vue'
import { mergeStepParams } from '../components/image/config/stepDefaults.js'
import {
  uploadImage,
  processAndDownload,
  fetchUploadedImageAsObjectUrl,
  revokePreviewObjectUrl,
} from '../utils/api/image'

const sources = [
  { name: 'Fabric.js', url: 'https://github.com/fabricjs/fabric.js' },
]

const canvasRef = ref(null)
const uploadRef = ref(null)
const stickerUploadRef = ref(null)

const imageId = ref('')
const imageInfo = ref(null)
/** 当前画布预览源（多为 blob:，因 /image/file 需 Bearer 无法在 img 中直接使用） */
const previewUrl = ref('')
const outputFormat = ref('PNG')
const displayScaleMode = ref('fit')
const previewing = ref(false)
const exporting = ref(false)
const showBatch = ref(false)
const showExport = ref(false)
const cropMode = ref(false)
const cropRatioKey = ref('free')
const customCropRatioWidth = ref(1)
const customCropRatioHeight = ref(1)

/** 工作流步骤列表 */
const workflowSteps = ref([])

const CROP_RATIO_OPTIONS = [
  { value: 'free', label: '自由' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
  { value: 'custom', label: '自定义' },
]

/**
 * 替换预览 URL：先 revoke 旧的 blob，再赋新值，避免泄漏与 401 下无效地址残留
 * @param {string|null|undefined} next - 新 object URL 或空
 */
function replacePreviewUrl(next) {
  revokePreviewObjectUrl(previewUrl.value)
  previewUrl.value = next || ''
}

/**
 * 画布加载图片失败（多为鉴权、网络或格式问题）
 * @param {unknown} err
 */
function onCanvasLoadError(err) {
  console.error(err)
  ElMessage.error('图片加载失败，请确认后端已启动且已获取 API Token')
}

/** 触发隐藏 file input，供用户选择本地图片 */
function triggerUpload() {
  uploadRef.value?.click()
}

/**
 * 文件选择变更：读取文件并走上传流程
 * @param {Event} e
 */
function onFileInputChange(e) {
  const file = e.target.files?.[0]
  if (file) handleUpload(file)
  e.target.value = ''
}

/**
 * 调用后端上传接口，成功后刷新画布并清空工作流
 * @param {File} file
 */
async function handleUpload(file) {
  const res = await uploadImage(file)
  if (!res || res.code !== 200) {
    ElMessage.error('上传失败')
    return
  }
  imageId.value = res.data.image_id
  imageInfo.value = res.data
  workflowSteps.value = []
  cancelCropMode()

  const objUrl = await fetchUploadedImageAsObjectUrl(res.data.image_id)
  if (!objUrl) {
    ElMessage.error('无法加载图片预览（鉴权失败或文件不可用）')
    return
  }
  replacePreviewUrl(objUrl)
  await nextTick()
  await canvasRef.value?.setOriginalImage(objUrl, res.data)
  ElMessage.success('图片已上传')
}

function triggerStickerUpload() {
  if (!imageId.value) {
    ElMessage.warning('请先上传图片')
    return
  }
  stickerUploadRef.value?.click()
}

async function onStickerInputChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return

  const res = await uploadImage(file)
  if (!res || res.code !== 200) {
    ElMessage.error('贴图上传失败')
    return
  }

  const objUrl = await fetchUploadedImageAsObjectUrl(res.data.image_id)
  if (!objUrl) {
    ElMessage.error('无法加载贴图')
    return
  }

  addStep({
    type: 'sticker',
    params: {
      image_id: res.data.image_id,
      preview_url: objUrl,
      x: 80,
      y: 80,
      width: 120,
      height: Math.max(1, Math.round(120 * ((res.data.height || 1) / (res.data.width || 1)))),
      angle: 0,
    },
  })
  ElMessage.success('贴图已添加')
}

/**
 * 画布报告图片尺寸等信息
 * @param {object} info
 */
function onImageLoaded(info) {
  imageInfo.value = { ...imageInfo.value, ...info }
}

/**
 * 从左侧工具栏追加一步（含唯一 id）
 * @param {{ type: string, params?: object }} step
 */
function addStep(step) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  workflowSteps.value.push({
    type: step.type,
    params: mergeStepParams(step.type, step.params),
    id,
  })
  debouncedPreview()
}

function getCropRatioConfig() {
  if (cropRatioKey.value === 'free') {
    return { aspectRatio: null, aspectRatioLabel: '' }
  }
  if (cropRatioKey.value === 'custom') {
    const width = Number(customCropRatioWidth.value) || 1
    const height = Number(customCropRatioHeight.value) || 1
    return {
      aspectRatio: width / height,
      aspectRatioLabel: `${width}:${height}`,
    }
  }
  const [width, height] = cropRatioKey.value.split(':').map(Number)
  return {
    aspectRatio: width / height,
    aspectRatioLabel: cropRatioKey.value,
  }
}

function applyCropRatio() {
  if (!cropMode.value) return
  const ok = canvasRef.value?.startCropSelection(getCropRatioConfig())
  if (!ok) {
    cropMode.value = false
    ElMessage.warning('请先上传图片')
  }
}

async function startCropMode() {
  if (!imageId.value) {
    ElMessage.warning('请先上传图片')
    return
  }
  cropMode.value = true
  await nextTick()
  applyCropRatio()
}

function cancelCropMode() {
  canvasRef.value?.cancelCropSelection()
  cropMode.value = false
}

function confirmCropMode() {
  const params = canvasRef.value?.confirmCropSelection()
  if (!params) {
    ElMessage.warning('没有可用的裁剪区域')
    return
  }
  cropMode.value = false
  addStep({ type: 'crop', params })
}

/**
 * 按索引删除一步
 * @param {number} index
 */
function removeStep(index) {
  workflowSteps.value.splice(index, 1)
  debouncedPreview()
}

/**
 * 拖拽排序后的完整列表替换
 * @param {object[]} newSteps
 */
function reorderSteps(newSteps) {
  workflowSteps.value = newSteps
  debouncedPreview()
}

/**
 * 更新某一步的参数（工作流面板内编辑后调用）
 * @param {number} index
 * @param {Record<string, unknown>} params
 */
function updateStepParams(index, params) {
  const cur = workflowSteps.value[index]
  if (!cur) return
  workflowSteps.value[index] = {
    ...cur,
    params: { ...params },
  }
  debouncedPreview()
}

/** 撤销最后一步工作流 */
function undoStep() {
  workflowSteps.value.pop()
  debouncedPreview()
}

/** 清空工作流与画布叠加层，预览恢复为服务器上的原图（带鉴权 blob） */
async function clearAll() {
  workflowSteps.value = []
  cancelCropMode()
  canvasRef.value?.clearOverlays()
  await canvasRef.value?.applyPreviewSteps([])
}

/** 防抖定时器句柄，避免连续改参数时频繁请求预览接口 */
let previewTimer = null

/** 在短时间无新变更后触发一次预览请求 */
function debouncedPreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(requestPreview, 120)
}

/**
 * 将当前工作流 + 画布文字叠加发给后端，用返回图片更新预览
 */
async function requestPreview() {
  if (!imageId.value) {
    return
  }

  previewing.value = true
  const steps = workflowSteps.value.map(s => ({ type: s.type, params: s.params }))
  try {
    await canvasRef.value?.applyPreviewSteps(steps)
  } catch (error) {
    console.error(error)
    ElMessage.error('前端预览生成失败')
  } finally {
    previewing.value = false
  }
}

/** 打开导出弹窗，由用户在导出前选择格式与质量 */
function handleExport() {
  if (!imageId.value) return
  showExport.value = true
}

/** 按当前工作流导出并触发浏览器下载 */
async function confirmExport(options) {
  if (!imageId.value) return
  outputFormat.value = options.outputFormat || outputFormat.value
  exporting.value = true
  const steps = workflowSteps.value.map(s => ({ type: s.type, params: s.params }))

  const ok = await processAndDownload(
    imageId.value,
    steps,
    outputFormat.value,
    options.quality || 95
  )
  if (ok) {
    showExport.value = false
    ElMessage.success('导出成功')
  } else {
    ElMessage.error('导出失败')
  }
  exporting.value = false
}

/** 离开页面时释放 blob 预览，避免内存泄漏 */
onBeforeUnmount(() => {
  replacePreviewUrl('')
})
</script>
