<template>
  <el-dialog v-model="visible" title="压缩文件" width="450px" @close="onClose">
    <el-form label-width="100px">
      <el-form-item label="选中文件">
        <div class="file-list-preview">
          <span v-for="(f, i) in files" :key="i" class="file-tag">{{ f.name }}</span>
        </div>
      </el-form-item>
      <el-form-item label="压缩格式">
        <el-radio-group v-model="format">
          <el-radio value="zip">ZIP</el-radio>
          <el-radio value="tar.gz">tar.gz</el-radio>
          <el-radio value="7z">7z</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="输出文件名">
        <el-input v-model="outputName" placeholder="archive">
          <template #append>.{{ format }}</template>
        </el-input>
      </el-form-item>
      <el-form-item label="输出目录">
        <el-input :model-value="targetDir" disabled />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="onClose">取消</el-button>
      <el-button type="primary" :loading="compressing" @click="doCompress">压缩</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { compressFiles } from "../utils/api/files.ts";

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    files: { type: Array, default: () => [] },
    targetDir: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue", "done"]);

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit("update:modelValue", val),
});

const format = ref("zip");
const outputName = ref("archive");
const compressing = ref(false);

watch(() => props.files, (val) => {
    if (val.length === 1) {
        outputName.value = val[0].name.replace(/\.[^.]+$/, "");
    } else {
        outputName.value = "archive";
    }
}, { immediate: true });

function onClose() {
    emit("update:modelValue", false);
}

async function doCompress() {
    if (!outputName.value.trim()) {
        ElMessage.warning("请输入输出文件名");
        return;
    }
    compressing.value = true;
    try {
        const filePaths = props.files.map((f) => f.path);
        const ext = format.value === "tar.gz" ? ".tar.gz" : `.${format.value}`;
        const targetPath = props.targetDir + outputName.value + ext;
        const res = await compressFiles(filePaths, targetPath, format.value);
        if (res) {
            ElMessage.success("压缩完成");
            emit("done");
            onClose();
        } else {
            ElMessage.error("压缩失败");
        }
    } catch (err) {
        ElMessage.error("压缩失败: " + (err.message || err));
    } finally {
        compressing.value = false;
    }
}
</script>

<style scoped>
.file-list-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 80px;
    overflow-y: auto;
}
.file-tag {
    background: #f4f4f5;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: #606266;
}
</style>
