<template>
  <div class="h-full min-h-0 overflow-auto bg-[#f8fafc] px-4 pb-4">
    <div class="mx-auto flex max-w-[1300px] flex-col gap-4">
      <header class="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-soft">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-semibold text-gray-900">SSL 证书查询</h1>
            <p class="mt-1 text-sm text-gray-500">查询站点 TLS 证书、有效期、签发者、SAN、协议和 Cipher。</p>
          </div>
          <el-button :icon="Search" type="primary" :loading="loading" @click="queryCertificate">查询</el-button>
        </div>
      </header>

      <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
          <el-input v-model="host" placeholder="openai.com 或 https://openai.com" @keyup.enter="queryCertificate" />
          <el-input-number v-model="port" class="w-full" :min="1" :max="65535" controls-position="right" />
          <el-input-number v-model="timeoutMs" class="w-full" :min="1000" :max="60000" :step="1000" controls-position="right" />
        </div>
      </section>

      <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon />

      <section v-if="result" class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">证书信息</h2>
          <div class="flex flex-wrap items-center gap-2">
            <el-tag :type="result.authorized ? 'success' : 'warning'">{{ result.authorized ? '可信' : '未验证' }}</el-tag>
            <el-tag :type="result.certificate.daysRemaining > 14 ? 'success' : 'danger'">剩余 {{ result.certificate.daysRemaining }} 天</el-tag>
            <el-button :icon="CopyDocument" @click="copyText(JSON.stringify(result, null, 2), '证书信息已复制')">复制 JSON</el-button>
          </div>
        </div>
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="info-card"><span>域名</span><strong>{{ result.host }}:{{ result.port }}</strong></div>
          <div class="info-card"><span>协议 / Cipher</span><strong>{{ result.protocol }} / {{ result.cipher }}</strong></div>
          <div class="info-card"><span>有效期开始</span><strong>{{ result.certificate.validFrom }}</strong></div>
          <div class="info-card"><span>有效期结束</span><strong>{{ result.certificate.validTo }}</strong></div>
          <div class="info-card"><span>Serial Number</span><strong>{{ result.certificate.serialNumber }}</strong></div>
          <div class="info-card"><span>Fingerprint SHA256</span><strong>{{ result.certificate.fingerprint256 }}</strong></div>
        </div>
        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <el-table :data="result.certificate.subject" border>
            <el-table-column prop="key" label="Subject" width="140" />
            <el-table-column prop="value" label="Value" />
          </el-table>
          <el-table :data="result.certificate.issuer" border>
            <el-table-column prop="key" label="Issuer" width="140" />
            <el-table-column prop="value" label="Value" />
          </el-table>
        </div>
        <div class="mt-4 rounded-xl border border-gray-100 bg-[#f8fafc] p-4">
          <div class="mb-2 text-xs font-semibold text-gray-500">Subject Alternative Name</div>
          <p class="break-words text-sm leading-6 text-gray-700">{{ result.certificate.subjectaltname || '-' }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Search } from '@element-plus/icons-vue'
import { copyText } from '../utils/devTools'

const host = ref('openai.com')
const port = ref(443)
const timeoutMs = ref(10000)
const loading = ref(false)
const errorMessage = ref('')
const result = ref(null)

async function queryCertificate() {
  if (!host.value.trim()) {
    ElMessage.error('请输入域名')
    return
  }
  loading.value = true
  errorMessage.value = ''
  result.value = null
  try {
    const response = await window.electronAPI?.devTools?.querySslCertificate?.({
      host: host.value,
      port: port.value,
      timeoutMs: timeoutMs.value,
    })
    if (!response?.ok) {
      errorMessage.value = response?.error || 'SSL 查询失败'
      return
    }
    result.value = response.data
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.shadow-soft { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.info-card { min-width: 0; border: 1px solid #edf2f7; border-radius: 14px; background: #f8fafc; padding: 14px; }
.info-card span { display: block; color: #64748b; font-size: 12px; }
.info-card strong { margin-top: 6px; display: block; overflow-wrap: anywhere; color: #111827; font-size: 14px; }
</style>
