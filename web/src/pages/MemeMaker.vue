<template>
  <div class="meme-maker h-full min-h-0 overflow-hidden flex flex-col">
    <!-- Top bar: status + controls -->
    <header class="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 shrink-0">
      <h1 class="text-base font-semibold text-gray-900">表情包制作</h1>
      <div class="flex items-center gap-2 ml-auto">
        <span class="inline-flex items-center gap-1 text-xs">
          <span class="inline-block w-2 h-2 rounded-full" :class="serviceRunning ? 'bg-green-500' : 'bg-red-400'" />
          {{ serviceRunning ? '服务运行中' : '服务未启动' }}
        </span>
        <el-button size="small" :loading="downloading" @click="downloadMemes">加载表情</el-button>
        <el-button size="small" @click="showExternalDialog = true">加载其他表情</el-button>
        <el-button v-if="!serviceRunning" size="small" type="primary" :loading="starting" @click="startService">启动服务</el-button>
        <el-button v-else size="small" @click="stopService">停止服务</el-button>
      </div>
    </header>

    <!-- Guide when service is not running and not starting -->
    <div v-if="!serviceRunning && !starting && !hasBinaryPath" class="flex-1 flex items-center justify-center p-8">
      <div class="text-center max-w-sm">
        <el-icon :size="48" class="text-gray-300 mb-4"><MagicStick /></el-icon>
        <h2 class="text-lg font-medium text-gray-700 mb-2">表情包服务未配置</h2>
        <p class="text-sm text-gray-500 mb-4">请先在「设置」中配置 meme-generator-rs 可执行文件路径。</p>
        <el-button type="primary" @click="$router.push('/settings?section=meme')">前往设置</el-button>
      </div>
    </div>

    <!-- Starting indicator -->
    <div v-else-if="!serviceRunning && starting" class="flex-1 flex items-center justify-center p-8">
      <div class="text-center">
        <el-icon class="is-loading text-blue-400 mb-4" :size="40"><Loading /></el-icon>
        <p class="text-sm text-gray-500">正在启动服务，请稍候...</p>
      </div>
    </div>

    <!-- Service configured but not reachable yet -->
    <div v-else-if="!serviceRunning && hasBinaryPath" class="flex-1 flex items-center justify-center p-8">
      <div class="text-center max-w-sm">
        <el-icon :size="48" class="text-gray-300 mb-4"><MagicStick /></el-icon>
        <h2 class="text-lg font-medium text-gray-700 mb-2">服务未运行</h2>
        <p class="text-sm text-gray-500 mb-4">已检测到配置路径，点击按钮启动服务。如果是首次使用请先点击「加载表情」下载资源。</p>
        <div class="flex gap-2 justify-center">
          <el-button :loading="downloading" @click="downloadMemes">加载表情</el-button>
          <el-button type="primary" :loading="starting" @click="startService">启动服务</el-button>
        </div>
      </div>
    </div>

    <!-- Main content when service is running -->
    <div v-else-if="serviceRunning" class="flex-1 flex min-h-0 overflow-hidden">
      <!-- Left panel: meme list -->
      <aside class="w-72 shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-gray-50">
        <div class="p-3 border-b border-gray-200">
          <el-input v-model="searchQuery" placeholder="搜索表情..." clearable :prefix-icon="Search" @input="onSearch" />
        </div>
        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="loadingList" class="flex items-center justify-center py-8">
            <el-icon class="is-loading text-gray-400" :size="24"><Loading /></el-icon>
          </div>
          <div v-else-if="filteredMemes.length === 0" class="text-center py-8 text-sm text-gray-400">
            {{ searchQuery ? '未找到匹配表情' : '暂无表情数据' }}
          </div>
          <div
            v-for="meme in filteredMemes"
            :key="meme.key"
            class="meme-item rounded-md px-3 py-2 cursor-pointer mb-1 transition-colors"
            :class="selectedMeme?.key === meme.key ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100 border border-transparent'"
            @click="selectMeme(meme)"
          >
            <div class="text-sm font-medium text-gray-800 truncate">{{ meme.keywords.join(' / ') || meme.key }}</div>
            <div class="text-xs text-gray-400 mt-0.5 truncate">{{ meme.key }}</div>
          </div>
        </div>
      </aside>

      <!-- Right panel: editor -->
      <main class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div v-if="!selectedMeme" class="flex-1 flex items-center justify-center">
          <div class="text-center text-gray-400">
            <el-icon :size="40"><Picture /></el-icon>
            <p class="mt-2 text-sm">请从左侧选择一个表情模板</p>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          <!-- Meme info header -->
          <div class="flex items-start gap-4">
            <div class="shrink-0 w-28 h-28 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden cursor-pointer" @click="previewUrl && previewImage(previewUrl)">
              <img v-if="previewUrl" :src="previewUrl" class="max-w-full max-h-full object-contain" />
              <el-icon v-else :size="32" class="text-gray-300"><Picture /></el-icon>
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold text-gray-900">{{ selectedMeme.keywords.join(' / ') || selectedMeme.key }}</h2>
              <div class="mt-1 text-xs text-gray-500">key: {{ selectedMeme.key }}</div>
              <div class="mt-2 flex flex-wrap gap-1">
                <el-tag v-if="selectedMeme.params.min_images > 0" size="small" type="info">
                  图片 {{ selectedMeme.params.min_images }}-{{ selectedMeme.params.max_images }}
                </el-tag>
                <el-tag v-if="selectedMeme.params.max_texts > 0" size="small" type="info">
                  文字 {{ selectedMeme.params.min_texts }}-{{ selectedMeme.params.max_texts }}
                </el-tag>
                <el-tag v-for="tag in selectedMeme.tags" :key="tag" size="small">{{ tag }}</el-tag>
              </div>
            </div>
          </div>

          <!-- Image inputs -->
          <section v-if="selectedMeme.params.max_images > 0">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-sm font-medium text-gray-700">图片</h3>
              <el-switch
                v-model="batchMode"
                size="small"
                active-text="批量"
                inactive-text="单张"
                @change="onBatchModeChange"
              />
            </div>

            <!-- Single mode -->
            <div v-if="!batchMode">
              <div class="text-xs text-gray-400 mb-1">{{ uploadedImages.length }}/{{ selectedMeme.params.max_images }}</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="(img, idx) in uploadedImages"
                  :key="idx"
                  class="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden group"
                >
                  <img :src="img.url" class="w-full h-full object-cover" />
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <el-button size="small" type="danger" circle :icon="Delete" @click="removeImage(idx)" />
                  </div>
                </div>
                <label
                  v-if="uploadedImages.length < selectedMeme.params.max_images"
                  class="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <el-icon :size="24" class="text-gray-400"><Plus /></el-icon>
                  <input type="file" accept="image/*" class="hidden" @change="onFileSelected" />
                </label>
              </div>
            </div>

            <!-- Batch mode -->
            <div v-else class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <el-button size="small" @click="selectBatchFiles">选择图片文件</el-button>
                <span v-if="batchFiles.length" class="text-xs text-gray-500">已选 {{ batchFiles.length }} 个文件</span>
              </div>

              <div v-if="batchFiles.length" class="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white">
                <div
                  v-for="(f, idx) in batchFiles"
                  :key="idx"
                  class="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-gray-100 last:border-b-0"
                >
                  <span class="text-gray-400 w-6 text-right shrink-0">{{ idx + 1 }}</span>
                  <span class="truncate flex-1 text-gray-700" :title="f">{{ getFileName(f) }}</span>
                  <el-button size="small" link type="danger" @click="batchFiles.splice(idx, 1)">移除</el-button>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-600 shrink-0">输出目录:</span>
                <el-input v-model="batchOutputDir" size="small" readonly placeholder="点击选择输出目录..." @click="selectBatchOutputDir" />
                <el-button size="small" @click="selectBatchOutputDir">选择</el-button>
              </div>
            </div>
          </section>

          <!-- Text inputs -->
          <section v-if="selectedMeme.params.max_texts > 0">
            <h3 class="text-sm font-medium text-gray-700 mb-2">文字 ({{ textInputs.length }}/{{ selectedMeme.params.max_texts }})</h3>
            <div class="flex flex-col gap-2">
              <div v-for="(_, idx) in textInputs" :key="idx" class="flex gap-2">
                <el-input v-model="textInputs[idx]" :placeholder="`文字 ${idx + 1}${getDefaultText(idx) ? ' (默认: ' + getDefaultText(idx) + ')' : ''}`" />
                <el-button v-if="textInputs.length > selectedMeme.params.min_texts" :icon="Delete" @click="removeText(idx)" />
              </div>
              <el-button v-if="textInputs.length < selectedMeme.params.max_texts" size="small" @click="addText">+ 添加文字</el-button>
            </div>
          </section>

          <!-- Options -->
          <section v-if="selectedMeme.params.options && selectedMeme.params.options.length > 0">
            <h3 class="text-sm font-medium text-gray-700 mb-2">选项</h3>
            <el-form label-position="left" label-width="120px">
              <el-form-item v-for="opt in selectedMeme.params.options" :key="opt.name" :label="opt.description || opt.name">
                <el-switch v-if="opt.type === 'boolean'" v-model="optionValues[opt.name]" />
                <el-input-number
                  v-else-if="opt.type === 'integer' || opt.type === 'float'"
                  v-model="optionValues[opt.name]"
                  :min="opt.minimum ?? undefined"
                  :max="opt.maximum ?? undefined"
                  :step="opt.type === 'float' ? 0.1 : 1"
                />
                <el-select v-else-if="opt.type === 'string' && opt.choices" v-model="optionValues[opt.name]" clearable>
                  <el-option v-for="c in opt.choices" :key="c" :label="c" :value="c" />
                </el-select>
                <el-input v-else v-model="optionValues[opt.name]" />
              </el-form-item>
            </el-form>
          </section>

          <!-- Generate button & result -->
          <section class="pt-2 border-t border-gray-100">
            <!-- Single mode actions -->
            <template v-if="!batchMode">
              <div class="flex items-center gap-3">
                <el-button type="primary" :loading="generating" :disabled="!canGenerate" @click="generate">生成表情</el-button>
                <el-button v-if="resultUrl" @click="copyResult">复制到剪贴板</el-button>
                <el-button v-if="resultUrl" @click="saveResult">保存到本地</el-button>
              </div>
              <div v-if="generateError" class="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{{ generateError }}</div>
              <div v-if="resultUrl" class="mt-4 inline-block rounded-lg border border-gray-200 bg-white p-2 cursor-pointer" @click="previewImage(resultUrl)">
                <img :src="resultUrl" class="max-w-xs max-h-60 object-contain" />
              </div>
            </template>

            <!-- Batch mode actions -->
            <template v-else>
              <div class="flex items-center gap-3">
                <el-button type="primary" :loading="batchProcessing" :disabled="!canBatchGenerate" @click="startBatchGenerate">
                  {{ batchProcessing ? '处理中...' : '开始批量生成' }}
                </el-button>
                <el-button v-if="batchProcessing" @click="cancelBatch">取消</el-button>
                <el-button v-if="!batchProcessing && batchResults.length > 0" @click="openBatchOutputDir">打开输出目录</el-button>
              </div>

              <div v-if="batchProcessing || batchResults.length > 0" class="mt-3">
                <div class="flex items-center gap-2 text-xs text-gray-600 mb-1">
                  <span>进度: {{ batchProgress.current }}/{{ batchProgress.total }}</span>
                  <span v-if="batchProgress.failed > 0" class="text-rose-500">失败: {{ batchProgress.failed }}</span>
                </div>
                <el-progress :percentage="batchProgressPercent" :status="batchProgressStatus" :stroke-width="6" />
              </div>

              <div v-if="batchResults.length > 0" class="mt-3 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white">
                <div
                  v-for="(r, idx) in batchResults"
                  :key="idx"
                  class="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-gray-100 last:border-b-0"
                >
                  <span class="w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-white text-[10px]"
                    :class="r.success ? 'bg-green-500' : 'bg-rose-500'"
                  >{{ r.success ? 'v' : 'x' }}</span>
                  <span class="truncate flex-1" :class="r.success ? 'text-gray-700' : 'text-rose-600'">
                    {{ r.fileName }}{{ r.error ? ' - ' + r.error : '' }}
                  </span>
                </div>
              </div>
            </template>
          </section>
        </div>
      </main>
    </div>

    <!-- Image preview dialog -->
    <el-dialog v-model="showPreview" width="fit-content" :show-close="true" class="preview-dialog" @close="previewSrc = ''">
      <img :src="previewSrc" class="max-w-[80vw] max-h-[80vh] object-contain" />
    </el-dialog>

    <!-- External meme dialog -->
    <el-dialog v-model="showExternalDialog" title="加载其他表情" width="500px" :close-on-click-modal="false">
      <div class="flex flex-col gap-4">
        <div class="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
          <p>输入外部表情库的下载地址（.dll / .so / .dylib 文件的直链 URL）。</p>
          <p class="mt-1">文件将被下载到 <code class="bg-blue-100 px-1 rounded">{{ memeHome }}/libraries/</code> 目录。</p>
          <p class="mt-1">
            参考：
            <a href="#" class="underline" @click.prevent="openExternalLink('https://github.com/MemeCrafters/meme-generator-contrib-rs')">
              meme-generator-contrib-rs
            </a>
          </p>
        </div>
        <el-input
          v-model="externalUrl"
          placeholder="https://github.com/.../releases/download/.../libmeme_generator_contrib.dll"
          clearable
        />
        <div v-if="externalResult" class="rounded-md p-3 text-sm" :class="externalResult.success ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'">
          {{ externalResult.success ? `下载成功：${externalResult.fileName}` : `失败：${externalResult.error}` }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="showExternalDialog = false">关闭</el-button>
          <el-button type="primary" :loading="downloadingExternal" :disabled="!externalUrl.trim()" @click="downloadExternal">
            下载并加载
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Footer -->
    <footer class="shrink-0 border-t border-gray-200 bg-white px-4 py-1.5 text-xs text-gray-400 text-center">
      Powered by
      <a href="#" class="text-blue-500 hover:underline" @click.prevent="openExternalLink('https://github.com/MemeCrafters/meme-generator-rs')">meme-generator-rs</a>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Picture, Plus, Delete, Loading, MagicStick } from '@element-plus/icons-vue'
