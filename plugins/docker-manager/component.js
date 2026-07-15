;(function(ctx, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig) {

var Plus = Icons.Plus
var Refresh = Icons.Refresh
var Delete = Icons.Delete
var ArrowDown = Icons.ArrowDown
var ArrowLeft = Icons.ArrowLeft
var ArrowRight = Icons.ArrowRight
var Document = Icons.Document
var Download = Icons.Download
var Edit = Icons.Edit
var EditPen = Icons.EditPen
var Folder = Icons.Folder
var FolderAdd = Icons.FolderAdd
var Monitor = Icons.Monitor
var Search = Icons.Search
var Upload = Icons.Upload
var Warning = Icons.Warning

function showMessage(msg, type) {
  type = type || 'info'
  var inst = Vue.getCurrentInstance()
  if (inst) inst.appContext.config.globalProperties.$message({ message: msg, type: type })
}

function showConfirm(msg, title, opts) {
  var inst = Vue.getCurrentInstance()
  if (!inst) return Promise.reject()
  return inst.appContext.config.globalProperties.$confirm(msg, title, opts)
}

function showPrompt(msg, title, opts) {
  var inst = Vue.getCurrentInstance()
  if (!inst) return Promise.reject()
  return inst.appContext.config.globalProperties.$prompt(msg, title, opts)
}

ctx.exports = {
  props: {
    profileId: { type: String, default: '' },
    exec: { type: Function, required: true },
    callSsh: { type: Function, default: null },
  },
  components: {
    Plus: Plus, Refresh: Refresh, Delete: Delete, ArrowDown: ArrowDown, ArrowLeft: ArrowLeft,
    ArrowRight: ArrowRight, Document: Document, Download: Download, Edit: Edit, EditPen: EditPen,
    Folder: Folder, FolderAdd: FolderAdd, Monitor: Monitor, Search: Search, Upload: Upload, Warning: Warning,
  },
  template: '<div class="docker-manager">\
    <div v-if="!checkDone" class="text-center py-10 text-gray-400">\
      <el-icon class="is-loading" size="24"><Refresh /></el-icon>\
      <p class="mt-2">检测 Docker 状态...</p>\
    </div>\
    <div v-if="checkDone && !installed" class="docker-not-installed">\
      <template v-if="!installing">\
        <div class="text-center py-8">\
          <el-icon size="48" class="text-gray-300 mb-3"><Warning /></el-icon>\
          <p class="text-gray-500 mb-4">未检测到 Docker，是否自动安装？</p>\
          <div class="install-options mx-auto" style="max-width: 360px; text-align: left;">\
            <el-form label-position="left" label-width="80px" size="small" class="mb-4">\
              <el-form-item label="镜像源">\
                <el-select v-model="installMirror" class="w-full">\
                  <el-option label="阿里云（推荐）" value="https://mirrors.aliyun.com/docker-ce" />\
                  <el-option label="Azure 中国" value="https://mirror.azure.cn/docker-ce" />\
                  <el-option label="官方" value="https://download.docker.com" />\
                </el-select>\
              </el-form-item>\
              <el-form-item label="频道">\
                <el-radio-group v-model="installChannel">\
                  <el-radio value="stable">Stable</el-radio>\
                  <el-radio value="test">Test</el-radio>\
                </el-radio-group>\
              </el-form-item>\
            </el-form>\
            <div class="text-center">\
              <el-button type="primary" @click="startInstall">开始安装</el-button>\
            </div>\
          </div>\
        </div>\
      </template>\
      <template v-else>\
        <div class="install-log-panel">\
          <div class="flex items-center gap-2 mb-2">\
            <span class="text-sm font-semibold">安装进度</span>\
            <el-tag :type="installStatus === \'done\' ? \'success\' : installStatus === \'error\' ? \'danger\' : \'warning\'" size="small">{{ installStatusText }}</el-tag>\
          </div>\
          <div ref="installLogRef" class="install-log"><pre>{{ installLog }}</pre></div>\
          <div v-if="installStatus === \'done\'" class="mt-2">\
            <el-button type="primary" size="small" @click="recheckDocker">完成，刷新状态</el-button>\
          </div>\
        </div>\
      </template>\
    </div>\
    <template v-if="checkDone && installed">\
      <div class="flex items-center gap-3 mb-3 flex-wrap">\
        <el-tag type="success" effect="dark">Docker {{ dockerVersion }}</el-tag>\
        <el-tag v-if="composeVersion" effect="plain">Compose {{ composeVersion }}</el-tag>\
        <div class="flex-1"></div>\
        <el-button size="small" :icon="RefreshIcon" @click="refreshCurrent" :loading="refreshing">刷新</el-button>\
      </div>\
      <el-tabs v-model="subTab" class="mgr-tabs">\
        <el-tab-pane label="容器" name="containers">\
          <div class="flex gap-2 mb-2 items-center flex-wrap">\
            <el-select v-model="containerFilter" size="small" class="w-[120px]">\
              <el-option label="全部" value="all" />\
              <el-option label="运行中" value="running" />\
              <el-option label="已停止" value="exited" />\
            </el-select>\
            <el-input v-model="containerSearch" size="small" placeholder="搜索名称/镜像" clearable class="w-[200px]" />\
          </div>\
          <el-table :data="filteredContainers" border size="small" max-height="400" row-key="id">\
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />\
            <el-table-column prop="image" label="镜像" min-width="160" show-overflow-tooltip />\
            <el-table-column label="状态" width="100">\
              <template #default="{ row }">\
                <el-tag size="small" :type="row.state === \'running\' ? \'success\' : row.state === \'paused\' ? \'warning\' : \'info\'">{{ row.state }}</el-tag>\
              </template>\
            </el-table-column>\
            <el-table-column prop="ports" label="端口" min-width="140" show-overflow-tooltip />\
            <el-table-column label="操作" width="200" align="center">\
              <template #default="{ row }">\
                <el-button size="small" text type="success" v-if="row.state !== \'running\'" @click="containerDo(row.id, \'start\')">启动</el-button>\
                <el-button size="small" text type="warning" v-if="row.state === \'running\'" @click="containerDo(row.id, \'stop\')">停止</el-button>\
                <el-button size="small" text type="primary" v-if="row.state === \'running\'" @click="containerDo(row.id, \'restart\')">重启</el-button>\
                <el-dropdown trigger="click" @command="function(cmd) { handleContainerCmd(cmd, row) }">\
                  <el-button size="small" text>更多<el-icon class="ml-0.5"><ArrowDown /></el-icon></el-button>\
                  <template #dropdown>\
                    <el-dropdown-menu>\
                      <el-dropdown-item command="logs">日志</el-dropdown-item>\
                      <el-dropdown-item command="inspect">详情</el-dropdown-item>\
                      <el-dropdown-item command="terminal" :disabled="row.state !== \'running\'">终端</el-dropdown-item>\
                      <el-dropdown-item command="files" :disabled="row.state !== \'running\'">文件</el-dropdown-item>\
                      <el-dropdown-item command="delete" divided style="color: #f56c6c">删除</el-dropdown-item>\
                    </el-dropdown-menu>\
                  </template>\
                </el-dropdown>\
              </template>\
            </el-table-column>\
          </el-table>\
        </el-tab-pane>\
        <el-tab-pane label="镜像" name="images">\
          <div class="flex gap-2 mb-2 items-center">\
            <el-input v-model="pullImageName" size="small" placeholder="输入镜像名称，如 nginx:latest" class="flex-1" />\
            <el-button size="small" type="primary" @click="doPullImage" :loading="pulling">拉取</el-button>\
            <el-button size="small" @click="imageSearchVisible = true">在线检索</el-button>\
          </div>\
          <div v-if="pullOutput" class="text-xs bg-slate-50 rounded p-2 mb-2 whitespace-pre-wrap max-h-[120px] overflow-auto">{{ pullOutput }}</div>\
          <el-table :data="images" border size="small" max-height="360">\
            <el-table-column prop="repository" label="仓库" min-width="160" show-overflow-tooltip />\
            <el-table-column prop="tag" label="标签" width="100" />\
            <el-table-column prop="size" label="大小" width="100" />\
            <el-table-column prop="created" label="创建时间" width="180" show-overflow-tooltip />\
            <el-table-column label="操作" width="180" align="center">\
              <template #default="{ row }">\
                <el-button size="small" text type="primary" @click="showRunDialog(row)">运行</el-button>\
                <el-popconfirm title="确认删除此镜像？" @confirm="doRemoveImage(row.id)">\
                  <template #reference><el-button size="small" text type="danger">删除</el-button></template>\
                </el-popconfirm>\
              </template>\
            </el-table-column>\
          </el-table>\
        </el-tab-pane>\
        <el-tab-pane label="Compose" name="compose">\
          <div class="flex gap-2 mb-2 items-center">\
            <el-button size="small" :icon="RefreshIcon" @click="loadComposeProjects" :loading="loadingCompose">扫描项目</el-button>\
            <el-button size="small" :icon="PlusIcon" @click="showNewCompose">新建项目</el-button>\
          </div>\
          <el-table :data="composeProjects" border size="small" max-height="300" v-loading="loadingCompose">\
            <el-table-column prop="dir" label="项目目录" min-width="200" show-overflow-tooltip />\
            <el-table-column prop="file" label="文件" width="180" />\
            <el-table-column label="操作" width="220" align="center">\
              <template #default="{ row }">\
                <el-button size="small" text type="success" @click="composeDo(row.dir, \'up\')">启动</el-button>\
                <el-button size="small" text type="danger" @click="composeDo(row.dir, \'down\')">停止</el-button>\
                <el-dropdown trigger="click" @command="function(cmd) { handleComposeCmd(cmd, row) }">\
                  <el-button size="small" text>更多<el-icon class="ml-0.5"><ArrowDown /></el-icon></el-button>\
                  <template #dropdown>\
                    <el-dropdown-menu>\
                      <el-dropdown-item command="restart">重启</el-dropdown-item>\
                      <el-dropdown-item command="pull">拉取镜像</el-dropdown-item>\
                      <el-dropdown-item command="logs">日志</el-dropdown-item>\
                      <el-dropdown-item command="edit">编辑配置</el-dropdown-item>\
                    </el-dropdown-menu>\
                  </template>\
                </el-dropdown>\
              </template>\
            </el-table-column>\
          </el-table>\
        </el-tab-pane>\
      </el-tabs>\
      <div v-if="terminalContainer" class="docker-terminal-wrapper mt-3">\
        <div class="flex items-center gap-2 mb-1">\
          <el-icon size="14" class="text-green-400"><Monitor /></el-icon>\
          <span class="text-xs font-semibold" style="color: #e5e7eb">容器终端: {{ terminalContainer.name }}</span>\
          <el-tag size="small" type="info">{{ terminalContainer.image }}</el-tag>\
          <div class="flex-1"></div>\
          <el-button size="small" text style="color: #ccc" @click="closeTerminal">关闭终端</el-button>\
        </div>\
        <div ref="dockerTermHost" class="docker-term-host"></div>\
        <div class="docker-toolbar">\
          <div class="toolbar-toggle" @click="toolbarExpanded = !toolbarExpanded">\
            <span>{{ toolbarExpanded ? \'\\u25BC\' : \'\\u25B2\' }} 工具栏</span>\
          </div>\
          <div v-show="toolbarExpanded" class="toolbar-body">\
            <el-tabs v-model="toolbarTab" class="toolbar-tabs">\
              <el-tab-pane label="快捷输入" name="quickInput">\
                <div class="toolbar-section">\
                  <el-input v-model="quickInputText" type="textarea" :rows="4" placeholder="粘贴或输入内容，点击发送写入终端..." />\
                  <div class="flex justify-end gap-2 mt-2">\
                    <el-button size="small" @click="quickInputText = \'\'">清空</el-button>\
                    <el-button size="small" type="primary" @click="sendQuickInput">发送</el-button>\
                  </div>\
                </div>\
              </el-tab-pane>\
              <el-tab-pane label="预设指令" name="preset">\
                <div class="toolbar-section">\
                  <div class="flex gap-2 mb-2">\
                    <el-button size="small" :icon="PlusIcon" @click="newPresetCommand">新建指令</el-button>\
                    <el-button size="small" :icon="FolderAddIcon" @click="newPresetGroup">新建指令组</el-button>\
                  </div>\
                  <div class="preset-tree">\
                    <template v-for="node in presetTreeNodes" :key="node.id">\
                      <div class="preset-node" :style="{ paddingLeft: node.depth * 20 + \'px\' }">\
                        <template v-if="node.type === \'group\'">\
                          <button class="preset-group-btn" @click="togglePresetGroup(node.id)">\
                            <span>{{ presetExpandedIds.has(node.id) ? \'\\u25BC\' : \'\\u25B6\' }}</span>\
                            <span class="font-semibold">{{ node.name }}</span>\
                          </button>\
                          <el-button size="small" text type="primary" @click="editPresetItem(node)">编辑</el-button>\
                          <el-popconfirm title="确认删除指令组？" @confirm="deletePresetItem(node.id)">\
                            <template #reference><el-button size="small" text type="danger">删除</el-button></template>\
                          </el-popconfirm>\
                        </template>\
                        <template v-else>\
                          <span class="preset-cmd-name" :title="node.remark || \'\'">{{ node.name }}</span>\
                          <span class="preset-cmd-text truncate text-xs text-gray-400 ml-2">{{ node.command }}</span>\
                          <div class="flex-1"></div>\
                          <el-button size="small" text type="primary" @click="editPresetItem(node)">编辑</el-button>\
                          <el-button size="small" text type="success" @click="executePresetCommand(node)">执行</el-button>\
                          <el-popconfirm title="确认删除指令？" @confirm="deletePresetItem(node.id)">\
                            <template #reference><el-button size="small" text type="danger">删除</el-button></template>\
                          </el-popconfirm>\
                        </template>\
                      </div>\
                    </template>\
                    <div v-if="presetTreeNodes.length === 0" class="text-xs text-gray-400 py-3 text-center">暂无预设指令</div>\
                  </div>\
                </div>\
              </el-tab-pane>\
              <el-tab-pane label="AI 指令" name="aiCmd">\
                <div class="toolbar-section">\
                  <template v-if="!aiConfigured">\
                    <div class="text-sm text-gray-400 py-4 text-center">AI 助手未配置</div>\
                  </template>\
                  <template v-else>\
                    <div class="flex gap-2 mb-2">\
                      <el-input v-model="aiPrompt" placeholder="输入需求，如：查看当前目录文件" class="flex-1" @keyup.enter="generateAiCommand" />\
                      <el-button size="small" type="primary" :loading="aiGenerating" @click="generateAiCommand">生成</el-button>\
                    </div>\
                    <div v-if="aiDescription" class="text-xs text-gray-500 mb-1">{{ aiDescription }}</div>\
                    <el-input v-model="aiCommandText" type="textarea" :rows="3" placeholder="AI 生成的命令将显示在此，可编辑后发送..." />\
                    <div class="flex justify-end mt-2">\
                      <el-button size="small" type="primary" :disabled="!aiCommandText" @click="sendAiCommand">发送</el-button>\
                    </div>\
                  </template>\
                </div>\
              </el-tab-pane>\
            </el-tabs>\
          </div>\
        </div>\
      </div>\
      <div v-if="fileContainer" class="docker-file-wrapper mt-3">\
        <div class="flex items-center gap-2 mb-2">\
          <el-icon size="14"><Folder /></el-icon>\
          <span class="text-xs font-semibold">文件管理: {{ fileContainer.name }}</span>\
          <div class="flex-1"></div>\
          <el-button size="small" text @click="closeFileManager">关闭</el-button>\
        </div>\
        <div class="flex gap-2 mb-2 items-center">\
          <el-button :icon="ArrowLeftIcon" size="small" plain @click="fileGoUp">上级</el-button>\
          <el-input v-model="fileCwd" size="small" @keyup.enter="browseContainerDir(fileCwd)">\
            <template #prepend>/</template>\
          </el-input>\
          <el-button size="small" :icon="RefreshIcon" @click="browseContainerDir(fileCwd)" :loading="loadingFiles">刷新</el-button>\
          <el-button size="small" :icon="FolderAddIcon" @click="createDirInContainer">新建目录</el-button>\
          <el-button size="small" type="primary" @click="showUploadDialog">上传</el-button>\
        </div>\
        <el-table :data="fileList" border size="small" max-height="400" v-loading="loadingFiles" @row-dblclick="onFileDblClick">\
          <el-table-column label="名称" min-width="220">\
            <template #default="{ row }">\
              <button class="file-name-btn" @click="row.isDir ? enterContainerDir(row.name) : openContainerFileEditor(row)">\
                <el-icon size="14" :class="row.isDir ? \'text-yellow-500\' : \'text-gray-400\'">\
                  <Folder v-if="row.isDir" /><Document v-else />\
                </el-icon>\
                <span class="truncate">{{ row.name }}</span>\
              </button>\
            </template>\
          </el-table-column>\
          <el-table-column prop="size" label="大小" width="100" />\
          <el-table-column prop="date" label="修改时间" width="160" show-overflow-tooltip />\
          <el-table-column prop="permissions" label="权限" width="110" />\
          <el-table-column label="操作" width="220" fixed="right" align="center">\
            <template #default="{ row }">\
              <div class="sftp-action-bar">\
                <el-button v-if="!row.isDir" size="small" :icon="EditPenIcon" title="编辑" @click="openContainerFileEditor(row)" />\
                <el-button size="small" :icon="EditIcon" title="重命名" @click="renameInContainer(row)" />\
                <el-button size="small" :icon="DownloadIcon" title="下载" @click="downloadFromContainer(row)" />\
                <el-button size="small" type="danger" :icon="DeleteIcon" title="删除" @click="deleteInContainer(row)" />\
              </div>\
            </template>\
          </el-table-column>\
        </el-table>\
      </div>\
    </template>\
    <el-dialog v-model="logsVisible" :title="\'日志: \' + logsContainerName" width="70vw" top="5vh" append-to-body>\
      <div class="log-viewer-inline">\
        <div class="log-toolbar-inline">\
          <el-input-number v-model="logLines" :min="50" :max="5000" :step="50" size="small" class="w-[120px]" />\
          <el-button size="small" :icon="RefreshIcon" @click="doRefreshLog" :loading="logLoading">刷新</el-button>\
          <el-divider direction="vertical" />\
          <el-input v-model="logKeyword" size="small" placeholder="关键词筛选 (grep)" clearable class="w-[200px]" @keyup.enter="doRefreshLog" @clear="doRefreshLog" />\
          <el-checkbox v-model="logIgnoreCase" size="small" @change="doRefreshLog">忽略大小写</el-checkbox>\
        </div>\
        <div class="log-content-inline"><pre>{{ logContent }}</pre></div>\
      </div>\
    </el-dialog>\
    <el-dialog v-model="inspectVisible" :title="\'详情: \' + inspectName" width="70vw" top="5vh" append-to-body>\
      <div v-if="inspectParsed" class="inspect-detail">\
        <div class="inspect-section-title">基本信息</div>\
        <el-table :data="inspectParsed.basic" border size="small" class="mb-3" :show-header="false">\
          <el-table-column prop="label" width="120" />\
          <el-table-column prop="value" min-width="300">\
            <template #default="{ row }">\
              <span class="inspect-value-text">{{ row.value }}</span>\
            </template>\
          </el-table-column>\
        </el-table>\
        <div class="inspect-section-title">资源限制</div>\
        <el-table :data="inspectParsed.resource" border size="small" class="mb-3" :show-header="false">\
          <el-table-column prop="label" width="120" />\
          <el-table-column prop="value" min-width="200" />\
        </el-table>\
        <div class="inspect-section-title">端口映射</div>\
        <div v-if="inspectParsed.ports.length" class="mb-3">\
          <el-tag v-for="(p, i) in inspectParsed.ports" :key="i" size="small" class="mr-1 mb-1">{{ p }}</el-tag>\
        </div>\
        <div v-else class="text-gray-400 text-xs mb-3">无端口映射</div>\
        <div class="inspect-section-title">挂载卷</div>\
        <el-table v-if="inspectParsed.mounts.length" :data="inspectParsed.mounts" border size="small" class="mb-3">\
          <el-table-column prop="type" label="类型" width="70" />\
          <el-table-column prop="source" label="宿主路径" min-width="200" show-overflow-tooltip />\
          <el-table-column prop="destination" label="容器路径" min-width="160" show-overflow-tooltip />\
          <el-table-column prop="mode" label="模式" width="70" />\
          <el-table-column prop="rw" label="权限" width="60" />\
        </el-table>\
        <div v-else class="text-gray-400 text-xs mb-3">无挂载卷</div>\
        <div class="inspect-section-title">网络</div>\
        <el-table :data="inspectNetworkList" border size="small" class="mb-3" v-if="inspectNetworkList.length">\
          <el-table-column prop="name" label="网络名" width="120" />\
          <el-table-column prop="ip" label="IP 地址" width="150" />\
          <el-table-column prop="gateway" label="网关" width="150" />\
          <el-table-column prop="mac" label="MAC" min-width="160" />\
        </el-table>\
        <div v-else class="text-gray-400 text-xs mb-3">无网络</div>\
        <el-collapse class="mb-3">\
          <el-collapse-item :title="\'环境变量 (\' + inspectParsed.envs.length + \')\'">\
            <el-table :data="inspectParsed.envs" border size="small" max-height="300">\
              <el-table-column prop="key" label="变量名" width="220" show-overflow-tooltip />\
              <el-table-column prop="value" label="值" min-width="300" show-overflow-tooltip />\
            </el-table>\
          </el-collapse-item>\
        </el-collapse>\
        <el-collapse v-if="inspectParsed.labels.length" class="mb-3">\
          <el-collapse-item :title="\'标签 (\' + inspectParsed.labels.length + \')\'">\
            <el-table :data="inspectParsed.labels" border size="small" max-height="300">\
              <el-table-column prop="key" label="Key" min-width="220" show-overflow-tooltip />\
              <el-table-column prop="value" label="Value" min-width="300" show-overflow-tooltip />\
            </el-table>\
          </el-collapse-item>\
        </el-collapse>\
        <el-collapse>\
          <el-collapse-item title="完整 JSON 信息">\
            <div class="log-view"><pre>{{ inspectContent }}</pre></div>\
          </el-collapse-item>\
        </el-collapse>\
      </div>\
      <div v-else-if="inspectContent" class="log-view"><pre>{{ inspectContent }}</pre></div>\
      <div v-else v-loading="true" class="py-10"></div>\
    </el-dialog>\
    <el-dialog v-model="runDialogVisible" title="运行容器" width="640px" top="5vh" :close-on-click-modal="false" append-to-body>\
      <div class="run-dialog-body">\
        <el-form label-position="left" label-width="90px" size="small">\
          <el-form-item label="镜像"><el-input :model-value="runForm.image" disabled /></el-form-item>\
          <el-form-item label="容器名称"><el-input v-model="runForm.name" placeholder="可选，如 my-nginx" /></el-form-item>\
          <el-form-item label="端口映射">\
            <div v-for="(p, i) in runForm.ports" :key="i" class="run-param-row">\
              <el-input v-model="p.host" placeholder="宿主机" class="w-[100px]" /><span class="text-gray-400">:</span>\
              <el-input v-model="p.container" placeholder="容器" class="w-[100px]" />\
              <el-select v-model="p.protocol" class="w-[80px]"><el-option value="tcp" /><el-option value="udp" /></el-select>\
              <el-button :icon="DeleteIcon" text type="danger" @click="runForm.ports.splice(i, 1)" />\
            </div>\
            <el-button size="small" text type="primary" :icon="PlusIcon" @click="runForm.ports.push({ host: \'\', container: \'\', protocol: \'tcp\' })">添加</el-button>\
          </el-form-item>\
          <el-form-item label="卷挂载">\
            <div v-for="(v, i) in runForm.volumes" :key="i" class="run-param-row">\
              <el-input v-model="v.host" placeholder="宿主机路径" class="flex-1" /><span class="text-gray-400">:</span>\
              <el-input v-model="v.container" placeholder="容器路径" class="flex-1" />\
              <el-select v-model="v.mode" class="w-[70px]"><el-option value="rw" /><el-option value="ro" /></el-select>\
              <el-button :icon="DeleteIcon" text type="danger" @click="runForm.volumes.splice(i, 1)" />\
            </div>\
            <el-button size="small" text type="primary" :icon="PlusIcon" @click="runForm.volumes.push({ host: \'\', container: \'\', mode: \'rw\' })">添加</el-button>\
          </el-form-item>\
          <el-form-item label="环境变量">\
            <div v-for="(e, i) in runForm.envs" :key="i" class="run-param-row">\
              <el-input v-model="e.key" placeholder="KEY" class="flex-1" /><span class="text-gray-400">=</span>\
              <el-input v-model="e.value" placeholder="VALUE" class="flex-1" />\
              <el-button :icon="DeleteIcon" text type="danger" @click="runForm.envs.splice(i, 1)" />\
            </div>\
            <el-button size="small" text type="primary" :icon="PlusIcon" @click="runForm.envs.push({ key: \'\', value: \'\' })">添加</el-button>\
          </el-form-item>\
          <el-form-item label="网络">\
            <el-select v-model="runForm.network" clearable placeholder="默认 (bridge)" class="w-full">\
              <el-option v-for="n in dockerNetworks" :key="n" :value="n" :label="n" />\
            </el-select>\
          </el-form-item>\
          <el-form-item label="重启策略">\
            <el-select v-model="runForm.restart" class="w-full">\
              <el-option value="" label="不自动重启" /><el-option value="always" /><el-option value="unless-stopped" /><el-option value="on-failure" />\
            </el-select>\
          </el-form-item>\
          <el-form-item label="后台运行"><el-switch v-model="runForm.detach" /></el-form-item>\
          <el-form-item label="启动命令"><el-input v-model="runForm.command" placeholder="可选，覆盖默认 CMD" /></el-form-item>\
          <el-collapse class="run-advanced-collapse mb-2">\
            <el-collapse-item title="资源限制">\
              <div class="run-grid-2col">\
                <el-form-item label="CPU 核数"><el-input v-model="runForm.cpus" placeholder="如 1.5" /></el-form-item>\
                <el-form-item label="内存限制"><el-input v-model="runForm.memory" placeholder="如 512m、2g" /></el-form-item>\
                <el-form-item label="内存+Swap"><el-input v-model="runForm.memorySwap" placeholder="如 1g，-1 表示不限" /></el-form-item>\
                <el-form-item label="共享内存"><el-input v-model="runForm.shmSize" placeholder="如 256m（默认 64m）" /></el-form-item>\
                <el-form-item label="PID 限制"><el-input v-model="runForm.pidsLimit" placeholder="如 200，-1 不限" /></el-form-item>\
              </div>\
            </el-collapse-item>\
            <el-collapse-item title="运行环境">\
              <div class="run-grid-2col">\
                <el-form-item label="Hostname"><el-input v-model="runForm.hostname" placeholder="容器主机名" /></el-form-item>\
                <el-form-item label="运行用户"><el-input v-model="runForm.user" placeholder="如 root、1000:1000" /></el-form-item>\
                <el-form-item label="工作目录"><el-input v-model="runForm.workdir" placeholder="如 /app" /></el-form-item>\
                <el-form-item label="DNS"><el-input v-model="runForm.dns" placeholder="如 8.8.8.8" /></el-form-item>\
                <el-form-item label="DNS 搜索域"><el-input v-model="runForm.dnsSearch" placeholder="如 example.com" /></el-form-item>\
              </div>\
              <div class="flex gap-4 mt-1 px-2">\
                <el-checkbox v-model="runForm.privileged">特权模式</el-checkbox>\
                <el-checkbox v-model="runForm.readOnly">只读根文件系统</el-checkbox>\
                <el-checkbox v-model="runForm.init">启用 init 进程</el-checkbox>\
              </div>\
            </el-collapse-item>\
            <el-collapse-item title="健康检查">\
              <el-form-item label="检查命令"><el-input v-model="runForm.healthCmd" placeholder="如 curl -f http://localhost/ || exit 1" /></el-form-item>\
              <div class="run-grid-3col">\
                <el-form-item label="间隔"><el-input v-model="runForm.healthInterval" placeholder="如 30s" /></el-form-item>\
                <el-form-item label="超时"><el-input v-model="runForm.healthTimeout" placeholder="如 10s" /></el-form-item>\
                <el-form-item label="重试次数"><el-input v-model="runForm.healthRetries" placeholder="如 3" /></el-form-item>\
              </div>\
            </el-collapse-item>\
            <el-collapse-item title="标签 (Labels)">\
              <div v-for="(l, i) in runForm.labels" :key="i" class="run-param-row">\
                <el-input v-model="l.key" placeholder="Key" class="flex-1" /><span class="text-gray-400">=</span>\
                <el-input v-model="l.value" placeholder="Value" class="flex-1" />\
                <el-button :icon="DeleteIcon" text type="danger" @click="runForm.labels.splice(i, 1)" />\
              </div>\
              <el-button size="small" text type="primary" :icon="PlusIcon" @click="runForm.labels.push({ key: \'\', value: \'\' })">添加</el-button>\
            </el-collapse-item>\
          </el-collapse>\
          <el-form-item label="额外参数"><el-input v-model="runForm.extraArgs" placeholder="其他 docker run 参数" /></el-form-item>\
        </el-form>\
        <div class="run-preview">\
          <div class="text-xs text-gray-400 mb-1">生成命令预览：</div>\
          <code class="run-preview-code">{{ buildRunCommand() }}</code>\
        </div>\
      </div>\
      <template #footer>\
        <el-button @click="runDialogVisible = false">取消</el-button>\
        <el-button type="primary" @click="doRunContainer" :loading="runningContainer">运行</el-button>\
      </template>\
    </el-dialog>\
    <el-dialog v-model="fileEditorVisible" :title="\'编辑: \' + fileEditorPath" width="75vw" top="5vh" :close-on-click-modal="false" append-to-body>\
      <div v-if="fileEditorLoading" class="py-10 text-center text-gray-400">加载中...</div>\
      <template v-else>\
        <div class="flex items-center gap-2 mb-2 text-xs text-gray-400">\
          <span>{{ fileEditorPath }}</span>\
        </div>\
        <el-input v-model="fileEditorContent" type="textarea" :rows="24" class="file-editor-textarea" spellcheck="false" />\
      </template>\
      <template #footer>\
        <el-button @click="fileEditorVisible = false">取消</el-button>\
        <el-button type="primary" :loading="fileEditorSaving" @click="saveContainerFile">保存</el-button>\
      </template>\
    </el-dialog>\
    <el-dialog v-model="uploadVisible" title="上传文件到容器" width="480px" append-to-body :close-on-click-modal="false">\
      <el-form label-position="top" size="small">\
        <el-form-item label="宿主机文件路径（服务器上的路径）">\
          <el-input v-model="uploadHostPath" placeholder="如 /tmp/myfile.txt" />\
        </el-form-item>\
        <el-form-item label="容器目标路径">\
          <el-input v-model="uploadContainerPath" :placeholder="fileCwd" />\
        </el-form-item>\
      </el-form>\
      <template #footer>\
        <el-button @click="uploadVisible = false">取消</el-button>\
        <el-button type="primary" @click="doUploadToContainer" :loading="uploading">上传</el-button>\
      </template>\
    </el-dialog>\
    <el-dialog v-model="imageSearchVisible" title="在线镜像检索" width="800px" top="5vh" append-to-body>\
      <div class="flex gap-2 mb-3 items-center">\
        <el-input v-model="imageSearchQuery" size="small" placeholder="搜索镜像，如 nginx、redis..." class="flex-1" @keyup.enter="searchOnlineImages" />\
        <el-select v-model="imageSearchRegistry" size="small" class="w-[150px]">\
          <el-option label="Docker Hub" value="dockerhub" />\
        </el-select>\
        <el-button size="small" type="primary" :loading="imageSearching" @click="searchOnlineImages">搜索</el-button>\
      </div>\
      <el-table :data="imageSearchResults" border size="small" max-height="400" v-loading="imageSearching">\
        <el-table-column label="镜像" min-width="180">\
          <template #default="{ row }">\
            <div>\
              <span class="font-semibold">{{ row.name }}</span>\
              <el-tag v-if="row.is_official" size="small" type="success" class="ml-1">官方</el-tag>\
            </div>\
            <div class="text-xs text-gray-400 truncate" :title="row.description">{{ row.description }}</div>\
          </template>\
        </el-table-column>\
        <el-table-column label="Stars" width="80" align="center">\
          <template #default="{ row }">{{ formatStars(row.star_count) }}</template>\
        </el-table-column>\
        <el-table-column label="拉取数" width="100" align="center">\
          <template #default="{ row }">{{ formatPulls(row.pull_count) }}</template>\
        </el-table-column>\
        <el-table-column label="操作" width="140" align="center">\
          <template #default="{ row }">\
            <el-button size="small" text type="primary" @click="pullSearchedImage(row)">拉取</el-button>\
            <el-button size="small" text type="success" @click="runSearchedImage(row)">运行</el-button>\
          </template>\
        </el-table-column>\
      </el-table>\
      <div v-if="imageSearchResults.length === 0 && !imageSearching && imageSearchQuery" class="text-center py-4 text-gray-400 text-sm">未找到匹配镜像</div>\
    </el-dialog>\
    <el-dialog v-model="pullDialogVisible" :title="pullDialogMode === \'run\' ? \'拉取并运行镜像\' : \'拉取镜像\'" width="520px" :close-on-click-modal="false" append-to-body>\
      <el-form label-position="left" label-width="90px" size="small">\
        <el-form-item label="镜像名称">\
          <el-input v-model="pullDialogImage" placeholder="如 nginx" />\
        </el-form-item>\
        <el-form-item label="版本标签">\
          <div class="flex gap-2 w-full">\
            <el-select v-model="pullDialogTag" filterable allow-create class="flex-1" :loading="pullDialogLoadingTags" placeholder="选择或输入标签">\
              <el-option v-for="t in pullDialogTags" :key="t" :value="t" :label="t" />\
            </el-select>\
            <el-button size="small" @click="loadImageTags" :loading="pullDialogLoadingTags">刷新标签</el-button>\
          </div>\
        </el-form-item>\
        <el-form-item label="使用镜像源">\
          <el-switch v-model="pullDialogUseMirror" />\
        </el-form-item>\
        <el-form-item v-if="pullDialogUseMirror" label="镜像源">\
          <el-select v-model="pullDialogMirrorPreset" class="w-full mb-1" @change="onMirrorPresetChange">\
            <el-option v-for="m in commonMirrors" :key="m.label" :value="m.value" :label="m.label" />\
          </el-select>\
          <el-input v-model="pullDialogMirror" placeholder="如 registry.cn-hangzhou.aliyuncs.com" />\
        </el-form-item>\
        <el-form-item label="完整命令">\
          <code class="pull-preview-code">{{ buildPullCommand() }}</code>\
        </el-form-item>\
      </el-form>\
      <template #footer>\
        <el-button @click="pullDialogVisible = false">取消</el-button>\
        <el-button type="primary" @click="doPullFromDialog" :loading="pulling">{{ pullDialogMode === \'run\' ? \'拉取并运行\' : \'拉取\' }}</el-button>\
      </template>\
    </el-dialog>\
    <el-dialog v-model="presetDialogVisible" :title="presetForm.id ? \'编辑\' : \'新建\'" width="520px" :close-on-click-modal="false" append-to-body>\
      <el-form label-position="top">\
        <el-form-item label="名称"><el-input v-model="presetForm.name" placeholder="指令名称" /></el-form-item>\
        <template v-if="presetForm.type === \'command\'">\
          <el-form-item label="参数">\
            <div class="preset-params-area">\
              <div class="preset-params-tags">\
                <el-tag v-for="(p, idx) in presetFormParams" :key="idx" closable class="cursor-pointer mr-1 mb-1" @click="insertParamPlaceholder(p)" @close="removePresetParam(idx)">{{ p }}</el-tag>\
              </div>\
              <div class="flex gap-2 mt-1">\
                <el-input v-model="newParamName" size="small" placeholder="参数名" class="flex-1" @keyup.enter="addPresetParam" />\
                <el-button size="small" @click="addPresetParam">添加</el-button>\
              </div>\
              <div v-if="presetFormParams.length" class="text-xs text-gray-400 mt-1">点击参数标签可将占位符插入到指令中</div>\
            </div>\
          </el-form-item>\
          <el-form-item label="指令">\
            <el-input ref="presetCmdInput" v-model="presetForm.command" type="textarea" :rows="3" placeholder="要执行的命令" />\
          </el-form-item>\
          <el-form-item label="备注"><el-input v-model="presetForm.remark" placeholder="可选" /></el-form-item>\
        </template>\
        <el-form-item label="所属指令组">\
          <el-select v-model="presetForm.parentId" clearable placeholder="根级">\
            <el-option label="根级" value="" />\
            <el-option v-for="g in presetGroupOptions" :key="g.id" :label="g.name" :value="g.id" />\
          </el-select>\
        </el-form-item>\
      </el-form>\
      <template #footer>\
        <el-button @click="presetDialogVisible = false">取消</el-button>\
        <el-button type="primary" :loading="savingPreset" @click="savePresetItem">保存</el-button>\
      </template>\
    </el-dialog>\
    <el-dialog v-model="presetExecDialogVisible" title="填写参数" width="440px" :close-on-click-modal="false" append-to-body>\
      <el-form label-position="top">\
        <el-form-item v-for="(p, idx) in presetExecParams" :key="idx" :label="p.name">\
          <el-input v-model="p.value" :placeholder="\'请输入 \' + p.name" />\
        </el-form-item>\
      </el-form>\
      <div class="rounded bg-slate-50 p-2 mt-2 text-xs text-gray-600 break-all"><strong>预览：</strong>{{ presetExecPreview }}</div>\
      <template #footer>\
        <el-button @click="presetExecDialogVisible = false">取消</el-button>\
        <el-button type="primary" @click="confirmExecutePreset">执行</el-button>\
      </template>\
    </el-dialog>\
    <el-dialog v-model="composeLogsVisible" :title="\'Compose 日志: \' + composeLogsDir" width="70vw" top="5vh" append-to-body>\
      <div class="log-viewer-inline">\
        <div class="log-toolbar-inline">\
          <el-input-number v-model="composeLogLines" :min="50" :max="5000" :step="50" size="small" class="w-[120px]" />\
          <el-button size="small" :icon="RefreshIcon" @click="doRefreshComposeLog" :loading="composeLogLoading">刷新</el-button>\
          <el-divider direction="vertical" />\
          <el-input v-model="composeLogKeyword" size="small" placeholder="关键词筛选 (grep)" clearable class="w-[200px]" @keyup.enter="doRefreshComposeLog" @clear="doRefreshComposeLog" />\
          <el-checkbox v-model="composeLogIgnoreCase" size="small" @change="doRefreshComposeLog">忽略大小写</el-checkbox>\
        </div>\
        <div class="log-content-inline"><pre>{{ composeLogContent }}</pre></div>\
      </div>\
    </el-dialog>\
    <el-dialog v-model="composeEditorVisible" :title="\'编辑: \' + composeEditorDir" width="75vw" top="3vh" :close-on-click-modal="false" append-to-body>\
      <el-radio-group v-model="composeEditorEditMode" size="small" class="mb-2">\
        <el-radio-button value="visual">可视化编排</el-radio-button>\
        <el-radio-button value="yaml">YAML 编辑</el-radio-button>\
      </el-radio-group>\
      <div v-if="composeEditorEditMode === \'visual\'" class="compose-visual-body">\
        <div class="flex items-center gap-2 mb-2">\
          <span class="text-sm font-semibold text-gray-600">服务 (Services)</span>\
          <el-button size="small" :icon="PlusIcon" @click="composeEditorServices.push(createComposeService(\'service_\' + (composeEditorServices.length + 1)))">添加服务</el-button>\
        </div>\
        <div v-for="(svc, si) in composeEditorServices" :key="si" class="compose-svc-card">\
          <div class="compose-svc-head" @click="svc.collapsed = !svc.collapsed">\
            <span class="compose-svc-head-left">\
              <el-icon class="mr-1"><ArrowRight v-if="svc.collapsed" /><ArrowDown v-else /></el-icon>\
              <span class="font-semibold">{{ svc.name || \'service_\' + (si + 1) }}</span>\
              <span v-if="svc.image" class="text-xs text-gray-400 ml-2">{{ svc.image }}</span>\
            </span>\
            <el-button :icon="DeleteIcon" text type="danger" size="small" @click.stop="composeEditorServices.splice(si, 1)" />\
          </div>\
          <div v-show="!svc.collapsed" class="compose-svc-body">\
            <el-form label-position="left" label-width="90px" size="small">\
              <div class="compose-grid-2col">\
                <el-form-item label="服务名"><el-input v-model="svc.name" placeholder="如 web、db" /></el-form-item>\
                <el-form-item label="镜像">\
                  <el-select v-model="svc.image" filterable allow-create clearable class="w-full" placeholder="选择已有镜像或输入">\
                    <el-option v-for="img in existingImageOptions" :key="img" :value="img" :label="img" />\
                  </el-select>\
                </el-form-item>\
                <el-form-item label="Build"><el-input v-model="svc.build" placeholder="如 . 或 ./app" /></el-form-item>\
                <el-form-item label="容器名"><el-input v-model="svc.containerName" placeholder="可选" /></el-form-item>\
                <el-form-item label="Hostname"><el-input v-model="svc.hostname" placeholder="可选" /></el-form-item>\
                <el-form-item label="用户"><el-input v-model="svc.user" placeholder="如 root、1000" /></el-form-item>\
                <el-form-item label="工作目录"><el-input v-model="svc.workingDir" placeholder="如 /app" /></el-form-item>\
                <el-form-item label="重启策略">\
                  <el-select v-model="svc.restart" class="w-full">\
                    <el-option value="" label="不重启" /><el-option value="always" /><el-option value="unless-stopped" /><el-option value="on-failure" />\
                  </el-select>\
                </el-form-item>\
              </div>\
              <el-form-item label="启动命令"><el-input v-model="svc.command" placeholder="覆盖默认 CMD" /></el-form-item>\
              <el-form-item label="Entrypoint"><el-input v-model="svc.entrypoint" placeholder="覆盖默认入口点" /></el-form-item>\
              <el-form-item label="端口映射">\
                <div v-for="(p, i) in svc.ports" :key="i" class="run-param-row">\
                  <el-input v-model="p.host" placeholder="宿主机" class="w-[100px]" /><span class="text-gray-400">:</span>\
                  <el-input v-model="p.container" placeholder="容器" class="w-[100px]" />\
                  <el-select v-model="p.protocol" class="w-[80px]"><el-option value="tcp" /><el-option value="udp" /></el-select>\
                  <el-button :icon="DeleteIcon" text type="danger" @click="svc.ports.splice(i, 1)" />\
                </div>\
                <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.ports.push({ host: \'\', container: \'\', protocol: \'tcp\' })">添加</el-button>\
              </el-form-item>\
              <el-form-item label="卷挂载">\
                <div v-for="(v, i) in svc.volumes" :key="i" class="run-param-row">\
                  <el-input v-model="v.host" placeholder="宿主/卷名" class="flex-1" /><span class="text-gray-400">:</span>\
                  <el-input v-model="v.container" placeholder="容器路径" class="flex-1" />\
                  <el-select v-model="v.mode" class="w-[70px]"><el-option value="rw" /><el-option value="ro" /></el-select>\
                  <el-button :icon="DeleteIcon" text type="danger" @click="svc.volumes.splice(i, 1)" />\
                </div>\
                <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.volumes.push({ host: \'\', container: \'\', mode: \'rw\' })">添加</el-button>\
              </el-form-item>\
              <el-form-item label="环境变量">\
                <div v-for="(e, i) in svc.envs" :key="i" class="run-param-row">\
                  <el-input v-model="e.key" placeholder="KEY" class="flex-1" /><span class="text-gray-400">=</span>\
                  <el-input v-model="e.value" placeholder="VALUE" class="flex-1" />\
                  <el-button :icon="DeleteIcon" text type="danger" @click="svc.envs.splice(i, 1)" />\
                </div>\
                <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.envs.push({ key: \'\', value: \'\' })">添加</el-button>\
              </el-form-item>\
              <el-form-item label="依赖服务">\
                <el-select v-model="svc.dependsOn" multiple filterable allow-create class="w-full" placeholder="选择或输入服务名">\
                  <el-option v-for="(s2, j) in composeEditorServices" :key="j" :value="s2.name" :label="s2.name" :disabled="s2.name === svc.name || !s2.name" />\
                </el-select>\
              </el-form-item>\
              <el-form-item label="网络">\
                <el-select v-model="svc.networks" multiple filterable allow-create class="w-full" placeholder="选择或输入网络名">\
                  <el-option v-for="n in composeEditorNetworks" :key="n.name" :value="n.name" :label="n.name" />\
                </el-select>\
              </el-form-item>\
              <el-collapse class="run-advanced-collapse mb-1">\
                <el-collapse-item title="资源限制">\
                  <div class="compose-grid-2col">\
                    <el-form-item label="CPU 核数"><el-input v-model="svc.cpus" placeholder="如 0.5" /></el-form-item>\
                    <el-form-item label="内存限制"><el-input v-model="svc.memLimit" placeholder="如 512M" /></el-form-item>\
                    <el-form-item label="内存预留"><el-input v-model="svc.memReservation" placeholder="如 256M" /></el-form-item>\
                    <el-form-item label="共享内存"><el-input v-model="svc.shmSize" placeholder="如 256m" /></el-form-item>\
                  </div>\
                </el-collapse-item>\
                <el-collapse-item title="健康检查">\
                  <el-form-item label="检查命令"><el-input v-model="svc.healthCmd" placeholder="如 curl -f http://localhost/ || exit 1" /></el-form-item>\
                  <div class="run-grid-3col">\
                    <el-form-item label="间隔"><el-input v-model="svc.healthInterval" placeholder="30s" /></el-form-item>\
                    <el-form-item label="超时"><el-input v-model="svc.healthTimeout" placeholder="10s" /></el-form-item>\
                    <el-form-item label="重试"><el-input v-model="svc.healthRetries" placeholder="3" /></el-form-item>\
                  </div>\
                </el-collapse-item>\
                <el-collapse-item title="其他选项">\
                  <div class="flex gap-4 flex-wrap mb-2">\
                    <el-checkbox v-model="svc.privileged">特权模式</el-checkbox>\
                    <el-checkbox v-model="svc.readOnly">只读根文件系统</el-checkbox>\
                    <el-checkbox v-model="svc.init">init 进程</el-checkbox>\
                    <el-checkbox v-model="svc.stdinOpen">stdin_open</el-checkbox>\
                    <el-checkbox v-model="svc.tty">tty</el-checkbox>\
                  </div>\
                </el-collapse-item>\
                <el-collapse-item title="标签 (Labels)">\
                  <div v-for="(l, i) in svc.labels" :key="i" class="run-param-row">\
                    <el-input v-model="l.key" placeholder="Key" class="flex-1" /><span class="text-gray-400">=</span>\
                    <el-input v-model="l.value" placeholder="Value" class="flex-1" />\
                    <el-button :icon="DeleteIcon" text type="danger" @click="svc.labels.splice(i, 1)" />\
                  </div>\
                  <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.labels.push({ key: \'\', value: \'\' })">添加</el-button>\
                </el-collapse-item>\
              </el-collapse>\
            </el-form>\
          </div>\
        </div>\
        <div v-if="composeEditorServices.length === 0" class="text-center py-6 text-gray-400 text-sm">暂无服务，点击「添加服务」开始编排</div>\
        <el-collapse class="compose-global-collapse mt-3">\
          <el-collapse-item title="全局网络 (Networks)">\
            <div v-for="(n, i) in composeEditorNetworks" :key="i" class="run-param-row mb-1">\
              <el-input v-model="n.name" placeholder="网络名" class="flex-1" />\
              <el-select v-model="n.driver" clearable placeholder="driver" class="w-[120px]">\
                <el-option value="" label="默认" /><el-option value="bridge" /><el-option value="overlay" /><el-option value="host" /><el-option value="none" />\
              </el-select>\
              <el-button :icon="DeleteIcon" text type="danger" @click="composeEditorNetworks.splice(i, 1)" />\
            </div>\
            <el-button size="small" text type="primary" :icon="PlusIcon" @click="composeEditorNetworks.push({ name: \'\', driver: \'\' })">添加网络</el-button>\
          </el-collapse-item>\
          <el-collapse-item title="全局卷 (Volumes)">\
            <div v-for="(v, i) in composeEditorVolumes" :key="i" class="run-param-row mb-1">\
              <el-input v-model="v.name" placeholder="卷名" class="flex-1" />\
              <el-select v-model="v.driver" clearable placeholder="driver" class="w-[120px]">\
                <el-option value="" label="默认" /><el-option value="local" />\
              </el-select>\
              <el-button :icon="DeleteIcon" text type="danger" @click="composeEditorVolumes.splice(i, 1)" />\
            </div>\
            <el-button size="small" text type="primary" :icon="PlusIcon" @click="composeEditorVolumes.push({ name: \'\', driver: \'\' })">添加卷</el-button>\
          </el-collapse-item>\
        </el-collapse>\
        <div class="mt-3">\
          <div class="text-xs text-gray-400 mb-1">生成 YAML 预览：</div>\
          <pre class="compose-yaml-preview">{{ generateComposeYamlFrom(composeEditorServices, composeEditorNetworks, composeEditorVolumes) }}</pre>\
        </div>\
      </div>\
      <div v-else>\
        <el-input v-model="composeEditorContent" type="textarea" :rows="24" spellcheck="false" class="compose-editor" />\
      </div>\
      <template #footer>\
        <el-button @click="composeEditorVisible = false">取消</el-button>\
        <el-button type="primary" @click="saveComposeFile" :loading="savingCompose">保存</el-button>\
      </template>\
    </el-dialog>\
    <el-dialog v-model="newComposeVisible" title="新建 Compose 项目" width="75vw" top="3vh" :close-on-click-modal="false" append-to-body>\
      <el-form label-position="left" label-width="80px" size="small" class="mb-2">\
        <el-form-item label="项目目录"><el-input v-model="newComposeDir" placeholder="/opt/myapp" /></el-form-item>\
      </el-form>\
      <el-radio-group v-model="composeEditMode" size="small" class="mb-2">\
        <el-radio-button value="visual">可视化编排</el-radio-button>\
        <el-radio-button value="yaml">YAML 编辑</el-radio-button>\
      </el-radio-group>\
      <div v-if="composeEditMode === \'visual\'" class="compose-visual-body">\
        <div class="flex items-center gap-2 mb-2">\
          <span class="text-sm font-semibold text-gray-600">服务 (Services)</span>\
          <el-button size="small" :icon="PlusIcon" @click="addComposeService">添加服务</el-button>\
        </div>\
        <div v-for="(svc, si) in composeServices" :key="si" class="compose-svc-card">\
          <div class="compose-svc-head" @click="svc.collapsed = !svc.collapsed">\
            <span class="compose-svc-head-left">\
              <el-icon class="mr-1"><ArrowRight v-if="svc.collapsed" /><ArrowDown v-else /></el-icon>\
              <span class="font-semibold">{{ svc.name || \'service_\' + (si + 1) }}</span>\
              <span v-if="svc.image" class="text-xs text-gray-400 ml-2">{{ svc.image }}</span>\
            </span>\
            <el-button :icon="DeleteIcon" text type="danger" size="small" @click.stop="removeComposeService(si)" />\
          </div>\
          <div v-show="!svc.collapsed" class="compose-svc-body">\
            <el-form label-position="left" label-width="90px" size="small">\
              <div class="compose-grid-2col">\
                <el-form-item label="服务名"><el-input v-model="svc.name" placeholder="如 web、db" /></el-form-item>\
                <el-form-item label="镜像">\
                  <el-select v-model="svc.image" filterable allow-create clearable class="w-full" placeholder="选择已有镜像或输入">\
                    <el-option v-for="img in existingImageOptions" :key="img" :value="img" :label="img" />\
                  </el-select>\
                </el-form-item>\
                <el-form-item label="Build"><el-input v-model="svc.build" placeholder="如 . 或 ./app" /></el-form-item>\
                <el-form-item label="容器名"><el-input v-model="svc.containerName" placeholder="可选" /></el-form-item>\
                <el-form-item label="Hostname"><el-input v-model="svc.hostname" placeholder="可选" /></el-form-item>\
                <el-form-item label="用户"><el-input v-model="svc.user" placeholder="如 root、1000" /></el-form-item>\
                <el-form-item label="工作目录"><el-input v-model="svc.workingDir" placeholder="如 /app" /></el-form-item>\
                <el-form-item label="重启策略">\
                  <el-select v-model="svc.restart" class="w-full">\
                    <el-option value="" label="不重启" /><el-option value="always" /><el-option value="unless-stopped" /><el-option value="on-failure" />\
                  </el-select>\
                </el-form-item>\
              </div>\
              <el-form-item label="启动命令"><el-input v-model="svc.command" placeholder="覆盖默认 CMD" /></el-form-item>\
              <el-form-item label="Entrypoint"><el-input v-model="svc.entrypoint" placeholder="覆盖默认入口点" /></el-form-item>\
              <el-form-item label="端口映射">\
                <div v-for="(p, i) in svc.ports" :key="i" class="run-param-row">\
                  <el-input v-model="p.host" placeholder="宿主机" class="w-[100px]" /><span class="text-gray-400">:</span>\
                  <el-input v-model="p.container" placeholder="容器" class="w-[100px]" />\
                  <el-select v-model="p.protocol" class="w-[80px]"><el-option value="tcp" /><el-option value="udp" /></el-select>\
                  <el-button :icon="DeleteIcon" text type="danger" @click="svc.ports.splice(i, 1)" />\
                </div>\
                <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.ports.push({ host: \'\', container: \'\', protocol: \'tcp\' })">添加</el-button>\
              </el-form-item>\
              <el-form-item label="卷挂载">\
                <div v-for="(v, i) in svc.volumes" :key="i" class="run-param-row">\
                  <el-input v-model="v.host" placeholder="宿主/卷名" class="flex-1" /><span class="text-gray-400">:</span>\
                  <el-input v-model="v.container" placeholder="容器路径" class="flex-1" />\
                  <el-select v-model="v.mode" class="w-[70px]"><el-option value="rw" /><el-option value="ro" /></el-select>\
                  <el-button :icon="DeleteIcon" text type="danger" @click="svc.volumes.splice(i, 1)" />\
                </div>\
                <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.volumes.push({ host: \'\', container: \'\', mode: \'rw\' })">添加</el-button>\
              </el-form-item>\
              <el-form-item label="环境变量">\
                <div v-for="(e, i) in svc.envs" :key="i" class="run-param-row">\
                  <el-input v-model="e.key" placeholder="KEY" class="flex-1" /><span class="text-gray-400">=</span>\
                  <el-input v-model="e.value" placeholder="VALUE" class="flex-1" />\
                  <el-button :icon="DeleteIcon" text type="danger" @click="svc.envs.splice(i, 1)" />\
                </div>\
                <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.envs.push({ key: \'\', value: \'\' })">添加</el-button>\
              </el-form-item>\
              <el-form-item label="依赖服务">\
                <el-select v-model="svc.dependsOn" multiple filterable allow-create class="w-full" placeholder="选择或输入服务名">\
                  <el-option v-for="(s2, j) in composeServices" :key="j" :value="s2.name" :label="s2.name" :disabled="s2.name === svc.name || !s2.name" />\
                </el-select>\
              </el-form-item>\
              <el-form-item label="网络">\
                <el-select v-model="svc.networks" multiple filterable allow-create class="w-full" placeholder="选择或输入网络名">\
                  <el-option v-for="n in composeNetworkList" :key="n.name" :value="n.name" :label="n.name" />\
                </el-select>\
              </el-form-item>\
              <el-collapse class="run-advanced-collapse mb-1">\
                <el-collapse-item title="资源限制">\
                  <div class="compose-grid-2col">\
                    <el-form-item label="CPU 核数"><el-input v-model="svc.cpus" placeholder="如 0.5" /></el-form-item>\
                    <el-form-item label="内存限制"><el-input v-model="svc.memLimit" placeholder="如 512M" /></el-form-item>\
                    <el-form-item label="内存预留"><el-input v-model="svc.memReservation" placeholder="如 256M" /></el-form-item>\
                    <el-form-item label="共享内存"><el-input v-model="svc.shmSize" placeholder="如 256m" /></el-form-item>\
                  </div>\
                </el-collapse-item>\
                <el-collapse-item title="健康检查">\
                  <el-form-item label="检查命令"><el-input v-model="svc.healthCmd" placeholder="如 curl -f http://localhost/ || exit 1" /></el-form-item>\
                  <div class="run-grid-3col">\
                    <el-form-item label="间隔"><el-input v-model="svc.healthInterval" placeholder="30s" /></el-form-item>\
                    <el-form-item label="超时"><el-input v-model="svc.healthTimeout" placeholder="10s" /></el-form-item>\
                    <el-form-item label="重试"><el-input v-model="svc.healthRetries" placeholder="3" /></el-form-item>\
                  </div>\
                </el-collapse-item>\
                <el-collapse-item title="其他选项">\
                  <div class="flex gap-4 flex-wrap mb-2">\
                    <el-checkbox v-model="svc.privileged">特权模式</el-checkbox>\
                    <el-checkbox v-model="svc.readOnly">只读根文件系统</el-checkbox>\
                    <el-checkbox v-model="svc.init">init 进程</el-checkbox>\
                    <el-checkbox v-model="svc.stdinOpen">stdin_open</el-checkbox>\
                    <el-checkbox v-model="svc.tty">tty</el-checkbox>\
                  </div>\
                </el-collapse-item>\
                <el-collapse-item title="标签 (Labels)">\
                  <div v-for="(l, i) in svc.labels" :key="i" class="run-param-row">\
                    <el-input v-model="l.key" placeholder="Key" class="flex-1" /><span class="text-gray-400">=</span>\
                    <el-input v-model="l.value" placeholder="Value" class="flex-1" />\
                    <el-button :icon="DeleteIcon" text type="danger" @click="svc.labels.splice(i, 1)" />\
                  </div>\
                  <el-button size="small" text type="primary" :icon="PlusIcon" @click="svc.labels.push({ key: \'\', value: \'\' })">添加</el-button>\
                </el-collapse-item>\
              </el-collapse>\
            </el-form>\
          </div>\
        </div>\
        <div v-if="composeServices.length === 0" class="text-center py-6 text-gray-400 text-sm">暂无服务，点击「添加服务」开始编排</div>\
        <el-collapse class="compose-global-collapse mt-3">\
          <el-collapse-item title="全局网络 (Networks)">\
            <div v-for="(n, i) in composeNetworkList" :key="i" class="run-param-row mb-1">\
              <el-input v-model="n.name" placeholder="网络名" class="flex-1" />\
              <el-select v-model="n.driver" clearable placeholder="driver" class="w-[120px]">\
                <el-option value="" label="默认" /><el-option value="bridge" /><el-option value="overlay" /><el-option value="host" /><el-option value="none" />\
              </el-select>\
              <el-button :icon="DeleteIcon" text type="danger" @click="composeNetworkList.splice(i, 1)" />\
            </div>\
            <el-button size="small" text type="primary" :icon="PlusIcon" @click="composeNetworkList.push({ name: \'\', driver: \'\' })">添加网络</el-button>\
          </el-collapse-item>\
          <el-collapse-item title="全局卷 (Volumes)">\
            <div v-for="(v, i) in composeVolumeList" :key="i" class="run-param-row mb-1">\
              <el-input v-model="v.name" placeholder="卷名" class="flex-1" />\
              <el-select v-model="v.driver" clearable placeholder="driver" class="w-[120px]">\
                <el-option value="" label="默认" /><el-option value="local" />\
              </el-select>\
              <el-button :icon="DeleteIcon" text type="danger" @click="composeVolumeList.splice(i, 1)" />\
            </div>\
            <el-button size="small" text type="primary" :icon="PlusIcon" @click="composeVolumeList.push({ name: \'\', driver: \'\' })">添加卷</el-button>\
          </el-collapse-item>\
        </el-collapse>\
        <div class="mt-3">\
          <div class="text-xs text-gray-400 mb-1">生成 YAML 预览：</div>\
          <pre class="compose-yaml-preview">{{ generateComposeYaml() }}</pre>\
        </div>\
      </div>\
      <div v-else>\
        <el-input v-model="newComposeContent" type="textarea" :rows="24" spellcheck="false" class="compose-editor" />\
      </div>\
      <template #footer>\
        <el-button @click="newComposeVisible = false">取消</el-button>\
        <el-button type="primary" @click="createCompose" :loading="creatingCompose">创建并启动</el-button>\
      </template>\
    </el-dialog>\
  </div>',

  setup(props) {
    var remoteConfigInstance = null

    var PlusIcon = Plus
    var RefreshIcon = Refresh
    var DeleteIcon = Delete
    var ArrowLeftIcon = ArrowLeft
    var FolderAddIcon = FolderAdd
    var EditIcon = Edit
    var EditPenIcon = EditPen
    var DownloadIcon = Download

    var checkDone = ref(false)
    var installed = ref(false)
    var dockerVersion = ref('')
    var composeVersion = ref('')
    var refreshing = ref(false)
    var subTab = ref('containers')

    var installing = ref(false)
    var installMirror = ref('https://mirrors.aliyun.com/docker-ce')
    var installChannel = ref('stable')
    var installLog = ref('')
    var installStatus = ref('running')
    var installLogRef = ref(null)

    var containers = ref([])
    var containerFilter = ref('all')
    var containerSearch = ref('')

    var images = ref([])
    var pullImageName = ref('')
    var pulling = ref(false)
    var pullOutput = ref('')

    var composeProjects = ref([])
    var loadingCompose = ref(false)

    var logsVisible = ref(false)
    var logsContainerName = ref('')
    var logsContainerId = ref('')
    var logLines = ref(200)
    var logKeyword = ref('')
    var logIgnoreCase = ref(true)
    var logContent = ref('')
    var logLoading = ref(false)

    var inspectVisible = ref(false)
    var inspectName = ref('')
    var inspectContent = ref('')
    var inspectParsed = ref(null)

    var composeLogsVisible = ref(false)
    var composeLogsDir = ref('')
    var composeLogLines = ref(200)
    var composeLogKeyword = ref('')
    var composeLogIgnoreCase = ref(true)
    var composeLogContent = ref('')
    var composeLogLoading = ref(false)

    var composeEditorVisible = ref(false)
    var composeEditorDir = ref('')
    var composeEditorFile = ref('')
    var composeEditorContent = ref('')
    var savingCompose = ref(false)
    var composeEditorEditMode = ref('visual')
    var composeEditorServices = ref([])
    var composeEditorNetworks = ref([])
    var composeEditorVolumes = ref([])
    var newComposeVisible = ref(false)
    var newComposeDir = ref('')
    var newComposeContent = ref('')
    var creatingCompose = ref(false)
    var composeEditMode = ref('visual')
    var composeServices = ref([])
    var composeNetworkList = ref([])
    var composeVolumeList = ref([])

    var runDialogVisible = ref(false)
    var runningContainer = ref(false)
    var dockerNetworks = ref([])
    var runForm = ref(createRunForm(''))

    var terminalContainer = ref(null)
    var dockerTermHost = ref(null)
    var dockerTerminal = null
    var dockerShellId = ''
    var unsubShellData = null

    var toolbarExpanded = ref(false)
    var toolbarTab = ref('quickInput')
    var quickInputText = ref('')

    var presetCommands = ref([])
    var presetExpandedIds = ref(new Set())
    var presetDialogVisible = ref(false)
    var presetForm = reactive({ id: '', type: 'command', name: '', command: '', params: '', remark: '', parentId: '' })
    var presetFormParams = ref([])
    var newParamName = ref('')
    var presetCmdInput = ref(null)
    var presetExecDialogVisible = ref(false)
    var presetExecParams = ref([])
    var presetExecCommand = ref('')
    var savingPreset = ref(false)

    var aiPrompt = ref('')
    var aiCommandText = ref('')
    var aiDescription = ref('')
    var aiGenerating = ref(false)
    var aiConfigured = ref(false)

    var fileContainer = ref(null)
    var fileCwd = ref('/')
    var fileList = ref([])
    var loadingFiles = ref(false)
    var fileEditorVisible = ref(false)
    var fileEditorLoading = ref(false)
    var fileEditorSaving = ref(false)
    var fileEditorPath = ref('')
    var fileEditorContent = ref('')
    var uploadVisible = ref(false)
    var uploadHostPath = ref('')
    var uploadContainerPath = ref('')
    var uploading = ref(false)

    var imageSearchVisible = ref(false)
    var imageSearchQuery = ref('')
    var imageSearchRegistry = ref('dockerhub')
    var imageSearchResults = ref([])
    var imageSearching = ref(false)

    var pullDialogVisible = ref(false)
    var pullDialogImage = ref('')
    var pullDialogTag = ref('latest')
    var pullDialogTags = ref([])
    var pullDialogLoadingTags = ref(false)
    var pullDialogUseMirror = ref(false)
    var pullDialogMirror = ref('')
    var commonMirrors = [
      { label: '阿里云', value: 'registry.cn-hangzhou.aliyuncs.com' },
      { label: 'DaoCloud', value: 'docker.m.daocloud.io' },
      { label: '腾讯云', value: 'ccr.ccs.tencentyun.com' },
      { label: '华为云', value: 'swr.cn-north-4.myhuaweicloud.com' },
      { label: '自定义', value: '' },
    ]
    var pullDialogMirrorPreset = ref('')
    var pullDialogMode = ref('pull')

    var installStatusText = computed(function() {
      return ({ running: '安装中...', done: '安装完成', error: '安装失败' })[installStatus.value] || ''
    })

    var filteredContainers = computed(function() {
      var list = containers.value
      if (containerFilter.value !== 'all') list = list.filter(function(c) { return c.state === containerFilter.value })
      var kw = containerSearch.value.trim().toLowerCase()
      if (kw) list = list.filter(function(c) { return c.name.toLowerCase().includes(kw) || c.image.toLowerCase().includes(kw) })
      return list
    })

    var existingImageOptions = computed(function() {
      var set = new Set()
      return images.value
        .map(function(img) {
          var full = img.tag && img.tag !== '<none>' ? img.repository + ':' + img.tag : img.repository
          if (set.has(full)) return null
          set.add(full)
          return full
        })
        .filter(Boolean)
    })

    var presetGroupOptions = computed(function() { return presetCommands.value.filter(function(c) { return c.type === 'group' }) })

    var presetTreeNodes = computed(function() { return buildPresetTree('', 0) })

    var presetExecPreview = computed(function() {
      var cmd = presetExecCommand.value
      for (var pi = 0; pi < presetExecParams.value.length; pi++) {
        var p = presetExecParams.value[pi]
        cmd = cmd.split('{{' + p.name + '}}').join(p.value || ('{{' + p.name + '}}'))
      }
      return cmd
    })

    var inspectNetworkList = computed(function() {
      if (!inspectParsed.value || !inspectParsed.value.networks) return []
      return Object.entries(inspectParsed.value.networks).map(function(entry) {
        return { name: entry[0], ip: entry[1].ip, gateway: entry[1].gateway, mac: entry[1].mac }
      })
    })

    function exec(cmd) {
      return props.exec(cmd)
    }

    function callSsh(action) {
      var args = Array.prototype.slice.call(arguments, 1)
      if (props.callSsh) return props.callSsh.apply(null, [action].concat(args))
      var fn = window.electronAPI && window.electronAPI.ssh && window.electronAPI.ssh[action]
      if (!fn) return Promise.resolve({ ok: false, error: 'SSH API 不可用' })
      return fn.apply(null, args)
    }

    function checkDocker() {
      return exec('which docker 2>/dev/null').then(function(r) {
        installed.value = r.code === 0 && r.stdout.trim() !== ''
        if (installed.value) {
          return exec('docker --version 2>/dev/null').then(function(vr) {
            dockerVersion.value = vr.stdout.replace(/Docker version\s*/i, '').replace(/,.*/, '').trim()
            return exec('docker compose version 2>/dev/null')
          }).then(function(cr) {
            composeVersion.value = cr.code === 0 ? cr.stdout.replace(/.*version\s*/i, '').trim() : ''
          })
        }
      }).then(function() { checkDone.value = true })
    }

    function loadContainers() {
      return exec("docker ps -a --format '{{json .}}' 2>/dev/null").then(function(r) {
        if (r.code !== 0) { containers.value = []; return }
        containers.value = r.stdout.trim().split('\n').filter(Boolean).map(function(line) {
          try { var o = JSON.parse(line); return { id: o.ID, name: o.Names, image: o.Image, status: o.Status, state: o.State, ports: o.Ports, created: o.CreatedAt } }
          catch(e) { return null }
        }).filter(Boolean)
      })
    }

    function loadImages() {
      return exec("docker images --format '{{json .}}' 2>/dev/null").then(function(r) {
        if (r.code !== 0) { images.value = []; return }
        images.value = r.stdout.trim().split('\n').filter(Boolean).map(function(line) {
          try { var o = JSON.parse(line); return { id: o.ID, repository: o.Repository, tag: o.Tag, size: o.Size, created: o.CreatedAt } }
          catch(e) { return null }
        }).filter(Boolean)
      })
    }

    function loadComposeProjects() {
      loadingCompose.value = true
      return exec("find /root /home /opt /srv /data -maxdepth 4 \\( -name 'docker-compose.yml' -o -name 'compose.yml' \\) 2>/dev/null | head -30").then(function(r) {
        if (r.code !== 0 || !r.stdout.trim()) { composeProjects.value = []; loadingCompose.value = false; return }
        composeProjects.value = r.stdout.trim().split('\n').filter(Boolean).map(function(fp) { var parts = fp.split('/'); var file = parts.pop(); return { dir: parts.join('/'), file: file } })
        loadingCompose.value = false
      })
    }

    function refreshCurrent() {
      refreshing.value = true
      var p
      if (subTab.value === 'containers') p = loadContainers()
      else if (subTab.value === 'images') p = loadImages()
      else if (subTab.value === 'compose') p = loadComposeProjects()
      else p = Promise.resolve()
      return p.then(function() { refreshing.value = false })
    }

    function containerDo(id, action) {
      return exec('docker ' + action + ' ' + id + ' 2>&1').then(function(r) {
        if (r.code !== 0) showMessage(r.stdout + r.stderr, 'error'); else showMessage(action + ' 成功', 'success')
        return loadContainers()
      })
    }

    function removeContainerById(id) {
      return exec('docker rm -f ' + id + ' 2>&1').then(function(r) {
        if (r.code !== 0) showMessage(r.stdout + r.stderr, 'error'); else showMessage('已删除', 'success')
        return loadContainers()
      })
    }

    function handleContainerCmd(cmd, row) {
      if (cmd === 'logs') showLogs(row)
      else if (cmd === 'inspect') showInspect(row)
      else if (cmd === 'terminal') openTerminal(row)
      else if (cmd === 'files') openFileManager(row)
      else if (cmd === 'delete') {
        showConfirm('确认删除此容器？', '提示', { type: 'warning' }).then(function() {
          removeContainerById(row.id)
        }).catch(function() {})
      }
    }

    function handleComposeCmd(cmd, row) {
      if (cmd === 'restart') composeDo(row.dir, 'restart')
      else if (cmd === 'pull') composeDo(row.dir, 'pull')
      else if (cmd === 'logs') showComposeLogs(row)
      else if (cmd === 'edit') editComposeFile(row)
    }

    function showLogs(row) {
      logsContainerName.value = row.name
      logsContainerId.value = row.id
      logContent.value = ''
      logsVisible.value = true
      doRefreshLog()
    }

    function doRefreshLog() {
      logLoading.value = true
      var base = 'docker logs --tail ' + logLines.value + ' ' + logsContainerId.value + ' 2>&1'
      var kw = logKeyword.value.trim()
      var cmd = kw ? base + ' | grep ' + (logIgnoreCase.value ? '-i' : '') + ' -- ' + shellQuote(kw) : base
      exec(cmd).then(function(r) {
        logContent.value = r.stdout || '（无日志）'
        logLoading.value = false
      })
    }

    function showInspect(row) {
      inspectName.value = row.name
      inspectParsed.value = null
      inspectContent.value = ''
      inspectVisible.value = true
      exec('docker inspect ' + row.id + ' 2>/dev/null').then(function(r) {
        var raw = r.stdout
        try {
          var arr = JSON.parse(raw)
          var obj = arr[0] || arr
          inspectContent.value = JSON.stringify(arr, null, 2)
          inspectParsed.value = parseInspectInfo(obj)
        } catch(e) { inspectContent.value = raw }
      })
    }

    function parseInspectInfo(obj) {
      var cfg = obj.Config || {}
      var hostCfg = obj.HostConfig || {}
      var netSettings = obj.NetworkSettings || {}
      var state = obj.State || {}
      var portBindings = hostCfg.PortBindings || {}
      var ports = []
      Object.entries(portBindings).forEach(function(entry) {
        var containerPort = entry[0], binds = entry[1]
        if (Array.isArray(binds)) binds.forEach(function(b) { ports.push((b.HostIp || '0.0.0.0') + ':' + b.HostPort + ' -> ' + containerPort) })
      })
      var mounts = (obj.Mounts || []).map(function(m) {
        return { type: m.Type || '', source: m.Source || '', destination: m.Destination || '', mode: m.Mode || '', rw: m.RW ? '读写' : '只读' }
      })
      var envs = (cfg.Env || []).map(function(e) {
        var idx = e.indexOf('=')
        return idx > -1 ? { key: e.slice(0, idx), value: e.slice(idx + 1) } : { key: e, value: '' }
      })
      var networks = {}
      if (netSettings.Networks) {
        Object.entries(netSettings.Networks).forEach(function(entry) {
          networks[entry[0]] = { ip: entry[1].IPAddress || '', gateway: entry[1].Gateway || '', mac: entry[1].MacAddress || '' }
        })
      }
      var labels = cfg.Labels || {}
      return {
        basic: [
          { label: '容器 ID', value: obj.Id ? obj.Id.slice(0, 12) : '' },
          { label: '完整 ID', value: obj.Id || '' },
          { label: '名称', value: (obj.Name || '').replace(/^\//, '') },
          { label: '镜像', value: cfg.Image || '' },
          { label: '镜像 ID', value: (obj.Image || '').replace('sha256:', '').slice(0, 12) },
          { label: '创建时间', value: obj.Created || '' },
          { label: '状态', value: state.Status || '' },
          { label: '启动时间', value: state.StartedAt || '' },
          { label: '停止时间', value: state.FinishedAt && state.FinishedAt !== '0001-01-01T00:00:00Z' ? state.FinishedAt : '-' },
          { label: '重启策略', value: hostCfg.RestartPolicy ? hostCfg.RestartPolicy.Name + '(max:' + hostCfg.RestartPolicy.MaximumRetryCount + ')' : '' },
          { label: '平台', value: obj.Platform || '' },
          { label: '工作目录', value: cfg.WorkingDir || '/' },
          { label: '启动命令', value: (cfg.Cmd || []).join(' ') || (cfg.Entrypoint || []).join(' ') || '' },
          { label: 'Entrypoint', value: (cfg.Entrypoint || []).join(' ') || '-' },
        ],
        resource: [
          { label: 'CPU 限制', value: hostCfg.NanoCpus ? (hostCfg.NanoCpus / 1e9).toFixed(2) + ' 核' : hostCfg.CpuShares ? hostCfg.CpuShares + ' shares' : '无限制' },
          { label: '内存限制', value: hostCfg.Memory ? formatBytes(hostCfg.Memory) : '无限制' },
          { label: '内存+Swap', value: hostCfg.MemorySwap && hostCfg.MemorySwap > 0 ? formatBytes(hostCfg.MemorySwap) : '无限制' },
          { label: 'PID 限制', value: hostCfg.PidsLimit && hostCfg.PidsLimit > 0 ? String(hostCfg.PidsLimit) : '无限制' },
          { label: '特权模式', value: hostCfg.Privileged ? '是' : '否' },
        ],
        ports: ports,
        mounts: mounts,
        envs: envs,
        networks: networks,
        labels: Object.entries(labels).map(function(entry) { return { key: entry[0], value: entry[1] } }),
      }
    }

    function shellQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'" }

    function formatBytes(bytes) {
      if (!bytes || bytes <= 0) return '0 B'
      var units = ['B', 'KB', 'MB', 'GB', 'TB']
      var i = Math.floor(Math.log(bytes) / Math.log(1024))
      return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
    }

    function doPullImage() {
      if (!pullImageName.value.trim()) return
      pulling.value = true; pullOutput.value = ''
      exec('docker pull ' + pullImageName.value.trim() + ' 2>&1').then(function(r) {
        pullOutput.value = r.stdout + r.stderr; pulling.value = false
        if (r.code === 0) { showMessage('拉取成功', 'success'); loadImages() } else showMessage('拉取失败', 'error')
      })
    }

    function doRemoveImage(id) {
      exec('docker rmi ' + id + ' 2>&1').then(function(r) {
        if (r.code !== 0) showMessage(r.stdout + r.stderr, 'error'); else { showMessage('已删除', 'success'); loadImages() }
      })
    }

    function createRunForm(image) {
      return {
        image: image, name: '', ports: [], volumes: [], envs: [], network: '', restart: '', detach: true, command: '', extraArgs: '',
        hostname: '', user: '', workdir: '', dns: '', dnsSearch: '',
        cpus: '', memory: '', memorySwap: '', shmSize: '', pidsLimit: '',
        privileged: false, readOnly: false, init: false,
        healthCmd: '', healthInterval: '', healthTimeout: '', healthRetries: '',
        labels: [],
      }
    }

    function showRunDialog(row) {
      var imageFull = row.tag && row.tag !== '<none>' ? row.repository + ':' + row.tag : row.repository
      runForm.value = createRunForm(imageFull)
      exec("docker network ls --format '{{.Name}}' 2>/dev/null").then(function(nr) {
        dockerNetworks.value = nr.code === 0 ? nr.stdout.trim().split('\n').filter(Boolean) : ['bridge', 'host', 'none']
        runDialogVisible.value = true
      })
    }

    function buildRunCommand() {
      var f = runForm.value; var parts = ['docker run']
      if (f.detach) parts.push('-d')
      if (f.name) parts.push('--name ' + f.name)
      if (f.restart) parts.push('--restart ' + f.restart)
      if (f.network) parts.push('--network ' + f.network)
      if (f.hostname) parts.push('--hostname ' + f.hostname)
      if (f.user) parts.push('--user ' + f.user)
      if (f.workdir) parts.push('--workdir ' + f.workdir)
      if (f.dns) parts.push('--dns ' + f.dns)
      if (f.dnsSearch) parts.push('--dns-search ' + f.dnsSearch)
      if (f.cpus) parts.push('--cpus=' + f.cpus)
      if (f.memory) parts.push('--memory=' + f.memory)
      if (f.memorySwap) parts.push('--memory-swap=' + f.memorySwap)
      if (f.shmSize) parts.push('--shm-size=' + f.shmSize)
      if (f.pidsLimit) parts.push('--pids-limit=' + f.pidsLimit)
      if (f.privileged) parts.push('--privileged')
      if (f.readOnly) parts.push('--read-only')
      if (f.init) parts.push('--init')
      if (f.healthCmd) {
        parts.push('--health-cmd="' + f.healthCmd + '"')
        if (f.healthInterval) parts.push('--health-interval=' + f.healthInterval)
        if (f.healthTimeout) parts.push('--health-timeout=' + f.healthTimeout)
        if (f.healthRetries) parts.push('--health-retries=' + f.healthRetries)
      }
      f.ports.forEach(function(p) { if (p.host && p.container) parts.push('-p ' + p.host + ':' + p.container + (p.protocol === 'udp' ? '/udp' : '')) })
      f.volumes.forEach(function(v) { if (v.host && v.container) parts.push('-v ' + v.host + ':' + v.container + (v.mode === 'ro' ? ':ro' : '')) })
      f.envs.forEach(function(e) { if (e.key) parts.push('-e ' + e.key + '=' + (e.value || '')) })
      f.labels.forEach(function(l) { if (l.key) parts.push('--label ' + l.key + '=' + (l.value || '')) })
      if (f.extraArgs) parts.push(f.extraArgs)
      parts.push(f.image)
      if (f.command) parts.push(f.command)
      return parts.join(' ')
    }

    function doRunContainer() {
      runningContainer.value = true
      exec(buildRunCommand() + ' 2>&1').then(function(r) {
        runningContainer.value = false
        if (r.code !== 0) { showMessage('运行失败: ' + (r.stdout + r.stderr).slice(0, 200), 'error'); return }
        showMessage('容器已启动', 'success'); runDialogVisible.value = false
        loadContainers().then(function() { subTab.value = 'containers' })
      })
    }

    function searchOnlineImages() {
      var q = imageSearchQuery.value.trim()
      if (!q) return
      imageSearching.value = true; imageSearchResults.value = []
      var httpFetch = window.electronAPI && window.electronAPI.httpFetch
      if (!httpFetch) { showMessage('API 不可用', 'error'); imageSearching.value = false; return }
      httpFetch('https://hub.docker.com/v2/search/repositories/?query=' + encodeURIComponent(q) + '&page_size=25').then(function(resp) {
        if (!resp.ok) throw new Error(resp.error || '请求失败')
        var data = JSON.parse(resp.data)
        imageSearchResults.value = (data.results || []).map(function(item) {
          return { name: item.repo_name || item.name || '', description: item.short_description || item.description || '', star_count: item.star_count || 0, pull_count: item.pull_count || 0, is_official: item.is_official || false, is_automated: item.is_automated || false }
        })
        imageSearching.value = false
      }).catch(function() { showMessage('检索失败，请检查网络', 'error'); imageSearching.value = false })
    }

    function formatStars(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0) }
    function formatPulls(n) { if (!n) return '0'; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(n) }

    function openPullDialog(imageName, mode) {
      mode = mode || 'pull'
      pullDialogImage.value = imageName
      pullDialogTag.value = 'latest'
      pullDialogTags.value = ['latest']
      pullDialogUseMirror.value = false
      pullDialogMirror.value = ''
      pullDialogMirrorPreset.value = ''
      pullDialogMode.value = mode
      pullDialogVisible.value = true
      loadImageTags()
    }

    function loadImageTags() {
      var name = pullDialogImage.value.trim()
      if (!name) return
      pullDialogLoadingTags.value = true
      var repo = name.includes('/') ? name : 'library/' + name
      var httpFetch = window.electronAPI && window.electronAPI.httpFetch
      if (!httpFetch) { pullDialogLoadingTags.value = false; return }
      httpFetch('https://hub.docker.com/v2/repositories/' + repo + '/tags/?page_size=50&ordering=last_updated').then(function(resp) {
        if (resp.ok) {
          var data = JSON.parse(resp.data)
          var tags = (data.results || []).map(function(t) { return t.name }).filter(Boolean)
          if (tags.length) pullDialogTags.value = tags
          else pullDialogTags.value = ['latest']
        }
        pullDialogLoadingTags.value = false
      }).catch(function() { pullDialogLoadingTags.value = false })
    }

    function onMirrorPresetChange(val) { if (val) pullDialogMirror.value = val }

    function buildPullCommand() {
      var name = pullDialogImage.value.trim() || 'nginx'
      var tag = pullDialogTag.value.trim() || 'latest'
      var full = pullDialogUseMirror.value && pullDialogMirror.value
        ? pullDialogMirror.value + '/' + name + ':' + tag
        : name + ':' + tag
      return 'docker pull ' + full
    }

    function doPullFromDialog() {
      pulling.value = true; pullOutput.value = ''
      var cmd = buildPullCommand() + ' 2>&1'
      exec(cmd).then(function(r) {
        pullOutput.value = r.stdout + r.stderr; pulling.value = false
        if (r.code !== 0) { showMessage('拉取失败', 'error'); return }
        showMessage('拉取成功', 'success')
        pullDialogVisible.value = false
        loadImages().then(function() {
          if (pullDialogMode.value === 'run') {
            var name = pullDialogImage.value.trim()
            var tag = pullDialogTag.value.trim() || 'latest'
            var imageFull = pullDialogUseMirror.value && pullDialogMirror.value ? pullDialogMirror.value + '/' + name + ':' + tag : name + ':' + tag
            runForm.value = createRunForm(imageFull)
            exec("docker network ls --format '{{.Name}}' 2>/dev/null").then(function(nr) {
              dockerNetworks.value = nr.code === 0 ? nr.stdout.trim().split('\n').filter(Boolean) : ['bridge', 'host', 'none']
              imageSearchVisible.value = false
              runDialogVisible.value = true
            })
          } else {
            imageSearchVisible.value = false
            subTab.value = 'images'
          }
        })
      })
    }

    function pullSearchedImage(row) { openPullDialog(row.name) }
    function runSearchedImage(row) { openPullDialog(row.name, 'run') }

    function writeToDockerTerminal(text) {
      if (!dockerShellId) { showMessage('终端未连接', 'warning'); return false }
      callSsh('writeShell', { profileId: props.profileId, shellId: dockerShellId, data: text })
      return true
    }

    function openTerminal(row) {
      if (terminalContainer.value && terminalContainer.value.id === row.id) return
      closeTerminal()
      terminalContainer.value = row
      nextTick(function() { mountDockerTerminal(row) })
    }

    function mountDockerTerminal(row) {
      if (!dockerTermHost.value) return
      if (!unsubShellData) {
        var onShellData = window.electronAPI && window.electronAPI.ssh && window.electronAPI.ssh.onShellData
        if (onShellData) {
          unsubShellData = onShellData(function(payload) {
            if (payload && payload.shellId === dockerShellId && payload.profileId === props.profileId && dockerTerminal) {
              dockerTerminal.write(String(payload.data || ''))
            }
          })
        }
      }
      try {
        var TerminalClass = window.Terminal || (window.xterm && window.xterm.Terminal)
        if (!TerminalClass) {
          dockerTermHost.value.innerHTML = '<pre style="color:#e5e7eb;padding:12px;font-size:12px;">Terminal (xterm) 未加载，交互终端不可用。\n请使用容器操作中的命令执行功能。</pre>'
          return
        }
        dockerTerminal = new TerminalClass({
          cursorBlink: true, fontFamily: 'Consolas, "Cascadia Mono", "Liberation Mono", monospace',
          fontSize: 13, rows: 20, cols: 110, theme: { background: '#0f172a', foreground: '#e5e7eb', cursor: '#f8fafc' }
        })
        dockerTerminal.open(dockerTermHost.value)
        dockerTerminal.attachCustomKeyEventHandler(function(e) {
          if (e.ctrlKey && e.shiftKey && e.code === 'KeyC' && e.type === 'keydown') {
            var sel = dockerTerminal.getSelection(); if (sel) navigator.clipboard.writeText(sel); return false
          }
          if (e.ctrlKey && e.shiftKey && e.code === 'KeyV' && e.type === 'keydown') {
            navigator.clipboard.readText().then(function(t) { if (t && dockerShellId) callSsh('writeShell', { profileId: props.profileId, shellId: dockerShellId, data: t }) }); return false
          }
          return true
        })
        dockerTerminal.focus()
        callSsh('startShell', { profileId: props.profileId, rows: 20, cols: 110 }).then(function(resp) {
          if (!resp || !resp.ok) { dockerTerminal.write('\r\n' + ((resp && resp.error) || 'Shell 启动失败') + '\r\n'); return }
          dockerShellId = resp.data.shellId
          if (resp.data.buffer) dockerTerminal.write(resp.data.buffer)
          dockerTerminal.onData(function(data) { callSsh('writeShell', { profileId: props.profileId, shellId: dockerShellId, data: data }) })
          setTimeout(function() {
            var shell = row.command && row.command.includes('bash') ? '/bin/bash' : '/bin/sh'
            callSsh('writeShell', { profileId: props.profileId, shellId: dockerShellId, data: 'docker exec -it ' + row.id + ' ' + shell + '\n' })
          }, 300)
        })
      } catch(e) {
        dockerTermHost.value.innerHTML = '<pre style="color:#e5e7eb;padding:12px;font-size:12px;">Terminal 加载失败: ' + String(e.message || e) + '</pre>'
      }
    }

    function closeTerminal() {
      if (dockerShellId) { callSsh('stopShell', { profileId: props.profileId, shellId: dockerShellId }); dockerShellId = '' }
      if (dockerTerminal) { dockerTerminal.dispose(); dockerTerminal = null }
      terminalContainer.value = null; toolbarExpanded.value = false
    }

    function sendQuickInput() {
      if (!quickInputText.value.trim()) return
      var text = quickInputText.value
      if (!text.endsWith('\n')) text += '\n'
      if (writeToDockerTerminal(text)) quickInputText.value = ''
    }

    function buildPresetTree(parentId, depth) {
      parentId = parentId || ''
      depth = depth || 0
      var nodes = []
      var children = presetCommands.value.filter(function(c) { return (c.parentId || '') === parentId }).sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0) })
      for (var ci = 0; ci < children.length; ci++) {
        var child = children[ci]
        nodes.push(Object.assign({}, child, { depth: depth }))
        if (child.type === 'group' && presetExpandedIds.value.has(child.id)) {
          var sub = buildPresetTree(child.id, depth + 1)
          for (var si = 0; si < sub.length; si++) nodes.push(sub[si])
        }
      }
      return nodes
    }

    function togglePresetGroup(id) { if (presetExpandedIds.value.has(id)) presetExpandedIds.value.delete(id); else presetExpandedIds.value.add(id) }

    function loadPresetCommands() {
      callSsh('listPresetCommands').then(function(res) {
        if (res && res.ok) presetCommands.value = res.data || []
      })
    }

    function newPresetCommand() {
      Object.assign(presetForm, { id: '', type: 'command', name: '', command: '', params: '', remark: '', parentId: '' })
      presetFormParams.value = []; presetDialogVisible.value = true
    }
    function newPresetGroup() {
      Object.assign(presetForm, { id: '', type: 'group', name: '', command: '', params: '', remark: '', parentId: '' })
      presetFormParams.value = []; presetDialogVisible.value = true
    }
    function editPresetItem(item) {
      Object.assign(presetForm, { id: item.id, type: item.type, name: item.name, command: item.command || '', params: item.params || '', remark: item.remark || '', parentId: item.parentId || '' })
      try { presetFormParams.value = JSON.parse(item.params || '[]') } catch(e) { presetFormParams.value = [] }
      presetDialogVisible.value = true
    }

    function addPresetParam() {
      var n = newParamName.value.trim(); if (!n) return
      if (!presetFormParams.value.includes(n)) presetFormParams.value.push(n)
      newParamName.value = ''
    }
    function removePresetParam(idx) { presetFormParams.value.splice(idx, 1) }
    function insertParamPlaceholder(paramName) { presetForm.command = (presetForm.command || '') + '{{' + paramName + '}}' }

    function savePresetItem() {
      if (!presetForm.name.trim()) { showMessage('请输入名称', 'warning'); return }
      savingPreset.value = true
      var payload = Object.assign({}, presetForm, { params: JSON.stringify(presetFormParams.value) })
      callSsh('savePresetCommand', payload).then(function(res) {
        savingPreset.value = false
        if (!res || !res.ok) { showMessage((res && res.error) || '保存失败', 'error'); return }
        showMessage('已保存', 'success'); presetDialogVisible.value = false; loadPresetCommands()
      })
    }

    function deletePresetItem(id) {
      callSsh('deletePresetCommand', id).then(function(res) {
        if (!res || !res.ok) { showMessage((res && res.error) || '删除失败', 'error'); return }
        loadPresetCommands()
      })
    }

    function executePresetCommand(node) {
      var cmd = node.command || ''
      var matches = cmd.match(/\{\{([^}]+)\}\}/g) || []
      var placeholders = []
      var seen = {}
      for (var mi = 0; mi < matches.length; mi++) {
        var name = matches[mi].slice(2, -2)
        if (!seen[name]) { placeholders.push(name); seen[name] = true }
      }
      if (placeholders.length === 0) { writeToDockerTerminal(cmd.endsWith('\n') ? cmd : cmd + '\n'); return }
      presetExecCommand.value = cmd
      presetExecParams.value = placeholders.map(function(name) { return { name: name, value: '' } })
      presetExecDialogVisible.value = true
    }

    function confirmExecutePreset() {
      var cmd = presetExecCommand.value
      for (var pi = 0; pi < presetExecParams.value.length; pi++) {
        var p = presetExecParams.value[pi]
        cmd = cmd.split('{{' + p.name + '}}').join(p.value)
      }
      if (!cmd.endsWith('\n')) cmd += '\n'
      writeToDockerTerminal(cmd); presetExecDialogVisible.value = false
    }

    function checkAiConfig() {
      try {
        var toolsMod = null
        import('../../utils/api/tools').then(function(m) {
          toolsMod = m
          return m.fetchToolsConfig()
        }).then(function(res) {
          aiConfigured.value = Boolean(res && res.data && res.data.ai && res.data.ai.baseUrl && res.data.ai.apiKey)
        }).catch(function() { aiConfigured.value = false })
      } catch(e) { aiConfigured.value = false }
    }

    function generateAiCommand() {
      if (!aiPrompt.value.trim()) { showMessage('请输入需求', 'warning'); return }
      aiGenerating.value = true; aiDescription.value = ''; aiCommandText.value = ''
      import('../../utils/api/tools').then(function(m) {
        return m.aiChat(aiPrompt.value)
      }).then(function(res) {
        if (res && res.code === 200 && res.data) { aiDescription.value = res.data.description || ''; aiCommandText.value = res.data.command || '' }
        else showMessage((res && res.message) || 'AI 请求失败', 'error')
        aiGenerating.value = false
      }).catch(function() { showMessage('AI 请求异常', 'error'); aiGenerating.value = false })
    }

    function sendAiCommand() {
      if (!aiCommandText.value.trim()) return
      var cmd = aiCommandText.value; if (!cmd.endsWith('\n')) cmd += '\n'
      writeToDockerTerminal(cmd)
    }

    function openFileManager(row) {
      if (fileContainer.value && fileContainer.value.id === row.id) return
      fileContainer.value = row; fileCwd.value = '/'
      browseContainerDir('/')
    }

    function closeFileManager() { fileContainer.value = null; fileList.value = [] }

    function containerFilePath(name) {
      return fileCwd.value === '/' ? '/' + name : fileCwd.value + '/' + name
    }

    function browseContainerDir(dir) {
      if (!fileContainer.value) return Promise.resolve()
      loadingFiles.value = true
      var path = dir || '/'
      fileCwd.value = path
      return exec("docker exec " + fileContainer.value.id + " ls -la '" + path + "' 2>&1").then(function(r) {
        if (r.code !== 0) { showMessage('无法读取目录', 'error'); loadingFiles.value = false; return }
        var lines = r.stdout.trim().split('\n').slice(1)
        fileList.value = lines.map(function(line) {
          var parts = line.split(/\s+/)
          if (parts.length < 9) return null
          var permissions = parts[0], size = parts[4], date = parts[5] + ' ' + parts[6] + ' ' + parts[7], name = parts.slice(8).join(' ')
          if (name === '.' || name === '..') return null
          var isDir = permissions.startsWith('d')
          return { name: name, size: isDir ? '-' : size, date: date, permissions: permissions, isDir: isDir }
        }).filter(Boolean)
        loadingFiles.value = false
      })
    }

    function enterContainerDir(name) { browseContainerDir(containerFilePath(name)) }
    function fileGoUp() { browseContainerDir(fileCwd.value.replace(/\/[^/]*$/, '') || '/') }

    function onFileDblClick(row) {
      if (row.isDir) enterContainerDir(row.name)
      else openContainerFileEditor(row)
    }

    function openContainerFileEditor(row) {
      if (row.isDir) return
      var remotePath = containerFilePath(row.name)
      fileEditorPath.value = remotePath; fileEditorContent.value = ''; fileEditorLoading.value = true; fileEditorVisible.value = true
      exec("docker exec " + fileContainer.value.id + " cat '" + remotePath + "' 2>&1").then(function(r) {
        fileEditorLoading.value = false
        if (r.code !== 0) { showMessage('读取文件失败', 'error'); fileEditorVisible.value = false; return }
        fileEditorContent.value = r.stdout
      })
    }

    function saveContainerFile() {
      fileEditorSaving.value = true
      exec("docker exec " + fileContainer.value.id + " sh -c 'cat > \"'\"'\"'" + fileEditorPath.value + "\"'\"'\"' <<'\"'\"'RANPAK_EOF'\"'\"'\\n" + fileEditorContent.value + "\\nRANPAK_EOF'").then(function(r) {
        if (r.code !== 0) {
          return exec("docker exec -i " + fileContainer.value.id + " tee '" + fileEditorPath.value + "' > /dev/null <<'RANPAK_EOF'\n" + fileEditorContent.value + "\nRANPAK_EOF")
        }
        return r
      }).then(function(r) {
        if (r.code !== 0) { showMessage('保存失败', 'error'); fileEditorSaving.value = false; return }
        showMessage('文件已保存', 'success'); fileEditorSaving.value = false; fileEditorVisible.value = false
        browseContainerDir(fileCwd.value)
      })
    }

    function createDirInContainer() {
      showPrompt('输入目录名', '新建目录').then(function(result) {
        var name = String((result && result.value) || '').trim()
        if (!name) return
        exec("docker exec " + fileContainer.value.id + " mkdir -p '" + containerFilePath(name) + "' 2>&1").then(function(r) {
          if (r.code !== 0) showMessage('创建失败: ' + r.stderr, 'error'); else browseContainerDir(fileCwd.value)
        })
      }).catch(function() {})
    }

    function renameInContainer(row) {
      showPrompt('输入新名称', '重命名', { inputValue: row.name }).then(function(result) {
        var newName = String((result && result.value) || '').trim()
        if (!newName || newName === row.name) return
        exec("docker exec " + fileContainer.value.id + " mv '" + containerFilePath(row.name) + "' '" + containerFilePath(newName) + "' 2>&1").then(function(r) {
          if (r.code !== 0) showMessage('重命名失败', 'error'); else browseContainerDir(fileCwd.value)
        })
      }).catch(function() {})
    }

    function downloadFromContainer(row) {
      var fullPath = containerFilePath(row.name)
      var tmpPath = '/tmp/_ranpak_dl_' + Date.now() + '_' + row.name
      exec("docker cp " + fileContainer.value.id + ":'" + fullPath + "' '" + tmpPath + "' 2>&1").then(function(cp) {
        if (cp.code !== 0) { showMessage('复制失败', 'error'); return }
        exec("cat '" + tmpPath + "' 2>/dev/null").then(function(cat) {
          exec("rm -f '" + tmpPath + "'")
          if (cat.code !== 0) { showMessage('读取失败', 'error'); return }
          var blob = new Blob([cat.stdout], { type: 'application/octet-stream' })
          var url = URL.createObjectURL(blob)
          var a = document.createElement('a'); a.href = url; a.download = row.name; a.click()
          URL.revokeObjectURL(url); showMessage('已下载', 'success')
        })
      })
    }

    function deleteInContainer(row) {
      showConfirm('确定删除 ' + row.name + '？', '删除', { type: 'warning' }).then(function() {
        var flag = row.isDir ? '-rf' : ''
        exec("docker exec " + fileContainer.value.id + " rm " + flag + " '" + containerFilePath(row.name) + "' 2>&1").then(function(r) {
          if (r.code !== 0) showMessage('删除失败', 'error'); else { showMessage('已删除', 'success'); browseContainerDir(fileCwd.value) }
        })
      }).catch(function() {})
    }

    function showUploadDialog() { uploadHostPath.value = ''; uploadContainerPath.value = fileCwd.value; uploadVisible.value = true }

    function doUploadToContainer() {
      if (!uploadHostPath.value.trim()) { showMessage('请输入宿主机路径', 'warning'); return }
      uploading.value = true
      var target = uploadContainerPath.value.trim() || fileCwd.value
      exec("docker cp '" + uploadHostPath.value.trim() + "' " + fileContainer.value.id + ":'" + target + "' 2>&1").then(function(r) {
        uploading.value = false
        if (r.code !== 0) { showMessage('上传失败: ' + r.stderr, 'error'); return }
        showMessage('上传成功', 'success'); uploadVisible.value = false; browseContainerDir(fileCwd.value)
      })
    }

    function composeDo(dir, action) {
      var cmd = ''
      if (action === 'up') cmd = "cd '" + dir + "' && docker compose up -d 2>&1"
      else if (action === 'down') cmd = "cd '" + dir + "' && docker compose down 2>&1"
      else if (action === 'restart') cmd = "cd '" + dir + "' && docker compose restart 2>&1"
      else if (action === 'pull') cmd = "cd '" + dir + "' && docker compose pull 2>&1"
      exec(cmd).then(function(r) {
        if (r.code !== 0) showMessage(r.stdout + r.stderr, 'warning'); else showMessage(action + ' 成功', 'success')
      })
    }

    function showComposeLogs(row) {
      composeLogsDir.value = row.dir
      composeLogContent.value = ''
      composeLogsVisible.value = true
      doRefreshComposeLog()
    }

    function doRefreshComposeLog() {
      composeLogLoading.value = true
      var base = "cd '" + composeLogsDir.value + "' && docker compose logs --tail " + composeLogLines.value + " 2>&1"
      var kw = composeLogKeyword.value.trim()
      var cmd = kw ? base + ' | grep ' + (composeLogIgnoreCase.value ? '-i' : '') + ' -- ' + shellQuote(kw) : base
      exec(cmd).then(function(r) {
        composeLogContent.value = r.stdout || '（无日志）'
        composeLogLoading.value = false
      })
    }

    function editComposeFile(row) {
      composeEditorDir.value = row.dir
      composeEditorFile.value = row.file
      composeEditorEditMode.value = 'visual'
      composeEditorServices.value = []
      composeEditorNetworks.value = []
      composeEditorVolumes.value = []
      exec("cat '" + row.dir + "/" + row.file + "' 2>/dev/null").then(function(r) {
        composeEditorContent.value = r.stdout || ''
        return exec("cd '" + row.dir + "' && docker compose config --format json 2>/dev/null")
      }).then(function(jr) {
        if (jr.code === 0 && jr.stdout.trim()) {
          try {
            var cfg = JSON.parse(jr.stdout)
            parseComposeConfig(cfg, composeEditorServices, composeEditorNetworks, composeEditorVolumes)
          } catch(e) { /* fallback to yaml mode */ }
        }
        if (!composeEditorServices.value.length) composeEditorEditMode.value = 'yaml'
        composeEditorVisible.value = true
      })
    }

    function createComposeService(name) {
      return {
        name: name || '', image: '', build: '', containerName: '', hostname: '',
        restart: 'unless-stopped', command: '', entrypoint: '', user: '', workingDir: '',
        ports: [], volumes: [], envs: [], labels: [],
        dependsOn: [], networks: [],
        cpus: '', memLimit: '', memReservation: '', shmSize: '',
        healthCmd: '', healthInterval: '', healthTimeout: '', healthRetries: '',
        privileged: false, readOnly: false, init: false, stdinOpen: false, tty: false,
        collapsed: false,
      }
    }

    function addComposeService() {
      var idx = composeServices.value.length + 1
      composeServices.value.push(createComposeService('service_' + idx))
    }

    function removeComposeService(i) { composeServices.value.splice(i, 1) }

    function generateComposeYaml() {
      return generateComposeYamlFrom(composeServices.value, composeNetworkList.value, composeVolumeList.value)
    }

    function generateComposeYamlFrom(svcs, nets, vols) {
      var doc = { version: '3.8', services: {} }
      for (var si = 0; si < svcs.length; si++) {
        var svc = svcs[si]
        if (!svc.name) continue
        var s = {}
        if (svc.image) s.image = svc.image
        if (svc.build) s.build = svc.build
        if (svc.containerName) s.container_name = svc.containerName
        if (svc.hostname) s.hostname = svc.hostname
        if (svc.restart) s.restart = svc.restart
        if (svc.command) s.command = svc.command
        if (svc.entrypoint) s.entrypoint = svc.entrypoint
        if (svc.user) s.user = svc.user
        if (svc.workingDir) s.working_dir = svc.workingDir
        if (svc.privileged) s.privileged = true
        if (svc.readOnly) s.read_only = true
        if (svc.init) s.init = true
        if (svc.stdinOpen) s.stdin_open = true
        if (svc.tty) s.tty = true
        var ports = svc.ports.filter(function(p) { return p.host && p.container }).map(function(p) { return p.host + ':' + p.container + (p.protocol === 'udp' ? '/udp' : '') })
        if (ports.length) s.ports = ports
        var volumes = svc.volumes.filter(function(v) { return v.host && v.container }).map(function(v) { return v.host + ':' + v.container + (v.mode === 'ro' ? ':ro' : '') })
        if (volumes.length) s.volumes = volumes
        var env = {}
        for (var ei = 0; ei < svc.envs.length; ei++) { if (svc.envs[ei].key) env[svc.envs[ei].key] = svc.envs[ei].value || '' }
        if (Object.keys(env).length) s.environment = env
        var lbl = {}
        for (var li = 0; li < svc.labels.length; li++) { if (svc.labels[li].key) lbl[svc.labels[li].key] = svc.labels[li].value || '' }
        if (Object.keys(lbl).length) s.labels = lbl
        var deps = svc.dependsOn.filter(Boolean)
        if (deps.length) s.depends_on = deps
        var netArr = svc.networks.filter(Boolean)
        if (netArr.length) s.networks = netArr
        var deploy = {}
        var resLimits = {}; var resReserv = {}
        if (svc.cpus) resLimits.cpus = svc.cpus
        if (svc.memLimit) resLimits.memory = svc.memLimit
        if (svc.memReservation) resReserv.memory = svc.memReservation
        if (Object.keys(resLimits).length) deploy.resources = Object.assign({}, deploy.resources, { limits: resLimits })
        if (Object.keys(resReserv).length) deploy.resources = Object.assign({}, deploy.resources || {}, { reservations: resReserv })
        if (Object.keys(deploy).length) s.deploy = deploy
        if (svc.shmSize) s.shm_size = svc.shmSize
        if (svc.healthCmd) {
          s.healthcheck = { test: ['CMD-SHELL', svc.healthCmd] }
          if (svc.healthInterval) s.healthcheck.interval = svc.healthInterval
          if (svc.healthTimeout) s.healthcheck.timeout = svc.healthTimeout
          if (svc.healthRetries) s.healthcheck.retries = parseInt(svc.healthRetries) || 3
        }
        doc.services[svc.name] = s
      }
      if (nets.length) {
        doc.networks = {}
        for (var ni = 0; ni < nets.length; ni++) { if (nets[ni].name) doc.networks[nets[ni].name] = nets[ni].driver ? { driver: nets[ni].driver } : {} }
      }
      if (vols.length) {
        doc.volumes = {}
        for (var vi = 0; vi < vols.length; vi++) { if (vols[vi].name) doc.volumes[vols[vi].name] = vols[vi].driver ? { driver: vols[vi].driver } : {} }
      }
      return toYaml(doc)
    }

    function toYaml(obj, indent) {
      indent = indent || 0
      var pad = ''
      for (var pi = 0; pi < indent; pi++) pad += ' '
      var out = ''
      var entries = Object.entries(obj)
      for (var ei = 0; ei < entries.length; ei++) {
        var k = entries[ei][0], v = entries[ei][1]
        if (v === null || v === undefined) continue
        if (Array.isArray(v)) {
          out += pad + k + ':\n'
          for (var ai = 0; ai < v.length; ai++) {
            if (typeof v[ai] === 'object') out += pad + '  - ' + toYaml(v[ai], indent + 4).trimStart()
            else out += pad + '  - ' + yamlVal(v[ai]) + '\n'
          }
        } else if (typeof v === 'object') {
          out += pad + k + ':\n' + toYaml(v, indent + 2)
        } else {
          out += pad + k + ': ' + yamlVal(v) + '\n'
        }
      }
      return out
    }

    function yamlVal(v) {
      if (typeof v === 'boolean') return v ? 'true' : 'false'
      if (typeof v === 'number') return String(v)
      var s = String(v)
      if (/[:#{}[\],&*?|>!%@`]/.test(s) || s === '' || /^\s|\s$/.test(s)) return '"' + s.replace(/"/g, '\\"') + '"'
      return s
    }

    function parseComposeConfig(cfg, svcRef, netRef, volRef) {
      var services = cfg.services || {}
      svcRef.value = Object.entries(services).map(function(entry) {
        var name = entry[0], s = entry[1]
        var svc = createComposeService(name)
        svc.image = s.image || ''
        svc.build = typeof s.build === 'string' ? s.build : ((s.build && s.build.context) || '')
        svc.containerName = s.container_name || ''
        svc.hostname = s.hostname || ''
        svc.restart = s.restart || ''
        svc.command = Array.isArray(s.command) ? s.command.join(' ') : (s.command || '')
        svc.entrypoint = Array.isArray(s.entrypoint) ? s.entrypoint.join(' ') : (s.entrypoint || '')
        svc.user = s.user || ''
        svc.workingDir = s.working_dir || ''
        svc.privileged = !!s.privileged
        svc.readOnly = !!s.read_only
        svc.init = !!s.init
        svc.stdinOpen = !!s.stdin_open
        svc.tty = !!s.tty
        svc.shmSize = s.shm_size || ''

        if (Array.isArray(s.ports)) {
          svc.ports = s.ports.map(function(p) {
            if (typeof p === 'string') {
              var proto = p.includes('/udp') ? 'udp' : 'tcp'
              var clean = p.replace(/\/(tcp|udp)$/, '')
              var parts = clean.split(':')
              return { host: parts.length > 1 ? parts[0] : '', container: parts.length > 1 ? parts[1] : parts[0], protocol: proto }
            }
            return { host: String(p.published || ''), container: String(p.target || ''), protocol: p.protocol || 'tcp' }
          })
        }

        if (Array.isArray(s.volumes)) {
          svc.volumes = s.volumes.map(function(v) {
            if (typeof v === 'string') {
              var parts = v.split(':')
              var mode = parts[2] === 'ro' ? 'ro' : 'rw'
              return { host: parts[0] || '', container: parts[1] || '', mode: mode }
            }
            return { host: v.source || '', container: v.target || '', mode: v.read_only ? 'ro' : 'rw' }
          })
        }

        var env = s.environment
        if (env) {
          if (Array.isArray(env)) svc.envs = env.map(function(e) { var i = e.indexOf('='); return i > -1 ? { key: e.slice(0, i), value: e.slice(i + 1) } : { key: e, value: '' } })
          else svc.envs = Object.entries(env).map(function(entry) { return { key: entry[0], value: entry[1] != null ? String(entry[1]) : '' } })
        }

        var lbl = s.labels
        if (lbl) {
          if (Array.isArray(lbl)) svc.labels = lbl.map(function(l) { var i = l.indexOf('='); return i > -1 ? { key: l.slice(0, i), value: l.slice(i + 1) } : { key: l, value: '' } })
          else svc.labels = Object.entries(lbl).map(function(entry) { return { key: entry[0], value: entry[1] != null ? String(entry[1]) : '' } })
        }

        if (Array.isArray(s.depends_on)) svc.dependsOn = s.depends_on
        else if (s.depends_on && typeof s.depends_on === 'object') svc.dependsOn = Object.keys(s.depends_on)

        if (Array.isArray(s.networks)) svc.networks = s.networks
        else if (s.networks && typeof s.networks === 'object') svc.networks = Object.keys(s.networks)

        var deploy = s.deploy || {}
        var limits = (deploy.resources && deploy.resources.limits) || {}
        var reserv = (deploy.resources && deploy.resources.reservations) || {}
        if (limits.cpus) svc.cpus = String(limits.cpus)
        if (limits.memory) svc.memLimit = String(limits.memory)
        if (reserv.memory) svc.memReservation = String(reserv.memory)

        var hc = s.healthcheck || {}
        if (hc.test) {
          var hcCmd = Array.isArray(hc.test) ? hc.test.filter(function(t) { return t !== 'CMD-SHELL' && t !== 'CMD' }).join(' ') : String(hc.test)
          svc.healthCmd = hcCmd
        }
        if (hc.interval) svc.healthInterval = String(hc.interval)
        if (hc.timeout) svc.healthTimeout = String(hc.timeout)
        if (hc.retries) svc.healthRetries = String(hc.retries)

        svc.collapsed = true
        return svc
      })

      var cfgNets = cfg.networks || {}
      netRef.value = Object.entries(cfgNets).map(function(entry) { return { name: entry[0], driver: (entry[1] && entry[1].driver) || '' } })

      var cfgVols = cfg.volumes || {}
      volRef.value = Object.entries(cfgVols).map(function(entry) { return { name: entry[0], driver: (entry[1] && entry[1].driver) || '' } })
    }

    function saveComposeFile() {
      var yaml = composeEditorEditMode.value === 'visual'
        ? generateComposeYamlFrom(composeEditorServices.value, composeEditorNetworks.value, composeEditorVolumes.value)
        : composeEditorContent.value
      if (!yaml.trim()) { showMessage('内容为空', 'warning'); return }
      savingCompose.value = true
      exec("sudo tee '" + composeEditorDir.value + "/" + composeEditorFile.value + "' > /dev/null <<'RANPAK_EOF'\n" + yaml + "\nRANPAK_EOF").then(function(r) {
        savingCompose.value = false
        if (r.code !== 0) { showMessage('保存失败', 'error'); return }
        showMessage('已保存', 'success'); composeEditorVisible.value = false
      })
    }

    function showNewCompose() {
      newComposeDir.value = ''
      newComposeContent.value = ''
      composeEditMode.value = 'visual'
      composeServices.value = [createComposeService('web')]
      composeServices.value[0].image = 'nginx:latest'
      composeServices.value[0].ports = [{ host: '80', container: '80', protocol: 'tcp' }]
      composeNetworkList.value = []
      composeVolumeList.value = []
      newComposeVisible.value = true
    }

    function createCompose() {
      if (!newComposeDir.value.trim()) { showMessage('请输入目录路径', 'warning'); return }
      var yaml = composeEditMode.value === 'visual' ? generateComposeYaml() : newComposeContent.value
      if (!yaml.trim()) { showMessage('内容为空', 'warning'); return }
      creatingCompose.value = true; var dir = newComposeDir.value.trim()
      exec("mkdir -p '" + dir + "'").then(function() {
        return exec("tee '" + dir + "/compose.yml' > /dev/null <<'RANPAK_EOF'\n" + yaml + "\nRANPAK_EOF")
      }).then(function(wr) {
        if (wr.code !== 0) { showMessage('写入失败', 'error'); creatingCompose.value = false; return Promise.reject() }
        return exec("cd '" + dir + "' && docker compose up -d 2>&1")
      }).then(function(r) {
        creatingCompose.value = false
        if (r.code !== 0) showMessage('启动可能有问题: ' + r.stdout + r.stderr, 'warning')
        else showMessage('项目已创建并启动', 'success')
        newComposeVisible.value = false; loadComposeProjects()
      }).catch(function() { creatingCompose.value = false })
    }

    function startInstall() {
      installing.value = true; installLog.value = ''; installStatus.value = 'running'
      if (remoteConfigInstance) remoteConfigInstance.set('docker', 'installMirror', installMirror.value)
      var steps = [
        'curl -fsSL https://get.docker.com -o /tmp/get-docker.sh',
        'DOWNLOAD_URL=' + installMirror.value + ' CHANNEL=' + installChannel.value + ' sudo sh /tmp/get-docker.sh',
        'sudo systemctl enable docker',
        'sudo systemctl start docker',
        'rm -f /tmp/get-docker.sh'
      ]
      var chain = Promise.resolve()
      var failed = false
      steps.forEach(function(cmd) {
        chain = chain.then(function() {
          if (failed) return
          installLog.value += '\n$ ' + cmd + '\n'; scrollLog()
          return exec(cmd).then(function(r) {
            installLog.value += r.stdout + (r.stderr ? '\n' + r.stderr : ''); scrollLog()
            if (r.code !== 0 && cmd.includes('get-docker.sh') && cmd.startsWith('DOWNLOAD')) {
              installStatus.value = 'error'; installLog.value += '\n安装失败\n'; failed = true
            }
          })
        })
      })
      chain.then(function() {
        if (!failed) {
          installStatus.value = 'done'; installLog.value += '\nDocker 安装完成\n'
        }
      })
    }

    function scrollLog() { nextTick(function() { if (installLogRef.value) installLogRef.value.scrollTop = installLogRef.value.scrollHeight }) }

    function recheckDocker() {
      installing.value = false; installLog.value = ''; checkDone.value = false
      checkDocker().then(function() { if (installed.value) { loadContainers(); loadImages() } })
    }

    function initWithConfig() {
      remoteConfigInstance = useRemoteConfig(exec)
      return remoteConfigInstance.ensureLoaded().then(function() {
        var savedMirror = remoteConfigInstance.get('docker', 'installMirror', '')
        if (savedMirror) installMirror.value = savedMirror
        return checkDocker()
      }).then(function() {
        if (installed.value) return Promise.all([loadContainers(), loadImages()])
      })
    }

    onMounted(function() {
      if (!props.profileId) return
      initWithConfig().then(function() {
        loadPresetCommands()
        checkAiConfig()
      })
    })

    onBeforeUnmount(function() {
      closeTerminal()
      if (unsubShellData) { unsubShellData(); unsubShellData = null }
    })

    watch(function() { return props.profileId }, function(id) {
      closeTerminal(); closeFileManager()
      if (!id) return
      checkDone.value = false; installed.value = false; containers.value = []; images.value = []; composeProjects.value = []
      initWithConfig()
    })

    watch(subTab, function(tab) { if (tab === 'compose' && composeProjects.value.length === 0) loadComposeProjects() })
    watch(composeEditMode, function(mode) { if (mode === 'yaml' && composeServices.value.length) newComposeContent.value = generateComposeYaml() })
    watch(composeEditorEditMode, function(mode) { if (mode === 'yaml' && composeEditorServices.value.length) composeEditorContent.value = generateComposeYamlFrom(composeEditorServices.value, composeEditorNetworks.value, composeEditorVolumes.value) })

    return {
      PlusIcon: PlusIcon, RefreshIcon: RefreshIcon, DeleteIcon: DeleteIcon, ArrowLeftIcon: ArrowLeftIcon,
      FolderAddIcon: FolderAddIcon, EditIcon: EditIcon, EditPenIcon: EditPenIcon, DownloadIcon: DownloadIcon,
      checkDone: checkDone, installed: installed, dockerVersion: dockerVersion, composeVersion: composeVersion,
      refreshing: refreshing, subTab: subTab,
      installing: installing, installMirror: installMirror, installChannel: installChannel,
      installLog: installLog, installStatus: installStatus, installLogRef: installLogRef,
      installStatusText: installStatusText,
      containers: containers, containerFilter: containerFilter, containerSearch: containerSearch,
      filteredContainers: filteredContainers,
      images: images, pullImageName: pullImageName, pulling: pulling, pullOutput: pullOutput,
      composeProjects: composeProjects, loadingCompose: loadingCompose,
      logsVisible: logsVisible, logsContainerName: logsContainerName,
      logLines: logLines, logKeyword: logKeyword, logIgnoreCase: logIgnoreCase, logContent: logContent, logLoading: logLoading,
      inspectVisible: inspectVisible, inspectName: inspectName, inspectContent: inspectContent, inspectParsed: inspectParsed,
      inspectNetworkList: inspectNetworkList,
      composeLogsVisible: composeLogsVisible, composeLogsDir: composeLogsDir,
      composeLogLines: composeLogLines, composeLogKeyword: composeLogKeyword,
      composeLogIgnoreCase: composeLogIgnoreCase, composeLogContent: composeLogContent, composeLogLoading: composeLogLoading,
      composeEditorVisible: composeEditorVisible, composeEditorDir: composeEditorDir,
      composeEditorContent: composeEditorContent, savingCompose: savingCompose,
      composeEditorEditMode: composeEditorEditMode,
      composeEditorServices: composeEditorServices, composeEditorNetworks: composeEditorNetworks,
      composeEditorVolumes: composeEditorVolumes,
      newComposeVisible: newComposeVisible, newComposeDir: newComposeDir,
      newComposeContent: newComposeContent, creatingCompose: creatingCompose,
      composeEditMode: composeEditMode, composeServices: composeServices,
      composeNetworkList: composeNetworkList, composeVolumeList: composeVolumeList,
      existingImageOptions: existingImageOptions,
      runDialogVisible: runDialogVisible, runningContainer: runningContainer,
      dockerNetworks: dockerNetworks, runForm: runForm,
      terminalContainer: terminalContainer, dockerTermHost: dockerTermHost,
      toolbarExpanded: toolbarExpanded, toolbarTab: toolbarTab, quickInputText: quickInputText,
      presetCommands: presetCommands, presetExpandedIds: presetExpandedIds,
      presetDialogVisible: presetDialogVisible, presetForm: presetForm,
      presetFormParams: presetFormParams, newParamName: newParamName, presetCmdInput: presetCmdInput,
      presetExecDialogVisible: presetExecDialogVisible, presetExecParams: presetExecParams,
      presetExecPreview: presetExecPreview,
      presetGroupOptions: presetGroupOptions, presetTreeNodes: presetTreeNodes,
      savingPreset: savingPreset,
      aiPrompt: aiPrompt, aiCommandText: aiCommandText, aiDescription: aiDescription,
      aiGenerating: aiGenerating, aiConfigured: aiConfigured,
      fileContainer: fileContainer, fileCwd: fileCwd, fileList: fileList, loadingFiles: loadingFiles,
      fileEditorVisible: fileEditorVisible, fileEditorLoading: fileEditorLoading,
      fileEditorSaving: fileEditorSaving, fileEditorPath: fileEditorPath, fileEditorContent: fileEditorContent,
      uploadVisible: uploadVisible, uploadHostPath: uploadHostPath,
      uploadContainerPath: uploadContainerPath, uploading: uploading,
      imageSearchVisible: imageSearchVisible, imageSearchQuery: imageSearchQuery,
      imageSearchRegistry: imageSearchRegistry, imageSearchResults: imageSearchResults,
      imageSearching: imageSearching,
      pullDialogVisible: pullDialogVisible, pullDialogImage: pullDialogImage,
      pullDialogTag: pullDialogTag, pullDialogTags: pullDialogTags,
      pullDialogLoadingTags: pullDialogLoadingTags, pullDialogUseMirror: pullDialogUseMirror,
      pullDialogMirror: pullDialogMirror, commonMirrors: commonMirrors,
      pullDialogMirrorPreset: pullDialogMirrorPreset, pullDialogMode: pullDialogMode,
      refreshCurrent: refreshCurrent, containerDo: containerDo, handleContainerCmd: handleContainerCmd,
      handleComposeCmd: handleComposeCmd,
      doPullImage: doPullImage, doRemoveImage: doRemoveImage,
      showRunDialog: showRunDialog, buildRunCommand: buildRunCommand, doRunContainer: doRunContainer,
      searchOnlineImages: searchOnlineImages, formatStars: formatStars, formatPulls: formatPulls,
      pullSearchedImage: pullSearchedImage, runSearchedImage: runSearchedImage,
      openPullDialog: openPullDialog, loadImageTags: loadImageTags,
      onMirrorPresetChange: onMirrorPresetChange, buildPullCommand: buildPullCommand,
      doPullFromDialog: doPullFromDialog,
      openTerminal: openTerminal, closeTerminal: closeTerminal,
      sendQuickInput: sendQuickInput,
      togglePresetGroup: togglePresetGroup, newPresetCommand: newPresetCommand, newPresetGroup: newPresetGroup,
      editPresetItem: editPresetItem, addPresetParam: addPresetParam, removePresetParam: removePresetParam,
      insertParamPlaceholder: insertParamPlaceholder, savePresetItem: savePresetItem,
      deletePresetItem: deletePresetItem, executePresetCommand: executePresetCommand,
      confirmExecutePreset: confirmExecutePreset,
      generateAiCommand: generateAiCommand, sendAiCommand: sendAiCommand,
      openFileManager: openFileManager, closeFileManager: closeFileManager,
      browseContainerDir: browseContainerDir, enterContainerDir: enterContainerDir, fileGoUp: fileGoUp,
      onFileDblClick: onFileDblClick, openContainerFileEditor: openContainerFileEditor,
      saveContainerFile: saveContainerFile, createDirInContainer: createDirInContainer,
      renameInContainer: renameInContainer, downloadFromContainer: downloadFromContainer,
      deleteInContainer: deleteInContainer, showUploadDialog: showUploadDialog,
      doUploadToContainer: doUploadToContainer,
      composeDo: composeDo, loadComposeProjects: loadComposeProjects,
      doRefreshLog: doRefreshLog, doRefreshComposeLog: doRefreshComposeLog,
      createComposeService: createComposeService, addComposeService: addComposeService,
      removeComposeService: removeComposeService,
      generateComposeYaml: generateComposeYaml, generateComposeYamlFrom: generateComposeYamlFrom,
      saveComposeFile: saveComposeFile, showNewCompose: showNewCompose, createCompose: createCompose,
      startInstall: startInstall, recheckDocker: recheckDocker,
    }
  }
}

})(this, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig);
