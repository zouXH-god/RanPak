<template>
  <div class="badge-print flex h-full min-h-0 flex-col gap-2 overflow-hidden px-4 pb-4">
    <div class="flex min-h-0 flex-1 gap-4">
      <section ref="previewBoxRef" class="min-w-0 flex-1 overflow-hidden rounded-lg bg-gray-100">
        <div class="flex h-full items-center justify-center p-5">
          <div
            ref="previewRef"
            class="preview-sheet bg-white"
            :style="previewStyle"
          >
            <div
              v-for="(row, rowIndex) in images"
              :key="rowIndex"
              class="badge-row"
            >
              <div
                v-for="(image, colIndex) in row"
                :key="`${rowIndex}-${colIndex}`"
                class="badge-outer"
                :class="{ 'is-empty-on-export': exporting && !image }"
                :style="badgeOuterStyle"
                @mouseenter="hoverCell = `${rowIndex},${colIndex}`"
                @mouseleave="hoverCell = ''"
              >
                <div class="badge-inner" :style="badgeInnerStyle">
                  <img
                    v-if="image"
                    class="badge-image"
                    :src="image"
                    alt=""
                    @click="selectImage(rowIndex, colIndex)"
                  />
                  <div
                    v-if="!image || isCellActive(rowIndex, colIndex)"
                    class="badge-actions"
                  >
                    <div class="badge-action-group" :style="actionGroupStyle">
                      <button class="badge-action-button" type="button" @click.stop="selectImage(rowIndex, colIndex)">
                        <el-icon><component :is="image ? Edit : Plus" /></el-icon>
                      </button>
                      <button v-if="tempImages[rowIndex]?.[colIndex]" class="badge-action-button" type="button" @click.stop="editCrop(rowIndex, colIndex)">
                        <el-icon><Crop /></el-icon>
                      </button>
                      <button v-if="tempImages[rowIndex]?.[colIndex]" class="badge-action-button" type="button" @click.stop="copyImage(rowIndex, colIndex)">
                        <el-icon><CopyDocument /></el-icon>
                      </button>
                      <button v-if="copiedImage" class="badge-action-button" type="button" @click.stop="pasteImage(rowIndex, colIndex)">
                        <el-icon><List /></el-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-4 py-3">
          <h2 class="text-base font-semibold text-gray-800">吧唧打印</h2>
          <p class="mt-1 text-xs text-gray-500">上传裁剪图片并排版成可打印尺寸</p>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <el-form ref="layoutFormRef" :model="layoutForm" :rules="layoutRules" label-width="104px" label-position="left">
            <el-form-item label="纸张大小">
              <el-radio-group v-model="paper">
                <el-radio-button v-for="item in paperOptions" :key="item" :label="item" />
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="paper === '自定义'" label="纸张宽度" prop="width">
              <el-input-number v-model="layoutForm.width" :min="1" controls-position="right" />
            </el-form-item>
            <el-form-item v-if="paper === '自定义'" label="纸张高度" prop="height">
              <el-input-number v-model="layoutForm.height" :min="1" controls-position="right" />
            </el-form-item>
            <el-form-item label="行数" prop="row">
              <el-input-number v-model="layoutForm.row" :min="1" :max="20" controls-position="right" />
            </el-form-item>
            <el-form-item label="列数" prop="col">
              <el-input-number v-model="layoutForm.col" :min="1" :max="20" controls-position="right" />
            </el-form-item>
            <el-form-item label="直径(cm)" prop="diam">
              <el-input-number v-model="layoutForm.diam" :min="0.1" :precision="2" controls-position="right" />
            </el-form-item>
            <el-form-item label="边距(cm)" prop="padding">
              <el-input-number v-model="layoutForm.padding" :min="0" :precision="2" controls-position="right" />
            </el-form-item>
            <el-form-item label="边框颜色" prop="color">
              <el-color-picker v-model="layoutForm.color" />
            </el-form-item>
          </el-form>

          <el-divider />

          <el-form :model="exportForm" label-width="104px" label-position="left">
            <el-form-item label="文件名">
              <el-input v-model="exportForm.fileName" />
            </el-form-item>
            <el-form-item label="文件类型">
              <el-select v-model="exportForm.fileType">
                <el-option label="png" value="png" />
                <el-option label="jpeg" value="jpeg" />
              </el-select>
            </el-form-item>
            <el-form-item label="质量">
              <el-slider v-model="exportForm.quality" :min="0.1" :max="1" :step="0.1" />
            </el-form-item>
            <el-form-item label="DPI">
              <el-select v-model="exportForm.dpi">
                <el-option label="600" :value="600" />
                <el-option label="400" :value="400" />
                <el-option label="300" :value="300" />
              </el-select>
            </el-form-item>
          </el-form>

          <el-divider />

          <section>
            <div class="mb-3 flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold text-gray-700">历史记录</div>
                <div class="text-xs text-gray-400">导出后自动保存，点击应用快速恢复</div>
              </div>
            </div>
            <div v-if="!historyRecords.length" class="rounded border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
              暂无历史记录
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="item in historyRecords"
                :key="item.id"
                class="flex gap-2 rounded border border-gray-200 bg-gray-50 p-2"
              >
                <img :src="item.thumbnail" alt="" class="h-16 w-12 shrink-0 rounded border border-gray-200 bg-white object-contain" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-medium text-gray-700">{{ item.name }}</div>
                  <div class="mt-1 text-[11px] text-gray-500">
                    {{ item.layout.row }}×{{ item.layout.col }} / {{ item.layout.diam }}cm / {{ item.paper }}
                  </div>
                  <div class="mt-2 flex gap-1">
                    <el-button size="small" type="primary" @click="applyHistory(item)">应用</el-button>
                    <el-button size="small" :icon="Delete" @click="deleteHistory(item.id)" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="border-t border-gray-100 p-4">
          <div class="flex gap-2">
            <el-button class="flex-1" type="primary" @click="generateLayout">生成</el-button>
            <el-button class="flex-1" type="primary" :loading="exporting" @click="exportImage">导出</el-button>
          </div>
          <p class="mt-2 text-xs text-gray-500">导出时未选择图片的圆圈会自动隐藏。</p>
        </div>
      </aside>
    </div>

    <SourceCredit :sources="sources" />

    <el-dialog v-model="cropDialogVisible" title="裁剪图片" width="800px" :close-on-click-modal="false">
      <div class="flex items-center flex-wrap gap-x-4 gap-y-2 mb-3 rounded-md bg-gray-50 px-3 py-2.5">
        <el-checkbox v-model="expandEnabled">扩图</el-checkbox>
        <template v-if="expandEnabled">
          <el-checkbox v-model="expandCenterLock">居中裁剪</el-checkbox>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-gray-500 shrink-0">扩展量:</span>
            <el-slider v-model="expandPercent" :min="0" :max="200" :step="5" class="!w-28" />
            <span class="text-xs text-gray-500 w-10 text-right">{{ expandPercent }}%</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-gray-500 shrink-0">填充色:</span>
            <el-color-picker v-model="expandColor" size="small" show-alpha />
            <el-button size="small" link type="primary" @click="pickScreenColor">取色</el-button>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-gray-500 shrink-0">比例:</span>
            <el-select v-model="expandRatio" size="small" class="!w-20" placeholder="自由">
              <el-option label="自由" value="" />
              <el-option label="1:1" value="1:1" />
              <el-option label="4:3" value="4:3" />
              <el-option label="3:4" value="3:4" />
              <el-option label="16:9" value="16:9" />
              <el-option label="9:16" value="9:16" />
            </el-select>
          </div>
        </template>
      </div>
      <div class="h-[520px]">
        <Cropper
          v-if="cropperSrc"
          ref="cropperRef"
          class="h-full"
          :src="cropperSrc"
          :stencil-component="CircleStencil"
          :default-position="expandCenterLock ? defaultCenterPosition : undefined"
          :default-size="expandCenterLock ? defaultCenterSize : undefined"
        />
      </div>
      <template #footer>
        <el-button @click="cropDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCrop">确定</el-button>
      </template>
    </el-dialog>

    <input ref="fileInputRef" type="file" class="hidden" accept="image/*" multiple @change="onFileChange" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Crop, Delete, Edit, List, Plus } from '@element-plus/icons-vue'