import { fetchToolsConfig } from '../utils/api/tools'

const serviceRunning = ref(false)
const starting = ref(false)
const hasBinaryPath = ref(false)
const loadingList = ref(false)
const downloading = ref(false)
const searchQuery = ref('')
const allMemes = ref([])
const filteredMemes = ref([])
const selectedMeme = ref(null)
const previewUrl = ref('')
const uploadedImages = ref([])
const textInputs = ref([])
const optionValues = reactive({})
const generating = ref(false)
const generateError = ref('')
const resultUrl = ref('')
const resultImageId = ref('')
const showExternalDialog = ref(false)
const externalUrl = ref('')
const downloadingExternal = ref(false)
const externalResult = ref(null)
const memeHome = ref('')
const showPreview = ref(false)
const previewSrc = ref('')
let memePort = 2233
let searchTimer = null
let unsubStatus = null

const batchMode = ref(false)
const batchFiles = ref([])
const batchOutputDir = ref('')
const batchProcessing = ref(false)
const batchResults = ref([])
const batchProgress = reactive({ current: 0, total: 0, failed: 0 })
let batchCancelled = false

const canGenerate = computed(() => {
  if (!selectedMeme.value) return false
  const p = selectedMeme.value.params
  if (p.min_images > 0 && uploadedImages.value.length < p.min_images) return false
  if (p.min_texts > 0) {
    const filled = textInputs.value.filter(t => t.trim()).length
    if (filled < p.min_texts) return false
  }
  return true
})

