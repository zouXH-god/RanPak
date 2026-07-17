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
          <button v-for="profile in historyProfiles" :key="profile.id" class="history-card" @click="quickConnect(profile.id)">
            <span class="profile-card-head">
              <span class="server-mark"></span>
              <span class="min-w-0">
                <strong class="truncate">{{ profile.name }}</strong>
                <small class="truncate">{{ profile.username }}@{{ profile.host }}:{{ profile.port }}</small>
                <small v-if="profile.jumpHosts?.length" class="truncate text-blue-400">via {{ profile.jumpHosts.length }} 个跳板机</small>
                <small v-if="profile.remark" class="truncate text-gray-400">{{ profile.remark }}</small>
              </span>
            </span>
            <span class="profile-meta">更新于 {{ formatDate(profile.updatedAt) }}</span>
          </button>
        </div>
        <el-empty v-if="historyProfiles.length === 0" description="暂无连接历史，点击上方 + 新增并连接服务器" />
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
            <!-- 终端工具栏 -->
            <div class="terminal-toolbar">
              <div class="toolbar-toggle" @click="toolbarExpanded = !toolbarExpanded">
                <span>{{ toolbarExpanded ? '▼' : '▲' }} 工具栏</span>
              </div>
              <div v-show="toolbarExpanded" class="toolbar-body">
                <el-tabs v-model="toolbarTab" class="toolbar-tabs">
                  <el-tab-pane label="快捷输入" name="quickInput">
                    <div class="toolbar-section">
                      <el-input v-model="quickInputText" type="textarea" :rows="5" placeholder="粘贴或输入内容，点击发送写入终端..." />
                      <div class="flex justify-end gap-2 mt-2">
                        <el-button size="small" @click="quickInputText = ''">清空</el-button>
                        <el-button size="small" type="primary" @click="sendQuickInput">发送</el-button>
                      </div>
                    </div>
                  </el-tab-pane>
                  <el-tab-pane label="预设指令" name="preset">
                    <div class="toolbar-section">
                      <div class="flex gap-2 mb-2">
                        <el-button size="small" :icon="Plus" @click="newPresetCommand">新建指令</el-button>
                        <el-button size="small" :icon="FolderAdd" @click="newPresetGroup">新建指令组</el-button>
                      </div>
                      <div class="preset-tree">
                        <template v-for="node in presetTreeNodes" :key="node.id">
                          <div class="preset-node" :style="{ paddingLeft: node.depth * 20 + 'px' }">
                            <template v-if="node.type === 'group'">
                              <button class="preset-group-btn" @click="togglePresetGroup(node.id)">
                                <span>{{ presetExpandedIds.has(node.id) ? '▼' : '▶' }}</span>
                                <span class="font-semibold">{{ node.name }}</span>
                              </button>
                              <el-button size="small" text type="primary" @click="editPresetItem(node)">编辑</el-button>
                              <el-popconfirm title="确认删除指令组？" @confirm="deletePresetItem(node.id)">
                                <template #reference><el-button size="small" text type="danger">删除</el-button></template>
                              </el-popconfirm>
                            </template>
                            <template v-else>
                              <span class="preset-cmd-name" :title="node.remark || ''">{{ node.name }}</span>
                              <span class="preset-cmd-text truncate text-xs text-gray-400 ml-2">{{ node.command }}</span>
                              <div class="flex-1"></div>
                              <el-button size="small" text type="primary" @click="editPresetItem(node)">编辑</el-button>
                              <el-button size="small" text type="success" @click="executePresetCommand(node)">执行</el-button>
                              <el-popconfirm title="确认删除指令？" @confirm="deletePresetItem(node.id)">
                                <template #reference><el-button size="small" text type="danger">删除</el-button></template>
                              </el-popconfirm>
                            </template>
                          </div>
                        </template>
                        <div v-if="presetTreeNodes.length === 0" class="text-xs text-gray-400 py-3 text-center">暂无预设指令</div>
                      </div>
                    </div>
                  </el-tab-pane>
                  <el-tab-pane label="AI 指令" name="aiCmd">
                    <div class="toolbar-section">
                      <template v-if="!aiConfigured">
                        <div class="text-sm text-gray-400 py-4 text-center">
                          AI 助手未配置，请前往
                          <router-link to="/settings?section=ai" class="text-blue-500 hover:underline">设置页</router-link>
                          填写接口参数
                        </div>
                      </template>
                      <template v-else>
                        <div class="flex gap-2 mb-2">
                          <el-input v-model="aiPrompt" placeholder="输入需求，如：查看 Docker 容器日志" class="flex-1" @keyup.enter="generateAiCommand" />
                          <el-button size="small" type="primary" :loading="aiGenerating" @click="generateAiCommand">生成</el-button>
                        </div>
                        <div v-if="aiDescription" class="text-xs text-gray-500 mb-1">{{ aiDescription }}</div>
                        <el-input v-model="aiCommandText" type="textarea" :rows="3" placeholder="AI 生成的命令将显示在此，可编辑后发送..." />
                        <div class="flex justify-end mt-2">
                          <el-button size="small" type="primary" :disabled="!aiCommandText" @click="sendAiCommand">发送</el-button>
                        </div>
                      </template>
                    </div>
                  </el-tab-pane>
                </el-tabs>
              </div>
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
                <div class="sftp-sort-bar">
                  <span class="text-xs text-gray-400">排序</span>
                  <el-select v-model="sftpSortField" size="small" class="w-[100px]">
                    <el-option label="类型+名称" value="type" />
                    <el-option label="名称" value="name" />
                    <el-option label="大小" value="size" />
                    <el-option label="修改时间" value="mtime" />
                  </el-select>
                  <el-button size="small" text @click="sftpSortOrder = sftpSortOrder === 'asc' ? 'desc' : 'asc'" :title="sftpSortOrder === 'asc' ? '升序' : '降序'">
                    {{ sftpSortOrder === 'asc' ? '↑' : '↓' }}
                  </el-button>
                </div>
              </div>
              <el-table :data="sortedRemoteFiles" border height="560">
                <el-table-column label="名称" min-width="260">
                  <template #default="{ row }">
                    <button class="file-name" @click="row.isDirectory ? enterDir(row.name) : openFileEditor(row)">
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
                <el-table-column label="操作" width="260" fixed="right" align="center">
                  <template #default="{ row }">
                    <div class="sftp-action-bar">
                      <el-button v-if="!row.isDirectory" size="small" :icon="EditPen" title="编辑" @click="openFileEditor(row)" />
                      <el-button v-if="isArchiveFile(row.name)" size="small" title="解压" @click="openExtractDialog(row)">解压</el-button>
                      <el-button v-if="row.isDirectory" size="small" title="压缩" @click="openCompressDialog(row)">压缩</el-button>
                      <el-button size="small" :icon="Edit" title="重命名" @click="renameRemote(row)" />
                      <el-button size="small" :icon="Download" :title="row.isDirectory ? '下载目录' : '下载'" @click="row.isDirectory ? downloadDir(row) : downloadFile(row)" />
                      <el-button size="small" type="danger" :icon="Delete" title="删除" @click="deleteRemote(row)" />
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="状态监控" name="monitor">
            <div class="monitor-panel">
              <div class="flex items-center gap-2 mb-4">
                <el-button :icon="Refresh" :loading="monitorLoading" size="small" @click="refreshMonitor">刷新</el-button>
                <el-checkbox v-model="monitorAutoRefresh" @change="toggleMonitorAuto">自动刷新</el-checkbox>
                <span v-if="monitorAutoRefresh" class="text-xs text-gray-400">每 5 秒</span>
                <div class="flex-1"></div>
                <span v-if="monitorLastTime" class="text-xs text-gray-400">{{ monitorLastTime }}</span>
              </div>

              <div v-if="!monitorData" class="text-center py-10 text-gray-400 text-sm">
                点击刷新获取服务器状态
              </div>
              <template v-else>
                <div class="monitor-grid">
                  <!-- 系统信息 -->
                  <div class="monitor-card">
                    <h3 class="monitor-card-title">系统信息</h3>
                    <div class="monitor-kv">
                      <span>主机名</span><strong>{{ monitorParsed.hostname }}</strong>
                    </div>
                    <div class="monitor-kv">
                      <span>系统</span><strong>{{ monitorParsed.osName }}</strong>
                    </div>
                    <div class="monitor-kv">
                      <span>内核</span><strong>{{ monitorParsed.kernel }}</strong>
                    </div>
                    <div class="monitor-kv">
                      <span>架构</span><strong>{{ monitorParsed.arch }}</strong>
                    </div>
                    <div class="monitor-kv">
                      <span>运行时间</span><strong>{{ monitorParsed.uptime }}</strong>
                    </div>
                  </div>

                  <!-- CPU & 负载 -->
                  <div class="monitor-card">
                    <h3 class="monitor-card-title">CPU & 负载</h3>
                    <div class="monitor-kv">
                      <span>CPU</span><strong>{{ monitorParsed.cpuModel }} ({{ monitorParsed.cpuCount }} 核)</strong>
                    </div>
                    <div class="monitor-kv">
                      <span>负载 (1/5/15min)</span><strong>{{ monitorParsed.loadAvg }}</strong>
                    </div>
                    <div v-if="monitorParsed.loadValues.length" class="mt-2">
                      <div v-for="(lv, li) in monitorParsed.loadValues" :key="li" class="mb-1">
                        <div class="flex items-center gap-2 text-xs text-gray-500">
                          <span class="w-10">{{ ['1m','5m','15m'][li] }}</span>
                          <el-progress :percentage="Math.min(100, Math.round(lv / monitorParsed.cpuCount * 100))" :stroke-width="8" :show-text="false" class="flex-1" />
                          <span class="w-10 text-right">{{ lv.toFixed(2) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 内存 -->
                  <div class="monitor-card">
                    <h3 class="monitor-card-title">内存</h3>
                    <div class="monitor-kv">
                      <span>总内存</span><strong>{{ formatBytes(monitorParsed.memTotal) }}</strong>
                    </div>
                    <div class="monitor-kv">
                      <span>已用</span><strong>{{ formatBytes(monitorParsed.memUsed) }}</strong>
                    </div>
                    <el-progress :percentage="monitorParsed.memPercent" :stroke-width="12" class="mt-1" />
                    <div v-if="monitorParsed.swapTotal > 0" class="mt-3">
                      <div class="monitor-kv">
                        <span>Swap</span><strong>{{ formatBytes(monitorParsed.swapUsed) }} / {{ formatBytes(monitorParsed.swapTotal) }}</strong>
                      </div>
                      <el-progress :percentage="monitorParsed.swapPercent" :stroke-width="8" :show-text="false" class="mt-1" />
                    </div>
                  </div>

                  <!-- 网络流量 -->
                  <div class="monitor-card">
                    <h3 class="monitor-card-title">网络流量</h3>
                    <div v-for="iface in monitorParsed.netInterfaces" :key="iface.name" class="monitor-kv">
                      <span>{{ iface.name }}</span>
                      <strong>↓{{ formatBytes(iface.rx) }} ↑{{ formatBytes(iface.tx) }}</strong>
                    </div>
                    <div v-if="monitorParsed.netInterfaces.length === 0" class="text-xs text-gray-400">无数据</div>
                  </div>

                  <!-- GPU -->
                  <template v-if="monitorParsed.gpus.length">
                    <div v-for="gpu in monitorParsed.gpus" :key="gpu.index" class="monitor-card">
                      <h3 class="monitor-card-title">GPU {{ gpu.index }} — {{ gpu.name }}</h3>
                      <div v-if="gpu.driverVersion" class="text-[11px] text-gray-400 -mt-1 mb-2">Driver {{ gpu.driverVersion }}</div>
                      <div class="monitor-kv">
                        <span>GPU 利用率</span><strong>{{ gpu.gpuUtil }}%</strong>
                      </div>
                      <el-progress :percentage="gpu.gpuUtil" :stroke-width="8" :show-text="false" class="mb-2" />
                      <div class="monitor-kv">
                        <span>显存</span><strong>{{ gpu.memUsed }} / {{ gpu.memTotal }} MiB ({{ gpu.memUtil }}%)</strong>
                      </div>
                      <el-progress :percentage="gpu.memUtil" :stroke-width="8" :show-text="false" status="warning" class="mb-2" />
                      <div class="monitor-kv">
                        <span>温度</span><strong>{{ gpu.temp }}°C</strong>
                      </div>
                      <div v-if="gpu.powerDraw" class="monitor-kv">
                        <span>功耗</span><strong>{{ gpu.powerDraw }} / {{ gpu.powerLimit }} W</strong>
                      </div>
                      <div v-if="gpu.fanSpeed && gpu.fanSpeed !== '[N/A]'" class="monitor-kv">
                        <span>风扇</span><strong>{{ gpu.fanSpeed }}%</strong>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- 实时带宽 -->
                <div class="monitor-card mt-3">
                  <div class="flex items-center gap-2 mb-2">
                    <h3 class="monitor-card-title mb-0">实时带宽</h3>
                    <el-select v-model="bandwidthIface" size="small" class="max-w-[160px]" v-if="monitorParsed.netInterfaces.length > 0">
                      <el-option v-for="iface in monitorParsed.netInterfaces" :key="iface.name" :label="iface.name" :value="iface.name" />
                    </el-select>
                    <span class="text-xs text-gray-400 ml-auto" v-if="bandwidthCurrent">↓{{ formatBytesPerSec(bandwidthCurrent.rx) }} ↑{{ formatBytesPerSec(bandwidthCurrent.tx) }}</span>
                  </div>
                  <div class="bandwidth-chart" v-if="bandwidthHistory.length > 1">
                    <div class="bandwidth-chart-area">
                      <div class="bandwidth-y-labels">
                        <span>{{ formatBytesPerSec(bandwidthMax) }}</span>
                        <span>{{ formatBytesPerSec(bandwidthMax / 2) }}</span>
                        <span>0</span>
                      </div>
                      <div class="bandwidth-bars">
                        <div v-for="(point, idx) in bandwidthHistory" :key="idx" class="bandwidth-bar-group" :title="point.time + ' ↓' + formatBytesPerSec(point.rx) + ' ↑' + formatBytesPerSec(point.tx)">
                          <div class="bandwidth-bar bandwidth-bar-rx" :style="{ height: bandwidthBarHeight(point.rx) + '%' }"></div>
                          <div class="bandwidth-bar bandwidth-bar-tx" :style="{ height: bandwidthBarHeight(point.tx) + '%' }"></div>
                        </div>
                      </div>
                    </div>
                    <div class="flex justify-between text-[10px] text-gray-400 mt-1 px-6">
                      <span>{{ bandwidthHistory[0]?.time }}</span>
                      <span>{{ bandwidthHistory[bandwidthHistory.length - 1]?.time }}</span>
                    </div>
                    <div class="flex items-center gap-4 justify-center mt-1">
                      <span class="flex items-center gap-1 text-[10px] text-gray-500"><span class="inline-block w-3 h-2 rounded-sm bg-blue-400"></span>接收</span>
                      <span class="flex items-center gap-1 text-[10px] text-gray-500"><span class="inline-block w-3 h-2 rounded-sm bg-green-400"></span>发送</span>
                    </div>
                  </div>
                  <div v-else class="text-xs text-gray-400 text-center py-4">开启自动刷新后将展示实时带宽数据</div>
                </div>

                <!-- 磁盘分区 -->
                <div class="monitor-card mt-3">
                  <h3 class="monitor-card-title">磁盘分区</h3>
                  <el-table :data="monitorParsed.disks" border size="small">
                    <el-table-column prop="fs" label="文件系统" min-width="140" />
                    <el-table-column prop="mount" label="挂载点" min-width="120" />
                    <el-table-column label="总量" width="100"><template #default="{ row }">{{ formatBytes(row.total) }}</template></el-table-column>
                    <el-table-column label="已用" width="100"><template #default="{ row }">{{ formatBytes(row.used) }}</template></el-table-column>
                    <el-table-column label="使用率" width="140">
                      <template #default="{ row }">
                        <el-progress :percentage="row.percent" :stroke-width="8" :show-text="true" />
                      </template>
                    </el-table-column>
                  </el-table>
                </div>

                <!-- 物理磁盘 -->
                <div v-if="monitorParsed.physicalDisks.length" class="monitor-card mt-3">
                  <h3 class="monitor-card-title">物理磁盘</h3>
                  <div v-for="pd in monitorParsed.physicalDisks" :key="pd.name" class="physical-disk-item">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      <el-tag size="small" :type="pd.type === 'SSD' ? 'success' : 'info'" effect="dark">{{ pd.type }}</el-tag>
                      <strong class="text-sm">/dev/{{ pd.name }}</strong>
                      <span v-if="pd.model" class="text-xs text-gray-500">{{ pd.model }}</span>
                      <span v-if="pd.serial" class="text-xs text-gray-400">(S/N: {{ pd.serial }})</span>
                      <span class="text-xs text-gray-500 ml-auto">{{ formatBytes(pd.size) }}</span>
                    </div>
                    <div v-if="pd.percent > 0" class="mb-2">
                      <div class="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <span>已用 {{ formatBytes(pd.usedBytes) }} / {{ formatBytes(pd.totalMounted) }}</span>
                        <span class="ml-auto">{{ pd.percent }}%</span>
                      </div>
                      <el-progress :percentage="pd.percent" :stroke-width="10" :show-text="false" />
                    </div>
                    <div v-if="pd.readBytes != null" class="flex gap-4 text-xs text-gray-400 mb-2">
                      <span>累计读取 {{ formatBytes(pd.readBytes) }}</span>
                      <span>累计写入 {{ formatBytes(pd.writeBytes) }}</span>
                      <span v-if="pd.ioMs">I/O 时间 {{ (pd.ioMs / 1000).toFixed(1) }}s</span>
                    </div>
                    <el-table v-if="pd.partitions.length" :data="pd.partitions" border size="small" class="mb-1">
                      <el-table-column label="分区" width="120">
                        <template #default="{ row }">{{ row.name }}</template>
                      </el-table-column>
                      <el-table-column label="文件系统" width="100" prop="fstype" />
                      <el-table-column label="挂载点" min-width="120" prop="mount">
                        <template #default="{ row }">{{ row.mount || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="容量" width="100">
                        <template #default="{ row }">{{ formatBytes(row.size) }}</template>
                      </el-table-column>
                      <el-table-column label="使用率" width="140">
                        <template #default="{ row }">
                          <el-progress v-if="row.percent > 0" :percentage="row.percent" :stroke-width="8" :show-text="true" />
                          <span v-else class="text-xs text-gray-400">-</span>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                </div>

                <!-- 进程列表 -->
                <div class="monitor-card mt-3">
                  <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 class="monitor-card-title mb-0">进程列表</h3>
                    <el-radio-group v-model="procSortBy" size="small">
                      <el-radio-button value="cpu">CPU</el-radio-button>
                      <el-radio-button value="mem">内存</el-radio-button>
                    </el-radio-group>
                    <el-input v-model="procFilter" size="small" placeholder="筛选进程..." clearable class="max-w-[200px]" :prefix-icon="Search" />
                  </div>
                  <el-table :data="filteredProcesses" border size="small" max-height="360">
                    <el-table-column prop="user" label="用户" width="90" />
                    <el-table-column prop="pid" label="PID" width="80" />
                    <el-table-column prop="cpu" label="CPU%" width="80" sortable />
                    <el-table-column prop="mem" label="MEM%" width="80" sortable />
                    <el-table-column prop="command" label="命令" min-width="200" show-overflow-tooltip />
                    <el-table-column label="" width="70" align="center">
                      <template #default="{ row }">
                        <el-popconfirm :title="'强制结束进程 ' + row.pid + '？'" @confirm="killProcess(row.pid)">
                          <template #reference>
                            <el-button size="small" type="danger" :icon="Close" title="结束进程" />
                          </template>
                        </el-popconfirm>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </div>
          </el-tab-pane>

          <el-tab-pane
            v-for="plugin in enabledPlugins"
            :key="plugin.id"
            :label="plugin.name"
            :name="'plugin-' + plugin.id"
            lazy
          >
            <component
              v-if="pluginComponents[plugin.id]"
              :is="pluginComponents[plugin.id]"
              :profile-id="activeConnectionId"
              :exec="pluginExec"
              :call-ssh="callSsh"
            />
            <div v-else class="flex items-center justify-center py-10 text-gray-400">
              <el-icon class="is-loading mr-2"><Refresh /></el-icon>
              <span>Loading plugin...</span>
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

          <el-tab-pane label="插件" name="plugins" lazy>
            <PluginMarketplace />
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
            <el-button :icon="Upload" plain @click="openTextImportDialog">导入</el-button>
            <el-button :icon="Download" plain @click="openRemoteImportDialog">远端导入</el-button>
            <el-button :icon="FolderAdd" plain @click="newFolderDraft(null)">新建文件夹</el-button>
            <el-button :icon="Plus" type="primary" @click="newProfileDraft(null)">新增连接</el-button>
          </div>
        </div>

        <div class="config-manager">
          <div class="config-tree-wrapper">
            <aside class="config-tree">
              <div class="config-tree-search">
                <el-input v-model="configSearchQuery" clearable placeholder="搜索名称、主机、用户名..." :prefix-icon="Search" />
              </div>
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
                <small v-if="node.type === 'profile'" class="truncate">{{ node.username }}@{{ node.host }}<template v-if="node.jumpHostCount"> [{{ node.jumpHostCount }}跳]</template></small>
              </button>
              <el-empty v-if="folders.length === 0 && profiles.length === 0" description="暂无配置" />
              <el-empty v-else-if="configSearchQuery.trim() && visibleTreeNodes.length === 0" description="未找到匹配配置" />
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
                <el-form-item label="备注"><el-input v-model="profileForm.remark" type="textarea" :rows="2" placeholder="可选，域名会自动解析IP填入" /></el-form-item>
              </div>
              <div class="form-section">
                <div class="form-section-title">认证方式</div>
                <el-form-item label="密码"><el-input v-model="profileForm.password" show-password placeholder="留空则保留已保存密码" /></el-form-item>
                <el-form-item label="私钥">
                  <div class="flex gap-2 w-full">
                    <el-select v-model="profileForm.privateKeyName" clearable placeholder="选择密钥" class="flex-1">
                      <el-option v-for="k in privateKeyList" :key="k.id" :label="k.name" :value="k.name" />
                    </el-select>
                    <el-button @click="openPrivateKeyDialog()">新建</el-button>
                    <el-button @click="privateKeyManageVisible = true">管理</el-button>
                  </div>
                </el-form-item>
                <el-form-item label="私钥口令"><el-input v-model="profileForm.passphrase" show-password placeholder="留空则保留已保存口令" /></el-form-item>
              </div>
              <div class="form-section">
                <div class="form-section-title flex items-center justify-between">
                  <span>跳板机 (Jump Host)</span>
                  <el-button size="small" :icon="Plus" @click="profileForm.jumpHosts.push(createJumpHost())">添加</el-button>
                </div>
                <div v-if="profileForm.jumpHosts.length === 0" class="text-xs text-gray-400 mb-2">未配置跳板机，将直连目标服务器</div>
                <div v-for="(hop, hopIdx) in profileForm.jumpHosts" :key="hopIdx" class="jump-host-item">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-gray-500">跳板机 {{ hopIdx + 1 }}</span>
                    <div class="flex items-center gap-1">
                      <el-button v-if="hopIdx > 0" size="small" text @click="profileForm.jumpHosts.splice(hopIdx, 1, ...profileForm.jumpHosts.splice(hopIdx - 1, 1, hop))">上移</el-button>
                      <el-button size="small" text type="danger" @click="profileForm.jumpHosts.splice(hopIdx, 1)">移除</el-button>
                    </div>
                  </div>
                  <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_100px]">
                    <el-form-item label="Host"><el-input v-model="hop.host" placeholder="跳板机地址" /></el-form-item>
                    <el-form-item label="Port"><el-input-number v-model="hop.port" class="w-full" :min="1" :max="65535" controls-position="right" /></el-form-item>
                  </div>
                  <el-form-item label="用户名"><el-input v-model="hop.username" placeholder="root" /></el-form-item>
                  <el-form-item label="密码"><el-input v-model="hop.password" show-password placeholder="留空则保留已保存密码" /></el-form-item>
                  <el-form-item label="私钥">
                    <el-select v-model="hop.privateKeyName" clearable placeholder="选择密钥" class="w-full">
                      <el-option v-for="k in privateKeyList" :key="k.id" :label="k.name" :value="k.name" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="私钥口令"><el-input v-model="hop.passphrase" show-password placeholder="留空则保留已保存口令" /></el-form-item>
                </div>
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

      <el-dialog v-model="remoteImportDialogVisible" title="远端导入 SSH 配置" width="980px" :close-on-click-modal="false">
        <div class="remote-import-manager">
          <aside class="remote-import-list">
            <div class="remote-import-list-head">
              <strong>远端列表</strong>
              <el-button :icon="Plus" size="small" type="primary" @click="newRemoteImportSource">新增</el-button>
            </div>
            <button
              v-for="source in remoteImportSources"
              :key="source.id"
              class="remote-source-item"
              :class="source.id === remoteImportForm.id ? 'is-active' : ''"
              @click="selectRemoteImportSource(source)"
            >
              <span class="remote-source-main">
                <strong class="truncate">{{ source.name }}</strong>
                <small class="truncate">{{ source.method }} {{ source.url }}</small>
                <span v-if="source.lastSyncResult" class="remote-source-sync">
                  新增 {{ source.lastSyncResult.created || 0 }} / 更新 {{ source.lastSyncResult.updated || 0 }} / 跳过 {{ source.lastSyncResult.skipped || 0 }}
                </span>
              </span>
              <el-button size="small" type="primary" plain :loading="remoteImporting" @click.stop="syncRemoteImportSource(source.id)">同步</el-button>
            </button>
            <el-empty v-if="remoteImportSources.length === 0" description="暂无远端配置" />
          </aside>

          <el-form class="remote-import-form" label-position="top">
            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
              <el-form-item label="名称">
                <el-input v-model="remoteImportForm.name" placeholder="生产 SSH 列表" />
              </el-form-item>
              <el-form-item label="请求方式">
                <el-select v-model="remoteImportForm.method">
                  <el-option v-for="method in httpMethods" :key="method" :label="method" :value="method" />
                </el-select>
              </el-form-item>
            </div>
            <el-form-item label="URL">
              <el-input v-model="remoteImportForm.url" placeholder="https://example.com/ssh-profiles.json" />
            </el-form-item>
            <el-form-item label="导入到文件夹">
              <el-select v-model="remoteImportForm.folderId" clearable placeholder="全部连接">
                <el-option label="全部连接" value="" />
                <el-option
                  v-for="folder in flattenedFolders"
                  :key="folder.id"
                  :label="`${'　'.repeat(folder.depth)}${folder.name}`"
                  :value="folder.id"
                />
              </el-select>
            </el-form-item>
            <div class="form-section">
              <div class="form-section-title">请求头</div>
              <div v-for="(header, index) in remoteImportForm.headers" :key="header.id" class="remote-header-row">
                <el-checkbox v-model="header.enabled" />
                <el-input v-model="header.key" placeholder="Header 名称" />
                <el-input v-model="header.value" placeholder="Header 值" />
                <el-button :icon="Delete" text type="danger" @click="removeRemoteHeader(index)" />
              </div>
              <el-button :icon="Plus" plain size="small" @click="addRemoteHeader">添加请求头</el-button>
            </div>
            <el-form-item label="请求体">
              <el-input
                v-model="remoteImportForm.body"
                type="textarea"
                :rows="6"
                placeholder='POST/PUT/PATCH 可填写 JSON 或其他文本，例如 {"token":"..."}'
              />
            </el-form-item>
            <div class="remote-import-help">
              返回值支持连接数组，或包含 data/items/profiles/servers/list/records 的对象。也可通过 folders 携带嵌套文件夹，每层使用 name、folders 和 profiles；同级同名文件夹会自动复用。
            </div>
          </el-form>
        </div>
        <template #footer>
          <el-button @click="remoteImportDialogVisible = false">取消</el-button>
          <el-button v-if="remoteImportForm.id" type="danger" plain :loading="remoteImportSaving" @click="deleteCurrentRemoteImportSource">删除</el-button>
          <el-button :loading="remoteImportSaving" @click="saveRemoteImportSource">保存</el-button>
          <el-button type="primary" :loading="remoteImporting" @click="syncCurrentRemoteImportSource">同步</el-button>
        </template>
      </el-dialog>

      <el-dialog v-model="textImportDialogVisible" title="导入 SSH 配置" width="680px" :close-on-click-modal="false">
        <el-form label-position="top">
          <el-form-item label="导入到文件夹">
            <el-select v-model="textImportFolderId" clearable placeholder="全部连接">
              <el-option label="全部连接" value="" />
              <el-option
                v-for="folder in flattenedFolders"
                :key="folder.id"
                :label="`${'　'.repeat(folder.depth)}${folder.name}`"
                :value="folder.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="JSON 内容">
            <div class="mb-2 flex gap-2">
              <el-button size="small" :icon="Upload" @click="importFromFile">从文件导入</el-button>
              <span class="text-xs leading-6 text-gray-400">选择 .json 文件自动填入，或直接在下方粘贴文本</span>
            </div>
            <el-input
              v-model="textImportContent"
              type="textarea"
              :rows="12"
              placeholder='JSON 数组或对象，格式与远端导入一致。例如：
[{"ip":"127.0.0.1","port":22,"username":"root","password":"***","name":"本地测试机"}]
或
{"data":[{"host":"10.0.0.1","port":22,"user":"admin","pass":"***"}]}'
            />
          </el-form-item>
          <div class="text-xs text-gray-400">
            支持连接数组，或对象中的 data/items/profiles/servers/list/records。也支持 folders 嵌套结构，每层可包含 name、folders 和 profiles，导入时会自动创建文件夹。
          </div>
        </el-form>
        <template #footer>
          <el-button @click="textImportDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="textImporting" @click="executeTextImport">导入</el-button>
        </template>
      </el-dialog>

      <!-- 新建/编辑预设指令弹窗 -->
      <el-dialog v-model="presetDialogVisible" :title="presetForm.id ? '编辑' : '新建'" width="520px" :close-on-click-modal="false" append-to-body>
        <el-form label-position="top">
          <el-form-item label="名称"><el-input v-model="presetForm.name" placeholder="指令名称" /></el-form-item>
          <template v-if="presetForm.type === 'command'">
            <el-form-item label="参数">
              <div class="preset-params-area">
                <div class="preset-params-tags">
                  <el-tag
                    v-for="(p, idx) in presetFormParams"
                    :key="idx"
                    closable
                    class="cursor-pointer mr-1 mb-1"
                    @click="insertParamPlaceholder(p)"
                    @close="removePresetParam(idx)"
                  >{{ p }}</el-tag>
                </div>
                <div class="flex gap-2 mt-1">
                  <el-input v-model="newParamName" size="small" placeholder="参数名" class="flex-1" @keyup.enter="addPresetParam" />
                  <el-button size="small" @click="addPresetParam">添加</el-button>
                </div>
                <div v-if="presetFormParams.length" class="text-xs text-gray-400 mt-1">点击参数标签可将占位符插入到指令中</div>
              </div>
            </el-form-item>
            <el-form-item label="指令">
              <el-input ref="presetCmdInput" v-model="presetForm.command" type="textarea" :rows="3" placeholder="要执行的命令，如 docker restart {{容器名}}" />
            </el-form-item>
            <el-form-item label="备注"><el-input v-model="presetForm.remark" placeholder="可选" /></el-form-item>
          </template>
          <el-form-item label="所属指令组">
            <el-select v-model="presetForm.parentId" clearable placeholder="根级">
              <el-option label="根级" value="" />
              <el-option v-for="g in presetGroupOptions" :key="g.id" :label="g.name" :value="g.id" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="presetDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="savingPreset" @click="savePresetItem">保存</el-button>
        </template>
      </el-dialog>

      <!-- SFTP 目录下载弹窗 -->
      <el-dialog v-model="dirDownloadVisible" title="下载目录" width="460px" :close-on-click-modal="false" append-to-body>
        <template v-if="dirDownloadStatus === 'confirm'">
          <p class="text-sm text-gray-700 mb-3">
            将目录 <strong>{{ dirDownloadName }}</strong> 压缩为 <code>.tar.gz</code> 后下载到本地。
          </p>
          <el-checkbox v-model="dirDownloadAutoExtract" class="mb-2">下载后自动解压到目标目录</el-checkbox>
        </template>
        <template v-else>
          <div class="text-center py-4">
            <div class="text-sm text-gray-600 mb-3">{{ dirDownloadStage }}</div>
            <el-progress :percentage="dirDownloadPercent" :stroke-width="10" :status="dirDownloadStatus === 'done' ? 'success' : dirDownloadStatus === 'error' ? 'exception' : ''" />
            <div v-if="dirDownloadError" class="text-xs text-red-500 mt-2">{{ dirDownloadError }}</div>
            <div v-if="dirDownloadStatus === 'done'" class="text-xs text-green-600 mt-2">下载完成</div>
          </div>
        </template>
        <template #footer>
          <template v-if="dirDownloadStatus === 'confirm'">
            <el-button @click="dirDownloadVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmDirDownload">选择目录并下载</el-button>
          </template>
          <template v-else>
            <el-button v-if="dirDownloadStatus === 'done'" type="primary" @click="openDirDownloadFolder">打开文件夹</el-button>
            <el-button @click="dirDownloadVisible = false" :disabled="dirDownloadStatus === 'running'">
              {{ dirDownloadStatus === 'done' || dirDownloadStatus === 'error' ? '关闭' : '取消' }}
            </el-button>
          </template>
        </template>
      </el-dialog>

      <!-- SFTP 文件编辑弹窗 -->
      <el-dialog v-model="fileEditorVisible" :title="'编辑: ' + fileEditorPath" width="75vw" top="5vh" :close-on-click-modal="false" append-to-body>
        <div v-if="fileEditorLoading" class="py-10 text-center text-gray-400">加载中...</div>
        <template v-else>
          <div class="flex items-center gap-2 mb-2 text-xs text-gray-400">
            <span>{{ fileEditorPath }}</span>
            <span>·</span>
            <span>{{ formatBytes(fileEditorSize) }}</span>
          </div>
          <el-input
            v-model="fileEditorContent"
            type="textarea"
            :rows="24"
            class="file-editor-textarea"
            spellcheck="false"
          />
        </template>
        <template #footer>
          <el-button @click="fileEditorVisible = false">取消</el-button>
          <el-button type="primary" :loading="fileEditorSaving" @click="saveFileEditor">保存</el-button>
        </template>
      </el-dialog>

      <!-- SFTP 解压弹窗 -->
      <el-dialog v-model="extractDialogVisible" title="解压文件" width="560px" :close-on-click-modal="false" append-to-body @closed="extractStatus = 'idle'">
        <template v-if="extractStatus === 'idle'">
          <el-form label-width="80px" size="small">
            <el-form-item label="压缩文件">
              <el-input :model-value="extractFileName" disabled />
            </el-form-item>
            <el-form-item label="解压目录">
              <div class="flex gap-2 w-full">
                <el-input v-model="extractTargetDir" placeholder="留空则解压到当前目录" class="flex-1" />
                <el-button size="small" @click="openExtractDirPicker">选择</el-button>
              </div>
            </el-form-item>
            <!-- 远程目录选择器 -->
            <div v-if="extractDirPickerVisible" class="extract-dir-picker">
              <div class="flex items-center gap-2 mb-2">
                <el-button size="small" :icon="ArrowLeft" @click="extractDirPickerGoUp" :disabled="extractDirPickerPath === '/'">上级</el-button>
                <span class="text-xs text-gray-500 truncate flex-1">{{ extractDirPickerPath }}</span>
                <el-button size="small" :icon="Refresh" @click="loadExtractDirPicker(extractDirPickerPath)" :loading="extractDirPickerLoading" />
              </div>
              <div class="extract-dir-list" v-loading="extractDirPickerLoading">
                <div
                  v-for="item in extractDirPickerItems"
                  :key="item.name"
                  class="extract-dir-item"
                  @click="extractDirPickerEnter(item.name)"
                >
                  <el-icon><Folder /></el-icon>
                  <span class="truncate">{{ item.name }}</span>
                </div>
                <div v-if="!extractDirPickerLoading && extractDirPickerItems.length === 0" class="text-xs text-gray-400 text-center py-3">无子目录</div>
              </div>
              <div class="flex justify-end gap-2 mt-2">
                <el-button size="small" @click="extractDirPickerVisible = false">取消</el-button>
                <el-button size="small" type="primary" @click="confirmExtractDirPicker">选择当前目录</el-button>
              </div>
            </div>
            <el-form-item label="解压后">
              <el-checkbox v-model="extractDeleteAfter">删除压缩包</el-checkbox>
            </el-form-item>
          </el-form>
        </template>
        <template v-else>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-semibold">{{ extractStatus === 'running' ? '解压中...' : extractStatus === 'done' ? '解压完成' : '解压失败' }}</span>
            <el-tag :type="extractStatus === 'done' ? 'success' : extractStatus === 'error' ? 'danger' : 'warning'" size="small">
              {{ extractStatus === 'running' ? '进行中' : extractStatus === 'done' ? '成功' : '失败' }}
            </el-tag>
          </div>
          <div ref="extractLogRef" class="extract-log">
            <pre>{{ extractLog }}</pre>
          </div>
        </template>
        <template #footer>
          <template v-if="extractStatus === 'idle'">
            <el-button @click="extractDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="doExtract">开始解压</el-button>
          </template>
          <template v-else>
            <el-button @click="extractDialogVisible = false" :disabled="extractStatus === 'running'">
              {{ extractStatus === 'running' ? '解压中...' : '关闭' }}
            </el-button>
          </template>
        </template>
      </el-dialog>

      <!-- SFTP 压缩弹窗 -->
      <el-dialog v-model="compressDialogVisible" title="压缩文件夹" width="560px" :close-on-click-modal="false" append-to-body @closed="compressStatus = 'idle'">
        <template v-if="compressStatus === 'idle'">
          <el-form label-width="80px" size="small">
            <el-form-item label="目标目录">
              <el-input :model-value="compressDirName" disabled />
            </el-form-item>
            <el-form-item label="压缩格式">
              <el-select v-model="compressFormat" class="w-full" @change="updateCompressOutputName">
                <el-option label="tar.gz（推荐）" value="tar.gz" />
                <el-option label="tar.bz2" value="tar.bz2" />
                <el-option label="tar.xz" value="tar.xz" />
                <el-option label="zip" value="zip" />
                <el-option label="7z" value="7z" />
              </el-select>
            </el-form-item>
            <el-form-item label="输出文件名">
              <el-input v-model="compressOutputName" placeholder="自动生成" />
            </el-form-item>
            <el-form-item label="压缩等级">
              <el-select v-model="compressLevel" class="w-full">
                <el-option label="默认" value="default" />
                <el-option label="快速（低压缩率）" value="fast" />
                <el-option label="最佳（高压缩率）" value="best" />
              </el-select>
            </el-form-item>
            <el-form-item label="压缩后">
              <el-checkbox v-model="compressDeleteAfter">删除源文件夹</el-checkbox>
            </el-form-item>
          </el-form>
        </template>
        <template v-else>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-semibold">{{ compressStatus === 'running' ? '压缩中...' : compressStatus === 'done' ? '压缩完成' : '压缩失败' }}</span>
            <el-tag :type="compressStatus === 'done' ? 'success' : compressStatus === 'error' ? 'danger' : 'warning'" size="small">
              {{ compressStatus === 'running' ? '进行中' : compressStatus === 'done' ? '成功' : '失败' }}
            </el-tag>
          </div>
          <div ref="compressLogRef" class="extract-log">
            <pre>{{ compressLog }}</pre>
          </div>
        </template>
        <template #footer>
          <template v-if="compressStatus === 'idle'">
            <el-button @click="compressDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="doCompress">开始压缩</el-button>
          </template>
          <template v-else>
            <el-button @click="compressDialogVisible = false" :disabled="compressStatus === 'running'">
              {{ compressStatus === 'running' ? '压缩中...' : '关闭' }}
            </el-button>
          </template>
        </template>
      </el-dialog>

      <!-- 执行预设指令参数填写弹窗 -->
      <el-dialog v-model="presetExecDialogVisible" title="填写参数" width="440px" :close-on-click-modal="false" append-to-body>
        <el-form label-position="top">
          <el-form-item v-for="(p, idx) in presetExecParams" :key="idx" :label="p.name">
            <el-input v-model="p.value" :placeholder="'请输入 ' + p.name" />
          </el-form-item>
        </el-form>
        <div class="rounded bg-slate-50 p-2 mt-2 text-xs text-gray-600 break-all">
          <strong>预览：</strong>{{ presetExecPreview }}
        </div>
        <template #footer>
          <el-button @click="presetExecDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmExecutePreset">执行</el-button>
        </template>
      </el-dialog>

      <!-- 新建/编辑密钥弹窗 -->
      <el-dialog v-model="privateKeyDialogVisible" :title="privateKeyForm.id ? '编辑密钥' : '新建密钥'" width="560px" :close-on-click-modal="false" append-to-body>
        <el-form label-position="top">
          <el-form-item label="密钥名称"><el-input v-model="privateKeyForm.name" placeholder="例如：pre" /></el-form-item>
          <el-form-item label="密钥内容">
            <div class="flex gap-2 mb-2">
              <el-button size="small" @click="readPrivateKeyFile">从文件导入</el-button>
              <span class="text-xs text-gray-400 leading-6">或直接粘贴密钥文本</span>
            </div>
            <el-input v-model="privateKeyForm.content" type="textarea" :rows="6" placeholder="-----BEGIN RSA PRIVATE KEY-----" />
          </el-form-item>
          <el-form-item label="密钥口令"><el-input v-model="privateKeyForm.password" show-password placeholder="可选" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="privateKeyDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="savingKey" @click="savePrivateKey">保存</el-button>
        </template>
      </el-dialog>

      <!-- 密钥管理面板 -->
      <el-dialog v-model="privateKeyManageVisible" title="密钥管理" width="560px" :close-on-click-modal="false" append-to-body>
        <div class="flex justify-end mb-3">
          <el-button :icon="Plus" type="primary" size="small" @click="openPrivateKeyDialog()">新建密钥</el-button>
        </div>
        <el-table :data="privateKeyList" border size="small" empty-text="暂无密钥">
          <el-table-column prop="name" label="名称" />
          <el-table-column label="创建时间" width="170">
            <template #default="scope">{{ scope.row.createdAt?.slice(0, 19).replace('T', ' ') }}</template>
          </el-table-column>
          <el-table-column label="操作" width="130">
            <template #default="scope">
              <el-button size="small" text type="primary" @click="openPrivateKeyDialog(scope.row)">编辑</el-button>
              <el-popconfirm title="确认删除？" @confirm="deletePrivateKey(scope.row.id)">
                <template #reference><el-button size="small" text type="danger">删除</el-button></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
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
import { persistentStorage } from '../utils/sqliteStorage'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { ArrowLeft, ArrowRight, Close, Delete, Document, Download, Edit, EditPen, Folder, FolderAdd, Monitor, Plus, Refresh, Search, Setting, SwitchButton, Upload } from '@element-plus/icons-vue'
import { formatBytes } from '../utils/devTools'
import { useSshPlugins } from '../composables/useSshPlugins'
import PluginMarketplace from './ssh/PluginMarketplace.vue'

const { pluginList, pluginComponents, initPlugins, loadPlugin } = useSshPlugins()
const enabledPlugins = computed(() => pluginList.value.filter((p) => p.enabled))

const profiles = ref([])
const folders = ref([])
const tunnels = ref([])
const activeConnectionId = ref('')
const HISTORY_STORAGE_KEY = 'ran-pak-ssh-connection-history'
const connectionHistory = ref([])

async function loadConnectionHistory() {
  const res = await window.electronAPI?.ssh?.getHistory?.()
  if (res?.ok && Array.isArray(res.data)) return res.data
  try { return JSON.parse(persistentStorage.getItem(HISTORY_STORAGE_KEY) || '[]') } catch { return [] }
}
function saveConnectionHistory() {
  const data = [...connectionHistory.value]
  persistentStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data))
  window.electronAPI?.ssh?.saveHistory?.(data)
}
function pushConnectionHistory(profileId) {
  connectionHistory.value = [profileId, ...connectionHistory.value.filter((id) => id !== profileId)]
  saveConnectionHistory()
}
function removeConnectionHistory(profileId) {
  connectionHistory.value = connectionHistory.value.filter((id) => id !== profileId)
  saveConnectionHistory()
}
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
const sftpSortField = ref('type')
const sftpSortOrder = ref('asc')
const transferQueue = ref([])
const transferPanelExpanded = ref(true)
const remoteImportDialogVisible = ref(false)
const remoteImporting = ref(false)
const remoteImportSaving = ref(false)
const textImportDialogVisible = ref(false)
const textImportContent = ref('')
const textImportFolderId = ref('')
const textImporting = ref(false)
const privateKeyDialogVisible = ref(false)
const privateKeyManageVisible = ref(false)
const privateKeyList = ref([])
const privateKeyForm = reactive({ id: '', name: '', content: '', password: '' })
const savingKey = ref(false)
const toolbarExpanded = ref(false)
const toolbarTab = ref('quickInput')
const quickInputText = ref('')
const presetCommands = ref([])
const presetExpandedIds = ref(new Set())
const presetDialogVisible = ref(false)
const presetForm = reactive({ id: '', type: 'command', name: '', command: '', params: '', remark: '', parentId: '' })
const presetFormParams = ref([])
const newParamName = ref('')
const presetCmdInput = ref(null)
const presetExecDialogVisible = ref(false)
const presetExecParams = ref([])
const presetExecCommand = ref('')
const savingPreset = ref(false)
const dirDownloadVisible = ref(false)
const dirDownloadName = ref('')
const dirDownloadRow = ref(null)
const dirDownloadAutoExtract = ref(false)
const dirDownloadStatus = ref('confirm')
const dirDownloadStage = ref('')
const dirDownloadPercent = ref(0)
const dirDownloadError = ref('')
const dirDownloadLocalPath = ref('')
const monitorData = ref(null)
const monitorLoading = ref(false)
const monitorAutoRefresh = ref(false)
const monitorLastTime = ref('')
let monitorTimer = null
const procSortBy = ref('cpu')
const procFilter = ref('')
const bandwidthIface = ref('')
const bandwidthHistory = ref([])
const bandwidthPrevSnapshot = ref(null)
const bandwidthPrevTime = ref(0)
const BANDWIDTH_MAX_POINTS = 30
const fileEditorVisible = ref(false)
const fileEditorLoading = ref(false)
const fileEditorSaving = ref(false)
const fileEditorPath = ref('')
const fileEditorContent = ref('')
const fileEditorSize = ref(0)
const extractDialogVisible = ref(false)
const extractFileName = ref('')
const extractTargetDir = ref('')
const extractDeleteAfter = ref(false)
const extractStatus = ref('idle')
const extractLog = ref('')
const extractLogRef = ref(null)
const extractDirPickerVisible = ref(false)
const extractDirPickerPath = ref('/')
const extractDirPickerItems = ref([])
const extractDirPickerLoading = ref(false)
const compressDialogVisible = ref(false)
const compressDirName = ref('')
const compressFormat = ref('tar.gz')
const compressOutputName = ref('')
const compressLevel = ref('default')
const compressDeleteAfter = ref(false)
const compressStatus = ref('idle')
const compressLog = ref('')
const compressLogRef = ref(null)
const aiPrompt = ref('')
const aiCommandText = ref('')
const aiDescription = ref('')
const aiGenerating = ref(false)
const aiConfigured = ref(false)
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const remoteImportSources = ref([])
const remoteImportForm = reactive(defaultRemoteImportForm())
const configSearchQuery = ref('')
let unsubscribeShellData = null
let unsubscribeTransferProgress = null
let unsubscribeCloudSync = null
let unsubscribeSftpDrop = null

