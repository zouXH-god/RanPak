<template>
  <div class="perler-page h-full min-h-0 overflow-hidden px-4 pb-4">
    <div class="flex h-full min-h-0 gap-4">
      <section class="min-w-0 flex-1 overflow-hidden rounded-lg bg-gray-100">
        <div class="flex h-full flex-col">
          <div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <div>
              <h1 class="text-base font-semibold text-gray-800">拼豆工具</h1>
              <p class="mt-1 text-xs text-gray-500">图片转拼豆底稿，支持色号统计、手动精修和导出</p>
            </div>
            <div class="flex items-center gap-2">
              <el-button :icon="Upload" type="primary" @click="fileInputRef?.click()">导入图片</el-button>
              <el-button :icon="Download" :disabled="!mappedPixels.length" @click="exportPatternPng">导出图纸</el-button>
            </div>
          </div>

          <div ref="canvasWrapRef" class="min-h-0 flex-1 overflow-auto p-5">
            <div v-if="!imageLoaded" class="flex h-full items-center justify-center">
              <button class="empty-import" type="button" @click="fileInputRef?.click()">
                <el-icon><Picture /></el-icon>
                <span>选择图片生成拼豆底稿</span>
              </button>
            </div>
            <div v-else class="inline-block rounded-lg bg-white p-4 shadow-sm">
              <canvas
                ref="canvasRef"
                class="perler-canvas"
                :style="canvasDisplayStyle"
                @click="selectCell"
              />
            </div>
          </div>
        </div>
      </section>

      <aside class="flex w-[390px] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-4 py-3">
          <h2 class="text-base font-semibold text-gray-800">参数</h2>
          <p class="mt-1 text-xs text-gray-500">最大支持 120 × 120 格</p>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <el-form :model="form" label-width="104px" label-position="left">
            <el-form-item label="横向格数">
              <el-input-number v-model="form.gridWidth" :min="1" :max="120" controls-position="right" />
            </el-form-item>
            <el-form-item label="纵向格数">
              <el-input-number v-model="form.gridHeight" :min="1" :max="120" controls-position="right" />
            </el-form-item>
            <el-form-item label="像素模式">
              <el-segmented v-model="form.pixelationMode" :options="pixelationOptions" />
            </el-form-item>
            <el-form-item label="色号系统">
              <el-select v-model="form.colorSystem">
                <el-option v-for="item in colorSystemOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="颜色合并">
              <el-switch v-model="form.mergeEnabled" />
            </el-form-item>
            <el-form-item v-if="form.mergeEnabled" label="合并阈值">
              <el-slider v-model="form.mergeThreshold" :min="1" :max="30" />
            </el-form-item>
            <el-form-item label="移除背景">
              <el-switch v-model="form.removeBackground" />
            </el-form-item>
            <el-form-item label="显示网格">
              <el-switch v-model="form.showGrid" />
            </el-form-item>
            <el-form-item label="显示色号">
              <el-switch v-model="form.showLabels" />
            </el-form-item>
            <el-form-item label="缩放">
              <el-slider v-model="form.zoom" :min="30" :max="240" :step="10" />
            </el-form-item>
            <el-form-item label="文件名">
              <el-input v-model="form.fileName" />
            </el-form-item>
          </el-form>

          <el-divider />

          <section>
            <div class="mb-3 flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold text-gray-700">手动精修</div>
                <div class="text-xs text-gray-400">{{ selectedCellLabel }}</div>
              </div>
            </div>
            <div v-if="!selectedCell" class="rounded border border-dashed border-gray-200 py-5 text-center text-xs text-gray-400">
              点击画布格子后可修改颜色
            </div>
            <template v-else>
              <el-select v-model="selectedColor" filterable class="w-full">
                <el-option
                  v-for="item in palette"
                  :key="item.color"
                  :label="`${item.key} ${item.color}`"
                  :value="item.color"
                >
                  <span class="inline-flex items-center gap-2">
                    <span class="inline-block h-4 w-4 rounded border border-gray-200" :style="{ background: item.color }" />
                    <span>{{ item.key }} {{ item.color }}</span>
                  </span>
                </el-option>
              </el-select>
              <div class="mt-3 flex gap-2">
                <el-button class="flex-1" type="primary" @click="replaceSelectedCell">替换当前格</el-button>
                <el-button class="flex-1" @click="replaceAllSameColor">替换同色</el-button>
              </div>
            </template>
          </section>

          <el-divider />

          <section>
            <div class="mb-3 flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold text-gray-700">颜色统计</div>
                <div class="text-xs text-gray-400">共 {{ beadTotal }} 粒 / {{ colorStats.length }} 色</div>
              </div>
              <el-button size="small" :disabled="!colorStats.length" @click="exportStatsCsv">CSV</el-button>
            </div>
            <div v-if="!colorStats.length" class="rounded border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
              生成后显示采购清单
            </div>
            <div v-else class="max-h-72 space-y-2 overflow-y-auto pr-1">
              <button
                v-for="item in colorStats"
                :key="item.color"
                class="stat-row"
                type="button"
                @click="selectedColor = item.color"
              >
                <span class="h-5 w-5 shrink-0 rounded border border-gray-200" :style="{ background: item.color }" />
                <span class="min-w-0 flex-1 truncate text-left">{{ item.key }} · {{ item.color }}</span>
                <span class="text-gray-500">{{ item.count }}</span>
                <span class="w-10 text-right text-gray-400">{{ item.percent }}%</span>
              </button>
            </div>
            <el-button class="mt-3 w-full" :disabled="!colorStats.length" @click="exportShoppingListPng">导出采购清单</el-button>
          </section>
        </div>

        <div class="border-t border-gray-100 p-4">
          <div class="text-[11px] leading-5 text-gray-400">
            色号映射与算法参考 Zippland/perler-beads，原项目许可证 AGPL-3.0。
          </div>
        </div>
      </aside>
    </div>

    <input ref="fileInputRef" type="file" class="hidden" accept="image/png,image/jpeg,image/webp" @change="onFileChange" />
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Picture, Upload } from '@element-plus/icons-vue'
import { colorSystemOptions } from '../data/perlerColorSystemMapping'
import {
  buildPalette,
  calculatePixelGrid,
  getColorStats,
  mergeSimilarRegions,
  removeExternalBackground,
} from '../utils/perlerBeads'