const canBatchGenerate = computed(() => {
  if (!selectedMeme.value) return false
  if (batchFiles.value.length === 0) return false
  if (!batchOutputDir.value) return false
  const p = selectedMeme.value.params
  if (p.min_texts > 0) {
    const filled = textInputs.value.filter(t => t.trim()).length
    if (filled < p.min_texts) return false
  }
  return true
})

const batchProgressPercent = computed(() => {
  if (batchProgress.total === 0) return 0
  return Math.round((batchProgress.current / batchProgress.total) * 100)
})

const batchProgressStatus = computed(() => {
  if (batchProcessing.value) return undefined
  if (batchProgress.failed > 0 && batchProgress.failed === batchProgress.total) return 'exception'
  if (batchProgress.current === batchProgress.total && batchProgress.total > 0) return 'success'
  return undefined
})

function apiUrl(path) {
  return `http://127.0.0.1:${memePort}${path}`
}

onMounted(async () => {
  const cfg = await fetchToolsConfig()
  if (cfg?.code === 200 && cfg.data?.meme) {
    memePort = cfg.data.meme.port || 2233
    hasBinaryPath.value = !!cfg.data.meme.binaryPath
  }

  memeHome.value = await window.electronAPI?.meme?.getHome?.() || ''

  const status = await window.electronAPI?.meme?.getStatus?.()
  if (status?.running) {
    serviceRunning.value = true
    loadMemes()
  } else if (hasBinaryPath.value) {
    await startService()
  }

  unsubStatus = window.electronAPI?.meme?.onStatusChanged?.((payload) => {
    serviceRunning.value = !!payload?.running
    if (!serviceRunning.value) {
      ElMessage.warning('表情包服务已停止')
    }
  })
})

