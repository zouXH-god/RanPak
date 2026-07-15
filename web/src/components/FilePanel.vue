<template>
  <div class="file-panel" :class="{ 'is-active': isActive }" @click="$emit('activate')">
    <div class="file-panel-nav">
      <el-button :icon="ArrowLeft" circle size="small" @click="goBack" :disabled="pathSegments.length <= 0" />
      <span class="path-sep">/</span>
      <template v-for="(p, index) in pathSegments" :key="index">
        <el-text class="path-crumb" @click="navigateTo(index)">{{ p }}</el-text>
        <span class="path-sep">/</span>
      </template>
    </div>

    <div class="file-panel-toolbar">
      <div class="sort-controls">
        <el-select v-model="sortField" size="small" class="w-[90px]">
          <el-option label="名称" value="name" />
          <el-option label="大小" value="size" />
          <el-option label="时间" value="modified_at" />
        </el-select>
        <el-button size="small" text @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
          {{ sortOrder === 'asc' ? '↑' : '↓' }}
        </el-button>
      </div>
      <el-button :icon="Refresh" size="small" text @click="refresh" :loading="loading" />
    </div>

    <el-table
      :data="sortedFiles"
      height="100%"
      class="file-panel-table"
      @selection-change="onSelectionChange"
      @row-dblclick="onRowDblClick"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column label="名称" min-width="200">
        <template #default="{ row }">
          <div class="file-name-cell">
            <el-icon size="18"><Folder v-if="row.is_dir" /><Document v-else /></el-icon>
            <span class="file-name-text" @click="row.is_dir ? enterDirectory(row.name) : null">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ row.is_dir ? '-' : formatSize(row.size) }}</template>
      </el-table-column>
      <el-table-column label="修改时间" width="155">
        <template #default="{ row }">{{ formatTime(row.modified_at) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { ArrowLeft, Folder, Document, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { getFileList } from "../utils/api/files.ts";

const props = defineProps({
  panelId: { type: String, required: true },
  initialPath: { type: String, default: "\\" },
  isActive: { type: Boolean, default: false },
});

const emit = defineEmits(["activate", "selection-change", "path-change"]);

const pathSegments = ref([]);
const files = ref([]);
const loading = ref(false);
const sortField = ref("name");
const sortOrder = ref("asc");

const currentPath = computed(() => {
  if (pathSegments.value.length === 0) return "\\";
  return pathSegments.value.join("\\") + "\\";
});

const sortedFiles = computed(() => {
  const list = [...files.value];
  const field = sortField.value;
  const asc = sortOrder.value === "asc";
  list.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    if (field === "name") cmp = a.name.localeCompare(b.name);
    else if (field === "size") cmp = (a.size || 0) - (b.size || 0);
    else if (field === "modified_at") cmp = (a.modified_at || 0) - (b.modified_at || 0);
    return asc ? cmp : -cmp;
  });
  return list;
});

onMounted(() => {
  loadFiles(props.initialPath);
});

watch(currentPath, (val) => {
  emit("path-change", val);
});

async function loadFiles(dirPath) {
  loading.value = true;
  try {
    const res = await getFileList(dirPath);
    if (!res) return false;
    files.value = res.data;
    return true;
  } catch (err) {
    ElMessage.error(err.message || "加载文件列表失败");
    return false;
  } finally {
    loading.value = false;
  }
}

async function goBack() {
  if (pathSegments.value.length > 0) {
    const popped = pathSegments.value.pop();
    const result = await loadFiles(currentPath.value);
    if (!result) pathSegments.value.push(popped);
  }
}

async function navigateTo(index) {
  const oldPath = [...pathSegments.value];
  pathSegments.value = pathSegments.value.slice(0, index + 1);
  const result = await loadFiles(currentPath.value);
  if (!result) pathSegments.value = oldPath;
}

async function enterDirectory(name) {
  pathSegments.value.push(name);
  const result = await loadFiles(currentPath.value);
  if (!result) pathSegments.value.pop();
}

function refresh() {
  loadFiles(currentPath.value);
}

function onSelectionChange(val) {
  emit("selection-change", val);
}

function onRowDblClick(row) {
  if (row.is_dir) enterDirectory(row.name);
}

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString();
}

defineExpose({ currentPath, refresh, pathSegments });
</script>

<style scoped>
.file-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 2px solid transparent;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.2s;
}
.file-panel.is-active {
  border-color: #409eff;
}
.file-panel-nav {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  gap: 2px;
  flex-shrink: 0;
}
.path-sep {
  margin: 0 2px;
  color: #999;
  font-size: 13px;
}
.path-crumb {
  cursor: pointer;
  font-size: 13px;
  color: #1f2329;
}
.path-crumb:hover {
  text-decoration: underline;
  color: #409eff;
}
.file-panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}
.sort-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}
.file-panel-table {
  flex: 1;
  min-height: 0;
}
.file-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.file-name-text {
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-name-text:hover {
  color: #409eff;
}
</style>
