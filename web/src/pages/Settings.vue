<template>
  <div class="h-full min-h-0 overflow-auto px-4 pb-6">
    <div class="mx-auto flex max-w-[1100px] flex-col gap-4">
      <header class="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <h1 class="text-xl font-semibold text-gray-900">设置</h1>
        <p class="mt-1 text-sm text-gray-500">配置外置工具与资源目录，应用会在运行时读取这些路径。</p>
      </header>

      <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div class="mb-4">
          <h2 class="text-base font-semibold text-gray-900">启动</h2>
          <p class="mt-1 text-sm text-gray-500">配置应用的启动行为。</p>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-700">开机自启动</span>
          <el-switch v-model="autoLaunch" @change="toggleAutoLaunch" />
        </div>
      </section>

      <section
        id="settings-ffmpeg"
        ref="ffmpegSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('ffmpeg')"
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900">FFmpeg</h2>
            <p class="mt-1 text-sm text-gray-500">留空表示从系统 PATH 自动查找。</p>
          </div>
          <el-tag :type="ffmpegTagType" effect="plain">{{ ffmpegStatusLabel }}</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="ffmpeg 路径">
            <div class="flex w-full gap-2">
              <el-input v-model="form.ffmpeg.ffmpegPath" placeholder="ffmpeg 或 ffmpeg.exe 的完整路径；留空使用 PATH" clearable />
              <el-button :icon="FolderOpened" @click="selectFfmpeg">选择</el-button>
            </div>
          </el-form-item>
          <el-form-item label="ffprobe 路径">
            <div class="flex w-full gap-2">
              <el-input v-model="form.ffmpeg.ffprobePath" placeholder="ffprobe 或 ffprobe.exe 的完整路径；留空使用 PATH" clearable />
              <el-button :icon="FolderOpened" @click="selectFfprobe">选择</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div v-if="ffmpegResult" class="mb-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-gray-600">
          <div>ffmpeg：{{ ffmpegResult.ffmpeg?.bin || '-' }} · {{ ffmpegResult.ffmpeg?.version || ffmpegResult.ffmpeg?.error || '-' }}</div>
          <div>ffprobe：{{ ffmpegResult.ffprobe?.bin || '-' }} · {{ ffmpegResult.ffprobe?.version || ffmpegResult.ffprobe?.error || '-' }}</div>
        </div>

        <div class="flex justify-end gap-2">
          <el-button :loading="testingFfmpeg" @click="testFfmpeg">测试</el-button>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
        </div>
      </section>

      <section
        id="settings-meme"
        ref="memeSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('meme')"
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900">表情包制作 (meme-generator-rs)</h2>
            <p class="mt-1 text-sm text-gray-500">
              配置 meme-generator-rs 可执行文件路径和服务端口。
              <a href="#" class="text-blue-500 hover:underline" @click.prevent="openMemeRelease">前往下载</a>
            </p>
          </div>
          <el-tag :type="memeTagType" effect="plain">{{ memeStatusLabel }}</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="可执行文件路径">
            <div class="flex w-full gap-2">
              <el-input v-model="form.meme.binaryPath" placeholder="meme-generator-rs 或 meme-generator-rs.exe 的完整路径" clearable />
              <el-button :icon="FolderOpened" @click="selectMemeBinary">选择</el-button>
            </div>
          </el-form-item>
          <el-form-item label="服务端口">
            <el-input-number v-model="form.meme.port" :min="1024" :max="65535" :step="1" />
          </el-form-item>
        </el-form>

        <div class="flex justify-end gap-2">
          <el-button :loading="testingMeme" @click="testMeme">测试连接</el-button>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
        </div>
      </section>

      <section
        id="settings-live2d"
        ref="live2dSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('live2d')"
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900">Live2D 外置资源</h2>
            <p class="mt-1 text-sm text-gray-500">资源目录应包含模型文件，catalog 可使用相对路径引用这些资源。</p>
          </div>
          <el-tag :type="live2dTagType" effect="plain">{{ live2dStatusLabel }}</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="资源目录">
            <div class="flex w-full gap-2">
              <el-input v-model="form.live2d.assetsDir" placeholder="Live2D 数据包目录；留空使用 userData/assets/live2d" clearable />
              <el-button :icon="FolderOpened" @click="selectLive2dDir">选择</el-button>
            </div>
          </el-form-item>
          <el-form-item label="Catalog 文件">
            <div class="flex w-full gap-2">
              <el-input v-model="form.live2d.catalogPath" placeholder="model-catalog.json；留空使用资源目录下的 model-catalog.json" clearable />
              <el-button :icon="Document" @click="selectLive2dCatalog">选择</el-button>
            </div>
          </el-form-item>
        </el-form>

        <div v-if="live2dError" class="mb-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{{ live2dError }}</div>
        <div v-else class="mb-4 rounded-md bg-slate-50 p-3 text-sm text-gray-600">当前可用模型：{{ live2dModelCount }} 个</div>

        <div class="flex justify-end gap-2">
          <el-button :loading="checkingLive2d" @click="checkLive2d">检查 Catalog</el-button>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
        </div>
      </section>

      <section
        id="settings-ai"
        ref="aiSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('ai')"
      >
        <div class="mb-4">
          <h2 class="text-base font-semibold text-gray-900">AI 助手</h2>
          <p class="mt-1 text-sm text-gray-500">配置 OpenAI 兼容接口参数，用于 SSH 终端 AI 指令生成。</p>
        </div>

        <el-form label-position="top">
          <el-form-item label="API 地址">
            <el-input v-model="form.ai.baseUrl" placeholder="https://api.openai.com/v1" clearable />
          </el-form-item>
          <el-form-item label="API 密钥">
            <el-input v-model="form.ai.apiKey" placeholder="sk-..." type="password" show-password clearable />
          </el-form-item>
          <el-form-item label="模型名称">
            <el-input v-model="form.ai.model" placeholder="gpt-3.5-turbo" clearable />
          </el-form-item>
        </el-form>

        <div class="flex justify-end gap-2">
          <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
        </div>
      </section>

      <section
        id="settings-features"
        ref="featuresSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('features')"
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900">功能管理</h2>
            <p class="mt-1 text-sm text-gray-500">选择在首页和侧边栏中显示哪些功能模块。关闭后不影响功能本身，可随时恢复。</p>
          </div>
          <el-tag effect="plain">{{ visibleFeatureCount }} / {{ totalFeatureCount }} 项可见</el-tag>
        </div>

        <el-input v-model="featureSearchText" clearable placeholder="搜索功能" class="mb-4">
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <div class="space-y-4">
          <div v-for="group in filteredManageGroups" :key="group.key" class="rounded-md border border-gray-100 bg-gray-50/60 p-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">{{ group.title }}</span>
              <el-switch
                :model-value="isGroupAllVisible(group)"
                :indeterminate="isGroupPartialVisible(group)"
                size="small"
                @change="toggleGroupVisibility(group, $event)"
              />
            </div>
            <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              <label
                v-for="item in group.items"
                :key="featureItemKey(item)"
                class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition hover:bg-white"
              >
                <el-switch
                  :model-value="!isFeatureHidden(item)"
                  size="small"
                  @change="toggleFeatureItem(item)"
                />
                <span class="min-w-0 flex-1 truncate text-sm text-gray-700">{{ item.label }}</span>
              </label>
            </div>
          </div>
          <div v-if="featureSearchText && filteredManageGroups.length === 0" class="py-4 text-center text-sm text-gray-400">
            没有匹配的功能
          </div>
        </div>
      </section>

      <section
        id="settings-cloud"
        ref="cloudSection"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        :class="sectionHighlightClass('cloud')"
      >
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900">云端同步</h2>
            <p class="mt-1 text-sm text-gray-500">将配置数据同步到云端服务，支持多设备间数据共享。</p>
          </div>
          <el-tag :type="cloudTagType" effect="plain">{{ cloudStatusLabel }}</el-tag>
        </div>

        <el-form label-position="top">
          <el-form-item label="云端服务地址">
            <el-input v-model="cloudForm.url" placeholder="https://your-server.com" clearable :disabled="cloudLoggedIn" />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="cloudForm.username" placeholder="输入用户名" clearable :disabled="cloudLoggedIn" />
          </el-form-item>
          <el-form-item v-if="!cloudLoggedIn" label="密码">
            <el-input v-model="cloudForm.password" placeholder="输入密码" type="password" show-password clearable />
          </el-form-item>
        </el-form>

        <div v-if="cloudLoggedIn" class="mb-4 rounded-md bg-slate-50 p-3 text-sm text-gray-600">
          <div>已登录为：{{ cloudStatus.username }}（{{ cloudStatus.role === 'admin' ? '管理员' : '普通用户' }}）</div>
          <div v-if="cloudStatus.lastSyncAt">上次同步：{{ formatSyncTime(cloudStatus.lastSyncAt) }}</div>
        </div>

        <div class="flex justify-end gap-2">
          <template v-if="cloudLoggedIn">
            <el-button :loading="cloudSyncing" @click="syncNow">立即同步</el-button>
            <el-button type="danger" plain @click="cloudLogout">退出登录</el-button>
          </template>
          <template v-else>
            <el-button :loading="cloudLoading" @click="cloudRegister">注册</el-button>
            <el-button type="primary" :loading="cloudLoading" @click="cloudLogin">登录</el-button>
          </template>
        </div>

        <!-- 两步验证配置 -->
        <div v-if="cloudLoggedIn" class="mt-5 border-t border-gray-100 pt-5">
          <h3 class="mb-3 text-sm font-semibold text-gray-900">两步验证 (TOTP)</h3>
          <div class="mb-3 flex items-center gap-3">
            <el-tag :type="totpEnabled ? 'success' : 'info'" effect="plain">
              {{ totpEnabled ? '已开启' : '未开启' }}
            </el-tag>
            <el-button v-if="!totpEnabled" size="small" type="primary" plain :loading="totpLoading" @click="handleTotpSetup">
              开启两步验证
            </el-button>
            <el-button v-else size="small" type="danger" plain @click="showTotpDisableDialog = true">
              关闭两步验证
            </el-button>
          </div>
          <p class="text-xs text-gray-400">开启后，登录时需使用 Authenticator 应用输入动态验证码。</p>
        </div>

        <!-- TOTP 设置对话框 -->
        <el-dialog v-model="showTotpSetupDialog" title="设置两步验证" width="400" :close-on-click-modal="false">
          <div v-if="totpSetupData" class="flex flex-col items-center gap-4">
            <p class="text-sm text-gray-600">请使用 Authenticator 应用扫描以下二维码：</p>
            <div class="rounded-lg border border-gray-200 p-3">
              <img :src="totpQrUrl" alt="TOTP QR Code" class="h-48 w-48" />
            </div>
            <div class="w-full">
              <p class="mb-1 text-xs text-gray-400">无法扫码？手动输入密钥：</p>
              <el-input :model-value="totpSetupData.secret" readonly size="small">
                <template #append>
                  <el-button size="small" @click="copyTotpSecret">复制</el-button>
                </template>
              </el-input>
            </div>
            <el-form-item label="输入 6 位验证码确认" class="w-full">
              <el-input v-model="totpConfirmCode" placeholder="000000" maxlength="6" />
            </el-form-item>
          </div>
          <template #footer>
            <el-button @click="showTotpSetupDialog = false">取消</el-button>
            <el-button type="primary" :loading="totpLoading" @click="handleTotpEnable">确认开启</el-button>
          </template>
        </el-dialog>

        <!-- TOTP 关闭对话框 -->
        <el-dialog v-model="showTotpDisableDialog" title="关闭两步验证" width="360" :close-on-click-modal="false">
          <p class="mb-3 text-sm text-gray-600">请输入当前验证码以确认关闭两步验证：</p>
          <el-input v-model="totpDisableCode" placeholder="000000" maxlength="6" />
          <template #footer>
            <el-button @click="showTotpDisableDialog = false">取消</el-button>
            <el-button type="danger" :loading="totpLoading" @click="handleTotpDisable">确认关闭</el-button>
          </template>
        </el-dialog>

        <!-- TOTP 登录验证对话框 -->
        <el-dialog v-model="showTotpLoginDialog" title="两步验证" width="360" :close-on-click-modal="false">
          <p class="mb-3 text-sm text-gray-600">请输入 Authenticator 应用中的 6 位验证码：</p>
          <el-input v-model="totpLoginCode" placeholder="000000" maxlength="6" @keyup.enter="handleTotpLogin" />
          <template #footer>
            <el-button @click="showTotpLoginDialog = false">取消</el-button>
            <el-button type="primary" :loading="cloudLoading" @click="handleTotpLogin">验证</el-button>
          </template>
        </el-dialog>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document, FolderOpened, Search } from '@element-plus/icons-vue'