import html2canvas from 'html2canvas'
import { CircleStencil, Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import SourceCredit from '../components/SourceCredit.vue'

const paperSizes = {
  A3: { width: 7016, height: 9921 },
  A4: { width: 4961, height: 7016 },
  A5: { width: 3496, height: 4961 },
  自定义: { width: 4961, height: 7016 },
}
const paperOptions = Object.keys(paperSizes)
const sources = [
  { name: 'html2canvas', url: 'https://github.com/niklasvh/html2canvas' },
  { name: 'vue-advanced-cropper', url: 'https://github.com/advanced-cropper/vue-advanced-cropper' },
]

const paper = ref('A4')
const layoutFormRef = ref(null)
const layoutForm = reactive({
  diam: 6.6,
  padding: 0.2,
  width: paperSizes.A4.width,
  height: paperSizes.A4.height,
  row: 4,
  col: 2,
  color: '#DDDDDD',
})
const submittedLayout = ref({ ...layoutForm })
const exportForm = reactive({
  fileName: '吧唧图',
  fileType: 'png',
  quality: 1,
  dpi: 600,
})

const layoutRules = {
  diam: [{ required: true, message: '请输入直径', trigger: 'blur' }],
  padding: [{ required: true, message: '请输入边距', trigger: 'blur' }],
  row: [{ required: true, message: '请输入行数', trigger: 'blur' }],
  col: [{ required: true, message: '请输入列数', trigger: 'blur' }],
  color: [{ required: true, message: '请选择边框颜色', trigger: 'blur' }],
  width: [{ required: true, message: '请输入纸张宽度', trigger: 'blur' }],
  height: [{ required: true, message: '请输入纸张高度', trigger: 'blur' }],
}

const previewBoxRef = ref(null)
const previewRef = ref(null)
const cropperRef = ref(null)
const fileInputRef = ref(null)
const previewBoxSize = ref({ width: 0, height: 0 })
const images = ref([])
const tempImages = ref([])
const copiedImage = ref('')
const copiedTemp = ref('')
const hoverCell = ref('')
const rowIndex = ref(0)
const colIndex = ref(0)
const cropDialogVisible = ref(false)
const editingTempImage = ref('')
const cropperSrc = ref('')
const expandEnabled = ref(false)
const expandPercent = ref(50)
const expandColor = ref('#FFFFFF')
const expandRatio = ref('1:1')
const expandCenterLock = ref(true)
const origDims = ref({ width: 0, height: 0 })
const exporting = ref(false)
const historyRecords = ref([])
const HISTORY_KEY = 'ran-pak.badge-print.history'
const HISTORY_LIMIT = 12

function createGrid(row, col) {
  return Array.from({ length: row }, () => Array.from({ length: col }, () => ''))
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

function cmTo600Dpi(cm) {
  return (Number(cm) || 0) / 2.54 * 600
}

function syncPaperSize(value) {
  const size = paperSizes[value] || paperSizes.A4
  layoutForm.width = size.width
  layoutForm.height = size.height
}

function updatePreviewBoxSize() {
  if (!previewBoxRef.value) return
  previewBoxSize.value = {
    width: Math.max(0, previewBoxRef.value.clientWidth - 40),
    height: Math.max(0, previewBoxRef.value.clientHeight - 40),
  }
}

const previewScale = computed(() => {
  const { width, height } = submittedLayout.value
  if (!width || !height || !previewBoxSize.value.width || !previewBoxSize.value.height) return 1
  return Math.min(previewBoxSize.value.width / width, previewBoxSize.value.height / height)
})

const previewStyle = computed(() => ({
  width: `${submittedLayout.value.width}px`,
  height: `${submittedLayout.value.height}px`,
  minWidth: `${submittedLayout.value.width}px`,
  minHeight: `${submittedLayout.value.height}px`,
  transform: `scale(${previewScale.value})`,
}))

const badgeOuterStyle = computed(() => {
  const size = cmTo600Dpi(submittedLayout.value.diam + submittedLayout.value.padding * 2)
  return {
    width: `${size}px`,
    height: `${size}px`,
    background: submittedLayout.value.color,
  }
})

const badgeInnerStyle = computed(() => {
  const size = cmTo600Dpi(submittedLayout.value.diam)
  return {
    width: `${size}px`,
    height: `${size}px`,
  }
})

const actionGroupStyle = computed(() => ({
  transform: `scale(${1 / previewScale.value})`,
  transformOrigin: 'center',
}))

watch(paper, syncPaperSize)

function validateLayout() {
  const { row, col, diam, padding, width, height } = layoutForm
  const actualWidth = cmTo600Dpi(col * (diam + padding * 2))
  const actualHeight = cmTo600Dpi(row * (diam + padding * 2))
  if (actualWidth > width) {
    ElMessage.warning('列数过多，无法排版')
    return false
  }
  if (actualHeight > height) {
    ElMessage.warning('行数过多，无法排版')
    return false
  }
  return true
}

function applyLayout() {
  submittedLayout.value = { ...layoutForm }
  images.value = createGrid(layoutForm.row, layoutForm.col)
  tempImages.value = createGrid(layoutForm.row, layoutForm.col)
  nextTick(async () => {
    updatePreviewBoxSize()
  })
}

function generateLayout() {
  layoutFormRef.value?.validate(async (valid) => {
    if (!valid || !validateLayout()) return
    const hasImages = images.value.some((row) => row.some(Boolean))
    if (!hasImages) {
      applyLayout()
      return
    }
    try {
      await ElMessageBox.confirm('已选图片将会被清空，是否继续？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      applyLayout()
    } catch {
      // user cancelled
    }
  })
}

function isCellActive(i, j) {
  return hoverCell.value === `${i},${j}`
}

function selectImage(i, j) {
  rowIndex.value = i
  colIndex.value = j
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

function onFileChange(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return

  if (files.length === 1) {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      tempImages.value[rowIndex.value][colIndex.value] = url
      images.value[rowIndex.value][colIndex.value] = url
      editingTempImage.value = url
      cropperSrc.value = url
      resetExpandState()
      const img = new Image()
      img.onload = () => { origDims.value = { width: img.naturalWidth, height: img.naturalHeight } }
      img.src = url
      cropDialogVisible.value = true
    }
    reader.readAsDataURL(files[0])
    return
  }

  readFilesAsDataUrls(files).then((urls) => {
    fillImagesFromCell(rowIndex.value, colIndex.value, urls)
    ElMessage.success(`已导入 ${urls.length} 张图片`)
  }).catch((error) => {
    console.error(error)
    ElMessage.error('批量导入失败')
  })
}

function readFilesAsDataUrls(files) {
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })))
}

