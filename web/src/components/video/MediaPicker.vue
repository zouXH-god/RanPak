<template>
  <section class="rounded-lg border border-gray-200 bg-white">
    <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">选择文件</h2>
        <p class="text-xs text-gray-500">{{ module.multi ? '可选择多个文件' : '选择一个视频或音频文件' }}</p>
      </div>
      <el-button type="primary" :icon="Upload" @click="$emit('pick')">选择文件</el-button>
    </div>

    <div class="p-4">
      <div v-if="!files.length" class="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
        还没有选择文件
      </div>
      <div v-else class="space-y-2">
        <div v-for="file in files" :key="file" class="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
          <el-icon class="text-sky-600"><VideoCamera /></el-icon>
          <div class="min-w-0 flex-1 truncate text-sm text-gray-700">{{ file }}</div>
        </div>
      </div>

      <video v-if="previewUrl" class="mt-4 max-h-56 w-full rounded-md bg-black object-contain" :src="previewUrl" controls />

      <div v-if="mediaSummary.length" class="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div v-for="item in mediaSummary" :key="item.label" class="rounded-md bg-slate-50 p-2">
          <div class="text-gray-400">{{ item.label }}</div>
          <div class="mt-1 truncate font-medium text-gray-800">{{ item.value }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Upload, VideoCamera } from '@element-plus/icons-vue'

const props = defineProps({
  module: { type: Object, required: true },
  files: { type: Array, required: true },
  previewUrl: { type: String, default: '' },
  probeInfo: { type: Object, default: null },
})
defineEmits(['pick'])

const mediaSummary = computed(() => {
  const info = props.probeInfo
  if (!info?.format && !info?.streams) return []
  const video = (info.streams || []).find((stream) => stream.codec_type === 'video')
  const audio = (info.streams || []).find((stream) => stream.codec_type === 'audio')
  return [
    { label: '时长', value: formatDuration(Number(info.format?.duration || 0)) },
    { label: '分辨率', value: video?.width && video?.height ? `${video.width}x${video.height}` : '无视频流' },
    { label: '视频编码', value: video?.codec_name || '-' },
    { label: '音频编码', value: audio?.codec_name || '-' },
  ]
})

function formatDuration(seconds) {
  if (!seconds) return '-'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
</script>