onBeforeUnmount(() => {
  if (unsubStatus) unsubStatus()
})

async function startService() {
  starting.value = true
  const res = await window.electronAPI?.meme?.start?.()
  if (res?.running) {
    let retries = 5
    while (retries-- > 0) {
      await new Promise(r => setTimeout(r, 1500))
      try {
        const resp = await fetch(apiUrl('/meme/version'))
        if (resp.ok) {
          serviceRunning.value = true
          ElMessage.success('服务已启动')
          loadMemes()
          starting.value = false
          return
        }
      } catch {}
    }
    ElMessage.warning('服务已启动但尚未就绪，请稍后刷新')
  } else {
    ElMessage.error(res?.error || '启动失败，请检查可执行文件路径')
  }
  starting.value = false
}

async function stopService() {
  await window.electronAPI?.meme?.stop?.()
  serviceRunning.value = false
}

async function downloadMemes() {
  if (!hasBinaryPath.value) {
    ElMessage.warning('请先配置可执行文件路径')
    return
  }
  downloading.value = true
  ElMessage.info('正在下载表情资源，首次加载可能需要几分钟...')
  const res = await window.electronAPI?.meme?.download?.()
  downloading.value = false
  if (res?.success) {
    ElMessage.success('表情资源加载完成')
    if (serviceRunning.value) {
      await stopService()
      await new Promise(r => setTimeout(r, 500))
      await startService()
    }
  } else {
    ElMessage.error('加载失败: ' + (res?.error || res?.stderr || '未知错误'))
  }
}