import { fetchToolsConfig, testFfmpegConfig, testLive2dCatalog, updateToolsConfig } from '../utils/api/tools'
import { featureGroups, featureKey as featureItemKey, matchesFeatureQuery } from '../data/features'
import { useFeatureVisibility } from '../composables/useFeatureVisibility'

const route = useRoute()
const form = reactive({
  ffmpeg: {
    ffmpegPath: '',
    ffprobePath: '',
  },
  meme: {
    binaryPath: '',
    port: 2233,
  },
  live2d: {
    assetsDir: '',
    catalogPath: '',
  },
  ai: {
    baseUrl: '',
    apiKey: '',
    model: '',
  },
})
const autoLaunch = ref(false)
const saving = ref(false)
const testingFfmpeg = ref(false)
const testingMeme = ref(false)
const memeStatus = ref('')
const checkingLive2d = ref(false)
const ffmpegResult = ref(null)
const live2dModelCount = ref(0)
const live2dError = ref('')
const ffmpegSection = ref(null)
const memeSection = ref(null)
const live2dSection = ref(null)
const aiSection = ref(null)
const cloudSection = ref(null)
const activeSection = ref('')

const ffmpegStatusLabel = computed(() => {
  if (!ffmpegResult.value) return '未检测'
  return ffmpegResult.value.available ? '可用' : '不可用'
})
const ffmpegTagType = computed(() => ffmpegResult.value?.available ? 'success' : ffmpegResult.value ? 'danger' : 'info')
const memeStatusLabel = computed(() => memeStatus.value === 'running' ? '运行中' : memeStatus.value === 'error' ? '不可用' : '未检测')
const memeTagType = computed(() => memeStatus.value === 'running' ? 'success' : memeStatus.value === 'error' ? 'danger' : 'info')
const live2dStatusLabel = computed(() => live2dError.value ? '不可用' : live2dModelCount.value ? `${live2dModelCount.value} 个模型` : '未检测')
const live2dTagType = computed(() => live2dError.value ? 'danger' : live2dModelCount.value ? 'success' : 'info')

