<template>
  <div class="tool-page">
    <div class="mx-auto grid max-w-[1400px] gap-4 xl:grid-cols-2">
      <section class="tool-card">
        <div class="mb-3">
          <h1 class="text-xl font-semibold text-gray-900">正则测试</h1>
          <p class="mt-1 text-sm text-gray-500">实时测试正则表达式，展示匹配项、捕获组和索引。</p>
        </div>
        <div class="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <el-input v-model="pattern" placeholder="表达式，例如 (foo)\\d+" />
          <el-input v-model="flags" placeholder="flags: gim" />
        </div>
        <el-input v-model="source" type="textarea" :autosize="{ minRows: 18, maxRows: 28 }" placeholder="输入测试文本..." />
        <el-alert v-if="errorMessage" class="mt-4" :title="errorMessage" type="error" show-icon />
      </section>
      <section class="tool-card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">匹配结果</h2>
          <div class="flex items-center gap-2">
            <el-tag type="info">{{ matches.length }} 个匹配</el-tag>
            <el-button :icon="CopyDocument" :disabled="matches.length === 0" @click="copyText(JSON.stringify(matches, null, 2))">复制 JSON</el-button>
          </div>
        </div>
        <el-table :data="matches" border height="560">
          <el-table-column prop="index" label="Index" width="90" />
          <el-table-column prop="match" label="Match" />
          <el-table-column label="Groups">
            <template #default="scope">
              <span class="break-words text-xs">{{ scope.row.groups.join(' | ') || '-' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { copyText } from '../utils/devTools'

const pattern = ref('(foo)\\d+')
const flags = ref('gi')
const source = ref('foo1\nbar\nfoo22')
const errorMessage = ref('')

const matches = computed(() => {
  errorMessage.value = ''
  if (!pattern.value) return []
  try {
    const normalizedFlags = Array.from(new Set(flags.value.includes('g') ? flags.value : `${flags.value}g`)).join('')
    const regex = new RegExp(pattern.value, normalizedFlags)
    return Array.from(source.value.matchAll(regex)).map((match) => ({
      index: match.index,
      match: match[0],
      groups: match.slice(1),
    }))
  } catch (error) {
    errorMessage.value = error?.message || '正则表达式无效'
    return []
  }
})
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; padding: 20px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
