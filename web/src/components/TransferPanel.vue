<template>
  <div
    class="transfer-panel"
    :class="{ 'is-collapsed': collapsed }"
    :style="{ height: collapsed ? '40px' : panelHeight + 'px' }"
  >
    <!-- 拖拽调整高度的手柄 -->
    <div v-show="!collapsed" class="resize-handle" @mousedown="startResize"></div>

    <div class="transfer-panel-header" @click="collapsed = !collapsed">
      <div class="transfer-stats">
        <span class="stat-badge running" v-if="runningCount > 0">传输中 {{ runningCount }}</span>
        <span class="stat-badge pending" v-if="pendingCount > 0">等待 {{ pendingCount }}</span>
        <span class="stat-badge done" v-if="doneCount > 0">完成 {{ doneCount }}</span>
        <span class="stat-badge error" v-if="errorCount > 0">失败 {{ errorCount }}</span>
        <span v-if="queue.length === 0" class="text-sm text-gray-400">暂无传输任务</span>
        <span v-if="queue.length > 0" class="total-progress-text">
          总计 {{ formatSize(totalTransferred) }} / {{ formatSize(totalSize) }}
        </span>
      </div>
      <div class="transfer-panel-actions" @click.stop>
        <span class="text-xs text-gray-500">块大小</span>
        <el-select v-model="chunkSizeMB" size="small" class="w-[75px]" @change="onChunkSizeChange">
          <el-option :value="5" label="5 MB" />
          <el-option :value="10" label="10 MB" />
          <el-option :value="20" label="20 MB" />
          <el-option :value="50" label="50 MB" />
          <el-option :value="100" label="100 MB" />
        </el-select>
        <span class="text-xs text-gray-500 ml-2">并发</span>
        <el-input-number v-model="concurrency" :min="1" :max="5" size="small" controls-position="right" class="w-[72px]" />
        <el-button size="small" text @click="pauseAll" :disabled="runningCount === 0">全部暂停</el-button>
        <el-button size="small" text @click="cancelAll" :disabled="!hasActive">全部取消</el-button>
        <el-button size="small" text @click="clearCompleted" :disabled="doneCount === 0">清除已完成</el-button>
      </div>
      <el-icon class="collapse-arrow"><ArrowDown v-if="collapsed" /><ArrowUp v-else /></el-icon>
    </div>

    <!-- 总进度条 -->
    <div v-show="!collapsed && queue.length > 0" class="total-progress-bar">
      <el-progress :percentage="totalProgress" :stroke-width="6" :show-text="false" />
      <span class="total-progress-pct">{{ totalProgress }}%</span>
    </div>

    <div v-show="!collapsed" class="transfer-panel-body">
      <div v-if="queue.length === 0" class="empty-hint">选择文件后点击复制或剪切开始传输</div>
      <div v-else class="task-list">
        <div v-for="task in queue" :key="task.id" class="task-item" :class="'status-' + task.status">
          <div class="task-info">
            <el-icon size="16" class="task-type-icon">
              <CopyDocument v-if="task.type === 'copy'" />
              <Scissor v-else />
            </el-icon>
            <span class="task-filename" :title="task.source">{{ task.fileName }}</span>
            <span class="task-size">{{ formatSize(task.fileSize) }}</span>
          </div>
          <div class="task-progress-row">
            <el-progress
              :percentage="task.progress"
              :status="progressStatus(task)"
              :stroke-width="14"
              class="task-progress-bar"
            />
            <span class="task-speed" v-if="task.status === 'running' && task.speed > 0">{{ formatSize(task.speed) }}/s</span>
          </div>
          <div class="task-actions">
            <el-tag size="small" :type="statusTagType(task.status)">{{ statusLabel(task.status) }}</el-tag>
            <span class="task-error" v-if="task.error" :title="task.error">{{ task.error }}</span>
            <div class="task-btns">
              <el-button v-if="task.status === 'running'" size="small" text @click="pauseTask(task.id)">暂停</el-button>
              <el-button v-if="task.status === 'paused'" size="small" text type="primary" @click="resumeTask(task.id)">恢复</el-button>
              <el-button v-if="task.status === 'error'" size="small" text type="warning" @click="retryTask(task.id)">重试</el-button>
              <el-button v-if="task.status !== 'done' && task.status !== 'cancelled'" size="small" text type="danger" @click="cancelTask(task.id)">取消</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { ArrowDown, ArrowUp, CopyDocument, Scissor } from "@element-plus/icons-vue";