const featuresSection = ref(null)
const featureSearchText = ref('')
const { hiddenSet, isHidden: isFeatureHidden, setHidden, setMultipleHidden, toggleVisibility: toggleFeatureItem, applyCloudUpdate: applyFeatureVisibilityUpdate, loadVisibility: reloadFeatureVisibility } = useFeatureVisibility()

const filteredManageGroups = computed(() => {
  const q = featureSearchText.value.trim()
  if (!q) return featureGroups
  return featureGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => matchesFeatureQuery(item, q)) }))
    .filter((group) => group.items.length > 0)
})

const totalFeatureCount = computed(() => featureGroups.reduce((sum, g) => sum + g.items.length, 0))
const visibleFeatureCount = computed(() => totalFeatureCount.value - hiddenSet.value.size)

function isGroupAllVisible(group) {
  return group.items.every((item) => !isFeatureHidden(item))
}

function isGroupPartialVisible(group) {
  const visibleCount = group.items.filter((item) => !isFeatureHidden(item)).length
  return visibleCount > 0 && visibleCount < group.items.length
}

function toggleGroupVisibility(group, visible) {
  setMultipleHidden(group.items, !visible)
}

const cloudForm = reactive({ url: '', username: '', password: '' })
const cloudStatus = reactive({ loggedIn: false, username: '', role: '', lastSyncAt: 0 })
const cloudLoggedIn = computed(() => cloudStatus.loggedIn)
const cloudLoading = ref(false)
const cloudSyncing = ref(false)
const cloudStatusLabel = computed(() => cloudLoggedIn.value ? '已连接' : '未连接')
const cloudTagType = computed(() => cloudLoggedIn.value ? 'success' : 'info')

