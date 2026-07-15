<template>
  <div class="plugin-marketplace">
    <div class="mb-5 flex flex-wrap items-center gap-3">
      <el-segmented v-model="viewTab" :options="viewTabs" />
      <div class="flex-1"></div>
      <el-button :icon="Upload" plain size="small" @click="installFromFile">
        从文件安装
      </el-button>
      <el-button :icon="Refresh" plain size="small" :loading="refreshing" @click="refreshAll">
        刷新
      </el-button>
    </div>

    <!-- 已安装 -->
    <template v-if="viewTab === 'installed'">
      <div v-if="pluginList.length === 0" class="py-10 text-center text-gray-400">
        <p>尚未安装任何插件</p>
        <p class="mt-1 text-xs">从"可用插件"中浏览并安装，或点击"从文件安装"导入插件包。</p>
      </div>
      <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="plugin in pluginList" :key="plugin.id" class="plugin-card">
          <div class="plugin-card-head">
            <span class="plugin-icon" v-html="resolveIcon(plugin.icon)"></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <strong class="truncate text-sm">{{ plugin.name }}</strong>
                <el-tag size="small" effect="plain">v{{ plugin.version }}</el-tag>
                <el-tag v-if="isBundled(plugin.id)" size="small" type="info">内置</el-tag>
              </div>
              <p class="mt-0.5 truncate text-xs text-gray-400">{{ plugin.description || '--' }}</p>
            </div>
          </div>
          <div class="plugin-card-actions">
            <el-switch
              :model-value="plugin.enabled"
              size="small"
              active-text="启用"
              inactive-text="禁用"
              @change="(v) => togglePlugin(plugin.id, v)"
            />
            <el-button
              v-if="!isBundled(plugin.id)"
              size="small"
              type="danger"
              text
              :icon="Delete"
              @click="doUninstall(plugin)"
            >
              卸载
            </el-button>
            <el-tag v-else size="small" type="info" effect="plain" class="text-[11px]">内置插件不可卸载</el-tag>
          </div>
        </div>
      </div>
    </template>

    <!-- 可用插件 -->
    <template v-if="viewTab === 'available'">
      <!-- 内置插件 -->
      <div v-if="bundledPlugins.length > 0" class="mb-5">
        <h3 class="mb-3 text-sm font-semibold text-gray-700">内置插件</h3>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="bp in bundledPlugins" :key="bp.id" class="plugin-card">
            <div class="plugin-card-head">
              <span class="plugin-icon" v-html="resolveIcon(bp.icon)"></span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <strong class="truncate text-sm">{{ bp.name }}</strong>
                  <el-tag size="small" effect="plain">v{{ bp.version }}</el-tag>
                  <el-tag size="small" type="info">内置</el-tag>
                </div>
                <p class="mt-0.5 truncate text-xs text-gray-400">{{ bp.description || '--' }}</p>
                <p v-if="bp.author" class="text-[11px] text-gray-300">by {{ bp.author }}</p>
              </div>
            </div>
            <div class="plugin-card-actions">
              <el-tag v-if="isInstalled(bp.id)" size="small" type="success">已安装</el-tag>
              <span v-else class="text-xs text-gray-400">重启应用后自动安装</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 远程仓库 -->
      <h3 class="mb-3 text-sm font-semibold text-gray-700">远程仓库</h3>
      <div class="mb-3 flex items-center gap-2">
        <el-input
          v-model="registryUrl"
          size="small"
          placeholder="插件仓库地址 (Registry URL)"
          class="flex-1"
        />
        <el-button size="small" type="primary" :loading="fetchingRegistry" @click="doFetchRegistry">
          获取
        </el-button>
      </div>
      <div v-if="registryPlugins.length === 0 && !fetchingRegistry" class="py-6 text-center text-gray-400 text-xs">
        输入远程仓库地址可浏览更多第三方插件
      </div>
      <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="rp in registryPlugins" :key="rp.id" class="plugin-card">
          <div class="plugin-card-head">
            <span class="plugin-icon" v-html="resolveIcon(rp.icon)"></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <strong class="truncate text-sm">{{ rp.name }}</strong>
                <el-tag size="small" effect="plain">v{{ rp.version }}</el-tag>
              </div>
              <p class="mt-0.5 truncate text-xs text-gray-400">{{ rp.description || '--' }}</p>
              <p v-if="rp.author" class="text-[11px] text-gray-300">by {{ rp.author }}</p>
            </div>
          </div>
          <div class="plugin-card-actions">
            <el-tag v-if="isInstalled(rp.id)" size="small" type="success">已安装</el-tag>
            <el-button
              v-if="canUpdate(rp)"
              size="small"
              type="warning"
              :loading="installingId === rp.id"
              @click="doInstallFromRegistry(rp)"
            >
              更新
            </el-button>
            <el-button
              v-else-if="!isInstalled(rp.id)"
              size="small"
              type="primary"
              :loading="installingId === rp.id"
              @click="doInstallFromRegistry(rp)"
            >
              安装
            </el-button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Refresh, Upload } from '@element-plus/icons-vue'
