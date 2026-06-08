<template>
  <svg v-if="name==='search'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="cls"><path d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z"/></svg>
  <svg v-else-if="name==='inbox'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="cls"><path d="M4 4h16v12h-4l-2 3h-4l-2-3H4z"/></svg>
  <svg v-else-if="name==='ticket'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="cls"><path d="M3 7h18v10H3zM8 7v10M16 7v10"/></svg>
  <svg v-else-if="name==='mic'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="cls"><path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"/><path d="M19 11a7 7 0 11-14 0"/></svg>
  <svg v-else-if="name==='calendar'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="cls"><path d="M7 2v3M17 2v3M3 9h18M5 7h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z"/></svg>
  <svg v-else-if="name==='settings'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="cls"><path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M4 12a8 8 0 0116 0"/></svg>
  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="cls"><circle cx="12" cy="12" r="8"/></svg>
</template>
<script setup>
const props = defineProps({ name:String, class:String })
const cls = props.class ?? 'w-5 h-5'
</script>