const totpEnabled = ref(false)
const totpLoading = ref(false)
const totpSetupData = ref(null)
const totpQrUrl = ref('')
const totpConfirmCode = ref('')
const totpDisableCode = ref('')
const totpLoginCode = ref('')
const showTotpSetupDialog = ref(false)
const showTotpDisableDialog = ref(false)
const showTotpLoginDialog = ref(false)

let _removeCloudListener = null

onMounted(async () => {
  autoLaunch.value = await window.electronAPI?.getAutoLaunch?.() || false
  await loadConfig()
  await reloadFeatureVisibility()
  await loadCloudStatus()
  await testFfmpeg()
  await checkLive2d()
  await scrollToRequestedSection()

  _removeCloudListener = window.electronAPI?.cloudSync?.onDataUpdated?.((payload) => {
    if (payload?.type === 'feature_visibility') applyFeatureVisibilityUpdate(payload.data)
  })
})

onUnmounted(() => {
  _removeCloudListener?.()
})

watch(() => route.query.section, () => {
  scrollToRequestedSection()
})

async function loadConfig() {
  const res = await fetchToolsConfig()
  if (res?.code !== 200 || !res.data) return
  Object.assign(form.ffmpeg, res.data.ffmpeg || {})
  Object.assign(form.meme, { binaryPath: '', port: 2233, ...(res.data.meme || {}) })
  Object.assign(form.live2d, res.data.live2d || {})
  Object.assign(form.ai, { baseUrl: '', apiKey: '', model: '', ...(res.data.ai || {}) })
}

