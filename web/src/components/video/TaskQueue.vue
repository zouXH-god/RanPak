<template>
  <section class="rounded-lg border border-gray-200 bg-white">
    <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
      <h2 class="text-sm font-semibold text-gray-900">任务列表</h2>
      <el-button size="small" text :icon="Refresh" @click="$emit('refresh')">刷新</el-button>
    </div>
    <el-table :data="jobs" size="small" height="220" empty-text="暂无任务">
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="150">
        <template #default="{ row }">
          <el-progress :percentage="row.progress || 0" :stroke-width="8" />
        </template>
      </el-table-column>
      <el-table-column label="输出位置" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">{{ row.outputPath || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="132" fixed="right">
        <template #default="{ row }">
          <div class="flex items-center gap-1">
            <el-tooltip v-if="row.status === 'running'" content="取消任务" placement="top">
              <el-button size="small" text type="danger" :icon="Close" @click="$emit('cancel', row.id)" />
            </el-tooltip>
            <el-tooltip content="打开所在文件夹" placement="top">
              <el-button size="small" text :icon="FolderOpened" :disabled="!row.outputPath" @click="openOutput(row)" />
            </el-tooltip>
            <el-tooltip content="查看详情" placement="top">
              <el-button size="small" text :icon="Document" @click="showDetail(row)" />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="detailOpen" title="任务详情" width="720px">
      <div v-if="activeJob" class="space-y-3">
        <div>
          <div class="mb-1 text-xs font-medium text-gray-500">FFmpeg 命令</div>
          <pre class="max-h-32 overflow-auto rounded bg-slate-950 p-3 text-xs leading-5 text-slate-100">{{ activeJob.command }}</pre>
        </div>
        <div>
          <div class="mb-1 text-xs font-medium text-gray-500">日志</div>
          <pre class="max-h-52 overflow-auto rounded bg-slate-50 p-3 text-xs leading-5 text-gray-700">{{ (activeJob.logs || []).join('\n') || '暂无日志' }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="copyCommand">复制命令</el-button>
        <el-button type="primary" @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Document, FolderOpened, Refresh } from '@element-plus/icons-vue'

defineProps({
  jobs: { type: Array, required: true },
})
defineEmits(['refresh', 'cancel'])

const detailOpen = ref(false)
const activeJob = ref(null)

function showDetail(job) {
  activeJob.value = job
  detailOpen.value = true
}

async function copyCommand() {
  if (!activeJob.value?.command) return
  await navigator.clipboard?.writeText(activeJob.value.command)
  ElMessage.success('已复制命令')
}

async function openOutput(job) {
  if (!job?.outputPath) {
    ElMessage.warning('没有可打开的输出路径')
    return
  }
  const opened = await window.electronAPI?.showItemInFolder?.(job.outputPath)
  if (!opened) ElMessage.warning('当前环境不支持打开文件夹')
}

function statusLabel(status) {
  return { queued: '等待', running: '运行中', success: '成功', failed: '失败', canceled: '已取消' }[status] || status
}

function statusType(status) {
  return { queued: 'info', running: 'warning', success: 'success', failed: 'danger', canceled: 'info' }[status] || 'info'
}
</script>