const fileInputRef = ref(null)
const canvasRef = ref(null)
const imageElement = ref(null)
const imageLoaded = ref(false)
const mappedPixels = ref([])
const selectedCell = ref(null)
const selectedColor = ref('')

const form = reactive({
  gridWidth: 48,
  gridHeight: 48,
  pixelationMode: 'dominant',
  colorSystem: 'MARD',
  mergeEnabled: true,
  mergeThreshold: 12,
  removeBackground: false,
  showGrid: true,
  showLabels: true,
  zoom: 100,
  fileName: '拼豆底稿',
})

const pixelationOptions = [
  { label: '主导色', value: 'dominant' },
  { label: '平均色', value: 'average' },
]

const palette = computed(() => buildPalette(form.colorSystem))
const colorStats = computed(() => getColorStats(mappedPixels.value))
const beadTotal = computed(() => colorStats.value.reduce((sum, item) => sum + item.count, 0))
const cellSize = computed(() => Math.max(14, Math.min(36, Math.round(720 / Math.max(form.gridWidth, form.gridHeight)))))
const canvasWidth = computed(() => form.gridWidth * cellSize.value)
const canvasHeight = computed(() => form.gridHeight * cellSize.value)
const canvasDisplayStyle = computed(() => ({
  width: `${canvasWidth.value * (form.zoom / 100)}px`,
  height: `${canvasHeight.value * (form.zoom / 100)}px`,
}))
const selectedCellLabel = computed(() => {
  if (!selectedCell.value) return '未选择格子'
  const cell = mappedPixels.value[selectedCell.value.row]?.[selectedCell.value.col]
  return `第 ${selectedCell.value.row + 1} 行，第 ${selectedCell.value.col + 1} 列 · ${cell?.key || ''}`
})

watch(() => [
  form.gridWidth,
  form.gridHeight,
  form.pixelationMode,
  form.colorSystem,
  form.mergeEnabled,
  form.mergeThreshold,
  form.removeBackground,
], () => {
  regenerate()
})

watch(() => [form.showGrid, form.showLabels, form.zoom, mappedPixels.value, selectedCell.value], () => {
  drawCanvas()
}, { deep: true })

async function onFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = async () => {
    URL.revokeObjectURL(url)
    imageElement.value = image
    imageLoaded.value = true
    selectedCell.value = null
    await regenerate()
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    ElMessage.error('图片加载失败')
  }
  image.src = url
}

async function regenerate() {
  if (!imageElement.value) return
  const width = clampGridSize(form.gridWidth)
  const height = clampGridSize(form.gridHeight)
  if (width !== form.gridWidth) form.gridWidth = width
  if (height !== form.gridHeight) form.gridHeight = height

  let grid = calculatePixelGrid(imageElement.value, width, height, palette.value, form.pixelationMode)
  if (form.mergeEnabled) grid = mergeSimilarRegions(grid, form.mergeThreshold, palette.value)
  if (form.removeBackground) {
    const stats = getColorStats(grid).slice(0, 3)
    grid = removeExternalBackground(grid, new Set(stats.map(item => item.color)))
  }
  mappedPixels.value = grid
  if (selectedCell.value && !grid[selectedCell.value.row]?.[selectedCell.value.col]) selectedCell.value = null
  await nextTick()
  drawCanvas()
}

function clampGridSize(value) {
  return Math.max(1, Math.min(120, Number(value) || 1))
}