async function saveConfig() {
  saving.value = true
  const res = await updateToolsConfig({
    ffmpeg: { ...form.ffmpeg },
    meme: { ...form.meme },
    live2d: { ...form.live2d },
    ai: { ...form.ai },
  })
  saving.value = false
  if (res?.code === 200) {
    ElMessage.success('配置已保存')
    await testFfmpeg()
    await checkLive2d()
  } else {
    ElMessage.error(res?.message || '保存失败')
  }
}

async function testFfmpeg() {
  testingFfmpeg.value = true
  const res = await testFfmpegConfig({ ...form.ffmpeg })
  testingFfmpeg.value = false
  ffmpegResult.value = res?.data || null
  if (ffmpegResult.value?.available) ElMessage.success('FFmpeg 检测通过')
}

async function checkLive2d() {
  checkingLive2d.value = true
  live2dError.value = ''
  const res = await testLive2dCatalog({ ...form.live2d })
  checkingLive2d.value = false
  if (res?.code === 200 && Array.isArray(res.data)) {
    live2dModelCount.value = res.data.length
    if (res.data.length) ElMessage.success('Live2D catalog 可用')
  } else {
    live2dModelCount.value = 0
    live2dError.value = res?.message || 'Live2D catalog 不可用'
  }
}

async function testMeme() {
  testingMeme.value = true
  let status = await window.electronAPI?.meme?.getStatus?.()
  if (!status?.running && form.meme.binaryPath) {
    await window.electronAPI?.meme?.start?.()
    await new Promise(r => setTimeout(r, 2000))
    status = await window.electronAPI?.meme?.getStatus?.()
  }
  testingMeme.value = false
  memeStatus.value = status?.running ? 'running' : 'error'
  if (status?.running) ElMessage.success('表情包服务可用')
  else ElMessage.warning(status?.error || '服务不可用，请检查配置并确保已加载表情资源')
}