function fillImagesFromCell(startRow, startCol, urls) {
  let index = 0
  for (let i = startRow; i < images.value.length; i += 1) {
    const colStart = i === startRow ? startCol : 0
    for (let j = colStart; j < images.value[i].length; j += 1) {
      if (index >= urls.length) return
      images.value[i][j] = urls[index]
      tempImages.value[i][j] = urls[index]
      index += 1
    }
  }
}

function resetExpandState() {
  expandEnabled.value = false
  expandPercent.value = 50
  expandColor.value = '#FFFFFF'
  expandRatio.value = '1:1'
  expandCenterLock.value = true
}

function editCrop(i, j) {
  rowIndex.value = i
  colIndex.value = j
  editingTempImage.value = tempImages.value[i][j]
  cropperSrc.value = editingTempImage.value
  resetExpandState()
  if (editingTempImage.value) {
    const img = new Image()
    img.onload = () => { origDims.value = { width: img.naturalWidth, height: img.naturalHeight } }
    img.src = editingTempImage.value
  }
  cropDialogVisible.value = Boolean(editingTempImage.value)
}

function confirmCrop() {
  const result = cropperRef.value?.getResult?.()
  const canvas = result?.canvas
  if (!canvas) return
  images.value[rowIndex.value][colIndex.value] = canvas.toDataURL()
  cropDialogVisible.value = false
}

