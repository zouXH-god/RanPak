<template>
  <div class="tool-page">
    <div class="mx-auto flex max-w-[1300px] flex-col gap-4">
      <header class="tool-header">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-gray-900">随机字符串生成</h1>
          <p class="mt-1 text-sm text-gray-500">按长度、数量和字符集生成随机字符串。</p>
        </div>
        <el-button :icon="RefreshRight" type="primary" @click="generate">生成</el-button>
      </header>

      <section class="tool-card">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label class="field"><span>长度</span><el-input-number v-model="length" class="w-full" :min="1" :max="4096" /></label>
          <label class="field"><span>数量</span><el-input-number v-model="count" class="w-full" :min="1" :max="1000" /></label>
          <label class="field"><span>字符集</span><el-select v-model="preset"><el-option v-for="item in presets" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
          <label class="field"><span>易混字符</span><el-switch v-model="excludeAmbiguous" active-text="排除" inactive-text="保留" /></label>
        </div>
        <label class="field mt-4">
          <span>自定义字符集</span>
          <el-input v-model="customCharset" :disabled="preset !== 'custom'" placeholder="输入允许出现的字符" />
        </label>
      </section>

      <section class="tool-card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">结果</h2>
          <div class="flex gap-2">
            <el-button :icon="CopyDocument" :disabled="!output" @click="copyText(output)">复制</el-button>
            <el-button :icon="Download" :disabled="!output" @click="downloadText(output, 'random-strings.txt')">下载</el-button>
          </div>
        </div>
        <el-input v-model="output" readonly type="textarea" :autosize="{ minRows: 16, maxRows: 28 }" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Download, RefreshRight } from '@element-plus/icons-vue'
import { copyText, downloadText } from '../utils/devTools'

const presets = [
  { label: '大小写字母 + 数字', value: 'alnum' },
  { label: '小写字母 + 数字', value: 'lowernum' },
  { label: '数字', value: 'number' },
  { label: '十六进制', value: 'hex' },
  { label: '强密码字符', value: 'password' },
  { label: '自定义', value: 'custom' },
]
const charsets = {
  alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  lowernum: 'abcdefghijklmnopqrstuvwxyz0123456789',
  number: '0123456789',
  hex: '0123456789abcdef',
  password: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{};:,.<>?',
}
const ambiguous = new Set('0Ool1I|`')
const length = ref(32)
const count = ref(10)
const preset = ref('alnum')
const customCharset = ref('')
const excludeAmbiguous = ref(true)
const output = ref('')

function generate() {
  let charset = preset.value === 'custom' ? customCharset.value : charsets[preset.value]
  if (excludeAmbiguous.value) charset = Array.from(charset).filter((item) => !ambiguous.has(item)).join('')
  charset = Array.from(new Set(Array.from(charset))).join('')
  if (!charset) {
    ElMessage.error('字符集为空')
    return
  }
  const values = []
  for (let row = 0; row < count.value; row += 1) {
    const bytes = new Uint32Array(length.value)
    crypto.getRandomValues(bytes)
    values.push(Array.from(bytes, (byte) => charset[byte % charset.length]).join(''))
  }
  output.value = values.join('\n')
}
</script>

<style scoped>
.tool-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.tool-header, .tool-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.tool-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 20px 24px; }
.tool-card { padding: 20px; }
.field { display: grid; gap: 8px; color: #64748b; font-size: 13px; }
.field span { color: #111827; font-weight: 700; }
:deep(.el-textarea__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 13px; }
</style>
