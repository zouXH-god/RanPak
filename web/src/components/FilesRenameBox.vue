<script setup>
/**
 * 批量重命名组件
 * 通过正则表达式匹配和替换模板实现文件批量重命名
 */
import {computed, ref} from "vue";
import {ElMessage} from "element-plus";
import {renameFile} from "../utils/api/files.ts";

const props = defineProps({
  files: { type: Array, default: () => [] },
  visible: { type: Boolean, default: false },
  currentPath: { type: String, default: "" },
  close: { type: Function },
})

const emit = defineEmits(['update:visible'])
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => { if (!val) props.close(false) }
})

const currentPath = ref(props.currentPath);
const files = ref(props.files);

const renameRegex = ref("");
const renameTemplate = ref("");
const onlyFile = ref(true);
const previewLoading = ref(false);
const renamePreview = ref([]);

/** 根据正则生成重命名预览 */
const generatePreview = () => {
  if (!renameRegex.value || !renameTemplate.value) {
    ElMessage.warning("请填写正则和模板");
    return;
  }

  previewLoading.value = true;
  setTimeout(() => {
    try {
      const regex = new RegExp(renameRegex.value);
      renamePreview.value = [];

      const targetFiles = onlyFile.value
          ? files.value.filter((f) => !f.is_dir)
          : files.value;

      let seq = 1;
      targetFiles.forEach((file) => {
        const match = file.name.match(regex);
        if (match) {
          let newName = renameTemplate.value;
          for (let i = 1; i < match.length; i++) {
            newName = newName.replace(new RegExp(`\\\\${i}`, "g"), match[i]);
          }
          newName = newName.replace(/\$i/g, seq++);
          renamePreview.value.push({ old: file.name, new: newName });
        }
      });
    } catch (e) {
      ElMessage.error("正则表达式语法错误: " + e.message);
    }
    previewLoading.value = false;
  }, 300);
};

const canConfirmRename = computed(() => renamePreview.value.length > 0);

/** 确认执行批量重命名 */
const confirmBatchRename = async () => {
  try {
    await renameFile(
        props.currentPath,
        renameRegex.value,
        renameTemplate.value,
        onlyFile.value
    );
    props.close(true);
  } catch (e) {
    ElMessage.error("重命名失败: " + e.message);
  }
};
</script>

<template>
  <el-dialog v-model="dialogVisible" title="批量重命名" width="600px">
    <el-form label-width="120px">
      <el-form-item label="目标文件夹">
        <el-input v-model="currentPath" disabled />
      </el-form-item>

      <el-form-item label="匹配正则表达式" required>
        <el-input
            v-model="renameRegex"
            placeholder="例如：^(.*)\(1\)$   （匹配带 (1) 的文件）"
        />
        <div class="text-xs text-gray-500 mt-1">
          使用 () 包裹需要捕获的内容，如：^(.+)\(1\)\.zip$
        </div>
      </el-form-item>

      <el-form-item label="新文件名模板" required>
        <el-input
            v-model="renameTemplate"
            placeholder="例如：\1.zip   或   新文件_$i   ($i 会自动递增序号)"
        />
        <div class="text-xs text-gray-500 mt-1">
          \1、\2... 代表捕获组；$i 代表递增序号（从 1 开始）
        </div>
      </el-form-item>

      <el-form-item label="仅重命名文件">
        <el-switch v-model="onlyFile" />
      </el-form-item>

      <!-- 预览表格 -->
      <el-form-item label="重命名预览">
        <el-table :data="renamePreview" height="250" v-loading="previewLoading">
          <el-table-column prop="old" label="原文件名" width="220" />
          <el-table-column prop="new" label="新文件名" width="220">
            <template #default="{ row }">
              <span>{{ row.new }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="props.close(false)">取消</el-button>
      <el-button type="primary" @click="generatePreview" :loading="previewLoading">
        预览
      </el-button>
      <el-button type="danger" @click="confirmBatchRename" :disabled="!canConfirmRename">
        确定重命名
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
</style>
