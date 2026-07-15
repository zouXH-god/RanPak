<template>
  <div class="files-page">
    <h2 class="page-title">文件管理</h2>

    <div class="dual-pane-container">
      <!-- 左面板 -->
      <FilePanel
        ref="leftPanelRef"
        panel-id="left"
        :is-active="activePanel === 'left'"
        @activate="activePanel = 'left'"
        @selection-change="leftSelected = $event"
        @path-change="leftPath = $event"
      />

      <!-- 中间操作栏 -->
      <div class="action-bar">
        <el-tooltip content="复制到右侧" placement="top">
          <el-button :icon="Right" :disabled="!canOperate('left')" @click="doCopy('left')">复制 &gt;&gt;</el-button>
        </el-tooltip>
        <el-tooltip content="复制到左侧" placement="top">
          <el-button :icon="Back" :disabled="!canOperate('right')" @click="doCopy('right')">&lt;&lt; 复制</el-button>
        </el-tooltip>
        <el-tooltip content="剪切到右侧" placement="top">
          <el-button :icon="Right" :disabled="!canOperate('left')" @click="doMove('left')">剪切 &gt;&gt;</el-button>
        </el-tooltip>
        <el-tooltip content="剪切到左侧" placement="top">
          <el-button :icon="Back" :disabled="!canOperate('right')" @click="doMove('right')">&lt;&lt; 剪切</el-button>
        </el-tooltip>
        <el-divider />
        <el-tooltip content="压缩选中文件" placement="top">
          <el-button :disabled="!hasSelection" @click="openCompress">压缩</el-button>
        </el-tooltip>
        <el-tooltip content="解压到另一面板" placement="top">
          <el-button :disabled="!canExtract" @click="doExtract">解压</el-button>
        </el-tooltip>
        <el-divider />
        <el-tooltip content="删除选中文件" placement="top">
          <el-button type="danger" :disabled="!hasSelection" @click="doDelete">删除</el-button>
        </el-tooltip>
        <el-tooltip content="批量重命名" placement="top">
          <el-button :disabled="!hasSelection" @click="openBatchRename">重命名</el-button>
        </el-tooltip>
      </div>

      <!-- 右面板 -->
      <FilePanel
        ref="rightPanelRef"
        panel-id="right"
        :is-active="activePanel === 'right'"
        @activate="activePanel = 'right'"
        @selection-change="rightSelected = $event"
        @path-change="rightPath = $event"
      />
    </div>

    <!-- 传输面板 -->
    <TransferPanel ref="transferPanelRef" />

    <!-- 压缩对话框 -->
    <CompressDialog
      v-model="compressVisible"
      :files="activeSelected"
      :target-dir="targetPath"
      @done="refreshBoth"
    />

    <!-- 批量重命名对话框 -->
    <FilesRenameBox
      v-if="batchRenameVisible"
      :visible="batchRenameVisible"
      :files="activeFiles"
      :currentPath="activePath"
      :close="closeBatchRename"
    />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { Right, Back } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import FilePanel from "../components/FilePanel.vue";
import TransferPanel from "../components/TransferPanel.vue";
import CompressDialog from "../components/CompressDialog.vue";
import FilesRenameBox from "../components/FilesRenameBox.vue";
import { useTransferQueue } from "../composables/useTransferQueue.js";
import { deleteFile, extractArchive } from "../utils/api/files.ts";

const { addTasks } = useTransferQueue();

const leftPanelRef = ref(null);
const rightPanelRef = ref(null);
const transferPanelRef = ref(null);

const activePanel = ref("left");
const leftSelected = ref([]);
const rightSelected = ref([]);
const leftPath = ref("\\");
const rightPath = ref("\\");

const activeSelected = computed(() => activePanel.value === "left" ? leftSelected.value : rightSelected.value);
const activePath = computed(() => activePanel.value === "left" ? leftPath.value : rightPath.value);
const targetPath = computed(() => activePanel.value === "left" ? rightPath.value : leftPath.value);
const activeFiles = computed(() => {
    const panel = activePanel.value === "left" ? leftPanelRef.value : rightPanelRef.value;
    return panel ? [...(leftSelected.value.length > 0 && activePanel.value === "left" ? leftSelected.value : rightSelected.value)] : [];
});

