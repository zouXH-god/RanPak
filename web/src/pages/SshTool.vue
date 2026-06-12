<template>
  <div class="h-full min-h-0 overflow-auto bg-[#f8fafc] px-4 pb-4">
    <div class="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header class="ssh-session-bar">
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="profile in connectedProfiles"
            :key="profile.id"
            class="connection-tab"
            :class="profile.id === activeConnectionId ? 'is-active' : ''"
            @click="activateConnection(profile.id)"
          >
            <span class="session-status-dot"></span>
            <span class="truncate font-semibold">{{ profile.name }}</span>
            <small class="truncate">{{ profile.username }}@{{ profile.host }}:{{ profile.port }}</small>
            <el-button class="session-close" :icon="Close" text size="small" @click.stop="disconnectConnection(profile.id)" />
          </button>
          <el-button class="session-add" :icon="Plus" circle type="primary" @click="openConnectionDialog" />
          <div class="min-w-[120px] flex-1"></div>
          <el-button :icon="Refresh" plain @click="refreshAll">刷新</el-button>
        </div>
      </header>

      <section v-if="connectedProfiles.length === 0" class="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">SSH 连接历史</h1>
            <p class="mt-1 text-sm text-gray-500">选择已保存的服务器快速连接，或点击上方 + 管理连接。</p>
          </div>
          <el-button :icon="Plus" type="primary" @click="openConnectionDialog">新增连接</el-button>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <button v-for="profile in profiles" :key="profile.id" class="history-card" @click="quickConnect(profile.id)">
            <span class="profile-card-head">
              <span class="server-mark"></span>
              <span class="min-w-0">
                <strong class="truncate">{{ profile.name }}</strong>
                <small class="truncate">{{ profile.username }}@{{ profile.host }}:{{ profile.port }}</small>
              </span>
            </span>
            <span class="profile-meta">更新于 {{ formatDate(profile.updatedAt) }}</span>
          </button>
        </div>
        <el-empty v-if="profiles.length === 0" description="暂无连接历史" />
      </section>

      <section v-else-if="activeProfile" class="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
        <el-tabs v-model="activeState.workTab" class="ssh-tabs" @tab-change="onWorkTabChange">
          <el-tab-pane label="终端" name="terminal">
            <div class="terminal-window-tabs">
              <button
                v-for="terminalTab in activeState.terminals"
                :key="terminalTab.id"
                class="terminal-window-tab"
                :class="terminalTab.id === activeState.activeTerminalId ? 'is-active' : ''"
                @click="activateTerminal(terminalTab.id)"
              >
                <span class="terminal-tab-glyph"></span>
                <span class="truncate">{{ terminalTab.title }}</span>
                <el-button class="terminal-close" :icon="Close" text size="small" @click.stop="closeTerminalTab(terminalTab.id)" />
              </button>
              <el-button class="terminal-add" :icon="Plus" plain size="small" @click="addTerminalTab">新增终端</el-button>
              <div class="flex-1"></div>
              <el-button :icon="Refresh" plain size="small" @click="restartShell">重启 Shell</el-button>
              <el-button :icon="Delete" plain size="small" @click="clearTerminal">清屏</el-button>
            </div>
            <div class="terminal-frame">
              <div class="terminal-frame-chrome">
                <span></span><span></span><span></span>
                <strong>{{ activeProfile.name }}</strong>
              </div>
              <div ref="terminalHost" class="terminal-host"></div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="SFTP" name="sftp">
            <div ref="sftpDropRef" class="sftp-drop-zone" :class="sftpDragOver ? 'is-drag-over' : ''">
              <div v-show="sftpDragOver" class="sftp-drop-hint">
                <el-icon size="32"><Upload /></el-icon>
                <span>释放文件以上传到当前目录</span>
              </div>
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <el-button :icon="ArrowLeft" plain @click="goUp">上级</el-button>
                <el-input v-model="activeState.remotePath" class="min-w-[260px] flex-1" @keyup.enter="loadRemoteDir" />
                <el-button :icon="Refresh" :loading="activeState.loadingDir" @click="loadRemoteDir">刷新</el-button>
                <el-button :icon="FolderAdd" @click="createRemoteDir">新建目录</el-button>
                <el-button :icon="Upload" @click="uploadFile">上传</el-button>
              </div>
              <el-table :data="activeState.remoteFiles" border height="560">
                <el-table-column label="名称" min-width="260">
                  <template #default="{ row }">
                    <button class="file-name" @click="row.isDirectory ? enterDir(row.name) : null">
                      <el-icon><Folder v-if="row.isDirectory" /><Document v-else /></el-icon>
                      <span class="truncate">{{ row.name }}</span>
                    </button>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="90">
                  <template #default="{ row }">{{ row.isDirectory ? '目录' : '文件' }}</template>
                </el-table-column>
                <el-table-column label="大小" width="120">
                  <template #default="{ row }">{{ row.isDirectory ? '-' : formatBytes(row.size) }}</template>
                </el-table-column>
                <el-table-column label="修改时间" width="180">
                  <template #default="{ row }">{{ formatMtime(row.mtime) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="240" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" text @click="renameRemote(row)">重命名</el-button>
                    <el-button size="small" text :disabled="row.isDirectory" @click="downloadFile(row)">下载</el-button>
                    <el-button size="small" text type="danger" @click="deleteRemote(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="端口映射" name="tunnels">
            <div class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <section class="rounded-xl border border-gray-100 bg-[#f8fafc] p-4">
                <h2 class="mb-4 text-sm font-semibold text-gray-900">新增映射</h2>
                <el-form label-position="top">
                  <el-form-item label="映射类型">
                    <el-radio-group v-model="activeState.tunnelForm.type">
                      <el-radio-button label="local">本地转发</el-radio-button>
                      <el-radio-button label="remote">远程转发</el-radio-button>
                    </el-radio-group>
                  </el-form-item>
                  <template v-if="activeState.tunnelForm.type === 'local'">
                    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px]">
                      <el-form-item label="本地监听 Host"><el-input v-model="activeState.tunnelForm.localHost" /></el-form-item>
                      <el-form-item label="本地端口"><el-input-number v-model="activeState.tunnelForm.localPort" class="w-full" :min="1" :max="65535" controls-position="right" /></el-form-item>
                    </div>
                    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px]">
                      <el-form-item label="远程目标 Host"><el-input v-model="activeState.tunnelForm.remoteHost" /></el-form-item>
                      <el-form-item label="远程目标端口"><el-input-number v-model="activeState.tunnelForm.remotePort" class="w-full" :min="1" :max="65535" controls-position="right" /></el-form-item>
                    </div>
                  </template>
                  <template v-else>
                    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px]">
                      <el-form-item label="远程监听 Host"><el-input v-model="activeState.tunnelForm.bindHost" /></el-form-item>
                      <el-form-item label="远程端口"><el-input-number v-model="activeState.tunnelForm.bindPort" class="w-full" :min="1" :max="65535" controls-position="right" /></el-form-item>
                    </div>
                    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px]">
                      <el-form-item label="本地目标 Host"><el-input v-model="activeState.tunnelForm.localHost" /></el-form-item>
                      <el-form-item label="本地目标端口"><el-input-number v-model="activeState.tunnelForm.localPort" class="w-full" :min="1" :max="65535" controls-position="right" /></el-form-item>
                    </div>
                  </template>
                  <el-button :icon="SwitchButton" type="primary" :loading="activeState.startingTunnel" @click="startTunnel">启动映射</el-button>
                </el-form>
              </section>
              <section>
                <el-table :data="activeTunnels" border height="520">
                  <el-table-column label="类型" width="100">
                    <template #default="{ row }">{{ row.type === 'local' ? '本地转发' : '远程转发' }}</template>
                  </el-table-column>
                  <el-table-column label="监听" min-width="190">
                    <template #default="{ row }">{{ row.type === 'local' ? `${row.localHost}:${row.localPort}` : `${row.bindHost}:${row.bindPort}` }}</template>
                  </el-table-column>
                  <el-table-column label="目标" min-width="190">
                    <template #default="{ row }">{{ row.type === 'local' ? `${row.remoteHost}:${row.remotePort}` : `${row.localHost}:${row.localPort}` }}</template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="100" />
                  <el-table-column prop="error" label="最近错误" min-width="180" />
                  <el-table-column label="操作" width="110" fixed="right">
                    <template #default="{ row }"><el-button size="small" text type="danger" @click="stopTunnel(row)">停止</el-button></template>
                  </el-table-column>
                </el-table>
              </section>
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>

      <el-dialog v-model="connectionDialogVisible" title="SSH 配置管理" width="70vw" top="8vh" class="ssh-config-dialog" :close-on-click-modal="false">
        <div class="connection-dialog-head">
          <div>
            <h2>配置文件树</h2>
            <p>左侧管理文件夹与连接，右侧编辑当前选中的配置。</p>
          </div>
          <div class="flex gap-2">
            <el-button :icon="FolderAdd" plain @click="newFolderDraft(null)">新建文件夹</el-button>
            <el-button :icon="Plus" type="primary" @click="newProfileDraft(null)">新增连接</el-button>
          </div>
        </div>

        <div class="config-manager">
          <div class="config-tree-wrapper">
            <aside class="config-tree">
              <button
                class="tree-node"
                :class="[selectedTreeType === 'root' ? 'is-active' : '', dragOverTarget === 'root' ? 'drag-over' : '']"
                @click="selectRootNode"
                @dragover.prevent="onTreeDragOver($event, { type: 'root', id: '', key: 'root' })"
                @dragleave="onTreeDragLeave"
                @drop.prevent="onTreeDrop($event, { type: 'root', id: '', key: 'root' })"
              >
                <span class="tree-spacer"></span>
                <el-icon><Folder /></el-icon>
                <span class="truncate">全部连接</span>
              </button>
              <button
                v-for="node in visibleTreeNodes"
                :key="node.key"
                class="tree-node"
                :class="[node.key === selectedNodeKey ? 'is-active' : '', dragOverTarget === node.key ? 'drag-over' : '', dragInsertPos === node.key + ':before' ? 'drag-insert-before' : '', dragInsertPos === node.key + ':after' ? 'drag-insert-after' : '']"
                :style="{ paddingLeft: `${10 + node.depth * 18}px` }"
                draggable="true"
                @click="selectTreeNode(node)"
                @dragstart="onTreeDragStart($event, node)"
                @dragend="onTreeDragEnd"
                @dragover.prevent="onTreeDragOver($event, node)"
                @dragleave="onTreeDragLeave"
                @drop.prevent="onTreeDrop($event, node)"
              >
                <span class="tree-expander" @click.stop="node.type === 'folder' ? toggleFolder(node.id) : null">
                  <el-icon v-if="node.type === 'folder'" :class="isFolderExpanded(node.id) ? 'rotate-90' : ''"><ArrowRight /></el-icon>
                </span>
                <el-icon><Folder v-if="node.type === 'folder'" /><Monitor v-else /></el-icon>
                <span class="truncate">{{ node.name }}</span>
                <small v-if="node.type === 'profile'" class="truncate">{{ node.username }}@{{ node.host }}</small>
              </button>
              <el-empty v-if="folders.length === 0 && profiles.length === 0" description="暂无配置" />
            </aside>
          </div>

          <div class="config-editor-wrapper">
            <section class="config-editor">
            <div class="config-editor-head">
              <div>
                <h3>{{ editorTitle }}</h3>
                <p>{{ editorHint }}</p>
              </div>
              <div class="flex gap-2">
                <el-button v-if="selectedTreeType === 'profile' && profileForm.id" :loading="connectingId === profileForm.id" @click="connectFromDialog(profileForm.id)">连接</el-button>
                <el-button v-if="selectedTreeType === 'folder' && folderForm.id" type="danger" plain @click="deleteSelectedFolder">删除文件夹</el-button>
                <el-button v-if="selectedTreeType === 'profile' && profileForm.id" type="danger" plain @click="deleteProfile">删除连接</el-button>
              </div>
            </div>

            <div v-if="selectedTreeType === 'root'" class="config-empty-editor">
              <div class="config-empty-icon"><el-icon><Folder /></el-icon></div>
              <h3>全部连接</h3>
              <p>从左侧选择一个文件夹或连接进行编辑，也可以在根目录下新建配置。</p>
              <div class="flex justify-center gap-2">
                <el-button :icon="FolderAdd" plain @click="newFolderDraft('')">新建文件夹</el-button>
                <el-button :icon="Plus" type="primary" @click="newProfileDraft('')">新增连接</el-button>
              </div>
            </div>

            <el-form v-else-if="selectedTreeType === 'folder'" class="ssh-edit-form" label-position="top">
              <div class="form-section">
                <div class="form-section-title">文件夹</div>
                <el-form-item label="名称"><el-input v-model="folderForm.name" placeholder="文件夹名称" /></el-form-item>
                <el-form-item label="上级文件夹">
                  <el-select v-model="folderForm.parentId" clearable placeholder="全部连接">
                    <el-option label="全部连接" value="" />
                    <el-option
                      v-for="folder in folderParentOptions"
                      :key="folder.id"
                      :label="`${'　'.repeat(folder.depth)}${folder.name}`"
                      :value="folder.id"
                    />
                  </el-select>
                </el-form-item>
              </div>
              <div class="flex justify-end gap-2">
                <el-button :icon="FolderAdd" plain @click="newFolderDraft(null)">新建子文件夹</el-button>
                <el-button type="primary" :loading="saving" @click="saveFolderDraft">保存文件夹</el-button>
              </div>
            </el-form>

            <el-form v-else class="ssh-edit-form" label-position="top">
              <div class="form-section">
                <div class="form-section-title">基础信息</div>
                <el-form-item label="名称"><el-input v-model="profileForm.name" placeholder="生产机 / 测试机" /></el-form-item>
                <el-form-item label="所属文件夹">
                  <el-select v-model="profileForm.folderId" clearable placeholder="全部连接">
                    <el-option label="全部连接" value="" />
                    <el-option
                      v-for="folder in flattenedFolders"
                      :key="folder.id"
                      :label="`${'　'.repeat(folder.depth)}${folder.name}`"
                      :value="folder.id"
                    />
                  </el-select>
                </el-form-item>
                <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
                  <el-form-item label="Host"><el-input v-model="profileForm.host" placeholder="127.0.0.1" /></el-form-item>
                  <el-form-item label="Port"><el-input-number v-model="profileForm.port" class="w-full" :min="1" :max="65535" controls-position="right" /></el-form-item>
                </div>
                <el-form-item label="用户名"><el-input v-model="profileForm.username" placeholder="root" /></el-form-item>
              </div>
              <div class="form-section">
                <div class="form-section-title">认证方式</div>
                <el-form-item label="密码"><el-input v-model="profileForm.password" show-password placeholder="留空则保留已保存密码" /></el-form-item>
                <el-form-item label="私钥路径">
                  <el-input v-model="profileForm.privateKeyPath" placeholder="可选">
                    <template #append><el-button @click="choosePrivateKey">选择</el-button></template>
                  </el-input>
                </el-form-item>
                <el-form-item label="私钥口令"><el-input v-model="profileForm.passphrase" show-password placeholder="留空则保留已保存口令" /></el-form-item>
              </div>
              <div class="form-section">
                <div class="form-section-title">连接参数</div>
                <el-form-item label="Keepalive 间隔(ms)">
                  <el-input-number v-model="profileForm.keepaliveInterval" class="w-full" :min="0" :max="120000" :step="1000" controls-position="right" />
                </el-form-item>
              </div>
              <div class="flex justify-end gap-2">
                <el-button :icon="Plus" plain @click="newProfileDraft(null)">新建连接</el-button>
                <el-button :loading="saving" @click="saveProfile">保存连接</el-button>
                <el-button type="primary" :loading="connecting" @click="saveAndConnect">保存并连接</el-button>
              </div>
            </el-form>
            </section>
          </div>
        </div>
      </el-dialog>

      <!-- 传输进度浮动面板 -->
      <div v-if="transferQueue.length > 0" class="transfer-panel">
        <div class="transfer-panel-header" @click="transferPanelExpanded = !transferPanelExpanded">
          <div class="flex items-center gap-2">
            <el-icon><SwitchButton /></el-icon>
            <span class="font-semibold">传输列表</span>
            <span class="transfer-badge">{{ transferQueue.filter(t => t.status === 'running' || t.status === 'pending').length }}</span>
          </div>
          <div class="flex items-center gap-2">
            <el-button v-if="transferQueue.some(t => t.status === 'done' || t.status === 'error')" text size="small" @click.stop="clearFinishedTransfers">清除已完成</el-button>
            <el-icon :class="transferPanelExpanded ? 'rotate-180' : ''" class="transfer-chevron"><ArrowRight /></el-icon>
          </div>
        </div>
        <div v-show="transferPanelExpanded" class="transfer-panel-body">
          <div v-for="task in transferQueue" :key="task.id" class="transfer-item">
            <div class="transfer-item-head">
              <el-icon :class="task.type === 'upload' ? 'text-blue-500' : 'text-green-500'">
                <Upload v-if="task.type === 'upload'" /><Download v-else />
              </el-icon>
              <span class="transfer-filename">{{ task.filename }}</span>
              <span class="transfer-status" :class="'is-' + task.status">
                {{ task.status === 'pending' ? '等待中' : task.status === 'running' ? '传输中' : task.status === 'done' ? '完成' : '失败' }}
              </span>
            </div>
            <el-progress
              v-if="task.status === 'running' || task.status === 'done'"
              :percentage="task.total > 0 ? Math.min(100, Math.round(task.transferred / task.total * 100)) : 0"
              :stroke-width="4"
              :status="task.status === 'done' ? 'success' : task.status === 'error' ? 'exception' : ''"
            />
            <div v-if="task.status === 'running' && task.total > 0" class="transfer-size-info">
              {{ formatBytes(task.transferred) }} / {{ formatBytes(task.total) }}
            </div>
            <div v-if="task.error" class="transfer-error">{{ task.error }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { ArrowLeft, ArrowRight, Close, Delete, Document, Download, EditPen, Folder, FolderAdd, Monitor, Plus, Refresh, SwitchButton, Upload } from '@element-plus/icons-vue'
import { formatBytes } from '../utils/devTools'

const profiles = ref([])
const folders = ref([])
const tunnels = ref([])
const activeConnectionId = ref('')
const connectionDialogVisible = ref(false)
const selectedTreeType = ref('root')
const selectedTreeId = ref('')
const expandedFolderIds = ref(new Set())
const saving = ref(false)
const connecting = ref(false)
const connectingId = ref('')
const terminalHost = ref(null)
const sftpDropRef = ref(null)
const activeTerminal = ref(null)
const mountedTerminalKey = ref('')
const stateByProfile = reactive({})
const profileForm = reactive(defaultProfileForm())
const folderForm = reactive(defaultFolderForm())
const dragNode = ref(null)
const dragOverTarget = ref('')
const dragInsertPos = ref('')
const sftpDragOver = ref(false)
const transferQueue = ref([])
const transferPanelExpanded = ref(true)
let unsubscribeShellData = null
let unsubscribeTransferProgress = null
let unsubscribeSftpDrop = null

const connectedProfiles = computed(() => profiles.value.filter((profile) => profile.status === 'connected'))
const activeProfile = computed(() => profiles.value.find((profile) => profile.id === activeConnectionId.value) || null)
const activeState = computed(() => stateFor(activeConnectionId.value))
const activeTerminalTab = computed(() => activeState.value.terminals.find((tab) => tab.id === activeState.value.activeTerminalId) || null)
const activeTunnels = computed(() => tunnels.value.filter((tunnel) => tunnel.profileId === activeConnectionId.value))
const flattenedFolders = computed(() => flattenFolders())
const selectedNodeKey = computed(() => selectedTreeType.value === 'root' ? 'root' : `${selectedTreeType.value}:${selectedTreeId.value}`)
const visibleTreeNodes = computed(() => buildVisibleTreeNodes())
const folderParentOptions = computed(() => flattenedFolders.value.filter((folder) => folder.id !== folderForm.id && !isFolderDescendant(folder.id, folderForm.id)))
const editorTitle = computed(() => {
  if (selectedTreeType.value === 'root') return '全部连接'
  if (selectedTreeType.value === 'folder') return folderForm.id ? '编辑文件夹' : '新建文件夹'
  return profileForm.id ? '编辑连接' : '新增连接'
})
const editorHint = computed(() => {
  if (selectedTreeType.value === 'root') return '选择左侧节点后可在右侧编辑配置。'
  if (selectedTreeType.value === 'folder') return '文件夹用于对 SSH 配置进行分组，支持多级嵌套。'
  return '连接配置保存后可直接连接，并在连接页使用终端、SFTP 和端口映射。'
})

onMounted(async () => {
  unsubscribeShellData = window.electronAPI?.ssh?.onShellData?.((payload) => {
    const terminalKey = `${payload?.profileId || ''}:${payload?.shellId || ''}`
    if (terminalKey === mountedTerminalKey.value && activeTerminal.value) {
      activeTerminal.value.write(String(payload.data || ''))
    }
  })
  unsubscribeTransferProgress = window.electronAPI?.ssh?.onTransferProgress?.((payload) => {
    const task = transferQueue.value.find((t) => t.id === payload.transferId)
    if (task) {
      task.transferred = payload.transferred || 0
      task.total = payload.total || task.total
    }
  })
  unsubscribeSftpDrop = setupSftpDropListeners()
  await refreshAll()
})

onBeforeUnmount(() => {
  unsubscribeShellData?.()
  unsubscribeTransferProgress?.()
  unsubscribeSftpDrop?.()
  disposeTerminal()
})

watch([activeConnectionId, () => activeState.value.workTab, () => activeState.value.activeTerminalId], async () => {
  if (activeState.value.workTab === 'terminal') await mountTerminal()
  else disposeTerminal()
})

function defaultProfileForm() {
  return { id: '', name: '', folderId: '', host: '', port: 22, username: '', password: '', privateKeyPath: '', passphrase: '', keepaliveInterval: 15000 }
}

function defaultFolderForm() {
  return { id: '', name: '', parentId: '' }
}

function defaultConnectionState() {
  const firstId = createLocalTerminalId()
  return {
    workTab: 'terminal',
    remotePath: '',
    remoteFiles: [],
    loadingDir: false,
    startingTunnel: false,
    terminals: [{ id: firstId, shellId: '', title: '终端 1' }],
    activeTerminalId: firstId,
    terminalSeq: 1,
    tunnelForm: {
      type: 'local',
      localHost: '127.0.0.1',
      localPort: 3307,
      remoteHost: '127.0.0.1',
      remotePort: 3306,
      bindHost: '127.0.0.1',
      bindPort: 18080,
    },
  }
}

function createLocalTerminalId() {
  return `local-terminal-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function stateFor(profileId) {
  if (!profileId) return defaultConnectionState()
  if (!stateByProfile[profileId]) stateByProfile[profileId] = defaultConnectionState()
  return stateByProfile[profileId]
}

async function callSsh(action, ...args) {
  const fn = window.electronAPI?.ssh?.[action]
  if (!fn) return { ok: false, error: 'SSH API 不可用，请在 Electron 中运行' }
  return await fn(...args)
}

async function refreshAll() {
  const response = await callSsh('listSessions')
  if (!response?.ok) {
    ElMessage.error(response?.error || '读取 SSH 状态失败')
    return
  }
  profiles.value = response.data.profiles || []
  folders.value = response.data.folders || []
  tunnels.value = response.data.tunnels || []
  if (selectedTreeType.value === 'folder' && selectedTreeId.value && !folders.value.some((folder) => folder.id === selectedTreeId.value)) selectRootNode()
  if (selectedTreeType.value === 'profile' && selectedTreeId.value && !profiles.value.some((profile) => profile.id === selectedTreeId.value)) selectRootNode()
  if (!connectedProfiles.value.some((profile) => profile.id === activeConnectionId.value)) {
    activeConnectionId.value = connectedProfiles.value[0]?.id || ''
  }
  if (activeConnectionId.value && activeState.value.workTab === 'terminal') await mountTerminal()
}

function activateConnection(profileId) {
  activeConnectionId.value = profileId
}

function openConnectionDialog(profile = null) {
  connectionDialogVisible.value = true
  if (profile?.id) selectProfileNode(profile.id)
  else if (!selectedTreeType.value) selectRootNode()
}

function applyProfileToForm(profile) {
  Object.assign(profileForm, {
    id: profile.id,
    name: profile.name,
    folderId: profile.folderId || '',
    host: profile.host,
    port: profile.port,
    username: profile.username,
    password: '',
    privateKeyPath: profile.privateKeyPath || '',
    passphrase: '',
    keepaliveInterval: profile.keepaliveInterval || 15000,
  })
}

function flattenFolders(parentId = '', depth = 0) {
  return folders.value
    .filter((folder) => (folder.parentId || '') === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .flatMap((folder) => [
      { ...folder, depth },
      ...flattenFolders(folder.id, depth + 1),
    ])
}

function sortByOrder(a, b) {
  const orderA = a.sortOrder ?? 0
  const orderB = b.sortOrder ?? 0
  if (orderA !== orderB) return orderA - orderB
  return a.name.localeCompare(b.name, 'zh-CN')
}

function buildVisibleTreeNodes(parentId = '', depth = 0) {
  const childFolders = folders.value
    .filter((folder) => (folder.parentId || '') === parentId)
    .sort(sortByOrder)
  const childProfiles = profiles.value
    .filter((profile) => (profile.folderId || '') === parentId)
    .sort(sortByOrder)
  const nodes = []
  childFolders.forEach((folder) => {
    nodes.push({ key: `folder:${folder.id}`, type: 'folder', id: folder.id, name: folder.name, depth })
    if (expandedFolderIds.value.has(folder.id)) nodes.push(...buildVisibleTreeNodes(folder.id, depth + 1))
  })
  childProfiles.forEach((profile) => {
    nodes.push({
      key: `profile:${profile.id}`,
      type: 'profile',
      id: profile.id,
      name: profile.name,
      username: profile.username,
      host: profile.host,
      depth,
    })
  })
  return nodes
}

function isFolderDescendant(candidateId, targetId) {
  if (!candidateId || !targetId) return false
  let cursor = folders.value.find((folder) => folder.id === candidateId)
  while (cursor) {
    if ((cursor.parentId || '') === targetId) return true
    cursor = folders.value.find((folder) => folder.id === cursor.parentId)
  }
  return false
}

/** 拖拽开始：记录正在拖拽的节点 */
function onTreeDragStart(event, node) {
  dragNode.value = node
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', node.key)
}

/** 拖拽结束：清除所有拖拽状态 */
function onTreeDragEnd() {
  dragNode.value = null
  dragOverTarget.value = ''
  dragInsertPos.value = ''
}

/** 拖拽经过目标节点：判断放置位置（进入文件夹 / 排在前后） */
function onTreeDragOver(event, targetNode) {
  if (!dragNode.value) return
  if (dragNode.value.key === targetNode.key) return

  const rect = event.currentTarget.getBoundingClientRect()
  const offsetY = event.clientY - rect.top
  const height = rect.height

  if (targetNode.type === 'folder' || targetNode.type === 'root') {
    if (offsetY < height * 0.25 && targetNode.type !== 'root') {
      dragOverTarget.value = ''
      dragInsertPos.value = targetNode.key + ':before'
    } else if (offsetY > height * 0.75 && targetNode.type !== 'root') {
      dragOverTarget.value = ''
      dragInsertPos.value = targetNode.key + ':after'
    } else {
      dragOverTarget.value = targetNode.key
      dragInsertPos.value = ''
    }
  } else {
    if (offsetY < height * 0.5) {
      dragOverTarget.value = ''
      dragInsertPos.value = targetNode.key + ':before'
    } else {
      dragOverTarget.value = ''
      dragInsertPos.value = targetNode.key + ':after'
    }
  }
  event.dataTransfer.dropEffect = 'move'
}

function onTreeDragLeave() {
  dragOverTarget.value = ''
  dragInsertPos.value = ''
}

/** 拖拽放下：调用后端完成节点移动 */
async function onTreeDrop(event, targetNode) {
  const source = dragNode.value
  const currentOverTarget = dragOverTarget.value
  const currentInsertPos = dragInsertPos.value
  onTreeDragEnd()
  if (!source) return
  if (source.key === targetNode.key) return

  let targetParentId = ''
  let afterId = ''
  let afterType = ''

  if (currentOverTarget === 'root' || (targetNode.type === 'root' && !currentInsertPos)) {
    targetParentId = ''
  } else if (currentOverTarget && targetNode.type === 'folder') {
    targetParentId = targetNode.id
  } else if (currentInsertPos) {
    if (targetNode.type === 'root') {
      targetParentId = ''
    } else {
      const parentId = targetNode.type === 'folder'
        ? (folders.value.find((f) => f.id === targetNode.id)?.parentId || '')
        : (profiles.value.find((p) => p.id === targetNode.id)?.folderId || '')
      targetParentId = parentId
    }
    if (currentInsertPos.endsWith(':after')) {
      afterId = targetNode.id
      afterType = targetNode.type
    }
  } else {
    targetParentId = targetNode.type === 'folder' ? targetNode.id : (profiles.value.find((p) => p.id === targetNode.id)?.folderId || '')
  }

  const response = await callSsh('moveNode', {
    type: source.type,
    id: source.id,
    targetParentId,
    afterId,
    afterType,
  })
  if (!response?.ok) {
    ElMessage.error(response?.error || '移动失败')
    return
  }
  await refreshAll()
}

function isFolderExpanded(folderId) {
  return expandedFolderIds.value.has(folderId)
}

function toggleFolder(folderId) {
  const next = new Set(expandedFolderIds.value)
  if (next.has(folderId)) next.delete(folderId)
  else next.add(folderId)
  expandedFolderIds.value = next
}

function expandAncestors(folderId) {
  const next = new Set(expandedFolderIds.value)
  let cursor = folders.value.find((folder) => folder.id === folderId)
  while (cursor) {
    next.add(cursor.id)
    cursor = folders.value.find((folder) => folder.id === cursor.parentId)
  }
  expandedFolderIds.value = next
}

function defaultParentFolderId() {
  if (selectedTreeType.value === 'folder' && folderForm.id) return folderForm.id
  if (selectedTreeType.value === 'profile') return profileForm.folderId || ''
  return ''
}

function selectRootNode() {
  selectedTreeType.value = 'root'
  selectedTreeId.value = ''
}

function selectFolderNode(folderId) {
  const folder = folders.value.find((item) => item.id === folderId)
  if (!folder) {
    selectRootNode()
    return
  }
  selectedTreeType.value = 'folder'
  selectedTreeId.value = folder.id
  Object.assign(folderForm, { id: folder.id, name: folder.name, parentId: folder.parentId || '' })
  expandAncestors(folder.parentId || '')
}

function selectProfileNode(profileId) {
  const profile = profiles.value.find((item) => item.id === profileId)
  if (!profile) {
    selectRootNode()
    return
  }
  selectedTreeType.value = 'profile'
  selectedTreeId.value = profile.id
  applyProfileToForm(profile)
  expandAncestors(profile.folderId || '')
}

function selectTreeNode(node) {
  if (node.type === 'folder') selectFolderNode(node.id)
  else selectProfileNode(node.id)
}

function newFolderDraft(parentId = null) {
  const resolvedParentId = parentId === null ? defaultParentFolderId() : parentId
  selectedTreeType.value = 'folder'
  selectedTreeId.value = ''
  Object.assign(folderForm, { ...defaultFolderForm(), parentId: resolvedParentId || '' })
  if (resolvedParentId) expandAncestors(resolvedParentId)
}

function newProfileDraft(folderId = null) {
  const resolvedFolderId = folderId === null ? defaultParentFolderId() : folderId
  selectedTreeType.value = 'profile'
  selectedTreeId.value = ''
  Object.assign(profileForm, { ...defaultProfileForm(), folderId: resolvedFolderId || '' })
  if (resolvedFolderId) expandAncestors(resolvedFolderId)
}

async function saveFolderDraft() {
  const payload = { ...folderForm, name: String(folderForm.name || '').trim(), parentId: folderForm.parentId || '' }
  if (!payload.name) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  saving.value = true
  try {
    const response = await callSsh('saveFolder', payload)
    if (!response?.ok) {
      ElMessage.error(response?.error || '保存文件夹失败')
      return
    }
    await refreshAll()
    selectFolderNode(response.data.id)
    ElMessage.success('文件夹已保存')
  } finally {
    saving.value = false
  }
}

async function deleteSelectedFolder() {
  if (!folderForm.id) return
  const confirmed = await ElMessageBox.confirm('仅空文件夹可以删除，确定继续？', '删除文件夹', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  const parentId = folders.value.find((folder) => folder.id === folderForm.id)?.parentId || ''
  const response = await callSsh('deleteFolder', folderForm.id)
  if (!response?.ok) {
    ElMessage.error(response?.error || '删除文件夹失败')
    return
  }
  await refreshAll()
  if (parentId) selectFolderNode(parentId)
  else selectRootNode()
  ElMessage.success('文件夹已删除')
}

async function choosePrivateKey() {
  const filePath = await window.electronAPI?.selectSshPrivateKey?.()
  if (filePath) profileForm.privateKeyPath = filePath
}

async function saveProfile() {
  saving.value = true
  try {
    const response = await callSsh('saveProfile', { ...profileForm })
    if (!response?.ok) {
      ElMessage.error(response?.error || '保存失败')
      return null
    }
    await refreshAll()
    applyProfileToForm(response.data)
    selectedTreeType.value = 'profile'
    selectedTreeId.value = response.data.id
    expandAncestors(response.data.folderId || '')
    ElMessage.success('SSH 连接已保存')
    return response.data
  } finally {
    saving.value = false
  }
}

async function saveAndConnect() {
  const profile = await saveProfile()
  if (!profile) return
  await connectProfile(profile.id)
  connectionDialogVisible.value = false
}

async function quickConnect(profileId) {
  await connectProfile(profileId)
}

async function connectFromDialog(profileId) {
  await connectProfile(profileId)
  connectionDialogVisible.value = false
}

async function connectProfile(profileId) {
  connecting.value = true
  connectingId.value = profileId
  try {
    const response = await callSsh('connect', profileId)
    if (!response?.ok) {
      ElMessage.error(response?.error || '连接失败')
      return
    }
    activeConnectionId.value = profileId
    stateFor(profileId)
    await refreshAll()
    ElMessage.success('SSH 已连接')
  } finally {
    connecting.value = false
    connectingId.value = ''
  }
}

async function disconnectConnection(profileId) {
  const response = await callSsh('disconnect', profileId)
  if (!response?.ok) {
    ElMessage.error(response?.error || '断开失败')
    return
  }
  if (mountedTerminalKey.value.startsWith(`${profileId}:`)) disposeTerminal()
  await refreshAll()
}

async function deleteProfile() {
  if (!profileForm.id) return
  const confirmed = await ElMessageBox.confirm('确定删除该 SSH 连接配置？', '删除连接', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  const response = await callSsh('deleteProfile', profileForm.id)
  if (!response?.ok) {
    ElMessage.error(response?.error || '删除失败')
    return
  }
  ElMessage.success('连接已删除')
  Object.assign(profileForm, defaultProfileForm())
  await refreshAll()
  selectRootNode()
}

async function onWorkTabChange() {
  if (activeState.value.workTab === 'sftp' && activeState.value.remoteFiles.length === 0) await loadRemoteDir()
}

function addTerminalTab() {
  const state = activeState.value
  state.terminalSeq += 1
  const id = createLocalTerminalId()
  state.terminals.push({ id, shellId: '', title: `终端 ${state.terminalSeq}` })
  state.activeTerminalId = id
}

function activateTerminal(id) {
  activeState.value.activeTerminalId = id
}

async function closeTerminalTab(id) {
  const state = activeState.value
  const target = state.terminals.find((tab) => tab.id === id)
  if (target?.shellId) await callSsh('stopShell', { profileId: activeConnectionId.value, shellId: target.shellId })
  const index = state.terminals.findIndex((tab) => tab.id === id)
  if (index >= 0) state.terminals.splice(index, 1)
  if (state.terminals.length === 0) {
    const nextId = createLocalTerminalId()
    state.terminals.push({ id: nextId, shellId: '', title: '终端 1' })
    state.terminalSeq = 1
  }
  if (state.activeTerminalId === id) state.activeTerminalId = state.terminals[Math.max(0, index - 1)]?.id || state.terminals[0].id
}

function disposeTerminal() {
  activeTerminal.value?.dispose()
  activeTerminal.value = null
  mountedTerminalKey.value = ''
}

async function mountTerminal() {
  const terminalTab = activeTerminalTab.value
  if (!activeConnectionId.value || !terminalTab || !terminalHost.value) return
  const targetKey = `${activeConnectionId.value}:${terminalTab.shellId || terminalTab.id}`
  if (mountedTerminalKey.value === targetKey && activeTerminal.value) return
  disposeTerminal()
  await nextTick()
  if (!terminalHost.value) return
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'Consolas, "Cascadia Mono", "Liberation Mono", monospace',
    fontSize: 13,
    rows: 28,
    cols: 110,
    theme: { background: '#0f172a', foreground: '#e5e7eb', cursor: '#f8fafc' },
  })
  terminal.open(terminalHost.value)
  terminal.focus()
  activeTerminal.value = terminal
  const response = await callSsh('startShell', { profileId: activeConnectionId.value, shellId: terminalTab.shellId, rows: 28, cols: 110 })
  if (!response?.ok) {
    terminal.write(`\r\n${response?.error || 'Shell 启动失败'}\r\n`)
    return
  }
  terminalTab.shellId = response.data.shellId
  mountedTerminalKey.value = `${activeConnectionId.value}:${terminalTab.shellId}`
  terminal.onData((data) => callSsh('writeShell', { profileId: activeConnectionId.value, shellId: terminalTab.shellId, data }))
  if (response.data?.buffer) terminal.write(response.data.buffer)
}

async function restartShell() {
  const tab = activeTerminalTab.value
  if (!activeConnectionId.value || !tab) return
  if (tab.shellId) await callSsh('stopShell', { profileId: activeConnectionId.value, shellId: tab.shellId })
  tab.shellId = ''
  disposeTerminal()
  await mountTerminal()
}

function clearTerminal() {
  activeTerminal.value?.clear()
}

function joinRemote(base, name) {
  const root = String(base || '/').replace(/\\/g, '/')
  if (root === '/') return `/${name}`
  return `${root.replace(/\/+$/g, '')}/${name}`
}

function parentRemote(value) {
  const normalized = String(value || '/').replace(/\\/g, '/').replace(/\/+$/g, '')
  if (!normalized || normalized === '/') return '/'
  const index = normalized.lastIndexOf('/')
  if (index <= 0) return '/'
  return normalized.slice(0, index)
}

async function loadRemoteDir() {
  if (!activeConnectionId.value) return
  activeState.value.loadingDir = true
  try {
    const response = await callSsh('listDir', {
      profileId: activeConnectionId.value,
      remotePath: activeState.value.remotePath || '.',
    })
    if (!response?.ok) {
      ElMessage.error(response?.error || '读取目录失败')
      return
    }
    activeState.value.remotePath = response.data.remotePath || activeState.value.remotePath || '/'
    activeState.value.remoteFiles = (response.data.items || []).filter((item) => !['.', '..'].includes(item.name))
  } finally {
    activeState.value.loadingDir = false
  }
}

async function enterDir(name) {
  activeState.value.remotePath = joinRemote(activeState.value.remotePath, name)
  await loadRemoteDir()
}

async function goUp() {
  activeState.value.remotePath = parentRemote(activeState.value.remotePath)
  await loadRemoteDir()
}

async function createRemoteDir() {
  const name = await ElMessageBox.prompt('输入目录名', '新建目录').catch(() => null)
  const dirName = String(name?.value || '').trim()
  if (!dirName) return
  const response = await callSsh('mkdir', { profileId: activeConnectionId.value, remotePath: joinRemote(activeState.value.remotePath, dirName) })
  if (!response?.ok) {
    ElMessage.error(response?.error || '创建目录失败')
    return
  }
  await loadRemoteDir()
}

async function uploadFile() {
  const localPath = await window.electronAPI?.selectSftpUploadFile?.()
  if (!localPath) return
  enqueueUpload(localPath)
}

/** 创建传输任务 ID */
function createTransferId() {
  return `transfer-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

/** 将上传任务加入队列并异步执行 */
function enqueueUpload(localPath) {
  const filename = localPath.split(/[\\/]/).pop()
  const transferId = createTransferId()
  const task = {
    id: transferId,
    type: 'upload',
    filename,
    localPath,
    remotePath: joinRemote(activeState.value.remotePath, filename),
    profileId: activeConnectionId.value,
    status: 'pending',
    transferred: 0,
    total: 0,
    error: '',
  }
  transferQueue.value.push(task)
  transferPanelExpanded.value = true
  executeTransferTask(task)
}

/** 将下载任务加入队列并异步执行 */
function enqueueDownload(row, localDir) {
  const remotePath = joinRemote(activeState.value.remotePath, row.name)
  const transferId = createTransferId()
  const task = {
    id: transferId,
    type: 'download',
    filename: row.name,
    remotePath,
    localDir,
    profileId: activeConnectionId.value,
    status: 'pending',
    transferred: 0,
    total: row.size || 0,
    error: '',
  }
  transferQueue.value.push(task)
  transferPanelExpanded.value = true
  executeTransferTask(task)
}

/** 执行传输任务 */
async function executeTransferTask(task) {
  task.status = 'running'
  try {
    if (task.type === 'upload') {
      const response = await callSsh('upload', {
        profileId: task.profileId,
        localPath: task.localPath,
        remotePath: task.remotePath,
        transferId: task.id,
      })
      if (!response?.ok) throw new Error(response?.error || '上传失败')
      task.total = response.data?.fileSize || task.total
      task.transferred = task.total
      task.status = 'done'
      if (activeConnectionId.value === task.profileId) await loadRemoteDir()
    } else {
      const response = await callSsh('download', {
        profileId: task.profileId,
        remotePath: task.remotePath,
        localDir: task.localDir,
        transferId: task.id,
      })
      if (!response?.ok) throw new Error(response?.error || '下载失败')
      task.total = response.data?.fileSize || task.total
      task.transferred = task.total
      task.status = 'done'
    }
  } catch (error) {
    task.status = 'error'
    task.error = error?.message || '传输失败'
  }
}

/** 清除已完成/失败的传输记录 */
function clearFinishedTransfers() {
  transferQueue.value = transferQueue.value.filter((t) => t.status === 'running' || t.status === 'pending')
}

/** 使用 window 级别事件监听拖拽上传，确保不被 el-table 内部拦截 */
function setupSftpDropListeners() {
  let dragCounter = 0

  const isSftpActive = () => {
    return activeConnectionId.value && activeState.value.workTab === 'sftp' && sftpDropRef.value
  }

  const onDragEnter = (e) => {
    if (!isSftpActive()) return
    if (!e.dataTransfer?.types?.includes('Files')) return
    dragCounter++
    sftpDragOver.value = true
  }

  const onDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
    if (!isSftpActive()) return
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDragLeave = (e) => {
    if (!isSftpActive()) return
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      sftpDragOver.value = false
    }
  }

  const onDrop = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
    if (!isSftpActive()) {
      dragCounter = 0
      sftpDragOver.value = false
      return
    }
    dragCounter = 0
    sftpDragOver.value = false
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const localPath = window.electronAPI?.getPathForFile?.(file) || file.path || ''
      if (!localPath) continue
      enqueueUpload(localPath)
    }
  }

  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)

  return () => {
    window.removeEventListener('dragenter', onDragEnter)
    window.removeEventListener('dragover', onDragOver)
    window.removeEventListener('dragleave', onDragLeave)
    window.removeEventListener('drop', onDrop)
  }
}