const connectedProfiles = computed(() => profiles.value.filter((profile) => profile.status === 'connected'))
const historyProfiles = computed(() => {
  return connectionHistory.value
    .map((id) => profiles.value.find((p) => p.id === id))
    .filter(Boolean)
})
const activeProfile = computed(() => profiles.value.find((profile) => profile.id === activeConnectionId.value) || null)
const activeState = computed(() => stateFor(activeConnectionId.value))
const activeTerminalTab = computed(() => activeState.value.terminals.find((tab) => tab.id === activeState.value.activeTerminalId) || null)
const activeTunnels = computed(() => tunnels.value.filter((tunnel) => tunnel.profileId === activeConnectionId.value))
const sortedRemoteFiles = computed(() => {
  const files = activeState.value.remoteFiles || []
  const field = sftpSortField.value
  const asc = sftpSortOrder.value === 'asc'
  return [...files].sort((a, b) => {
    if (field === 'type') {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
    }
    if (field === 'name') {
      const cmp = a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
      return asc ? cmp : -cmp
    }
    if (field === 'size') {
      const sa = a.isDirectory ? -1 : (a.size || 0)
      const sb = b.isDirectory ? -1 : (b.size || 0)
      const cmp = sa - sb
      return asc ? cmp : -cmp
    }
    if (field === 'mtime') {
      const cmp = (a.mtime || 0) - (b.mtime || 0)
      return asc ? cmp : -cmp
    }
    return 0
  })
})
const flattenedFolders = computed(() => flattenFolders())
const selectedNodeKey = computed(() => selectedTreeType.value === 'root' ? 'root' : `${selectedTreeType.value}:${selectedTreeId.value}`)
const visibleTreeNodes = computed(() => {
  const query = configSearchQuery.value.trim()
  return query ? buildSearchVisibleTreeNodes('', 0, query) : buildVisibleTreeNodes()
})
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
  unsubscribeCloudSync = window.electronAPI?.cloudSync?.onDataUpdated?.((payload) => {
    if (payload?.type === 'ssh_profiles') refreshAll()
    if (payload?.type === 'ssh_preset_commands') loadPresetCommands()
    if (payload?.type === 'ssh_history') loadConnectionHistory().then((d) => { connectionHistory.value = d })
  })
  unsubscribeSftpDrop = setupSftpDropListeners()
  connectionHistory.value = await loadConnectionHistory()
  await refreshAll()
  loadPresetCommands()
  checkAiConfig()
  initPlugins()
})