import { useSshPlugins } from '../../composables/useSshPlugins'

const {
  pluginList,
  refreshPluginList,
  setPluginEnabled,
  installPluginFromUrl,
  installPluginFromFile,
  uninstallPlugin,
  fetchRegistry,
} = useSshPlugins()

const viewTab = ref('installed')
const viewTabs = [
  { label: '已安装', value: 'installed' },
  { label: '可用插件', value: 'available' },
]
const refreshing = ref(false)
const registryUrl = ref('')
const registryPlugins = ref([])
const fetchingRegistry = ref(false)
const installingId = ref('')
const bundledPlugins = ref([])

const installedMap = computed(() => {
  const m = {}
  for (const p of pluginList.value) m[p.id] = p
  return m
})

const bundledIdSet = computed(() => new Set(bundledPlugins.value.map((p) => p.id)))

function isInstalled(id) {
  return Boolean(installedMap.value[id])
}

function isBundled(id) {
  return bundledIdSet.value.has(id)
}

function canUpdate(rp) {
  const installed = installedMap.value[rp.id]
  return installed && installed.version !== rp.version
}

function resolveIcon(icon) {
  if (!icon) return '<span class="plugin-icon-placeholder">P</span>'
  if (icon.startsWith('svg:')) return icon.slice(4)
  return `<span class="plugin-icon-placeholder">${icon.charAt(0).toUpperCase()}</span>`
}

async function loadBundledPlugins() {
  const api = window.electronAPI?.sshPlugins
  if (!api) return
  const res = await api.listBundled()
  if (res?.ok) bundledPlugins.value = res.data
}

async function refreshAll() {
  refreshing.value = true
  await Promise.all([refreshPluginList(), loadBundledPlugins()])
  refreshing.value = false
}

async function togglePlugin(pluginId, enabled) {
  await setPluginEnabled(pluginId, enabled)
}

async function doUninstall(plugin) {
  try {
    await ElMessageBox.confirm(
      `确定卸载插件「${plugin.name}」？此操作不可撤销。`,
      '卸载插件',
      { type: 'warning' },
    )
  } catch { return }
  const res = await uninstallPlugin(plugin.id)
  if (res?.ok) ElMessage.success('已卸载')
  else ElMessage.error(res?.error || '卸载失败')
}

async function installFromFile() {
  const res = await installPluginFromFile()
  if (!res?.ok) {
    if (res?.error !== 'cancelled') ElMessage.error(res?.error || '安装失败')
    return
  }
  ElMessage.success(`插件「${res.data?.manifest?.name || ''}」安装成功`)
}

async function doFetchRegistry() {
  if (!registryUrl.value.trim()) {
    ElMessage.warning('请输入仓库地址')
    return
  }
  fetchingRegistry.value = true
  try {
    registryPlugins.value = await fetchRegistry(registryUrl.value.trim())
    if (registryPlugins.value.length === 0) ElMessage.info('仓库中暂无可用插件')
  } catch (e) {
    ElMessage.error('获取仓库失败: ' + (e.message || ''))
  } finally {
    fetchingRegistry.value = false
  }
}

async function doInstallFromRegistry(rp) {
  if (!rp.downloadUrl) {
    ElMessage.error('该插件没有提供下载地址')
    return
  }
  installingId.value = rp.id
  try {
    const res = await installPluginFromUrl(rp.downloadUrl)
    if (res?.ok) ElMessage.success(`「${rp.name}」安装成功`)
    else ElMessage.error(res?.error || '安装失败')
  } finally {
    installingId.value = ''
  }
}

onMounted(() => {
  loadBundledPlugins()
})
</script>

<style scoped>
.plugin-marketplace {
  padding: 4px 0;
}
.plugin-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: box-shadow 0.15s;
}
.plugin-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.plugin-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.plugin-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.plugin-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f0f5ff;
  color: #409eff;
  overflow: hidden;
}
.plugin-icon :deep(svg) {
  width: 20px;
  height: 20px;
}
.plugin-icon-placeholder {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
}
</style>