async function downloadFile(row) {
  const localDir = await window.electronAPI?.selectOutputDirectory?.()
  if (!localDir) return
  enqueueDownload(row, localDir)
}

async function renameRemote(row) {
  const result = await ElMessageBox.prompt('输入新名称', '重命名', { inputValue: row.name }).catch(() => null)
  const nextName = String(result?.value || '').trim()
  if (!nextName || nextName === row.name) return
  const response = await callSsh('rename', {
    profileId: activeConnectionId.value,
    from: joinRemote(activeState.value.remotePath, row.name),
    to: joinRemote(activeState.value.remotePath, nextName),
  })
  if (!response?.ok) {
    ElMessage.error(response?.error || '重命名失败')
    return
  }
  await loadRemoteDir()
}

async function deleteRemote(row) {
  const confirmed = await ElMessageBox.confirm(`确定删除 ${row.name}？目录仅支持删除空目录。`, '删除远程文件', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  const response = await callSsh('delete', { profileId: activeConnectionId.value, remotePath: joinRemote(activeState.value.remotePath, row.name) })
  if (!response?.ok) {
    ElMessage.error(response?.error || '删除失败')
    return
  }
  await loadRemoteDir()
}

async function startTunnel() {
  activeState.value.startingTunnel = true
  try {
    const response = await callSsh('startTunnel', { ...activeState.value.tunnelForm, profileId: activeConnectionId.value })
    if (!response?.ok) {
      ElMessage.error(response?.error || '启动映射失败')
      return
    }
    await refreshAll()
  } finally {
    activeState.value.startingTunnel = false
  }
}

async function stopTunnel(row) {
  const response = await callSsh('stopTunnel', row.id)
  if (!response?.ok) {
    ElMessage.error(response?.error || '停止映射失败')
    return
  }
  await refreshAll()
}

function formatMtime(value) {
  if (!value) return '-'
  return new Date(Number(value) * 1000).toLocaleString()
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}
</script>

<style scoped>
.shadow-soft { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.ssh-tabs :deep(.el-tabs__content) { overflow: visible; }
.ssh-session-bar {
  border: 1px solid rgba(203, 213, 225, 0.72);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92)),
    radial-gradient(circle at 12% 0%, rgba(20,184,166,0.10), transparent 34%);
  padding: 12px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(16px);
}
.connection-tab {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 28px;
  gap: 0 9px;
  min-width: 180px;
  max-width: 260px;
  border: 1px solid rgba(203, 213, 225, 0.86);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  padding: 9px 8px 9px 12px;
  text-align: left;
  color: #334155;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease, background .16s ease;
}
.connection-tab small { grid-column: 2; color: #64748b; font-size: 12px; }
.connection-tab .session-close { grid-column: 3; grid-row: 1 / span 2; align-self: center; opacity: .65; }
.session-status-dot {
  grid-column: 1;
  grid-row: 1 / span 2;
  align-self: center;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.13);
}
.connection-tab:hover,
.connection-tab.is-active {
  border-color: rgba(37, 99, 235, 0.55);
  background: linear-gradient(135deg, #ffffff, #eff6ff);
  box-shadow: 0 16px 30px rgba(37, 99, 235, 0.11);
  transform: translateY(-1px);
}
.session-add {
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.20);
}
.history-card,
.saved-profile {
  display: grid;
  gap: 10px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96));
  padding: 15px;
  text-align: left;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.saved-profile {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}
