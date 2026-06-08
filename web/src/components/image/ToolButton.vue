<template>
  <button
    class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600
           hover:bg-blue-50 hover:text-blue-600 transition-colors duration-150 text-left"
    @click="$emit('click')"
  >
    <el-icon :size="16"><component :is="iconComponent" /></el-icon>
    <span>{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import {
  Crop, RefreshRight, FullScreen, Sort,
  Sunny, MoonNight, MagicStick, View, Aim, Picture,
  EditPen, Collection, Stamp,
} from '@element-plus/icons-vue'

/** 名称与左侧工具栏使用的图标一致 */
const ICON_BY_NAME = {
  Crop,
  RefreshRight,
  FullScreen,
  Sort,
  Sunny,
  MoonNight,
  MagicStick,
  View,
  Aim,
  Picture,
  EditPen,
  Collection,
  Stamp,
}

const props = defineProps({
  /** 与 ICON_BY_NAME 的键一致，例如 'Crop' */
  icon: { type: String, required: true },
  label: { type: String, required: true },
})

defineEmits(['click'])

/** 将 props.icon 解析为实际组件，供动态组件渲染 */
const iconComponent = computed(() => ICON_BY_NAME[props.icon] || Picture)
</script>
