<template>
  <div class="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-3">
    <div class="text-sm font-medium text-gray-700">{{ title }}</div>

    <!-- 旋转 -->
    <template v-if="type === 'rotate'">
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 w-12">角度</span>
        <el-slider v-model="params.angle" :min="-360" :max="360" :step="1" class="flex-1" />
        <span class="text-xs text-gray-500 w-10 text-right">{{ params.angle }}°</span>
      </div>
    </template>

    <!-- 缩放 -->
    <template v-if="type === 'resize'">
      <el-segmented
        v-model="params.mode"
        :options="[
          { label: '像素', value: 'pixels' },
          { label: '百分比', value: 'percent' },
        ]"
        size="small"
        class="w-full"
      />
      <template v-if="params.mode !== 'percent'">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">宽度</span>
          <el-input-number v-model="params.width" :min="1" :max="10000" size="small" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">高度</span>
          <el-input-number v-model="params.height" :min="1" :max="10000" size="small" />
        </div>
        <el-checkbox v-model="params.keep_ratio" label="保持比例" size="small" />
      </template>
      <template v-else>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">比例</span>
          <el-slider v-model="params.percent" :min="1" :max="500" :step="1" class="flex-1" />
          <span class="text-xs text-gray-500 w-12 text-right">{{ params.percent }}%</span>
        </div>
        <el-input-number v-model="params.percent" :min="1" :max="500" size="small" class="!w-full" />
      </template>
    </template>

    <!-- 翻转 -->
    <template v-if="type === 'flip'">
      <el-radio-group v-model="params.direction" size="small">
        <el-radio-button value="horizontal">水平翻转</el-radio-button>
        <el-radio-button value="vertical">垂直翻转</el-radio-button>
      </el-radio-group>
    </template>

    <!-- 亮度/对比度/饱和度 -->
    <template v-if="['brightness', 'contrast', 'saturation'].includes(type)">
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 w-12">强度</span>
        <el-slider v-model="params.factor" :min="0" :max="3" :step="0.05" class="flex-1" />
        <span class="text-xs text-gray-500 w-10 text-right">{{ Number(params.factor).toFixed(2) }}</span>
      </div>
    </template>

    <!-- 模糊 -->
    <template v-if="type === 'blur'">
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500 w-12">半径</span>
        <el-slider v-model="params.radius" :min="0.5" :max="20" :step="0.5" class="flex-1" />
        <span class="text-xs text-gray-500 w-10 text-right">{{ params.radius }}</span>
      </div>
    </template>

    <!-- 水印 -->
    <template v-if="type === 'watermark'">
      <div class="space-y-2">
        <el-input v-model="params.content" placeholder="水印文字" />
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">字号</span>
          <el-input-number v-model="params.size" :min="8" :max="200" size="small" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">颜色</span>
          <el-color-picker v-model="params.color" size="small" />
          <span class="text-xs text-gray-500">{{ params.color }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">透明</span>
          <el-slider v-model="params.opacity" :min="0.05" :max="1" :step="0.05" class="flex-1" />
          <span class="text-xs text-gray-500 w-10 text-right">{{ Number(params.opacity).toFixed(2) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">角度</span>
          <el-slider v-model="params.angle" :min="-90" :max="90" :step="1" class="flex-1" />
          <span class="text-xs text-gray-500 w-10 text-right">{{ params.angle }}°</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">横距</span>
            <el-input-number v-model="params.gap_x" :min="40" :max="800" size="small" controls-position="right" />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">纵距</span>
            <el-input-number v-model="params.gap_y" :min="40" :max="800" size="small" controls-position="right" />
          </div>
        </div>
      </div>
    </template>

    <!-- 文字 -->
    <template v-if="type === 'text'">
      <div class="space-y-2">
        <el-input v-model="params.content" placeholder="文字内容" />
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">X</span>
            <el-input-number v-model="params.x" :min="0" size="small" controls-position="right" />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">Y</span>
            <el-input-number v-model="params.y" :min="0" size="small" controls-position="right" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">字号</span>
          <el-input-number v-model="params.size" :min="8" :max="200" size="small" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">颜色</span>
          <el-color-picker v-model="params.color" size="small" />
          <span class="text-xs text-gray-500">{{ params.color }}</span>
        </div>
      </div>
    </template>

    <!-- 贴图 -->
    <template v-if="type === 'sticker'">
      <div class="space-y-2">
        <div v-if="params.preview_url" class="rounded border border-gray-200 bg-white p-2">
          <img :src="params.preview_url" alt="" class="max-h-24 max-w-full object-contain mx-auto" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">X</span>
            <el-input-number v-model="params.x" :min="0" size="small" controls-position="right" />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">Y</span>
            <el-input-number v-model="params.y" :min="0" size="small" controls-position="right" />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">宽</span>
            <el-input-number v-model="params.width" :min="1" size="small" controls-position="right" />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-gray-500">高</span>
            <el-input-number v-model="params.height" :min="1" size="small" controls-position="right" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 w-12">角度</span>
          <el-slider v-model="params.angle" :min="-180" :max="180" :step="1" class="flex-1" />
          <span class="text-xs text-gray-500 w-12 text-right">{{ params.angle }}°</span>
        </div>
      </div>
    </template>

    <!-- 裁剪：必须先填参数再加入工作流 -->
    <template v-if="type === 'crop'">
      <p class="text-xs text-gray-500">左上角坐标与裁剪区域宽高（像素）</p>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-500">X</span>
          <el-input-number v-model="params.x" :min="0" size="small" controls-position="right" />
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-500">Y</span>
          <el-input-number v-model="params.y" :min="0" size="small" controls-position="right" />
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-500">宽</span>
          <el-input-number v-model="params.width" :min="1" size="small" controls-position="right" />
        </div>
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-500">高</span>
          <el-input-number v-model="params.height" :min="1" size="small" controls-position="right" />
        </div>
      </div>
    </template>

    <!-- 无参步骤：仍允许在编辑面板中确认 -->
    <template v-if="type === 'sharpen' || type === 'grayscale'">
      <p class="text-xs text-gray-500 leading-relaxed">
        此步骤无需额外参数，点击下方按钮即可{{ mode === 'edit' ? '保存' : '加入工作流' }}。
      </p>
    </template>

    <div class="flex justify-end gap-2 pt-1">
      <el-button size="small" @click="$emit('cancel')">取消</el-button>
      <el-button type="primary" size="small" @click="onConfirm">
        {{ confirmLabel }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, computed, nextTick } from 'vue'
import { mergeStepParams, STEP_CONFIG_TITLES } from './config/stepDefaults.js'

const props = defineProps({
  /** 步骤类型，与后端 StepType 字符串一致 */
  type: { type: String, required: true },
  /**
   * 编辑模式：传入当前步骤已有 params，会与默认值合并后填入表单
   */
  initialParams: { type: Object, default: null },
  /** add：左侧工具新增；edit：工作流中修改 */
  mode: { type: String, default: 'add', validator: (v) => ['add', 'edit'].includes(v) },
})

const emit = defineEmits(['confirm', 'cancel', 'change'])

/** 面板标题 */
const title = computed(() => STEP_CONFIG_TITLES[props.type] || '参数设置')

/** 主按钮文案 */
const confirmLabel = computed(() => (props.mode === 'edit' ? '保存修改' : '应用'))

/** 表单数据：由 mergeStepParams 根据类型与 initialParams 初始化 */
const params = reactive(mergeStepParams(props.type, props.initialParams))
let resetting = false

/**
 * 类型或初始参数变化时重置表单（例如切换正在编辑的步骤）
 */
function resetParamsFromProps() {
  resetting = true
  const next = mergeStepParams(props.type, props.initialParams)
  if (props.type === 'resize' && !next.mode) {
    next.mode = 'pixels'
  }
  Object.keys(params).forEach((k) => delete params[k])
  Object.assign(params, next)
  nextTick(() => {
    resetting = false
  })
}

watch(
  () => [props.type, props.initialParams],
  () => resetParamsFromProps(),
  { deep: true, immediate: true }
)

watch(
  params,
  () => {
    if (resetting) return
    emit('change', { ...params })
  },
  { deep: true }
)

/**
 * 提交时将当前 params 浅拷贝发出，避免父组件直接改到 reactive 引用
 */
function onConfirm() {
  const next = { ...params }
  if (props.type === 'resize') {
    next.mode = next.mode || 'pixels'
  }
  emit('confirm', next)
}
</script>
