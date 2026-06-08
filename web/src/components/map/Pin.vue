<template>
  <div class="absolute -translate-x-1/2 -translate-y-1/2" :style="{ left: x, top: y }">
    <div :class="['h-8 w-8 rounded-full grid place-items-center text-white text-xs font-semibold shadow-soft', toneClass]">{{ label.split(' ')[0] }}</div>
    <div class="text-[10px] text-gray-600 text-center mt-1">{{ label.split(' ')[1] }}</div>
  </div>
</template>
<script setup>
import {computed} from "vue";

const props = defineProps({ x: String, y: String, label: String, tone: String })
const toneClass = computed(() => ({
  teal: 'bg-brand-teal',
  orange: 'bg-brand-orange',
  purple: 'bg-brand-purple'
}[props.tone] ?? 'bg-brand-teal'))
</script>
