<template>
  <div class="h-full min-h-0 overflow-auto bg-[#f8fafc] px-4 pb-4">
    <div class="mx-auto flex max-w-[600px] flex-col gap-4">
      <header class="page-header">
        <div>
          <h1 class="text-xl font-bold text-gray-900">FinalShell Active</h1>
          <p class="mt-1 text-sm text-gray-500">FinalShell 离线激活码生成（≤4.6.5，支持高级版 & 专业版）</p>
        </div>
      </header>

      <section class="card">
        <div class="card-title">机器码</div>
        <el-input v-model="machineCode" placeholder="请输入 FinalShell 机器码" clearable size="large" />
      </section>

      <section class="card">
        <div class="card-title">FinalShell 版本</div>
        <div class="option-group">
          <button
            v-for="v in versions"
            :key="v.value"
            class="option-btn"
            :class="{ 'is-active': version === v.value }"
            @click="version = v.value"
          >{{ v.label }}</button>
        </div>

        <div class="card-title">激活版本类型</div>
        <div class="option-group">
          <button
            v-for="t in types"
            :key="t.value"
            class="option-btn"
            :class="{ 'is-active': activationType === t.value }"
            @click="activationType = t.value"
          >{{ t.label }}</button>
        </div>
      </section>

      <section class="card">
        <el-button type="primary" size="large" class="w-full" @click="generate">生成激活码</el-button>

        <div class="result-box" :class="{ copied }" @click="copyResult">
          <span class="result-text">{{ result || '请输入机器码并点击生成' }}</span>
          <span class="result-hint">{{ copied ? '已复制 ✔' : '点击复制' }}</span>
        </div>
      </section>

      <footer class="page-footer">
        <p>本程序仅供学习研究使用，严禁用于商业用途或非法目的。</p>
        <p>使用产生的任何风险由使用者自行承担，作者不承担任何法律责任！</p>
        <p class="mt-2">
          <a href="#" @click.prevent="openGithub">FinalShell-Active</a> 基于 MIT 许可协议开源
        </p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import CryptoJS from 'crypto-js'

const machineCode = ref('')
const version = ref('v46')
const activationType = ref('pro')
const result = ref('')
const copied = ref(false)

const versions = [
  { label: '＜ 3.9.6', value: 'old' },
  { label: '≥ 3.9.6', value: 'new' },
  { label: '4.5 版本', value: 'v45' },
  { label: '4.6 版本', value: 'v46' },
]

const types = [
  { label: '专业版', value: 'pro' },
  { label: '高级版', value: 'adv' },
]

function md5(str) {
  return CryptoJS.MD5(str).toString()
}

function keccak384(str) {
  return CryptoJS.SHA3(str, { outputLength: 384 }).toString()
}

function generate() {
  const code = machineCode.value.trim()
  if (!code) {
    ElMessage.warning('请先输入有效的机器码')
    return
  }
  const v = version.value
  const t = activationType.value

  if (v === 'old') {
    result.value = t === 'adv'
      ? md5('61305' + code + '8552').slice(8, 24)
      : md5('2356' + code + '13593').slice(8, 24)
  } else if (v === 'new') {
    result.value = t === 'adv'
      ? keccak384(code + 'hSf(78cvVlS5E').slice(12, 28)
      : keccak384(code + 'FF3Go(*Xvbb5s2').slice(12, 28)
  } else if (v === 'v45') {
    result.value = t === 'adv'
      ? keccak384(code + 'wcegS3gzA$').slice(12, 28)
      : keccak384(code + 'b(xxkHn%z);x').slice(12, 28)
  } else {
    result.value = t === 'adv'
      ? keccak384(code + 'csSf5*xlkgYSX,y').slice(12, 28)
      : keccak384(code + 'Scfg*ZkvJZc,s,Y').slice(12, 28)
  }
}

function copyResult() {
  if (!result.value) {
    ElMessage.warning('暂无有效激活码可复制')
    return
  }
  navigator.clipboard.writeText(result.value).then(() => {
    copied.value = true
    ElMessage.success('已复制到剪贴板')
    setTimeout(() => { copied.value = false }, 1500)
  }).catch(() => {
    ElMessage.error('复制失败，请手动复制')
  })
}

function openGithub() {
  window.electronAPI?.openExternal?.('https://github.com/LuoyeAutumn/FinalShell-Active')
}
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.82);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92));
  padding: 16px 20px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}

.card {
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  background: #ffffff;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.option-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.option-btn {
  flex: 1;
  min-width: 80px;
  padding: 10px 12px;
  font-size: 13px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 10px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-btn:hover {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(239, 246, 255, 0.6);
  transform: translateY(-1px);
}

.option-btn.is-active {
  border-color: rgba(37, 99, 235, 0.5);
  background: rgba(239, 246, 255, 0.9);
  color: #1d4ed8;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
}

.result-box {
  margin-top: 4px;
  border: 1px dashed rgba(148, 163, 184, 0.5);
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 52px;
}

.result-box:hover {
  border-color: rgba(37, 99, 235, 0.4);
  background: linear-gradient(135deg, #eff6ff, #e0f2fe);
}

.result-box.copied {
  border-color: rgba(34, 197, 94, 0.5);
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
}

.result-text {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  color: #0f172a;
  word-break: break-all;
}

.result-hint {
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
}

.result-box.copied .result-hint {
  color: #16a34a;
}

.page-footer {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.8;
  padding: 8px 0;
}

.page-footer a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
}

.page-footer a:hover {
  text-decoration: underline;
}
</style>