async function downloadExternal() {
  const url = externalUrl.value.trim()
  if (!url) return
  downloadingExternal.value = true
  externalResult.value = null
  const res = await window.electronAPI?.meme?.downloadExternal?.(url)
  downloadingExternal.value = false
  externalResult.value = res
  if (res?.success) {
    ElMessage.success('外部表情库下载成功，重启服务以生效')
    if (serviceRunning.value) {
      await stopService()
      await new Promise(r => setTimeout(r, 500))
      await startService()
    }
  }
}

function openExternalLink(url) {
  window.electronAPI?.openExternal?.(url)
}

async function loadMemes() {
  loadingList.value = true
  try {
    const resp = await fetch(apiUrl('/meme/infos?sort_by=keywords_pinyin'))
    if (resp.ok) {
      allMemes.value = await resp.json()
      filteredMemes.value = allMemes.value
    }
  } catch (e) {
    ElMessage.error('加载表情列表失败: ' + e.message)
  }
  loadingList.value = false
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    const q = searchQuery.value.trim()
    if (!q) {
      filteredMemes.value = allMemes.value
      return
    }
    try {
      const resp = await fetch(apiUrl(`/meme/search?query=${encodeURIComponent(q)}&include_tags=true`))
      if (resp.ok) {
        const keys = await resp.json()
        const keySet = new Set(keys)
        filteredMemes.value = allMemes.value.filter(m => keySet.has(m.key))
      }
    } catch {
      const lower = q.toLowerCase()
      filteredMemes.value = allMemes.value.filter(m =>
        m.key.includes(lower) || m.keywords.some(k => k.includes(lower))
      )
    }
  }, 300)
}