function openMemeRelease() {
  window.electronAPI?.openExternal?.('https://github.com/MemeCrafters/meme-generator-rs/releases')
}

async function selectMemeBinary() {
  const selected = await window.electronAPI?.selectMemeBinary?.()
  if (selected) form.meme.binaryPath = selected
}

async function selectFfmpeg() {
  const selected = await window.electronAPI?.selectFfmpegBinary?.()
  if (selected) form.ffmpeg.ffmpegPath = selected
}

async function selectFfprobe() {
  const selected = await window.electronAPI?.selectFfprobeBinary?.()
  if (selected) form.ffmpeg.ffprobePath = selected
}

async function selectLive2dDir() {
  const selected = await window.electronAPI?.selectLive2dDirectory?.()
  if (selected) form.live2d.assetsDir = selected
}

async function selectLive2dCatalog() {
  const selected = await window.electronAPI?.selectLive2dCatalogFile?.()
  if (selected) form.live2d.catalogPath = selected
}

async function scrollToRequestedSection() {
  const section = String(route.query.section || '')
  const target = {
    ffmpeg: ffmpegSection,
    meme: memeSection,
    live2d: live2dSection,
    ai: aiSection,
    features: featuresSection,
    cloud: cloudSection,
  }[section]
  if (!target?.value) return
  activeSection.value = section
  await nextTick()
  target.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.setTimeout(() => {
    if (activeSection.value === section) activeSection.value = ''
  }, 1800)
}

async function toggleAutoLaunch(value) {
  await window.electronAPI?.setAutoLaunch?.(value)
}

function sectionHighlightClass(section) {
  return activeSection.value === section ? 'ring-2 ring-blue-300 ring-offset-2' : ''
}

async function loadCloudStatus() {
  const res = await window.electronAPI?.cloudSync?.getStatus?.()
  if (res?.ok && res.data) {
    Object.assign(cloudStatus, res.data)
    if (res.data.url) cloudForm.url = res.data.url
    if (res.data.username) cloudForm.username = res.data.username
  }
}

let _pendingLoginUrl = ''
let _pendingLoginUsername = ''
let _pendingLoginPassword = ''

async function doLogin(url, username, password, totpCode = '') {
  cloudLoading.value = true
  const res = await window.electronAPI?.cloudSync?.login?.({
    url, username, password, totpCode,
  })
  cloudLoading.value = false

  if (!res?.ok) {
    ElMessage.error(res?.error || '登录失败')
    return
  }

  const data = res.data
  if (data.code === 4001) {
    _pendingLoginUrl = url
    _pendingLoginUsername = username
    _pendingLoginPassword = password
    totpLoginCode.value = ''
    showTotpLoginDialog.value = true
    return
  }
  if (data.code === 4002) {
    ElMessage.error('验证码错误或已过期')
    return
  }
  if (data.code === 4003) {
    ElMessage.warning('账号待审核，请联系管理员')
    return
  }

  ElMessage.success('登录成功')
  cloudForm.password = ''
  totpEnabled.value = data.user?.totpEnabled || false
  await loadCloudStatus()
}

async function cloudLogin() {
  if (!cloudForm.url || !cloudForm.username || !cloudForm.password) {
    ElMessage.warning('请填写完整的云端服务地址、用户名和密码')
    return
  }
  await doLogin(cloudForm.url, cloudForm.username, cloudForm.password)
}