function drawCanvas(targetCanvas = canvasRef.value, options = {}) {
  if (!targetCanvas || !mappedPixels.value.length) return
  const size = options.cellSize || cellSize.value
  const width = mappedPixels.value[0].length * size
  const height = mappedPixels.value.length * size
  targetCanvas.width = width
  targetCanvas.height = height
  const ctx = targetCanvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  mappedPixels.value.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const x = colIndex * size
      const y = rowIndex * size
      if (!cell?.isExternal) {
        ctx.fillStyle = cell.color
        ctx.beginPath()
        ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2)
        ctx.fill()
        if (options.showLabels ?? form.showLabels) {
          ctx.fillStyle = readableTextColor(cell.color)
          ctx.font = `${Math.max(7, Math.floor(size * 0.28))}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(cell.key, x + size / 2, y + size / 2)
        }
      }
      if (options.showGrid ?? form.showGrid) {
        ctx.strokeStyle = '#d7dce2'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1)
      }
    })
  })

  if (selectedCell.value && !options.hideSelection) {
    ctx.strokeStyle = '#409eff'
    ctx.lineWidth = 3
    ctx.strokeRect(selectedCell.value.col * size + 1.5, selectedCell.value.row * size + 1.5, size - 3, size - 3)
  }
}

function readableTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? '#111827' : '#ffffff'
}

function selectCell(event) {
  if (!mappedPixels.value.length) return
  const rect = event.currentTarget.getBoundingClientRect()
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * form.gridWidth)
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * form.gridHeight)
  if (!mappedPixels.value[row]?.[col]) return
  selectedCell.value = { row, col }
  selectedColor.value = mappedPixels.value[row][col].color
  drawCanvas()
}

function replaceSelectedCell() {
  if (!selectedCell.value || !selectedColor.value) return
  const color = palette.value.find(item => item.color === selectedColor.value)
  if (!color) return
  const next = mappedPixels.value.map(row => row.map(cell => ({ ...cell })))
  next[selectedCell.value.row][selectedCell.value.col] = { ...color }
  mappedPixels.value = next
  drawCanvas()
}

function replaceAllSameColor() {
  if (!selectedCell.value || !selectedColor.value) return
  const source = mappedPixels.value[selectedCell.value.row]?.[selectedCell.value.col]
  const target = palette.value.find(item => item.color === selectedColor.value)
  if (!source || !target) return
  mappedPixels.value = mappedPixels.value.map(row => row.map(cell => {
    if (!cell?.isExternal && cell.color === source.color) return { ...target }
    return { ...cell }
  }))
  drawCanvas()
}

function exportPatternPng() {
  if (!mappedPixels.value.length) return
  const exportCanvas = document.createElement('canvas')
  drawCanvas(exportCanvas, { cellSize: 32, hideSelection: true })
  downloadDataUrl(exportCanvas.toDataURL('image/png'), `${form.fileName || '拼豆底稿'}.png`)
}

function exportShoppingListPng() {
  if (!colorStats.value.length) return
  const rowHeight = 42
  const width = 760
  const height = 96 + colorStats.value.length * rowHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 26px Arial'
  ctx.fillText(`${form.fileName || '拼豆底稿'} 采购清单`, 32, 44)
  ctx.font = '14px Arial'
  ctx.fillStyle = '#6b7280'
  ctx.fillText(`${form.colorSystem} · ${beadTotal.value} 粒 · ${colorStats.value.length} 色`, 32, 70)
  colorStats.value.forEach((item, index) => {
    const y = 104 + index * rowHeight
    ctx.fillStyle = item.color
    ctx.fillRect(32, y - 22, 24, 24)
    ctx.strokeStyle = '#d1d5db'
    ctx.strokeRect(32, y - 22, 24, 24)
    ctx.fillStyle = '#111827'
    ctx.font = '16px Arial'
    ctx.fillText(item.key, 72, y - 4)
    ctx.fillStyle = '#6b7280'
    ctx.fillText(item.color, 180, y - 4)
    ctx.fillStyle = '#111827'
    ctx.fillText(`${item.count} 粒`, 340, y - 4)
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(`${item.percent}%`, 460, y - 4)
  })
  downloadDataUrl(canvas.toDataURL('image/png'), `${form.fileName || '拼豆底稿'}-采购清单.png`)
}

function exportStatsCsv() {
  if (!colorStats.value.length) return
  const rows = [
    ['colorSystem', 'colorCode', 'hex', 'count'],
    ...colorStats.value.map(item => [form.colorSystem, item.key, item.color, item.count]),
  ]
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  downloadDataUrl(URL.createObjectURL(blob), `${form.fileName || '拼豆底稿'}-采购清单.csv`, true)
}

function downloadDataUrl(url, fileName, revoke = false) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  if (revoke) URL.revokeObjectURL(url)
}
</script>

<style scoped>
.perler-canvas {
  image-rendering: pixelated;
  display: block;
  cursor: crosshair;
}

.empty-import {
  display: inline-flex;
  min-width: 260px;
  min-height: 150px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  font-size: 14px;
}

.empty-import .el-icon {
  font-size: 32px;
  color: #409eff;
}

.stat-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  padding: 8px;
  font-size: 12px;
}

.stat-row:hover {
  border-color: #409eff;
  background: #f5faff;
}
</style>