async function selectMeme(meme) {
  selectedMeme.value = meme
  uploadedImages.value = []
  textInputs.value = Array.from({ length: meme.params.min_texts }, () => '')
  Object.keys(optionValues).forEach(k => delete optionValues[k])
  for (const opt of meme.params.options || []) {
    optionValues[opt.name] = opt.default ?? (opt.type === 'boolean' ? false : opt.type === 'string' ? '' : 0)
  }
  generateError.value = ''
  resultUrl.value = ''
  resultImageId.value = ''
  previewUrl.value = ''
  batchMode.value = false
  batchFiles.value = []
  batchResults.value = []
  batchProgress.current = 0
  batchProgress.total = 0
  batchProgress.failed = 0

  try {
    const resp = await fetch(apiUrl(`/memes/${meme.key}/preview`))
    if (resp.ok) {
      const data = await resp.json()
      if (data.image_id) {
        previewUrl.value = apiUrl(`/image/${data.image_id}`)
      }
    }
  } catch {}
}

function getDefaultText(idx) {
  return selectedMeme.value?.params?.default_texts?.[idx] || ''
}

async function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    const resp = await fetch(apiUrl('/image/upload/multipart'), { method: 'POST', body: formData })
    if (resp.ok) {
      const data = await resp.json()
      uploadedImages.value.push({
        id: data.image_id,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: apiUrl(`/image/${data.image_id}`),
      })
    } else {
      ElMessage.error('图片上传失败')
    }
  } catch (err) {
    ElMessage.error('图片上传失败: ' + err.message)
  }
}

function removeImage(idx) {
  uploadedImages.value.splice(idx, 1)
}

function addText() {
  textInputs.value.push('')
}

function removeText(idx) {
  textInputs.value.splice(idx, 1)
}