import { useTransferQueue } from "../composables/useTransferQueue.js";

const {
    queue, concurrency, chunkSize,
    totalSize, totalTransferred, totalProgress,
    runningCount, pendingCount, doneCount, errorCount, hasActive,
    pauseTask, resumeTask, retryTask, cancelTask,
    clearCompleted, pauseAll, cancelAll,
} = useTransferQueue();

const collapsed = ref(true);
const panelHeight = ref(260);
const chunkSizeMB = ref(chunkSize.value / (1024 * 1024));

function onChunkSizeChange(val) {
    chunkSize.value = val * 1024 * 1024;
}

function startResize(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panelHeight.value;

    function onMouseMove(ev) {
        const delta = startY - ev.clientY;
        panelHeight.value = Math.max(120, Math.min(600, startHeight + delta));
    }
    function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function progressStatus(task) {
    if (task.status === "done") return "success";
    if (task.status === "error") return "exception";
    return "";
}

function statusTagType(status) {
    const map = { pending: "info", running: "", paused: "warning", done: "success", error: "danger", cancelled: "info" };
    return map[status] || "info";
}

function statusLabel(status) {
    const map = { pending: "等待", running: "传输中", paused: "已暂停", done: "完成", error: "失败", cancelled: "已取消" };
    return map[status] || status;
}

defineExpose({ collapsed });
</script>

<style scoped>
.transfer-panel {
    border-top: 1px solid #e8e8e8;
    background: #fafbfc;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    transition: height 0.15s ease;
}
.transfer-panel.is-collapsed {
    height: 40px !important;
}
.resize-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    cursor: ns-resize;
    z-index: 10;
}
.resize-handle:hover {
    background: rgba(64, 158, 255, 0.15);
}
.transfer-panel-header {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    cursor: pointer;
    gap: 12px;
    border-bottom: 1px solid #f0f0f0;
    user-select: none;
    flex-shrink: 0;
}
.transfer-stats {
    display: flex;
    gap: 8px;
    align-items: center;
    flex: 1;
}
.total-progress-text {
    font-size: 12px;
    color: #666;
    margin-left: 8px;
}
.stat-badge {
    font-size: 12px;
    padding: 1px 8px;
    border-radius: 10px;
}
.stat-badge.running { background: #e6f7ff; color: #1890ff; }
.stat-badge.pending { background: #f6f6f6; color: #666; }
.stat-badge.done { background: #f6ffed; color: #52c41a; }
.stat-badge.error { background: #fff2f0; color: #ff4d4f; }
.transfer-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}
.collapse-arrow {
    transition: transform 0.2s;
}
.total-progress-bar {
    display: flex;
    align-items: center;
    padding: 4px 16px;
    gap: 8px;
    flex-shrink: 0;
    border-bottom: 1px solid #f0f0f0;
}
.total-progress-bar .el-progress {
    flex: 1;
}
.total-progress-pct {
    font-size: 12px;
    color: #409eff;
    font-weight: 500;
    min-width: 36px;
    text-align: right;
}
.transfer-panel-body {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding: 8px 16px;
}
.empty-hint {
    text-align: center;
    color: #999;
    font-size: 13px;
    padding: 24px 0;
}
.task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.task-item {
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    padding: 8px 12px;
}
.task-item.status-error {
    border-color: #ffccc7;
}
.task-item.status-done {
    opacity: 0.7;
}
.task-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}
.task-type-icon {
    color: #666;
}
.task-filename {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.task-size {
    font-size: 12px;
    color: #999;
    flex-shrink: 0;
}
.task-progress-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}
.task-progress-bar {
    flex: 1;
}
.task-speed {
    font-size: 11px;
    color: #1890ff;
    flex-shrink: 0;
    min-width: 70px;
    text-align: right;
}
.task-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.task-error {
    font-size: 11px;
    color: #ff4d4f;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.task-btns {
    margin-left: auto;
    display: flex;
    gap: 2px;
}
</style>
