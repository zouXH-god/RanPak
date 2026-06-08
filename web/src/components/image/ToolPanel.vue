<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-gray-100">
      <h3 class="text-sm font-semibold text-gray-700">编辑工具</h3>
    </div>
    <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
      <!-- 基本变换 -->
      <div class="text-xs text-gray-400 font-medium px-1 pt-2 pb-1">基本变换</div>
      <ToolButton icon="Crop" label="裁剪" @click="startCrop" />
      <ToolButton icon="RefreshRight" label="旋转" @click="showConfig('rotate')" />
      <ToolButton icon="FullScreen" label="缩放" @click="showConfig('resize')" />
      <ToolButton icon="Sort" label="翻转" @click="showConfig('flip')" />

      <!-- 滤镜调整 -->
      <div class="text-xs text-gray-400 font-medium px-1 pt-3 pb-1">滤镜调整</div>
      <ToolButton icon="Sunny" label="亮度" @click="showConfig('brightness')" />
      <ToolButton icon="MoonNight" label="对比度" @click="showConfig('contrast')" />
      <ToolButton icon="MagicStick" label="饱和度" @click="showConfig('saturation')" />
      <ToolButton icon="View" label="模糊" @click="showConfig('blur')" />
      <ToolButton icon="Aim" label="锐化" @click="emitStep('sharpen')" />
      <ToolButton icon="Picture" label="灰度" @click="emitStep('grayscale')" />

      <!-- 叠加 -->
      <div class="text-xs text-gray-400 font-medium px-1 pt-3 pb-1">叠加元素</div>
      <ToolButton icon="EditPen" label="添加文字" @click="showConfig('text')" />
      <ToolButton icon="Stamp" label="添加水印" @click="showConfig('watermark')" />
      <ToolButton icon="Collection" label="添加贴图" @click="$emit('add-sticker')" />
    </div>
  </div>
</template>

<script setup>
import ToolButton from './ToolButton.vue'

const emit = defineEmits(['add-step', 'add-sticker', 'start-crop'])

/**
 * 点击工具后立即添加默认步骤，参数在右侧工作流面板实时编辑。
 * @param {string} type - 步骤类型
 */
function showConfig(type) {
  emitStep(type)
}

/** 进入画布裁剪模式 */
function startCrop() {
  emit('start-crop')
}

/**
 * 无参或固定参步骤直接加入工作流
 * @param {string} type
 * @param {Record<string, unknown>} params
 */
function emitStep(type, params = {}) {
  emit('add-step', { type, params })
}
</script>
