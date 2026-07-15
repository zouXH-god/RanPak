<template>
  <aside class="h-screen w-64 bg-white/90 backdrop-blur-md border-r border-gray-100 shadow-soft sticky left-0 top-0 p-4 flex flex-col overflow-hidden">
    <div class="flex items-center gap-3 px-2 py-3 header-drag">
      <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-teal to-brand-purple grid place-items-center text-white font-bold text-lg shrink-0 overflow-hidden">
        <img class="h-full w-full object-cover" :src="appIconUrl" alt="RanTerminal"/>
      </div>
      <div>
        <div class="font-semibold text-brand-ink">RanTerminal</div>
        <div class="text-xs text-gray-500">逝染自用终端</div>
      </div>
    </div>

    <div class="mt-[90px] shrink-0 pb-3">
      <el-input v-model="searchText" clearable placeholder="搜索功能">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[15px] pb-4">
      <SidebarItem icon="House" label="首页" to="/home" />
      <template v-for="group in visibleGroups" :key="group.key">
        <button
          class="group flex w-full items-center justify-between px-3 py-2 rounded-xl hover:bg-peach-100"
          :class="isGroupActive(group, route) ? 'bg-peach-100' : ''"
          @click="toggleGroup(group.key)"
        >
          <span class="flex items-center gap-3 text-gray-700">
            <el-icon>
              <component :is="Icons[group.icon]" />
            </el-icon>
            <span>{{ group.title }}</span>
          </span>
          <el-icon class="text-gray-500 transition-transform" :class="isGroupOpen(group.key) ? 'rotate-90' : ''">
            <ArrowRight />
          </el-icon>
        </button>
        <div v-if="isGroupOpen(group.key)" class="ml-6 space-y-1">
          <SidebarItem
            v-for="item in group.items"
            :key="`${group.key}-${item.label}`"
            :icon="item.icon"
            :label="item.label"
            :to="item.to"
            :favorite-item="item"
            :is-favorite="isFavorite(item)"
            @toggle-favorite="toggleFavorite"
          />
          <div v-if="group.key === 'favorites' && group.items.length === 0" class="px-3 py-2 text-xs text-gray-400">
            暂无收藏
          </div>
        </div>
      </template>
      <div v-if="searchText && visibleGroups.length === 0" class="px-3 py-8 text-center text-xs text-gray-400">
        未找到匹配功能
      </div>
    </nav>
    <div class="h-[72px] shrink-0 pointer-events-none"></div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as Icons from '@element-plus/icons-vue'
import { ArrowRight, Search } from '@element-plus/icons-vue'
import SidebarItem from './SidebarItem.vue'
import { featureGroups, featureGroupsWithFavorites, filterFeatureGroups, isGroupActive } from '../data/features'
import { useFavorites } from '../composables/useFavorites'
import { useFeatureVisibility } from '../composables/useFeatureVisibility'
import appIconUrl from '../static/images/app-icon.png'

const route = useRoute()
const searchText = ref('')
const openGroup = ref('image')
const { favoriteKeySet, isFavorite, toggleFavorite } = useFavorites()
const { hiddenSet } = useFeatureVisibility()

const allGroups = computed(() => featureGroupsWithFavorites(favoriteKeySet.value, hiddenSet.value))
const visibleGroups = computed(() => searchText.value.trim() ? filterFeatureGroups(searchText.value, allGroups.value) : allGroups.value)

watch(() => route.fullPath, () => {
  const activeGroup = featureGroups.find((group) => isGroupActive(group, route))
  if (activeGroup) openGroup.value = activeGroup.key
}, { immediate: true })

watch(searchText, (value) => {
  if (!value.trim()) return
  const firstGroup = visibleGroups.value[0]
  if (firstGroup) openGroup.value = firstGroup.key
})

function isGroupOpen(group) {
  if (searchText.value.trim()) return visibleGroups.value.some((item) => item.key === group)
  return openGroup.value === group
}

function toggleGroup(group) {
  openGroup.value = openGroup.value === group ? '' : group
}
</script>
