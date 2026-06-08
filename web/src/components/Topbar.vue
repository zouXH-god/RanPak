<template>
  <div class="flex items-center justify-between px-6 pb-4">
    <h1 class="text-xl font-semibold text-brand-ink">{{ title }}</h1>
    <div class="flex-1 mx-6">
      <div class="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-2 shadow-soft">
        <el-input v-model="q" placeholder="搜索所有活动" clearable>
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div class="flex items-center gap-2">
          <el-tag round type="warning" effect="light">California</el-tag>
          <el-tag round>All</el-tag>
        </div>
      </div>
      <div class="flex items-center gap-3 mt-3 text-sm">
        <el-check-tag v-for="t in tags" :key="t" :checked="checkedTags.includes(t)" @change="onToggle(t)">{{ t }}</el-check-tag>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-gray-500"></span>
      <div class="text-sm bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-soft">
        <span class="text-gray-500 mr-2">Balance</span>
        <span class="font-semibold">$3 456.20</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useRoute } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import {computed, ref} from "vue";
const route = useRoute()
const title = computed(() => route.meta.title ?? 'Find Events')
const q = ref('')
const tags = ['Arts', 'Music', 'Tech', 'Social']
const checkedTags = ref([])

/** 切换标签选中状态 */
function onToggle(t) {
  const i = checkedTags.value.indexOf(t);
  if (i === -1) {
    checkedTags.value.push(t);
  } else {
    checkedTags.value.splice(i, 1);
  }
}
</script>