function expandImageCanvas(dataUrl, percent, fillColor, ratio) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      origDims.value = { width: img.width, height: img.height }

      const base = Math.max(img.width, img.height)
      const pad = base * (percent / 100)
      let cw = img.width + pad * 2
      let ch = img.height + pad * 2

      if (ratio) {
        const [rw, rh] = ratio.split(':').map(Number)
        const target = rw / rh
        if (cw / ch > target) {
          ch = cw / target
        } else {
          cw = ch * target
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(cw)
      canvas.height = Math.round(ch)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = fillColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, (canvas.width - img.width) / 2, (canvas.height - img.height) / 2)
      resolve(canvas.toDataURL())
    }
    img.src = dataUrl
  })
}

function defaultCenterSize({ imageSize }) {
  const ow = origDims.value.width || imageSize.width
  const oh = origDims.value.height || imageSize.height
  const size = Math.min(ow, oh)
  return { width: size, height: size }
}

function defaultCenterPosition({ imageSize }) {
  const { width } = defaultCenterSize({ imageSize })
  return {
    left: (imageSize.width - width) / 2,
    top: (imageSize.height - width) / 2,
  }
}

async function pickScreenColor() {
  if (!window.EyeDropper) {
    ElMessage.warning('当前环境不支持取色器')
    return
  }
  try {
    const dropper = new window.EyeDropper()
    const result = await dropper.open()
    expandColor.value = result.sRGBHex
  } catch {
    // user cancelled
  }
}

