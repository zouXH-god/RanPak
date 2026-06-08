<template>
  <p class="source-credit">
    <span>开源来源：</span>
    <template v-for="(item, index) in normalizedSources" :key="item.url">
      <button type="button" @click="openSource(item.url)">{{ item.name }}</button>
      <span v-if="index < normalizedSources.length - 1">、</span>
    </template>
  </p>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sources: {
    type: Array,
    required: true,
  },
})

const normalizedSources = computed(() => props.sources
  .map((item) => ({
    name: String(item?.name || '').trim(),
    url: String(item?.url || '').trim(),
  }))
  .filter((item) => item.name && /^https?:\/\//i.test(item.url)))

async function openSource(url) {
  const opened = await window.electronAPI?.openExternal?.(url)
  if (!opened) window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.source-credit {
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.source-credit button {
  border: 0;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.source-credit button:hover {
  color: #374151;
}
</style>
