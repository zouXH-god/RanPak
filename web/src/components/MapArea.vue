<template>
  <div class="relative rounded-3xl bg-gray-100 h-80 overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.04)_1px,_transparent_0)] bg-[length:24px_24px]"></div>
    <Pin v-for="pin in pins" :key="pin.id" :x="pin.x" :y="pin.y" :label="pin.label" :tone="pin.tone"/>
  </div>
</template>
<script setup>
const Pin = (await import('./map/Pin.vue')).default
const pins = [
  { id: 1, x: '15%', y: '20%', label: '15 km', tone: 'teal' },
  { id: 2, x: '35%', y: '40%', label: '5 km', tone: 'orange' },
  { id: 3, x: '55%', y: '30%', label: '12 km', tone: 'purple' },
  { id: 4, x: '70%', y: '60%', label: '10 km', tone: 'teal' },
  { id: 5, x: '82%', y: '35%', label: '2 km', tone: 'orange' }
]
</script>