async function applyExpand() {
  if (!editingTempImage.value) return
  if (!expandEnabled.value) {
    cropperSrc.value = editingTempImage.value
    return
  }
  cropperSrc.value = await expandImageCanvas(
    editingTempImage.value,
    expandPercent.value,
    expandColor.value,
    expandRatio.value,
  )
}

let expandTimer = null
watch([expandEnabled, expandPercent, expandColor, expandRatio, expandCenterLock], () => {
  clearTimeout(expandTimer)
  expandTimer = setTimeout(applyExpand, 200)
})

function copyImage(i, j) {
  copiedImage.value = images.value[i][j]
  copiedTemp.value = tempImages.value[i][j]
}

function pasteImage(i, j) {
  if (!copiedImage.value) return
  images.value[i][j] = copiedImage.value
  tempImages.value[i][j] = copiedTemp.value || copiedImage.value
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    historyRecords.value = raw ? JSON.parse(raw) : []
  } catch {
    historyRecords.value = []
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyRecords.value.slice(0, HISTORY_LIMIT)))
}

async function createThumbnail() {
  if (!previewRef.value) return ''
  await nextTick()
  const canvas = await html2canvas(previewRef.value, {
    scale: 0.04,
    backgroundColor: '#ffffff',
    onclone: (_doc, element) => {
      element.style.transform = ''
    },
  })
  return canvas.toDataURL('image/jpeg', 0.72)
}

async function saveHistorySnapshot(reason = '导出保存') {
  if (!images.value.length) return
  try {
    const thumbnail = await createThumbnail()
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${reason} ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      paper: paper.value,
      layout: cloneData(layoutForm),
      submittedLayout: cloneData(submittedLayout.value),
      exportForm: cloneData(exportForm),
      images: cloneData(images.value),
      tempImages: cloneData(tempImages.value),
      thumbnail,
    }
    historyRecords.value = [
      record,
      ...historyRecords.value.filter((item) => item.id !== record.id),
    ].slice(0, HISTORY_LIMIT)
    persistHistory()
  } catch (error) {
    console.error(error)
    ElMessage.warning('历史记录保存失败，可能是图片数据过大')
  }
}

function applyHistory(record) {
  paper.value = record.paper || 'A4'
  Object.assign(layoutForm, cloneData(record.layout || paperSizes.A4))
  submittedLayout.value = cloneData(record.submittedLayout || record.layout || layoutForm)
  Object.assign(exportForm, cloneData(record.exportForm || exportForm))
  images.value = cloneData(record.images || createGrid(submittedLayout.value.row, submittedLayout.value.col))
  tempImages.value = cloneData(record.tempImages || images.value)
  copiedImage.value = ''
  copiedTemp.value = ''
  hoverCell.value = ''
  nextTick(updatePreviewBoxSize)
  ElMessage.success('历史记录已应用')
}

function deleteHistory(id) {
  historyRecords.value = historyRecords.value.filter((item) => item.id !== id)
  persistHistory()
}

async function exportImage() {
  if (exporting.value || !previewRef.value) return
  exporting.value = true
  try {
    await nextTick()
    const canvas = await html2canvas(previewRef.value, {
      scale: exportForm.dpi / 600,
      backgroundColor: '#ffffff',
      onclone: (_doc, element) => {
        element.style.transform = ''
      },
    })
    const link = document.createElement('a')
    link.href = canvas.toDataURL(`image/${exportForm.fileType}`, exportForm.quality)
    link.download = `${exportForm.fileName || '吧唧图'}.${exportForm.fileType}`
    link.click()
    await saveHistorySnapshot('导出保存')
  } catch (error) {
    console.error(error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadHistory()
  applyLayout()
  updatePreviewBoxSize()
  window.addEventListener('resize', updatePreviewBoxSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePreviewBoxSize)
})
</script>

<style scoped>
.preview-sheet {
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  transform-origin: center;
}

.badge-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-evenly;
}

.badge-outer {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
}

.badge-outer.is-empty-on-export {
  opacity: 0;
}

.badge-inner {
  position: relative;
  overflow: hidden;
  border-radius: 9999px;
}

.badge-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 9999px;
}

.badge-actions {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.12);
}

.badge-action-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.badge-action-button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid #dcdfe6;
  background: #ffffff;
  color: #606266;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
  cursor: pointer;
}

.badge-action-button:hover {
  color: #409eff;
  border-color: #409eff;
}

.badge-action-button .el-icon {
  font-size: 16px;
}

.badge-actions :deep(.el-button) {
  flex: 0 0 auto;
}
</style>