async function handleTotpLogin() {
  if (!totpLoginCode.value || totpLoginCode.value.length !== 6) {
    ElMessage.warning('请输入 6 位验证码')
    return
  }
  showTotpLoginDialog.value = false
  await doLogin(_pendingLoginUrl, _pendingLoginUsername, _pendingLoginPassword, totpLoginCode.value)
}

async function cloudRegister() {
  if (!cloudForm.url || !cloudForm.username || !cloudForm.password) {
    ElMessage.warning('请填写完整的云端服务地址、用户名和密码')
    return
  }
  cloudLoading.value = true
  const res = await window.electronAPI?.cloudSync?.register?.({
    url: cloudForm.url,
    username: cloudForm.username,
    password: cloudForm.password,
  })
  cloudLoading.value = false
  if (res?.ok) {
    if (res.data?.pending) {
      ElMessage.success('注册成功，等待管理员审核')
    } else {
      ElMessage.success('注册成功')
      cloudForm.password = ''
      await loadCloudStatus()
    }
  } else {
    ElMessage.error(res?.error || '注册失败')
  }
}

async function cloudLogout() {
  await window.electronAPI?.cloudSync?.logout?.()
  Object.assign(cloudStatus, { loggedIn: false, username: '', role: '', lastSyncAt: 0 })
  cloudForm.password = ''
  ElMessage.success('已退出云端登录')
}

async function syncNow() {
  cloudSyncing.value = true
  const res = await window.electronAPI?.cloudSync?.syncNow?.()
  cloudSyncing.value = false
  if (res?.ok) {
    const summary = res.data?.summary || {}
    ElMessage.success(`全量同步完成：拉取更新 ${summary.pulled?.length || 0} 项，数据一致 ${summary.unchanged?.length || 0} 项`)
    await loadCloudStatus()
  } else {
    ElMessage.error(res?.error || '同步失败')
  }
}

async function handleTotpSetup() {
  totpLoading.value = true
  const res = await window.electronAPI?.cloudSync?.totpSetup?.()
  totpLoading.value = false
  if (!res?.ok) {
    ElMessage.error(res?.error || '生成密钥失败')
    return
  }
  totpSetupData.value = res.data
  totpQrUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(res.data.url)}`
  totpConfirmCode.value = ''
  showTotpSetupDialog.value = true
}

function copyTotpSecret() {
  navigator.clipboard.writeText(totpSetupData.value?.secret || '')
  ElMessage.success('已复制密钥')
}

async function handleTotpEnable() {
  if (!totpConfirmCode.value || totpConfirmCode.value.length !== 6) {
    ElMessage.warning('请输入 6 位验证码')
    return
  }
  totpLoading.value = true
  const res = await window.electronAPI?.cloudSync?.totpEnable?.({ code: totpConfirmCode.value })
  totpLoading.value = false
  if (res?.ok) {
    ElMessage.success('两步验证已开启')
    totpEnabled.value = true
    showTotpSetupDialog.value = false
  } else {
    ElMessage.error(res?.error || '启用失败')
  }
}

async function handleTotpDisable() {
  if (!totpDisableCode.value || totpDisableCode.value.length !== 6) {
    ElMessage.warning('请输入 6 位验证码')
    return
  }
  totpLoading.value = true
  const res = await window.electronAPI?.cloudSync?.totpDisable?.({ code: totpDisableCode.value })
  totpLoading.value = false
  if (res?.ok) {
    ElMessage.success('两步验证已关闭')
    totpEnabled.value = false
    showTotpDisableDialog.value = false
    totpDisableCode.value = ''
  } else {
    ElMessage.error(res?.error || '关闭失败')
  }
}

function formatSyncTime(ts) {
  if (!ts) return '从未'
  return new Date(ts).toLocaleString()
}
</script>
