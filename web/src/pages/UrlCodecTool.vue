<template>
  <div class="tool-page">
    <div class="mx-auto grid max-w-[1400px] gap-4 xl:grid-cols-2">
      <section class="tool-card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">URL 编解码</h1>
            <p class="mt-1 text-sm text-gray-500">支持组件编解码、完整 URL 查询参数解析和批量换行处理。</p>
          </div>
          <el-button :icon="Delete" plain @click="source = ''; output = ''; params = []">清空</el-button>
        </div>
        <el-input v-model="source" type="textarea" :autosize="{ minRows: 14, maxRows: 24 }" placeholder="输入 URL 或文本，每行一条..." />
        <div class="mt-4 flex flex-wrap gap-2">
          <el-button type="primary" @click="encodeLines">Encode</el-button>
          <el-button @click="decodeLines">Decode</el-button>
          <el-button @click="parseUrl">解析 URL</el-button>
          <el-button :icon="CopyDocument" :disabled="!output" @click="copyText(output)">复制结果</el-button>
        </div>
      </section>
      <section class="tool-card">
        <h2 class="mb-3 text-sm font-semibold text-gray-900">输出</h2>
        <el-input v-model="output" readonly type="textarea" :autosize="{ minRows: 14, maxRows: 24 }" />
      </section>
      <section class="tool-card xl:col-span-2">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">Query 参数</h2>
          <el-button :disabled="params.length === 0" @click="rebuildUrl">按表格重组 URL</el-button>
        </div>
        <el-table :data="params" border>
          <el-table-column prop="key" label="Key" />
          <el-table-column prop="value" label="Value" />
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Delete } from '@element-plus/icons-vue'
import { copyText } from '../utils/devTools'

const source = ref('')
const output = ref('')
const params = ref([])
let parsedUrl = null

function mapLines(action) {
  return source.value.split(/\r?\n/).map((line) => line ? action(line) : '').join('\n')
}

function encodeLines() {
  output.value = mapLines((line) => encodeURIComponent(line))
}

function decodeLines() {
  try {
    output.value = mapLines((line) => decodeURIComponent(line))
  } catch (error) {
    ElMessage.error(error?.message || 'URL 解码失败')
  }
}

function parseUrl() {
  try {
    parsedUrl = new URL(source.value.trim())
    params.value = Array.from(parsedUrl.searchParams.entries()).map(([key, value]) => ({ key, value }))
    output.value = JSON.stringify({
      protocol: parsedUrl.protocol,
      host: parsedUrl.host,
      pathname: parsedUrl.pathname,
      hash: parsedUrl.hash,
      query: params.value,
    }, null, 2)
  } catch (error) {
    ElMessage.error(error?.message || 'URL 解析失败')
  }
}

function rebuildUrl() {
  if (!parsedUrl) return
  parsedUrl.search = ''
  params.value.forEach((item) => parsedUrl.searchParams.append(item.key, item.value))
  output.value = parsedUrl.toString()
}
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; padding: 20px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
