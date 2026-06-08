<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-700">工作流</h3>
      <el-tag v-if="steps.length" size="small" type="info">{{ steps.length }} 步</el-tag>
    </div>

    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="!steps.length" class="text-center text-gray-400 text-sm mt-8">
        从左侧添加编辑步骤<br />构建处理工作流
      </div>

      <TransitionGroup name="list" tag="div" class="space-y-2">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="rounded-lg border transition-colors group"
          :class="isEditing(step.id)
            ? 'border-blue-400 bg-blue-50/60'
            : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50'"
        >
          <div
            class="px-3 py-2.5 flex items-center gap-2 cursor-move"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
            @dragover.prevent="onDragOver(index, $event)"
            @drop="onDrop(index, $event)"
          >
            <span class="text-xs text-gray-400 w-5 shrink-0">{{ index + 1 }}</span>
            <el-icon :size="14" class="text-blue-500 shrink-0">
              <component :is="stepIconComponent(step.type)" />
            </el-icon>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-gray-700 truncate">{{ stepLabel(step.type) }}</div>
              <div class="text-xs text-gray-400 truncate">{{ buildStepSummary(step) }}</div>
            </div>
            <el-button
              v-if="isStepEditable(step.type)"
              :icon="Edit"
              size="small"
              circle
              text
              title="编辑参数"
              @click.stop="openEditor(step.id)"
            />
            <el-button
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              :icon="Close"
              size="small"
              circle
              text
              title="删除"
              @click.stop="$emit('remove-step', index)"
            />
          </div>

          <!-- 展开编辑：与左侧 StepConfig 共用同一套表单 -->
          <div v-if="isEditing(step.id)" class="px-3 pb-3" @click.stop>
            <StepConfig
              :type="step.type"
              mode="edit"
              :initial-params="step.params"
              @change="(p) => onEditorChange(step.id, p)"
              @confirm="(p) => onEditorConfirm(step.id, p)"
              @cancel="closeEditor"
            />
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div class="px-4 py-3 border-t border-gray-100 space-y-2">
      <el-button
        type="primary"
        class="w-full"
        :loading="loading"
        :disabled="!steps.length"
        @click="$emit('preview')"
      >
        刷新预览
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Close, Edit } from '@element-plus/icons-vue'
import {
  Crop, RefreshRight, FullScreen, Sort,
  Sunny, MoonNight, MagicStick, View, Aim, Picture,
  EditPen, Stamp, Collection,
} from '@element-plus/icons-vue'
import StepConfig from './StepConfig.vue'
import { STEP_LABELS } from './config/stepDefaults.js'
import { buildStepSummary } from './utils/stepSummary.js'

const props = defineProps({
  steps: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['remove-step', 'reorder', 'update-step', 'preview'])

/** 当前正在编辑的步骤 id（用 id 避免拖拽排序后索引错位） */
const editingStepId = ref(null)

/** 步骤类型 → Element Plus 图标组件（避免 :is 传入字符串无法解析） */
const STEP_ICONS = {
  crop: Crop,
  rotate: RefreshRight,
  resize: FullScreen,
  flip: Sort,
  brightness: Sunny,
  contrast: MoonNight,
  saturation: MagicStick,
  blur: View,
  sharpen: Aim,
  grayscale: Picture,
  watermark: Stamp,
  text: EditPen,
  sticker: Collection,
}

/** 支持在右侧面板中改参数的步骤类型（无 UI 的步骤也给简短说明面板） */
const EDITABLE_TYPES = new Set([
  'crop', 'rotate', 'resize', 'flip',
  'brightness', 'contrast', 'saturation', 'blur',
  'sharpen', 'grayscale',
  'watermark',
  'text', 'sticker',
])

/**
 * @param {string} type
 * @returns {boolean}
 */
function isStepEditable(type) {
  return EDITABLE_TYPES.has(type)
}

/**
 * @param {string} id
 */
function isEditing(id) {
  return editingStepId.value === id
}

/**
 * @param {string} type
 * @returns {object}
 */
function stepIconComponent(type) {
  return STEP_ICONS[type] || MagicStick
}

/**
 * @param {string} type
 */
function stepLabel(type) {
  return STEP_LABELS[type] || type
}

/**
 * 打开某一行的参数编辑
 * @param {string} stepId
 */
function openEditor(stepId) {
  editingStepId.value = editingStepId.value === stepId ? null : stepId
}

/** 关闭编辑面板 */
function closeEditor() {
  editingStepId.value = null
}

/**
 * 保存编辑后的参数并通知父组件
 * @param {string} stepId
 * @param {Record<string, unknown>} params
 */
function onEditorConfirm(stepId, params) {
  const index = props.steps.findIndex((s) => s.id === stepId)
  if (index >= 0) {
    emit('update-step', index, params)
  }
  closeEditor()
}

/**
 * 表单字段变更时立即更新工作流步骤，父组件会触发实时预览。
 * @param {string} stepId
 * @param {Record<string, unknown>} params
 */
function onEditorChange(stepId, params) {
  const index = props.steps.findIndex((s) => s.id === stepId)
  if (index >= 0) {
    emit('update-step', index, params)
  }
}

// 拖拽排序
let dragIndex = -1

/**
 * @param {number} index
 * @param {DragEvent} e
 */
function onDragStart(index, e) {
  dragIndex = index
  e.dataTransfer.effectAllowed = 'move'
}

/**
 * @param {number} index
 * @param {DragEvent} e
 */
function onDragOver(index, e) {
  e.dataTransfer.dropEffect = 'move'
}

/**
 * 放下后重排并关闭编辑（避免顺序变化后仍展开错误行）
 * @param {number} index
 */
function onDrop(index) {
  if (dragIndex === index || dragIndex < 0) return
  const newSteps = [...props.steps]
  const [moved] = newSteps.splice(dragIndex, 1)
  newSteps.splice(index, 0, moved)
  emit('reorder', newSteps)
  dragIndex = -1
  closeEditor()
}

/** 若正在编辑的步骤被删除或不在列表中，自动收起面板 */
watch(
  () => props.steps.map((s) => s.id),
  (ids, oldIds = []) => {
    if (ids.length > oldIds.length) {
      editingStepId.value = ids[ids.length - 1]
      return
    }
    if (editingStepId.value && !ids.includes(editingStepId.value)) {
      editingStepId.value = null
    }
  }
)
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
.list-move {
  transition: transform 0.3s ease;
}
</style>
