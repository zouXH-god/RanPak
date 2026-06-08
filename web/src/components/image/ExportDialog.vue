<template>
  <el-dialog
    :model-value="visible"
    title="导出图片"
    width="420px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div>
        <div class="mb-2 text-sm font-medium text-gray-600">输出格式</div>
        <el-select v-model="format" class="w-full">
          <el-option
            v-for="opt in IMAGE_EXPORT_FORMAT_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>

      <div>
        <div class="mb-2 text-sm font-medium text-gray-600">质量</div>
        <el-input-number v-model="quality" :min="1" :max="100" class="!w-full" />
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="confirmExport">导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { IMAGE_EXPORT_FORMAT_OPTIONS } from './config/exportFormats.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  outputFormat: { type: String, default: 'PNG' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'confirm'])

const format = ref(props.outputFormat)
const quality = ref(95)

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      format.value = props.outputFormat
      quality.value = 95
    }
  }
)

function confirmExport() {
  emit('confirm', {
    outputFormat: format.value,
    quality: quality.value,
  })
}
</script>
