<template>
  <aside class="h-[calc(100vh-5rem)] w-[360px] bg-white border border-gray-100 shadow-soft sticky top-[5rem] flex flex-col rounded-3xl overflow-hidden">
    <div class="h-44 bg-gradient-to-tr from-brand-teal to-brand-purple relative">
      <div class="absolute inset-0 grid place-items-center">
        <div class="text-white text-4xl font-black drop-shadow-md">{{ event?.imageText ?? 'SOUND' }}</div>
      </div>
      <el-button class="absolute bottom-3 left-3" size="small" round>Watch video</el-button>
    </div>
    <div class="p-5 space-y-3 overflow-y-auto">
      <h2 class="font-semibold text-lg text-brand-ink leading-tight">{{ event?.title ?? 'Electronic Sound with DJ ARMY ft Miss Lexa' }}</h2>
      <div class="text-sm text-gray-600 flex flex-col gap-1">
        <div><span class="font-medium">Date: </span>{{ event ? new Date(event.date).toLocaleDateString() : 'Mar 29, 2025' }}</div>
        <div><span class="font-medium">Time: </span>{{ event?.time ?? '19:00 - End' }}</div>
        <div><span class="font-medium">City: </span>{{ event?.city ?? 'California, CA' }}</div>
      </div>
      <div>
        <div class="text-sm text-gray-800 font-medium mb-1">About this event</div>
        <p class="text-sm text-gray-600 leading-relaxed">
          We're celebrating our 30th edition of the California Art Festival this Spring.
          Join us at the Building Park in California State University with our Private View.
        </p>
      </div>
      <div class="mt-2 flex items-center justify-between">
        <div class="text-sm text-gray-600">Price</div>
        <div class="font-semibold text-brand-ink">${{ (event?.price?.[0] ?? 25.98).toFixed(2) }} - ${{ (event?.price?.[1] ?? 35.00).toFixed(2) }}</div>
      </div>
    </div>
    <div class="p-5 mt-auto"><el-button type="primary" size="large" round class="w-full">Get a Ticket</el-button></div>
  </aside>
</template>
<script setup>
defineProps({ event: Object })
</script>