onBeforeUnmount(() => {
  unsubscribeShellData?.()
  unsubscribeTransferProgress?.()
  unsubscribeCloudSync?.()
  unsubscribeSftpDrop?.()
  disposeTerminal()
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null }
})

watch([activeConnectionId, () => activeState.value.workTab, () => activeState.value.activeTerminalId], async () => {
  if (activeState.value.workTab === 'terminal') await mountTerminal()
  else disposeTerminal()
})

watch(connectionDialogVisible, (visible) => {
  if (!visible) configSearchQuery.value = ''
})
watch(bandwidthIface, () => {
  bandwidthHistory.value = []
  bandwidthPrevSnapshot.value = null
})

function createJumpHost() {
  return { host: '', port: 22, username: '', password: '', privateKeyName: '', privateKeyPath: '', passphrase: '' }
}

function defaultProfileForm() {
  return { id: '', name: '', folderId: '', host: '', port: 22, username: '', remark: '', password: '', privateKeyName: '', privateKeyPath: '', passphrase: '', keepaliveInterval: 15000, jumpHosts: [] }
}

function defaultFolderForm() {
  return { id: '', name: '', parentId: '' }
}

function createRemoteHeader(key = '', value = '') {
  return { id: `header-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, enabled: true, key, value }
}

function defaultRemoteImportForm() {
  return {
    id: '',
    name: '',
    url: '',
    method: 'GET',
    folderId: '',
    headers: [createRemoteHeader('Accept', 'application/json')],
    body: '',
  }
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
  monitorData.value = null
  monitorAutoRefresh.value = false
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null }
  bandwidthHistory.value = []
  bandwidthPrevSnapshot.value = null
  bandwidthIface.value = ''
}

async function openConnectionDialog(profile = null) {
  connectionDialogVisible.value = true
  configSearchQuery.value = ''
  await refreshAll()
  await loadPrivateKeys()
  expandedFolderIds.value = new Set()
  if (profile?.id) selectProfileNode(profile.id)
  else selectRootNode()
}

function applyProfileToForm(profile) {
  Object.assign(profileForm, {
    id: profile.id,
    name: profile.name,
    folderId: profile.folderId || '',
    host: profile.host,
    port: profile.port,
    username: profile.username,
    remark: profile.remark || '',
    password: '',
    privateKeyName: profile.privateKeyName || '',
    privateKeyPath: profile.privateKeyPath || '',
    passphrase: '',
    keepaliveInterval: profile.keepaliveInterval || 15000,
    jumpHosts: (profile.jumpHosts || []).map((h) => ({
      host: h.host || '',
      port: h.port || 22,
      username: h.username || '',
      password: '',
      privateKeyName: h.privateKeyName || '',
      privateKeyPath: h.privateKeyPath || '',
      passphrase: '',
    })),
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
    nodes.push(createProfileTreeNode(profile, depth))
  })
  return nodes
}

function profileMatchesSearch(profile, query) {
  const haystack = `${profile.name} ${profile.host} ${profile.username} ${profile.port} ${profile.remark || ''}`.toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function folderNameMatchesSearch(folder, query) {
  return folder.name.toLowerCase().includes(query.toLowerCase())
}

function folderHasSearchMatch(folderId, query) {
  if (profiles.value.some((profile) => (profile.folderId || '') === folderId && profileMatchesSearch(profile, query))) return true
  return folders.value
    .filter((folder) => (folder.parentId || '') === folderId)
    .some((folder) => folderNameMatchesSearch(folder, query) || folderHasSearchMatch(folder.id, query))
}

function createProfileTreeNode(profile, depth) {
  return {
    key: `profile:${profile.id}`,
    type: 'profile',
    id: profile.id,
    name: profile.name,
    username: profile.username,
    host: profile.host,
    jumpHostCount: profile.jumpHosts?.length || 0,
    depth,
  }
}

function buildSearchVisibleTreeNodes(parentId = '', depth = 0, query = '') {
  const nodes = []
  folders.value
    .filter((folder) => (folder.parentId || '') === parentId)
    .sort(sortByOrder)
    .filter((folder) => folderNameMatchesSearch(folder, query) || folderHasSearchMatch(folder.id, query))
    .forEach((folder) => {
      nodes.push({ key: `folder:${folder.id}`, type: 'folder', id: folder.id, name: folder.name, depth })
      nodes.push(...buildSearchVisibleTreeNodes(folder.id, depth + 1, query))
    })
  profiles.value
    .filter((profile) => (profile.folderId || '') === parentId)
    .sort(sortByOrder)
    .filter((profile) => profileMatchesSearch(profile, query))
    .forEach((profile) => {
      nodes.push(createProfileTreeNode(profile, depth))
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

/** 加载密钥列表 */
async function loadPrivateKeys() {
  const res = await callSsh('listPrivateKeys')
  if (res?.ok) privateKeyList.value = res.data || []
}

/** 打开新建/编辑密钥弹窗 */
function openPrivateKeyDialog(existing = null) {
  Object.assign(privateKeyForm, {
    id: existing?.id || '',
    name: existing?.name || '',
    content: '',
    password: '',
  })
  privateKeyDialogVisible.value = true
}

/** 保存密钥 */
async function savePrivateKey() {
  if (!privateKeyForm.name.trim()) { ElMessage.warning('密钥名称不能为空'); return }
  if (!privateKeyForm.id && !privateKeyForm.content.trim()) { ElMessage.warning('密钥内容不能为空'); return }
  savingKey.value = true
  try {
    const res = await callSsh('savePrivateKey', { ...privateKeyForm })
    if (!res?.ok) { ElMessage.error(res?.error || '保存失败'); return }
    ElMessage.success('密钥已保存')
    privateKeyDialogVisible.value = false
    await loadPrivateKeys()
  } finally { savingKey.value = false }
}

/** 删除密钥 */
async function deletePrivateKey(id) {
  const res = await callSsh('deletePrivateKey', id)
  if (!res?.ok) { ElMessage.error(res?.error || '删除失败'); return }
  ElMessage.success('密钥已删除')
  await loadPrivateKeys()
}

/** 从文件读取密钥内容 */
async function readPrivateKeyFile() {
  const res = await callSsh('readPrivateKeyFile')
  if (res?.ok && res.data) privateKeyForm.content = res.data
  else if (res?.error) ElMessage.error(res.error)
}

function openRemoteImportDialog() {
  remoteImportDialogVisible.value = true
  loadRemoteImportSources()
}

function openTextImportDialog() {
  textImportContent.value = ''
  textImportFolderId.value = defaultParentFolderId()
  textImportDialogVisible.value = true
}

async function importFromFile() {
  const response = await callSsh('importProfilesFromFile', textImportFolderId.value)
  if (!response?.ok) {
    if (response?.error) ElMessage.error(response.error)
    return
  }
  if (!response.data) return
  const result = response.data
  textImportDialogVisible.value = false
  await refreshAll()
  const message = `共 ${result.total} 项：新增 ${result.created} / 更新 ${result.updated} / 跳过 ${result.skipped}`
  if (result.errors?.length) ElMessage.warning(message)
  else ElMessage.success(message)
}

async function executeTextImport() {
  if (!textImportContent.value.trim()) {
    ElMessage.warning('请输入或粘贴 JSON 内容')
    return
  }
  textImporting.value = true
  try {
    const response = await callSsh('importProfilesFromText', {
      text: textImportContent.value,
      folderId: textImportFolderId.value,
    })
    if (!response?.ok) {
      ElMessage.error(response?.error || '导入失败')
      return
    }
    const result = response.data
    textImportDialogVisible.value = false
    await refreshAll()
    const message = `共 ${result.total} 项：新增 ${result.created} / 更新 ${result.updated} / 跳过 ${result.skipped}`
    if (result.errors?.length) ElMessage.warning(message)
    else ElMessage.success(message)
  } finally {
    textImporting.value = false
  }
}

function addRemoteHeader() {
  remoteImportForm.headers.push(createRemoteHeader())
}

function removeRemoteHeader(index) {
  remoteImportForm.headers.splice(index, 1)
}

function normalizeRemoteImportPayload() {
  const url = String(remoteImportForm.url || '').trim()
  return {
    id: remoteImportForm.id || '',
    name: String(remoteImportForm.name || '').trim(),
    url,
    method: remoteImportForm.method,
    folderId: remoteImportForm.folderId || '',
    headers: remoteImportForm.headers
      .filter((header) => header.enabled && String(header.key || '').trim())
      .map((header) => ({ key: String(header.key).trim(), value: String(header.value ?? ''), enabled: true })),
    body: remoteImportForm.body,
  }
}

function applyRemoteImportSourceToForm(source = {}) {
  Object.assign(remoteImportForm, {
    ...defaultRemoteImportForm(),
    ...source,
    headers: (source.headers?.length ? source.headers : [createRemoteHeader('Accept', 'application/json')])
      .map((header) => createRemoteHeader(header.key, header.value))
      .map((header, index) => ({ ...header, enabled: source.headers?.[index]?.enabled !== false })),
  })
}

async function loadRemoteImportSources() {
  const response = await callSsh('listRemoteImportSources')
  if (!response?.ok) {
    ElMessage.error(response?.error || '读取远端导入列表失败')
    return
  }
  remoteImportSources.value = response.data || []
  if (remoteImportForm.id) {
    const current = remoteImportSources.value.find((source) => source.id === remoteImportForm.id)
    if (current) applyRemoteImportSourceToForm(current)
    else newRemoteImportSource()
  } else if (remoteImportSources.value.length > 0) {
    applyRemoteImportSourceToForm(remoteImportSources.value[0])
  } else {
    newRemoteImportSource()
  }
}

function newRemoteImportSource() {
  applyRemoteImportSourceToForm({ ...defaultRemoteImportForm(), folderId: defaultParentFolderId() })
}

function selectRemoteImportSource(source) {
  applyRemoteImportSourceToForm(source)
}

async function saveRemoteImportSource() {
  const payload = normalizeRemoteImportPayload()
  if (!payload.name) {
    ElMessage.warning('请输入远端导入名称')
    return null
  }
  if (!payload.url) {
    ElMessage.warning('请输入远端 URL')
    return null
  }
  remoteImportSaving.value = true
  try {
    const response = await callSsh('saveRemoteImportSource', payload)
    if (!response?.ok) {
      ElMessage.error(response?.error || '保存远端导入失败')
      return null
    }
    await loadRemoteImportSources()
    applyRemoteImportSourceToForm(response.data)
    ElMessage.success('远端导入配置已保存')
    return response.data
  } finally {
    remoteImportSaving.value = false
  }
}

async function deleteCurrentRemoteImportSource() {
  if (!remoteImportForm.id) return
  const confirmed = await ElMessageBox.confirm('确定删除该远端导入配置？', '删除远端导入', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  remoteImportSaving.value = true
  try {
    const response = await callSsh('deleteRemoteImportSource', remoteImportForm.id)
    if (!response?.ok) {
      ElMessage.error(response?.error || '删除远端导入失败')
      return
    }
    remoteImportSources.value = response.data || []
    if (remoteImportSources.value.length > 0) applyRemoteImportSourceToForm(remoteImportSources.value[0])
    else newRemoteImportSource()
    ElMessage.success('远端导入配置已删除')
  } finally {
    remoteImportSaving.value = false
  }
}

async function syncCurrentRemoteImportSource() {
  let sourceId = remoteImportForm.id
  if (!sourceId) {
    const saved = await saveRemoteImportSource()
    if (!saved) return
    sourceId = saved.id
  }
  await syncRemoteImportSource(sourceId)
}

async function syncRemoteImportSource(sourceId) {
  if (!sourceId) return
  remoteImporting.value = true
  try {
    const response = await callSsh('syncRemoteImportSource', sourceId)
    if (!response?.ok) {
      ElMessage.error(response?.error || '远端同步失败')
      return
    }
    const result = response.data || {}
    await refreshAll()
    await loadRemoteImportSources()
    if (remoteImportForm.folderId) expandAncestors(remoteImportForm.folderId)
    const firstProfile = result.profiles?.[0]
    if (firstProfile?.id) selectProfileNode(firstProfile.id)
    const message = `同步完成：新增 ${result.created || 0}，更新 ${result.updated || 0}，跳过 ${result.skipped || 0}`
    if (result.skipped > 0) ElMessage.warning(message)
    else ElMessage.success(message)
  } finally {
    remoteImporting.value = false
  }
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
    pushConnectionHistory(profileId)
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
  removeConnectionHistory(profileForm.id)
  Object.assign(profileForm, defaultProfileForm())
  await refreshAll()
  selectRootNode()
}

async function onWorkTabChange() {
  if (activeState.value.workTab === 'sftp' && activeState.value.remoteFiles.length === 0) await loadRemoteDir()
  if (activeState.value.workTab === 'monitor' && !monitorData.value) refreshMonitor()
  const tab = activeState.value.workTab
  if (tab.startsWith('plugin-')) {
    const pluginId = tab.slice('plugin-'.length)
    if (!pluginComponents.value[pluginId]) await loadPlugin(pluginId)
  }
}

async function pluginExec(cmd) {
  const fn = window.electronAPI?.ssh?.exec
  if (!fn) return { code: -1, stdout: '', stderr: 'SSH API not available' }
  const res = await fn(activeConnectionId.value, cmd)
  if (!res?.ok) return { code: -1, stdout: '', stderr: res?.error || '' }
  return res.data
}

const monitorParsed = computed(() => {
  const d = monitorData.value || {}
  const osLines = (d.os || '').split('\n')
  const osName = osLines.find((l) => l.startsWith('PRETTY_NAME='))?.replace('PRETTY_NAME=', '').replace(/"/g, '') || ''
  const loadParts = (d.load || '').split(' ')
  const loadValues = loadParts.slice(0, 3).map(Number).filter((n) => !isNaN(n))
  const memParts = (d.memory || '').split(/\s+/).map(Number)
  const memTotal = memParts[1] || 0
  const memUsed = memParts[2] || 0
  const swapParts = (d.swap || '').split(/\s+/).map(Number)
  const swapTotal = swapParts[1] || 0
  const swapUsed = swapParts[2] || 0
  const cpuCount = parseInt(d.cpu) || 1
  const uptimeRaw = (d.uptime || '').replace(/^.*up\s+/, '').replace(/,\s*\d+ user.*$/, '').trim()
  const diskLines = (d.disk || '').split('\n').filter(Boolean)
  const disks = diskLines.map((line) => {
    const p = line.split(/\s+/)
    const total = parseInt(p[1]) || 0
    const used = parseInt(p[2]) || 0
    return { fs: p[0], total, used, available: parseInt(p[3]) || 0, percent: total > 0 ? Math.round(used / total * 100) : 0, mount: p[5] || '' }
  })
  const netLines = (d.netTraffic || '').split('\n').filter(Boolean)
  const netInterfaces = netLines.map((line) => {
    const m = line.trim().match(/^(\S+):\s*(.*)$/)
    if (!m) return null
    const nums = m[2].split(/\s+/).map(Number)
    return { name: m[1], rx: nums[0] || 0, tx: nums[8] || 0 }
  }).filter((n) => n && n.name !== 'lo')
  const procLines = (d.topProcesses || '').split('\n').filter(Boolean)
  const processes = procLines.slice(1).map((line) => {
    const p = line.split(/\s+/)
    return { user: p[0], pid: p[1], cpu: p[2], mem: p[3], command: p.slice(10).join(' ') }
  })
  const gpuLines = (d.gpu || '').split('\n').filter(Boolean)
  const gpus = gpuLines.map((line) => {
    const p = line.split(',').map((s) => s.trim())
    if (p.length < 8) return null
    return {
      index: p[0], name: p[1],
      gpuUtil: parseFloat(p[2]) || 0,
      memUtil: parseFloat(p[3]) || 0,
      memTotal: parseFloat(p[4]) || 0,
      memUsed: parseFloat(p[5]) || 0,
      memFree: parseFloat(p[6]) || 0,
      temp: parseFloat(p[7]) || 0,
      powerDraw: parseFloat(p[8]) || 0,
      powerLimit: parseFloat(p[9]) || 0,
      fanSpeed: p[10] || '',
      driverVersion: p[11] || '',
    }
  }).filter(Boolean)
  const blkLines = (d.blockDevices || '').split('\n').filter(Boolean)
  const blkAll = blkLines.map((line) => {
    const obj = {}
    for (const m of line.matchAll(/(\w+)="([^"]*)"/g)) obj[m[1]] = m[2]
    return obj
  }).filter((b) => b.NAME)
  const physicalDisks = blkAll.filter((b) => b.TYPE === 'disk').map((disk) => {
    const size = parseInt(disk.SIZE) || 0
    const isHDD = disk.ROTA === '1'
    const parts = blkAll.filter((b) => b.TYPE === 'part' && b.NAME.startsWith(disk.NAME) && b.NAME !== disk.NAME)
    const usedByDf = disks.filter((d) => parts.some((p) => d.fs.includes(p.NAME)))
    const usedBytes = usedByDf.reduce((sum, d) => sum + d.used, 0)
    const totalMounted = usedByDf.reduce((sum, d) => sum + d.total, 0)
    return {
      name: disk.NAME,
      model: (disk.MODEL || '').trim(),
      serial: (disk.SERIAL || '').trim(),
      size,
      type: isHDD ? 'HDD' : 'SSD',
      partitions: parts.map((p) => {
        const pSize = parseInt(p.SIZE) || 0
        const dfMatch = disks.find((d) => d.fs.includes(p.NAME))
        return {
          name: p.NAME,
          size: pSize,
          fstype: p.FSTYPE || '',
          mount: p.MOUNTPOINT || '',
          used: dfMatch?.used || 0,
          total: dfMatch?.total || pSize,
          percent: dfMatch?.percent || 0,
        }
      }),
      usedBytes,
      totalMounted,
      percent: totalMounted > 0 ? Math.round(usedBytes / totalMounted * 100) : 0,
    }
  })
  const diskIoLines = (d.diskIo || '').split('\n').filter(Boolean)
  const diskIoMap = {}
  for (const line of diskIoLines) {
    const p = line.trim().split(/\s+/)
    if (p.length < 14) continue
    const devName = p[2]
    diskIoMap[devName] = { readSectors: parseInt(p[5]) || 0, writeSectors: parseInt(p[9]) || 0, ioMs: parseInt(p[12]) || 0 }
  }
  for (const pd of physicalDisks) {
    const io = diskIoMap[pd.name]
    if (io) {
      pd.readBytes = io.readSectors * 512
      pd.writeBytes = io.writeSectors * 512
      pd.ioMs = io.ioMs
    }
  }
  return {
    hostname: (d.hostname || '').trim(),
    osName,
    kernel: (d.kernel || '').trim(),
    arch: (d.arch || '').trim(),
    uptime: uptimeRaw,
    cpuModel: (d.cpuModel || '').trim(),
    cpuCount,
    loadAvg: loadValues.map((v) => v.toFixed(2)).join(' / '),
    loadValues,
    memTotal, memUsed,
    memPercent: memTotal > 0 ? Math.round(memUsed / memTotal * 100) : 0,
    swapTotal, swapUsed,
    swapPercent: swapTotal > 0 ? Math.round(swapUsed / swapTotal * 100) : 0,
    disks, netInterfaces, processes, gpus, physicalDisks,
  }
})

async function refreshMonitor() {
  if (!activeConnectionId.value) return
  monitorLoading.value = true
  try {
    const res = await callSsh('serverStats', activeConnectionId.value)
    if (!res?.ok) { ElMessage.error(res?.error || '获取状态失败'); return }
    monitorData.value = res.data
    monitorLastTime.value = new Date().toLocaleTimeString()
    nextTick(() => updateBandwidth(monitorParsed.value.netInterfaces))
  } catch { ElMessage.error('获取服务器状态异常') }
  finally { monitorLoading.value = false }
}

function toggleMonitorAuto(val) {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null }
  if (val) {
    refreshMonitor()
    monitorTimer = setInterval(() => {
      if (activeState.value.workTab === 'monitor') refreshMonitor()
    }, 5000)
  }
}

const filteredProcesses = computed(() => {
  let list = monitorParsed.value.processes || []
  const q = procFilter.value.trim().toLowerCase()
  if (q) list = list.filter((p) => p.user.toLowerCase().includes(q) || p.pid.includes(q) || p.command.toLowerCase().includes(q))
  const key = procSortBy.value === 'mem' ? 'mem' : 'cpu'
  return [...list].sort((a, b) => parseFloat(b[key]) - parseFloat(a[key]))
})

async function killProcess(pid) {
  if (!activeConnectionId.value) return
  try {
    const res = await callSsh('killProcess', activeConnectionId.value, Number(pid))
    if (!res?.ok) { ElMessage.error(res?.error || '结束进程失败'); return }
    ElMessage.success(`进程 ${pid} 已终止`)
    await refreshMonitor()
  } catch (e) { ElMessage.error(e?.message || '结束进程异常') }
}

function formatBytesPerSec(bps) {
  return formatBytes(bps) + '/s'
}

const bandwidthCurrent = computed(() => bandwidthHistory.value.length ? bandwidthHistory.value[bandwidthHistory.value.length - 1] : null)
const bandwidthMax = computed(() => {
  let max = 1024
  for (const p of bandwidthHistory.value) { max = Math.max(max, p.rx, p.tx) }
  return max
})
function bandwidthBarHeight(value) {
  return bandwidthMax.value > 0 ? Math.max(1, Math.round(value / bandwidthMax.value * 100)) : 0
}

function updateBandwidth(netInterfaces) {
  const now = Date.now()
  const snapshot = {}
  for (const iface of netInterfaces) snapshot[iface.name] = { rx: iface.rx, tx: iface.tx }
  if (!bandwidthIface.value && netInterfaces.length) bandwidthIface.value = netInterfaces[0].name
  const prev = bandwidthPrevSnapshot.value
  const elapsed = (now - bandwidthPrevTime.value) / 1000
  if (prev && elapsed > 0 && bandwidthIface.value) {
    const ifName = bandwidthIface.value
    const prevIf = prev[ifName]
    const curIf = snapshot[ifName]
    if (prevIf && curIf) {
      const rxDiff = Math.max(0, curIf.rx - prevIf.rx)
      const txDiff = Math.max(0, curIf.tx - prevIf.tx)
      bandwidthHistory.value.push({
        rx: Math.round(rxDiff / elapsed),
        tx: Math.round(txDiff / elapsed),
        time: new Date().toLocaleTimeString(),
      })
      if (bandwidthHistory.value.length > BANDWIDTH_MAX_POINTS) bandwidthHistory.value.shift()
    }
  }
  bandwidthPrevSnapshot.value = snapshot
  bandwidthPrevTime.value = now
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
  await nextTick()
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
  terminal.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      const sel = terminal.getSelection()
      if (sel) navigator.clipboard.writeText(sel)
      return false
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
      navigator.clipboard.readText().then((text) => { if (text) terminal.paste(text) })
      return false
    }
    return true
  })
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

/** 向当前终端发送数据 */
function writeToTerminal(text) {
  const tab = activeTerminalTab.value
  if (!activeConnectionId.value || !tab?.shellId) { ElMessage.warning('请先连接 SSH'); return false }
  callSsh('writeShell', { profileId: activeConnectionId.value, shellId: tab.shellId, data: text })
  return true
}

/** 快捷输入：发送内容到终端 */
function sendQuickInput() {
  if (!quickInputText.value.trim()) return
  let text = quickInputText.value
  if (!text.endsWith('\n')) text += '\n'
  if (writeToTerminal(text)) quickInputText.value = ''
}

/** 预设指令：构建树形节点列表 */
const presetGroupOptions = computed(() => presetCommands.value.filter((c) => c.type === 'group'))
const presetTreeNodes = computed(() => buildPresetTree('', 0))
function buildPresetTree(parentId = '', depth = 0) {
  const nodes = []
  const children = presetCommands.value
    .filter((c) => (c.parentId || '') === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  for (const child of children) {
    nodes.push({ ...child, depth })
    if (child.type === 'group' && presetExpandedIds.value.has(child.id)) {
      nodes.push(...buildPresetTree(child.id, depth + 1))
    }
  }
  return nodes
}
function togglePresetGroup(id) {
  if (presetExpandedIds.value.has(id)) presetExpandedIds.value.delete(id)
  else presetExpandedIds.value.add(id)
}

async function loadPresetCommands() {
  const res = await callSsh('listPresetCommands')
  if (res?.ok) presetCommands.value = res.data || []
}

function parsePresetParams(params) {
  if (Array.isArray(params)) return params
  try { const arr = JSON.parse(params); if (Array.isArray(arr)) return arr } catch {}
  return params ? [params] : []
}

function newPresetCommand() {
  Object.assign(presetForm, { id: '', type: 'command', name: '', command: '', params: '', remark: '', parentId: '' })
  presetFormParams.value = []
  newParamName.value = ''
  presetDialogVisible.value = true
}
function newPresetGroup() {
  Object.assign(presetForm, { id: '', type: 'group', name: '', command: '', params: '', remark: '', parentId: '' })
  presetFormParams.value = []
  newParamName.value = ''
  presetDialogVisible.value = true
}
function editPresetItem(item) {
  Object.assign(presetForm, { id: item.id, type: item.type, name: item.name, command: item.command || '', params: item.params || '', remark: item.remark || '', parentId: item.parentId || '' })
  presetFormParams.value = parsePresetParams(item.params)
  newParamName.value = ''
  presetDialogVisible.value = true
}

function addPresetParam() {
  const name = newParamName.value.trim()
  if (!name) return
  if (presetFormParams.value.includes(name)) { ElMessage.warning('参数已存在'); return }
  presetFormParams.value.push(name)
  newParamName.value = ''
}
function removePresetParam(idx) {
  presetFormParams.value.splice(idx, 1)
}
function insertParamPlaceholder(paramName) {
  const placeholder = `{{${paramName}}}`
  presetForm.command = (presetForm.command || '') + placeholder
  nextTick(() => {
    const textarea = presetCmdInput.value?.$el?.querySelector('textarea') || presetCmdInput.value?.ref
    textarea?.focus()
  })
}
async function savePresetItem() {
  if (!presetForm.name.trim()) { ElMessage.warning('名称不能为空'); return }
  if (presetForm.type === 'command' && !presetForm.command.trim()) { ElMessage.warning('指令不能为空'); return }
  savingPreset.value = true
  try {
    const payload = { ...presetForm, params: JSON.stringify(presetFormParams.value) }
    const res = await callSsh('savePresetCommand', payload)
    if (!res?.ok) { ElMessage.error(res?.error || '保存失败'); return }
    ElMessage.success('已保存')
    presetDialogVisible.value = false
    await loadPresetCommands()
  } finally { savingPreset.value = false }
}
async function deletePresetItem(id) {
  const res = await callSsh('deletePresetCommand', id)
  if (!res?.ok) { ElMessage.error(res?.error || '删除失败'); return }
  ElMessage.success('已删除')
  await loadPresetCommands()
}
const presetExecPreview = computed(() => {
  let cmd = presetExecCommand.value
  for (const p of presetExecParams.value) {
    cmd = cmd.replaceAll(`{{${p.name}}}`, p.value || `{{${p.name}}}`)
  }
  return cmd
})

function executePresetCommand(node) {
  const cmd = node.command || ''
  const placeholders = [...new Set((cmd.match(/\{\{([^}]+)\}\}/g) || []).map((m) => m.slice(2, -2)))]
  if (placeholders.length === 0) {
    writeToTerminal(cmd.endsWith('\n') ? cmd : cmd + '\n')
    return
  }
  presetExecCommand.value = cmd
  presetExecParams.value = placeholders.map((name) => ({ name, value: '' }))
  presetExecDialogVisible.value = true
}

function confirmExecutePreset() {
  let cmd = presetExecCommand.value
  for (const p of presetExecParams.value) {
    cmd = cmd.replaceAll(`{{${p.name}}}`, p.value)
  }
  if (!cmd.endsWith('\n')) cmd += '\n'
  writeToTerminal(cmd)
  presetExecDialogVisible.value = false
}

/** AI 指令：检查 AI 配置并生成命令 */
async function checkAiConfig() {
  try {
    const res = await (await import('../utils/api/tools')).fetchToolsConfig()
    aiConfigured.value = Boolean(res?.data?.ai?.baseUrl && res?.data?.ai?.apiKey)
  } catch { aiConfigured.value = false }
}
async function generateAiCommand() {
  if (!aiPrompt.value.trim()) { ElMessage.warning('请输入需求'); return }
  aiGenerating.value = true
  aiDescription.value = ''
  aiCommandText.value = ''
  try {
    const { aiChat } = await import('../utils/api/tools')
    const res = await aiChat(aiPrompt.value)
    if (res?.code === 200 && res.data) {
      aiDescription.value = res.data.description || ''
      aiCommandText.value = res.data.command || ''
    } else {
      ElMessage.error(res?.message || 'AI 请求失败')
    }
  } catch (e) { ElMessage.error('AI 请求异常') }
  finally { aiGenerating.value = false }
}
function sendAiCommand() {
  if (!aiCommandText.value.trim()) return
  let cmd = aiCommandText.value
  if (!cmd.endsWith('\n')) cmd += '\n'
  writeToTerminal(cmd)
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

function downloadDir(row) {
  dirDownloadRow.value = row
  dirDownloadName.value = row.name
  dirDownloadAutoExtract.value = false
  dirDownloadStatus.value = 'confirm'
  dirDownloadStage.value = ''
  dirDownloadPercent.value = 0
  dirDownloadError.value = ''
  dirDownloadLocalPath.value = ''
  dirDownloadVisible.value = true
}

async function confirmDirDownload() {
  const localDir = await window.electronAPI?.selectOutputDirectory?.()
  if (!localDir) return
  const row = dirDownloadRow.value
  const remotePath = joinRemote(activeState.value.remotePath, row.name)
  const transferId = createTransferId()
  dirDownloadStatus.value = 'running'
  dirDownloadStage.value = '正在远程压缩...'
  dirDownloadPercent.value = 0

  const unsub = window.electronAPI?.ssh?.onTransferProgress?.((p) => {
    if (p.transferId !== transferId) return
    dirDownloadStage.value = '正在下载...'
    dirDownloadPercent.value = p.total > 0 ? Math.min(99, Math.round(p.transferred / p.total * 100)) : 0
  })

  try {
    const res = await callSsh('downloadDir', {
      profileId: activeConnectionId.value,
      remotePath,
      localDir,
      transferId,
      autoExtract: dirDownloadAutoExtract.value,
    })
    unsub?.()
    if (!res?.ok) { dirDownloadStatus.value = 'error'; dirDownloadError.value = res?.error || '下载失败'; return }
    dirDownloadPercent.value = 100
    dirDownloadStage.value = res.data?.extracted ? '已下载并解压' : '已下载压缩包'
    dirDownloadLocalPath.value = res.data?.localPath || localDir
    dirDownloadStatus.value = 'done'
  } catch (e) {
    unsub?.()
    dirDownloadStatus.value = 'error'
    dirDownloadError.value = e?.message || '下载异常'
  }
}

function openDirDownloadFolder() {
  if (dirDownloadLocalPath.value) window.electronAPI?.showItemInFolder?.(dirDownloadLocalPath.value)
  dirDownloadVisible.value = false
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

async function openFileEditor(row) {
  if (row.isDirectory) return
  const remotePath = joinRemote(activeState.value.remotePath, row.name)
  fileEditorPath.value = remotePath
  fileEditorContent.value = ''
  fileEditorSize.value = 0
  fileEditorLoading.value = true
  fileEditorVisible.value = true
  try {
    const res = await callSsh('readRemoteFile', { profileId: activeConnectionId.value, remotePath })
    if (!res?.ok) { ElMessage.error(res?.error || '读取文件失败'); fileEditorVisible.value = false; return }
    fileEditorContent.value = res.data.content
    fileEditorSize.value = res.data.size || 0
  } catch (e) { ElMessage.error('读取文件异常'); fileEditorVisible.value = false }
  finally { fileEditorLoading.value = false }
}

async function saveFileEditor() {
  fileEditorSaving.value = true
  try {
    const res = await callSsh('writeRemoteFile', { profileId: activeConnectionId.value, remotePath: fileEditorPath.value, content: fileEditorContent.value })
    if (!res?.ok) { ElMessage.error(res?.error || '保存失败'); return }
    ElMessage.success('文件已保存')
    fileEditorVisible.value = false
    await loadRemoteDir()
  } catch { ElMessage.error('保存文件异常') }
  finally { fileEditorSaving.value = false }
}

const ARCHIVE_EXTENSIONS = ['.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz', '.tar.zst', '.tar', '.zip', '.gz', '.bz2', '.xz', '.7z', '.rar']

function isArchiveFile(name) {
  const lower = (name || '').toLowerCase()
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function getArchiveType(name) {
  const lower = (name || '').toLowerCase()
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz'
  if (lower.endsWith('.tar.bz2') || lower.endsWith('.tbz2')) return 'tar.bz2'
  if (lower.endsWith('.tar.xz') || lower.endsWith('.txz')) return 'tar.xz'
  if (lower.endsWith('.tar.zst')) return 'tar.zst'
  if (lower.endsWith('.tar')) return 'tar'
  if (lower.endsWith('.zip')) return 'zip'
  if (lower.endsWith('.gz')) return 'gz'
  if (lower.endsWith('.bz2')) return 'bz2'
  if (lower.endsWith('.xz')) return 'xz'
  if (lower.endsWith('.7z')) return '7z'
  if (lower.endsWith('.rar')) return 'rar'
  return ''
}

function buildExtractCommand(filePath, targetDir, archiveType) {
  const dir = targetDir ? `mkdir -p '${targetDir}' && cd '${targetDir}' && ` : ''
  const tDir = targetDir ? ` -C '${targetDir}'` : ''
  switch (archiveType) {
    case 'tar.gz': return `${dir ? `mkdir -p '${targetDir}' && ` : ''}tar -xzvf '${filePath}'${tDir} 2>&1`
    case 'tar.bz2': return `${dir ? `mkdir -p '${targetDir}' && ` : ''}tar -xjvf '${filePath}'${tDir} 2>&1`
    case 'tar.xz': return `${dir ? `mkdir -p '${targetDir}' && ` : ''}tar -xJvf '${filePath}'${tDir} 2>&1`
    case 'tar.zst': return `${dir ? `mkdir -p '${targetDir}' && ` : ''}tar --zstd -xvf '${filePath}'${tDir} 2>&1`
    case 'tar': return `${dir ? `mkdir -p '${targetDir}' && ` : ''}tar -xvf '${filePath}'${tDir} 2>&1`
    case 'zip': return `${dir}unzip -o '${filePath}'${targetDir ? ` -d '${targetDir}'` : ''} 2>&1`
    case 'gz': return `${dir}gunzip -k '${filePath}' 2>&1`
    case 'bz2': return `${dir}bunzip2 -k '${filePath}' 2>&1`
    case 'xz': return `${dir}unxz -k '${filePath}' 2>&1`
    case '7z': return `${dir}7z x -y '${filePath}'${targetDir ? ` -o'${targetDir}'` : ''} 2>&1`
    case 'rar': return `${dir}unrar x -o+ '${filePath}'${targetDir ? ` '${targetDir}/'` : ''} 2>&1`
    default: return ''
  }
}

function openExtractDialog(row) {
  extractFileName.value = row.name
  extractTargetDir.value = ''
  extractDeleteAfter.value = false
  extractStatus.value = 'idle'
  extractLog.value = ''
  extractDirPickerVisible.value = false
  extractDialogVisible.value = true
}

async function openExtractDirPicker() {
  const startPath = extractTargetDir.value.trim() || activeState.value.remotePath || '/'
  extractDirPickerVisible.value = true
  await loadExtractDirPicker(startPath)
}

async function loadExtractDirPicker(dirPath) {
  extractDirPickerLoading.value = true
  extractDirPickerPath.value = dirPath
  extractDirPickerItems.value = []
  const res = await callSsh('exec', activeConnectionId.value, `ls -1pA '${dirPath}' 2>/dev/null`)
  if (res?.ok && res.data?.code === 0) {
    extractDirPickerItems.value = res.data.stdout.trim().split('\n')
      .filter((name) => name.endsWith('/'))
      .map((name) => ({ name: name.replace(/\/$/, '') }))
  }
  extractDirPickerLoading.value = false
}

async function extractDirPickerEnter(name) {
  const next = extractDirPickerPath.value === '/' ? '/' + name : extractDirPickerPath.value + '/' + name
  await loadExtractDirPicker(next)
}

async function extractDirPickerGoUp() {
  const parts = extractDirPickerPath.value.split('/').filter(Boolean)
  parts.pop()
  await loadExtractDirPicker('/' + parts.join('/'))
}

function confirmExtractDirPicker() {
  extractTargetDir.value = extractDirPickerPath.value
  extractDirPickerVisible.value = false
}

function scrollExtractLog() {
  nextTick(() => {
    if (extractLogRef.value) extractLogRef.value.scrollTop = extractLogRef.value.scrollHeight
  })
}

async function doExtract() {
  const fileName = extractFileName.value
  const archiveType = getArchiveType(fileName)
  if (!archiveType) { ElMessage.error('不支持的压缩格式'); return }

  const filePath = joinRemote(activeState.value.remotePath, fileName)
  const targetDir = extractTargetDir.value.trim()
  const cmd = buildExtractCommand(filePath, targetDir, archiveType)
  if (!cmd) { ElMessage.error('无法构建解压命令'); return }

  extractStatus.value = 'running'
  extractLog.value = `$ ${cmd}\n`
  scrollExtractLog()

  const checkToolCmd = archiveType === 'zip' ? 'which unzip' : archiveType === '7z' ? 'which 7z' : archiveType === 'rar' ? 'which unrar' : ''
  if (checkToolCmd) {
    const checkRes = await callSsh('exec', activeConnectionId.value, `${checkToolCmd} 2>/dev/null`)
    if (checkRes?.ok && checkRes.data?.code !== 0) {
      const toolName = checkToolCmd.split(' ')[1]
      extractLog.value += `\n❌ 未找到 ${toolName}，请先安装: sudo apt install ${toolName} 或 sudo yum install ${toolName}\n`
      extractStatus.value = 'error'
      scrollExtractLog()
      return
    }
  }

  const res = await callSsh('exec', activeConnectionId.value, cmd)
  if (res?.ok) {
    const output = (res.data?.stdout || '') + (res.data?.stderr || '')
    extractLog.value += output
    scrollExtractLog()
    if (res.data?.code === 0) {
      extractLog.value += '\n✅ 解压完成\n'
      extractStatus.value = 'done'
      if (extractDeleteAfter.value) {
        extractLog.value += `\n正在删除压缩包 ${fileName}...\n`
        scrollExtractLog()
        await callSsh('exec', activeConnectionId.value, `rm -f '${filePath}'`)
        extractLog.value += `已删除 ${fileName}\n`
      }
      await loadRemoteDir()
    } else {
      extractLog.value += '\n❌ 解压失败\n'
      extractStatus.value = 'error'
    }
  } else {
    extractLog.value += `\n❌ 执行失败: ${res?.error || '未知错误'}\n`
    extractStatus.value = 'error'
  }
  scrollExtractLog()
}

function formatExtension(format) {
  const map = { 'tar.gz': '.tar.gz', 'tar.bz2': '.tar.bz2', 'tar.xz': '.tar.xz', 'zip': '.zip', '7z': '.7z' }
  return map[format] || '.tar.gz'
}

function openCompressDialog(row) {
  compressDirName.value = row.name
  compressFormat.value = 'tar.gz'
  compressOutputName.value = row.name + '.tar.gz'
  compressLevel.value = 'default'
  compressDeleteAfter.value = false
  compressStatus.value = 'idle'
  compressLog.value = ''
  compressDialogVisible.value = true
}

function updateCompressOutputName() {
  const baseName = compressDirName.value.replace(/\.[^.]+$/, '')
  compressOutputName.value = baseName + formatExtension(compressFormat.value)
}

function buildCompressCommand(dirPath, outputPath, format, level) {
  const levelFlag = (defaultFlag, fastFlag, bestFlag) => level === 'fast' ? fastFlag : level === 'best' ? bestFlag : defaultFlag
  switch (format) {
    case 'tar.gz': {
      const env = level === 'fast' ? 'GZIP=-1 ' : level === 'best' ? 'GZIP=-9 ' : ''
      return `${env}tar -czvf '${outputPath}' '${dirPath}' 2>&1`
    }
    case 'tar.bz2': {
      const env = level === 'fast' ? 'BZIP2=-1 ' : level === 'best' ? 'BZIP2=-9 ' : ''
      return `${env}tar -cjvf '${outputPath}' '${dirPath}' 2>&1`
    }
    case 'tar.xz': {
      const env = level === 'fast' ? 'XZ_OPT=-1 ' : level === 'best' ? 'XZ_OPT=-9 ' : ''
      return `${env}tar -cJvf '${outputPath}' '${dirPath}' 2>&1`
    }
    case 'zip':
      return `zip -r ${levelFlag('-6', '-1', '-9')} '${outputPath}' '${dirPath}' 2>&1`
    case '7z':
      return `7z a ${levelFlag('', '-mx=1', '-mx=9')} '${outputPath}' '${dirPath}' 2>&1`
    default:
      return ''
  }
}

function scrollCompressLog() {
  nextTick(() => {
    if (compressLogRef.value) compressLogRef.value.scrollTop = compressLogRef.value.scrollHeight
  })
}

async function doCompress() {
  const dirName = compressDirName.value
  const format = compressFormat.value
  const outputName = compressOutputName.value.trim() || dirName + formatExtension(format)
  const parentDir = activeState.value.remotePath
  const dirPath = dirName
  const outputPath = joinRemote(parentDir, outputName)

  const checkToolCmd = format === 'zip' ? 'which zip' : format === '7z' ? 'which 7z' : ''
  compressStatus.value = 'running'
  compressLog.value = ''

  if (checkToolCmd) {
    const checkRes = await callSsh('exec', activeConnectionId.value, `${checkToolCmd} 2>/dev/null`)
    if (checkRes?.ok && checkRes.data?.code !== 0) {
      const toolName = checkToolCmd.split(' ')[1]
      compressLog.value += `❌ 未找到 ${toolName}，请先安装: sudo apt install ${toolName} 或 sudo yum install ${toolName}\n`
      compressStatus.value = 'error'
      scrollCompressLog()
      return
    }
  }

  const cdCmd = `cd '${parentDir}' && `
  const cmd = cdCmd + buildCompressCommand(dirPath, outputPath, format, compressLevel.value)
  compressLog.value += `$ ${cmd}\n`
  scrollCompressLog()

  const res = await callSsh('exec', activeConnectionId.value, cmd)
  if (res?.ok) {
    const output = (res.data?.stdout || '') + (res.data?.stderr || '')
    compressLog.value += output
    scrollCompressLog()
    if (res.data?.code === 0) {
      const sizeRes = await callSsh('exec', activeConnectionId.value, `stat -c%s '${outputPath}' 2>/dev/null`)
      const sizeStr = sizeRes?.ok ? (sizeRes.data?.stdout || '').trim() : ''
      compressLog.value += `\n✅ 压缩完成${sizeStr ? ' (' + formatBytes(parseInt(sizeStr)) + ')' : ''}\n`
      compressStatus.value = 'done'
      if (compressDeleteAfter.value) {
        compressLog.value += `\n正在删除源文件夹 ${dirName}...\n`
        scrollCompressLog()
        await callSsh('exec', activeConnectionId.value, `rm -rf '${joinRemote(parentDir, dirName)}'`)
        compressLog.value += `已删除 ${dirName}\n`
      }
      await loadRemoteDir()
    } else {
      compressLog.value += '\n❌ 压缩失败\n'
      compressStatus.value = 'error'
    }
  } else {
    compressLog.value += `\n❌ 执行失败: ${res?.error || '未知错误'}\n`
    compressStatus.value = 'error'
  }
  scrollCompressLog()
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
.config-tree-search {
  position: sticky;
  top: 0;
  z-index: 1;
  margin-bottom: 4px;
  padding-bottom: 6px;
  background: linear-gradient(180deg, rgba(255,255,255,.98) 70%, rgba(255,255,255,0));
}
.config-tree-search :deep(.el-input__wrapper) {
  border-radius: 10px;
  box-shadow: 0 0 0 1px rgba(203,213,225,.82) inset;
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
.terminal-toolbar {
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
}
.toolbar-toggle {
  display: flex; align-items: center; justify-content: center;
  padding: 4px; cursor: pointer; font-size: 12px; color: #6b7280; user-select: none;
}
.toolbar-toggle:hover { background: #f1f5f9; }
.toolbar-body { padding: 8px 12px; }
.toolbar-tabs :deep(.el-tabs__header) { margin-bottom: 8px; }
.toolbar-section { min-height: 80px; }
.preset-tree { max-height: 260px; overflow-y: auto; }
.preset-node { display: flex; align-items: center; gap: 4px; padding: 3px 4px; border-radius: 4px; }
.preset-node:hover { background: #f1f5f9; }
.preset-group-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; padding: 2px 4px; }
.preset-cmd-name { font-size: 13px; white-space: nowrap; }
.preset-cmd-text { max-width: 200px; }
.preset-params-area { width: 100%; }
.preset-params-tags { display: flex; flex-wrap: wrap; min-height: 28px; }
.file-editor-textarea :deep(textarea) { font-family: Consolas, "Cascadia Mono", "Liberation Mono", monospace; font-size: 13px; line-height: 1.6; }
.monitor-panel { min-height: 400px; }
.monitor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.monitor-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
.monitor-card-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px; }
.monitor-kv { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6b7280; padding: 3px 0; }
.monitor-kv strong { color: #1f2937; font-weight: 500; text-align: right; max-width: 65%; word-break: break-all; }
.physical-disk-item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.physical-disk-item:first-child { padding-top: 0; }
.physical-disk-item:last-child { border-bottom: none; padding-bottom: 0; }
.bandwidth-chart { padding: 4px 0; }
.bandwidth-chart-area { display: flex; gap: 4px; height: 140px; }
.bandwidth-y-labels { display: flex; flex-direction: column; justify-content: space-between; width: 70px; text-align: right; font-size: 10px; color: #9ca3af; padding-right: 6px; }
.bandwidth-bars { display: flex; align-items: flex-end; gap: 2px; flex: 1; border-bottom: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; padding: 0 2px; }
.bandwidth-bar-group { display: flex; gap: 1px; flex: 1; align-items: flex-end; height: 100%; min-width: 0; }
.bandwidth-bar { flex: 1; min-width: 0; border-radius: 2px 2px 0 0; transition: height 0.3s ease; }
.bandwidth-bar-rx { background: #60a5fa; }
.bandwidth-bar-tx { background: #4ade80; }
.sftp-action-bar { display: flex; align-items: center;gap: 4px; }
.sftp-sort-bar { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; }
.extract-log { background: #0f172a; color: #e5e7eb; border-radius: 8px; padding: 12px; max-height: 400px; overflow-y: auto; font-family: Consolas, "Cascadia Mono", monospace; font-size: 12px; scroll-behavior: smooth; }
.extract-log pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
.extract-dir-picker { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
.extract-dir-list { border: 1px solid #e5e7eb; border-radius: 6px; max-height: 220px; overflow-y: auto; background: #fff; }
.extract-dir-item { display: flex; align-items: center; gap: 6px; padding: 6px 10px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f5f5f5; transition: background .15s; }
.extract-dir-item:last-child { border-bottom: none; }
.extract-dir-item:hover { background: #f0f7ff; }
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
.jump-host-item {
  border: 1px dashed rgba(148, 163, 184, .5);
  border-radius: 10px;
  padding: 10px 12px 2px;
  margin-bottom: 12px;
  background: rgba(241, 245, 249, .5);
}
.jump-host-item + .jump-host-item {
  margin-top: 0;
}
.remote-import-manager {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 14px;
  min-height: 560px;
}
.remote-import-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  padding: 10px;
}
.remote-import-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 6px;
  color: #0f172a;
  font-size: 13px;
}
.remote-source-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 12px;
  background: #ffffff;
  padding: 10px;
  text-align: left;
  transition: background .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.remote-source-item:hover,
.remote-source-item.is-active {
  border-color: rgba(37,99,235,.32);
  background: #eff6ff;
  box-shadow: 0 10px 20px rgba(37,99,235,.08);
}
.remote-source-main {
  display: grid;
  min-width: 0;
  gap: 3px;
}
.remote-source-main strong {
  color: #0f172a;
  font-size: 13px;
}
.remote-source-main small,
.remote-source-sync {
  color: #64748b;
  font-size: 11px;
}
.remote-import-form {
  display: grid;
  gap: 12px;
}
.remote-header-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) minmax(0, 1fr) 36px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.remote-import-help {
  border-radius: 12px;
  background: #f8fafc;
  padding: 10px 12px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
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

@media (max-width: 900px) {
  .remote-import-manager {
    grid-template-columns: 1fr;
  }

  .remote-import-list {
    max-height: 240px;
  }
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
