<template>
  <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
    <button
      v-for="tool in modules"
      :key="tool.key"
      class="rounded-lg border bg-white p-4 text-left transition hover:border-sky-200 hover:bg-sky-50/50"
      :class="tool.key === activeTool ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-100' : 'border-gray-200'"
      type="button"
      @click="$emit('select', tool.key)"
    >
      <div class="mb-3 flex items-center justify-between">
        <span class="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-700">
          <el-icon><component :is="tool.icon" /></el-icon>
        </span>
        <el-tag v-if="tool.key === 'convert' || tool.key === 'compress'" size="small" type="success" effect="plain">常用</el-tag>
      </div>
      <div class="text-sm font-semibold text-gray-900">{{ tool.label }}</div>
      <div class="mt-1 min-h-10 text-xs leading-5 text-gray-500">{{ tool.summary }}</div>
    </button>
  </div>
</template>

<script setup>
defineProps({
  modules: { type: Array, required: true },
  activeTool: { type: String, required: true },
})
defineEmits(['select'])
</script>