.history-card:hover,
.saved-profile:hover {
  border-color: rgba(37, 99, 235, 0.36);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}
.profile-card-head {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}
.profile-card-head strong {
  display: block;
  color: #0f172a;
  font-size: 14px;
}
.profile-card-head small,
.profile-meta {
  display: block;
  color: #64748b;
  font-size: 12px;
}
.server-mark {
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background:
    linear-gradient(135deg, #1e293b, #2563eb);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 10px 20px rgba(37,99,235,.14);
  flex: 0 0 auto;
  position: relative;
}
.server-mark::after {
  content: "";
  position: absolute;
  left: 9px;
  right: 9px;
  top: 10px;
  height: 2px;
  border-radius: 999px;
  background: rgba(255,255,255,.72);
  box-shadow: 0 6px 0 rgba(255,255,255,.52);
}
.connection-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
  border-radius: 16px;
  border: 1px solid rgba(226,232,240,.82);
  background: linear-gradient(135deg, #f8fafc, #ffffff);
  padding: 14px;
}
.connection-dialog-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}
.connection-dialog-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}
.config-manager {
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr);
  gap: 14px;
  height: calc(84vh - 160px);
  min-height: 300px;
}
.config-tree-wrapper {
  overflow-y: auto;
  border-radius: 18px;
}
.config-tree {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 100%;
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.94)),
    radial-gradient(circle at 20% 0%, rgba(37,99,235,.08), transparent 34%);
  padding: 10px;
}
.tree-node {
  display: grid;
  grid-template-columns: 22px 20px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 38px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: #334155;
  font-size: 13px;
  text-align: left;
  transition: background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease;
}
.tree-node small {
  grid-column: 3;
  margin-top: -4px;
  color: #94a3b8;
  font-size: 11px;
}
.tree-node:hover,
.tree-node.is-active {
  border-color: rgba(37,99,235,.24);
  background: rgba(239,246,255,.86);
  color: #1d4ed8;
  box-shadow: 0 8px 18px rgba(37,99,235,.08);
  transform: translateX(1px);
}
.tree-node.drag-over {
  border-color: rgba(37,99,235,.7);
  background: rgba(219,234,254,.6);
  box-shadow: 0 0 0 2px rgba(37,99,235,.22);
}
.tree-node.drag-insert-before {
  border-top: 2px solid #2563eb;
}
.tree-node.drag-insert-after {
  border-bottom: 2px solid #2563eb;
}
.tree-node[draggable="true"] {
  cursor: grab;
}
.tree-node[draggable="true"]:active {
  cursor: grabbing;
  opacity: 0.6;
}
.tree-expander,
.tree-spacer {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
}
.tree-expander :deep(.el-icon) {
  transition: transform .16s ease;
}
.config-editor-wrapper {
  overflow-y: auto;
  border-radius: 18px;
}
.config-editor {
  min-width: 0;
  min-height: 100%;
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 18px;
  background: #ffffff;
  padding: 14px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
}
.config-editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f8fafc, #ffffff);
  padding: 12px;
}
.config-editor-head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}
.config-editor-head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}
.config-empty-editor {
  display: grid;
  min-height: 420px;
  align-content: center;
  justify-items: center;
  gap: 10px;
  border: 1px dashed rgba(148,163,184,.55);
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  padding: 24px;
  text-align: center;
}
.config-empty-editor h3 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}
.config-empty-editor p {
  max-width: 360px;
  margin: 0 0 4px;
  color: #64748b;
  font-size: 13px;
}
.config-empty-icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 16px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 24px;
}
.folder-browser {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 14px;
  min-height: 480px;
}
.folder-sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  padding: 8px;
}
.folder-node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  border-radius: 10px;
  color: #475569;
  font-size: 13px;
  text-align: left;
  transition: background .16s ease, color .16s ease, transform .16s ease;
}
.folder-node:hover,
.folder-node.is-active {
  background: #eff6ff;
  color: #1d4ed8;
}
.folder-node:hover { transform: translateX(1px); }
.folder-content {
  min-width: 0;
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 16px;
  background: #ffffff;
  padding: 12px;
}
.folder-content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: #f8fafc;
  padding: 10px 12px;
}
.folder-card {
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid rgba(226,232,240,.92);
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  padding: 14px;
  text-align: left;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.folder-card:hover {
  border-color: rgba(37, 99, 235, 0.32);
  box-shadow: 0 14px 28px rgba(15,23,42,.07);
  transform: translateY(-2px);
}
.folder-card strong {
  display: block;
  color: #0f172a;
  font-size: 14px;
}
.folder-card small {
  color: #64748b;
  font-size: 12px;
}
.folder-card-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 12px;
  background: #eff6ff;
  color: #2563eb;
  flex: 0 0 auto;
}
.terminal-window-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
  border: 1px solid rgba(226,232,240,.86);
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  padding: 8px;
}
.terminal-window-tab {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 7px;
  min-width: 118px;
  max-width: 180px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  padding: 7px 5px 7px 10px;
  color: #334155;
  font-size: 13px;
  transition: background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease;
}
.terminal-window-tab.is-active,
.terminal-window-tab:hover {
  border-color: rgba(148,163,184,.42);
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15,23,42,.05);
  transform: translateY(-1px);
}
.terminal-tab-glyph {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #94a3b8;
}
.terminal-window-tab.is-active .terminal-tab-glyph {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34,197,94,.12);
}
.terminal-close { opacity: .55; }
.terminal-add {
  border-style: dashed;
  background: rgba(239,246,255,.72);
}
.terminal-frame {
  overflow: hidden;
  border: 1px solid rgba(30, 41, 59, 0.86);
  border-radius: 16px;
  background: #0f172a;
  box-shadow: 0 22px 46px rgba(15, 23, 42, 0.18);
}
.terminal-frame-chrome {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, #172033, #111827);
  padding: 0 12px;
}
.terminal-frame-chrome span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}
.terminal-frame-chrome span:nth-child(1) { background: #fb7185; }
.terminal-frame-chrome span:nth-child(2) { background: #facc15; }
.terminal-frame-chrome span:nth-child(3) { background: #34d399; }
.terminal-frame-chrome strong {
  margin-left: 8px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
}
.terminal-host {
  min-height: 520px;
  overflow: hidden;
  background: #0f172a;
  padding: 10px;
}
.ssh-edit-form {
  display: grid;
  gap: 12px;
}
.form-section {
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  padding: 14px 14px 2px;
}
.form-section-title {
  margin-bottom: 10px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}
.ssh-edit-form :deep(.el-form-item__label) {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
.ssh-edit-form :deep(.el-input__wrapper),
.ssh-edit-form :deep(.el-input-number .el-input__wrapper) {
  border-radius: 10px;
  box-shadow: 0 0 0 1px rgba(203,213,225,.82) inset;
}
.file-name {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 8px;
  color: #334155;
}
.file-name:hover { color: #2563eb; }
.sftp-drop-zone {
  position: relative;
  border: 2px solid transparent;
  border-radius: 12px;
  transition: border-color .2s ease, background .2s ease;
}
.sftp-drop-zone.is-drag-over {
  border-color: #2563eb;
  background: rgba(219, 234, 254, 0.3);
}
.sftp-drop-hint {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  background: rgba(239, 246, 255, 0.92);
  color: #2563eb;
  font-size: 15px;
  font-weight: 600;
  pointer-events: none;
}
.transfer-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2000;
  width: 360px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.14);
  overflow: hidden;
}
.transfer-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(135deg, #f8fafc, #ffffff);
  border-bottom: 1px solid rgba(226,232,240,.7);
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: #334155;
}
.transfer-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #2563eb;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}
.transfer-chevron {
  transition: transform .2s ease;
}
.transfer-panel-body {
  overflow-y: auto;
  max-height: 320px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.transfer-item {
  padding: 8px 10px;
  border: 1px solid rgba(226,232,240,.7);
  border-radius: 10px;
  background: #f8fafc;
}
.transfer-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.transfer-filename {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #334155;
  font-weight: 500;
}
.transfer-status {
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.transfer-status.is-pending { color: #94a3b8; }
.transfer-status.is-running { color: #2563eb; }
.transfer-status.is-done { color: #16a34a; }
.transfer-status.is-error { color: #dc2626; }
.transfer-size-info {
  margin-top: 2px;
  font-size: 11px;
  color: #64748b;
}
.transfer-error {
  margin-top: 2px;
  font-size: 11px;
  color: #dc2626;
}
</style>

<style>
.ssh-config-dialog {
  max-width: 1200px;
  min-width: 720px;
  margin: 0 auto;
}
.ssh-config-dialog .el-dialog__body {
  overflow: hidden;
  padding: 16px 20px;
}
</style>
