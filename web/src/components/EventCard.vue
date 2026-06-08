<template>
  <div class="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
    <div class="h-28 bg-gradient-to-tr from-brand-teal to-brand-purple grid place-items-center text-white font-black tracking-widest text-xl">
      {{ item.imageText }}
    </div>
    <div class="p-4">
      <div class="flex items-center gap-2 text-xs text-gray-500">
        <span>{{ prettyDate(item.date) }}</span>
        <span>·</span>
        <span>{{ item.time }}</span>
      </div>
      <div class="mt-1 font-semibold text-brand-ink line-clamp-2">{{ item.title }}</div>
      <div class="mt-1 text-sm text-gray-500">{{ item.city }}</div>
      <div class="mt-3 flex items-center justify-between">
        <el-tag type="warning" effect="light" round>${{ item.price[0].toFixed(2) }} - ${{ item.price[1].toFixed(2) }}</el-tag>
        <el-button type="primary" round size="small" @click="$emit('select', item)">查看</el-button>
      </div>
    </div>
  </div>
</template>
<script setup>
defineProps({ item: Object })
defineEmits(['select'])
const prettyDate = (d) => new Date(d).toLocaleDateString()
</script>
