<script setup>
import Sidebar from './components/Sidebar.vue'
import { Close, FullScreen, Minus } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isOverlay = computed(() => route.meta?.overlay === true)

function minimizeWindow() {
  window.electronAPI?.minimizeWindow?.()
}

function toggleMaximizeWindow() {
  window.electronAPI?.toggleMaximizeWindow?.()
}

function closeWindow() {
  window.electronAPI?.closeWindow?.()
}
</script>
<template>
  <router-view v-if="isOverlay" />
  <div v-else class="min-h-screen text-brand-ink h-full">
    <div class="window-controls">
      <button class="window-control" type="button" title="最小化" @click="minimizeWindow">
        <el-icon><Minus /></el-icon>
      </button>
      <button class="window-control" type="button" title="最大化/还原" @click="toggleMaximizeWindow">
        <el-icon><FullScreen /></el-icon>
      </button>
      <button class="window-control close" type="button" title="关闭" @click="closeWindow">
        <el-icon><Close /></el-icon>
      </button>
    </div>
    <div class="grid grid-cols-[16rem_1fr] gap-0 h-full">
      <Sidebar />
      <main class="min-h-screen bg-peach-50 h-full overflow-auto">
        <div class="top-app-region"></div>
        <div class="pt-4 h-full min-h-0"><router-view /></div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.window-controls {
  position: fixed;
  left: 16px;
  bottom: 18px;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.window-control {
  display: inline-flex;
  width: 34px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

.window-control:hover {
  background: rgba(17, 24, 39, 0.08);
  color: #111827;
}

.window-control.close:hover {
  background: #ef4444;
  color: #fff;
}
</style>
