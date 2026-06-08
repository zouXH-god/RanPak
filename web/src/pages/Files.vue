<template>
  <div class="p-10">
    <!-- 标题 -->
    <h2 class="text-2xl font-semibold text-brand-ink mb-6">文件管理</h2>

    <!-- 路径导航栏 -->
    <div class="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden flex items-center pl-3 pt-2 pb-2 mb-6">
      <el-button :icon="ArrowLeft" circle size="small" @click="goBack" :disabled="pathSegments.length <= 0" />
      <span class="pl-3 pr-3">/</span>
      <template v-for="(p, index) in pathSegments" :key="index">
        <el-text
            class="mx-1 cursor-pointer text-brand-ink hover:underline"
            @click="navigateTo(index)"
        >{{ p }}</el-text>
        <span class="pl-3 pr-3">/</span>
      </template>
    </div>

    <!-- 工具栏 -->
    <div class="mb-4 flex items-center justify-between">
      <div>
        <el-button type="primary" @click="openBatchRenameDialog" :disabled="selectedFiles.length === 0">
          批量重命名（{{ selectedFiles.length }}）
        </el-button>
        <el-button type="danger" :disabled="selectedFiles.length === 0" @click="deleteSelected">
          删除选中
        </el-button>
      </div>
    </div>

    <!-- 文件列表 -->
    <el-table :data="files" style="width: 100%" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" />
      <el-table-column label="名称" min-width="280">
        <template #default="{ row }">
          <div class="flex items-center space-x-2">
            <el-icon v-if="row.is_dir" size="20"><Folder /></el-icon>
            <el-icon v-else size="20"><Document /></el-icon>
            <span
                class="cursor-pointer hover:text-blue-600"
                @click="row.is_dir ? enterDirectory(row.name) : null"
            >{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="size" label="大小" width="120">
        <template #default="{ row }">
          {{ row.is_dir ? '-' : formatSize(row.size) }}
        </template>
      </el-table-column>
      <el-table-column prop="modified_at" label="修改时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.modified_at) }}
        </template>
      </el-table-column>
    </el-table>

    <!-- 批量重命名对话框 -->
    <FilesRenameBox v-if="batchRenameVisible" :visible="batchRenameVisible" :files="files" :currentPath="currentPath" :close="closeBatchRenameDialog"/>
  </div>
</template>

<script setup>
/**
 * 文件管理页面
 * 支持文件浏览、删除和批量重命名
 */
import {ref, computed, onMounted} from "vue";
import {ArrowLeft, Folder, Document} from "@element-plus/icons-vue";
import {ElMessage, ElMessageBox} from "element-plus";
import {deleteFile, getFileList} from "../utils/api/files.ts";
import FilesRenameBox from "../components/FilesRenameBox.vue";

const pathSegments = ref([]);
const files = ref([]);

onMounted(() => {
  _getFiles("\\");
});

/** 当前完整路径 */
const currentPath = computed(() => pathSegments.value.join("\\") + "\\");

const selectedFiles = ref([]);

const handleSelectionChange = (val) => {
  selectedFiles.value = val;
};

/** 批量删除选中文件 */
const deleteSelected = async () => {
  if (
      await ElMessageBox.confirm(`确定删除 ${selectedFiles.value.length} 个项目？`, "警告", {
        type: "warning",
      }).catch(() => false)
  ) {
    const promises = selectedFiles.value.map((f) => _deleteFile(f.path));
    await Promise.allSettled(promises);
    ElMessage.success("删除完成");
    await _getFiles(currentPath.value);
    selectedFiles.value = [];
  }
};

/** 路径回退 */
const goBack = async () => {
  if (pathSegments.value.length > 0) {
    const pop_path = pathSegments.value.pop();
    const result = await _getFiles(currentPath.value);
    if (!result) {
      pathSegments.value.push(pop_path);
    }
  }
};

/** 导航到指定层级 */
const navigateTo = async (index) => {
  const oldPath = [...pathSegments.value];
  pathSegments.value = pathSegments.value.slice(0, index + 1);
  const result = await _getFiles(currentPath.value);
  if (!result) {
    pathSegments.value = oldPath;
  }
};

/** 进入子目录 */
const enterDirectory = async (name) => {
  pathSegments.value.push(name);
  const result = await _getFiles(currentPath.value);
  if (!result) {
    pathSegments.value.pop();
  }
};

// 批量重命名
const batchRenameVisible = ref(false);
const openBatchRenameDialog = () => {
  batchRenameVisible.value = true;
};
const closeBatchRenameDialog = (send) => {
  batchRenameVisible.value = false;
  if (send) {
    ElMessage.success("批量重命名请求已发送");
    _getFiles(currentPath.value);
  }
};

/** 格式化文件大小 */
const formatSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/** 格式化时间戳 */
const formatTime = (timestamp) => {
  return new Date(timestamp * 1000).toLocaleString();
};

/** 获取文件列表 */
const _getFiles = async (dirPath) => {
  try {
    const res = await getFileList(dirPath)
    if (!res) return false
    files.value = res.data
    return true
  } catch (err) {
    ElMessage.error(err.message)
    return false
  }
};

/** 删除文件 */
const _deleteFile = async (filePath) => {
  return deleteFile(filePath)
};
</script>

<style scoped>
.text-brand-ink {
  color: #1f2329;
}
.shadow-soft {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
</style>
