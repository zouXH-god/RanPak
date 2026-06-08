<template>
  <!-- 叠在画布上方、不拦截鼠标事件；刻度贴在图片左缘与下缘 -->
  <div class="pointer-events-none absolute inset-0 z-[5] overflow-visible" aria-hidden="true">
    <!-- 左侧 Y 轴刻度 -->
    <div
      v-if="frame && frame.height > 0"
      class="pointer-events-none absolute flex flex-col justify-between text-[10px] leading-none text-gray-600 font-mono tabular-nums select-none border-r border-gray-500/70 bg-white/85 px-0.5 py-0.5"
      :style="yAxisStyle"
    >
      <span v-for="(v, i) in yTicks" :key="'y' + i" class="text-right">{{ v }}</span>
    </div>

    <!-- 底部 X 轴刻度 -->
    <div
      v-if="frame && frame.width > 0"
      class="pointer-events-none absolute flex justify-between items-start text-[10px] leading-none text-gray-600 font-mono tabular-nums select-none border-t border-gray-500/70 bg-white/85 px-0.5 pt-0.5"
      :style="xAxisStyle"
    >
      <span v-for="(v, i) in xTicks" :key="'x' + i">{{ v }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildAxisTickValues } from './utils/imageCoordinateUtils.js'

/** 相对包裹层的图片像素框 { left, top, width, height } */
const props = defineProps({
  frame: {
    type: Object,
    default: null,
    validator: (v) =>
      !v ||
      (typeof v.left === 'number' &&
        typeof v.top === 'number' &&
        typeof v.width === 'number' &&
        typeof v.height === 'number'),
  },
  /** 图片原始宽度（像素），用于刻度数值 */
  naturalWidth: { type: Number, default: 0 },
  /** 图片原始高度（像素） */
  naturalHeight: { type: Number, default: 0 },
})

/** 坐标轴区域厚度（与左侧竖条宽度一致） */
const RULER = 26

/** X 轴刻度值：0 → 宽度 */
const xTicks = computed(() => buildAxisTickValues(props.naturalWidth, 4))

/** Y 轴刻度：自上而下为 0 → 高度（与图片像素坐标一致，原点在左上） */
const yTicks = computed(() => buildAxisTickValues(props.naturalHeight, 4))

/**
 * 左侧竖向刻度条样式：贴在图片左边缘外侧
 */
const yAxisStyle = computed(() => {
  const f = props.frame
  if (!f) return {}
  return {
    left: `${Math.max(0, f.left - RULER)}px`,
    top: `${f.top}px`,
    width: `${RULER}px`,
    height: `${f.height}px`,
  }
})

/**
 * 底部横向刻度条样式：贴在图片下边缘外侧
 */
const xAxisStyle = computed(() => {
  const f = props.frame
  if (!f) return {}
  return {
    left: `${f.left}px`,
    top: `${f.top + f.height}px`,
    width: `${f.width}px`,
    minHeight: '18px',
  }
})
</script>
