<template>
  <button class="px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-brand-orange hover:text-brand-orange transition">
    {{ label }}
  </button>
</template>
<script setup>
defineProps({ label: String })
</script>