async function generate() {
  generating.value = true
  generateError.value = ''
  resultUrl.value = ''
  try {
    const payload = {
      images: uploadedImages.value.map(img => ({ name: img.name, id: img.id })),
      texts: textInputs.value.filter(t => t.trim()),
      options: { ...optionValues },
    }
    const resp = await fetch(apiUrl(`/memes/${selectedMeme.value.key}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (resp.ok) {
      const data = await resp.json()
      resultImageId.value = data.image_id
      resultUrl.value = apiUrl(`/image/${data.image_id}`)
    } else {
      const errData = await resp.json().catch(() => null)
      generateError.value = errData?.detail || errData?.message || `生成失败 (${resp.status})`
    }
  } catch (err) {
    generateError.value = '请求失败: ' + err.message
  }
  generating.value = false
}

function previewImage(url) {
  previewSrc.value = url
  showPreview.value = true
}

async function copyResult() {
  if (!resultUrl.value) return
  try {
    const res = await window.electronAPI?.copyImageToClipboard?.(resultUrl.value)
    if (res?.success) {
      ElMessage.success('已复制到剪贴板')
    } else {
      ElMessage.error('复制失败: ' + (res?.error || '未知错误'))
    }
  } catch (err) {
    ElMessage.error('复制失败: ' + err.message)
  }
}

async function saveResult() {
  if (!resultUrl.value) return
  try {
    const resp = await fetch(resultUrl.value)
    const blob = await resp.blob()
    const ext = blob.type.includes('gif') ? 'gif' : 'png'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meme_${selectedMeme.value.key}_${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('已保存')
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  }
}

function getFileName(filePath) {
  return filePath.split(/[/\\]/).pop() || filePath
}

function onBatchModeChange() {
  batchFiles.value = []
  batchResults.value = []
  batchProgress.current = 0
  batchProgress.total = 0
  batchProgress.failed = 0
}

async function selectBatchFiles() {
  const paths = await window.electronAPI?.selectImageFiles?.()
  if (paths?.length) {
    batchFiles.value = paths
    batchResults.value = []
    batchProgress.current = 0
    batchProgress.total = 0
    batchProgress.failed = 0
  }
}

async function selectBatchOutputDir() {
  const dir = await window.electronAPI?.selectDirectory?.()
  if (dir) batchOutputDir.value = dir
}

function cancelBatch() {
  batchCancelled = true
}

function openBatchOutputDir() {
  if (batchOutputDir.value) {
    window.electronAPI?.openPath?.(batchOutputDir.value)
  }
}

async function startBatchGenerate() {
  if (!canBatchGenerate.value || !selectedMeme.value) return

  batchProcessing.value = true
  batchCancelled = false
  batchResults.value = []
  batchProgress.current = 0
  batchProgress.total = batchFiles.value.length
  batchProgress.failed = 0

  const texts = textInputs.value.filter(t => t.trim())
  const options = { ...optionValues }

  for (let i = 0; i < batchFiles.value.length; i++) {
    if (batchCancelled) {
      batchResults.value.push({ fileName: '(已取消)', success: false, error: '用户取消' })
      break
    }

    const filePath = batchFiles.value[i]
    const fileName = getFileName(filePath)

    try {
      const uploadRes = await window.electronAPI.meme.uploadLocalImage(filePath, memePort)
      if (!uploadRes?.success) {
        batchProgress.failed++
        batchResults.value.push({ fileName, success: false, error: '上传失败: ' + (uploadRes?.error || '未知') })
        batchProgress.current++
        continue
      }

      const payload = {
        images: [{ name: uploadRes.name, id: uploadRes.imageId }],
        texts,
        options,
      }
      const genResp = await fetch(apiUrl(`/memes/${selectedMeme.value.key}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!genResp.ok) {
        const errData = await genResp.json().catch(() => null)
        batchProgress.failed++
        batchResults.value.push({ fileName, success: false, error: errData?.detail || errData?.message || `HTTP ${genResp.status}` })
        batchProgress.current++
        continue
      }

      const genData = await genResp.json()
      const imageUrl = apiUrl(`/image/${genData.image_id}`)

      const typeResp = await fetch(imageUrl, { method: 'HEAD' })
      const contentType = typeResp.headers.get('content-type') || ''
      const ext = contentType.includes('gif') ? '.gif' : '.png'
      const baseName = fileName.replace(/\.[^.]+$/, '')
      const savePath = `${batchOutputDir.value}/${baseName}_meme${ext}`

      const saveRes = await window.electronAPI.meme.saveImageToPath(imageUrl, savePath)
      if (!saveRes?.success) {
        batchProgress.failed++
        batchResults.value.push({ fileName, success: false, error: '保存失败: ' + (saveRes?.error || '未知') })
      } else {
        batchResults.value.push({ fileName, success: true })
      }
    } catch (err) {
      batchProgress.failed++
      batchResults.value.push({ fileName, success: false, error: err.message })
    }

    batchProgress.current++
  }

  batchProcessing.value = false

  const successCount = batchProgress.current - batchProgress.failed
  if (batchCancelled) {
    ElMessage.warning(`批量处理已取消，完成 ${successCount} 个`)
  } else if (batchProgress.failed === 0) {
    ElMessage.success(`批量处理完成，共 ${successCount} 个`)
  } else {
    ElMessage.warning(`批量处理完成: 成功 ${successCount}，失败 ${batchProgress.failed}`)
  }
}
</script>

<style scoped>
.meme-maker {
  background: #f9fafb;
}
</style>

<style>
.preview-dialog .el-dialog__body {
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-dialog .el-dialog__header {
  padding-bottom: 0;
}
</style>
