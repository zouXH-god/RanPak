<template>
  <div class="group flex items-center rounded-xl hover:bg-peach-100" :class="isActive ? 'bg-peach-100' : ''">
    <RouterLink :to="to" class="min-w-0 flex-1 flex items-center justify-between px-3 py-2">
      <div class="min-w-0 flex items-center gap-3">
        <el-icon v-if="props.icon" class="shrink-0">
          <component :is="Icons[props.icon]" />
        </el-icon>
        <span class="truncate text-gray-700">{{ label }}</span>
      </div>
      <el-badge v-if="badge" :value="badge" class="translate-y-[-1px]"><span class="w-0 h-0"></span></el-badge>
    </RouterLink>
    <button
      v-if="favoriteItem"
      type="button"
      class="favorite-toggle"
      :class="isFavorite ? 'is-favorite' : ''"
      :aria-label="isFavorite ? `取消收藏 ${label}` : `收藏 ${label}`"
      :title="isFavorite ? '取消收藏' : '收藏'"
      @click.stop="$emit('toggle-favorite', favoriteItem)"
    >
      <el-icon>
        <StarFilled v-if="isFavorite" />
        <Star v-else />
      </el-icon>
    </button>
  </div>
  <div class="ml-6" v-if="subActive">
    <slot name="sub-item"></slot>
  </div>
</template>
<script setup>
import { RouterLink, useRoute } from 'vue-router'
import * as Icons from '@element-plus/icons-vue'
import { Star, StarFilled } from '@element-plus/icons-vue'
import {computed} from "vue";
const props = defineProps({ icon:String, label:String, badge:String, to:[String, Object], favoriteItem:Object, isFavorite:Boolean })
defineEmits(['toggle-favorite'])
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

<style scoped>
.favorite-toggle {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  margin-right: 0.25rem;
  border: 0;
  border-radius: 999px;
  color: #cbd5e1;
  background: transparent;
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.favorite-toggle:hover {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  transform: scale(1.05);
}

.favorite-toggle.is-favorite {
  color: #f59e0b;
}
</style>