const hasSelection = computed(() => activeSelected.value.length > 0);

function canOperate(fromPanel) {
    const selected = fromPanel === "left" ? leftSelected.value : rightSelected.value;
    return selected.length > 0;
}

const canExtract = computed(() => {
    const sel = activeSelected.value;
    if (sel.length !== 1) return false;
    const name = sel[0].name.toLowerCase();
    return name.endsWith(".zip") || name.endsWith(".tar.gz") || name.endsWith(".tgz")
        || name.endsWith(".7z") || name.endsWith(".rar");
});

function doCopy(fromPanel) {
    const selected = fromPanel === "left" ? leftSelected.value : rightSelected.value;
    const target = fromPanel === "left" ? rightPath.value : leftPath.value;
    if (selected.length === 0) return;
    addTasks(selected, target, "copy");
    if (transferPanelRef.value) transferPanelRef.value.collapsed = false;
    ElMessage.success(`已将 ${selected.length} 个文件加入复制队列`);
}

function doMove(fromPanel) {
    const selected = fromPanel === "left" ? leftSelected.value : rightSelected.value;
    const target = fromPanel === "left" ? rightPath.value : leftPath.value;
    if (selected.length === 0) return;
    addTasks(selected, target, "move");
    if (transferPanelRef.value) transferPanelRef.value.collapsed = false;
    ElMessage.success(`已将 ${selected.length} 个文件加入剪切队列`);
}

// 压缩
const compressVisible = ref(false);
function openCompress() {
    if (!hasSelection.value) return;
    compressVisible.value = true;
}

// 解压
async function doExtract() {
    const sel = activeSelected.value;
    if (sel.length !== 1) return;
    const archivePath = sel[0].path;
    const targetDir = targetPath.value;
    try {
        const res = await extractArchive(archivePath, targetDir);
        if (res) {
            ElMessage.success("解压完成");
            refreshBoth();
        } else {
            ElMessage.error("解压失败");
        }
    } catch (err) {
        ElMessage.error("解压失败: " + (err.message || err));
    }
}

// 删除
async function doDelete() {
    const sel = activeSelected.value;
    if (sel.length === 0) return;
    const confirmed = await ElMessageBox.confirm(
        `确定删除 ${sel.length} 个项目？此操作不可撤销。`, "警告", { type: "warning" }
    ).catch(() => false);
    if (!confirmed) return;
    const results = await Promise.allSettled(sel.map((f) => deleteFile(f.path)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) ElMessage.warning(`${sel.length - failed} 个删除成功，${failed} 个失败`);
    else ElMessage.success("删除完成");
    refreshActive();
}

// 批量重命名
const batchRenameVisible = ref(false);
function openBatchRename() {
    batchRenameVisible.value = true;
}
function closeBatchRename(send) {
    batchRenameVisible.value = false;
    if (send) {
        ElMessage.success("批量重命名请求已发送");
        refreshActive();
    }
}

function refreshActive() {
    const panel = activePanel.value === "left" ? leftPanelRef.value : rightPanelRef.value;
    if (panel) panel.refresh();
}

function refreshBoth() {
    if (leftPanelRef.value) leftPanelRef.value.refresh();
    if (rightPanelRef.value) rightPanelRef.value.refresh();
}
</script>

<style scoped>
.files-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    overflow: hidden;
}
.page-title {
    font-size: 20px;
    font-weight: 600;
    color: #1f2329;
    margin-bottom: 12px;
    flex-shrink: 0;
}
.dual-pane-container {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 0;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    overflow: hidden;
    background: #f5f5f5;
}
.dual-pane-container > :deep(.file-panel) {
    flex: 1;
    min-width: 0;
}
.action-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 8px;
    background: #f9f9fb;
    border-left: 1px solid #e8e8e8;
    border-right: 1px solid #e8e8e8;
    flex-shrink: 0;
    width: 110px;
}
.action-bar .el-button {
    width: 94px;
    font-size: 12px;
}
.action-bar .el-divider {
    margin: 4px 0;
    width: 80%;
}
</style>
