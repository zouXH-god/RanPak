<template>
  <RouterLink :to="to" class="group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-peach-100" :class="isActive ? 'bg-peach-100' : ''">
    <div class="flex items-center gap-3">
      <el-icon v-if="props.icon">
        <component :is="Icons[props.icon]" />
      </el-icon>
      <span class="text-gray-700">{{ label }}</span>
    </div>
    <el-badge v-if="badge" :value="badge" class="translate-y-[-1px]"><span class="w-0 h-0"></span></el-badge>
  </RouterLink>
  <div class="ml-6" v-if="subActive">
    <slot name="sub-item"></slot>
  </div>
</template>
<script setup>
import { RouterLink, useRoute } from 'vue-router'
import * as Icons from '@element-plus/icons-vue'
import {computed} from "vue";
const props = defineProps({ icon:String, label:String, badge:String, to:[String, Object] })
const route = useRoute()
const isActive = computed(() => {
  const basePath = typeof props.to === 'string' ? props.to : props.to?.path || props.to
  if (route.path !== basePath) return false
  const query = typeof props.to === 'object' ? props.to?.query : null
  if (!query) return true
  return Object.entries(query).every(([key, value]) => String(route.query[key] || '') === String(value))
})
const subActive = computed(() => {
  if (!props.to) return false
  const basePath = typeof props.to === 'string' ? props.to : props.to?.path || props.to
  return route.path === basePath || route.path.startsWith(basePath + '/')
})
</script>
