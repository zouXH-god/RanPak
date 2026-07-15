;(function(ctx, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig) {

const Back = Icons.Back
const Delete = Icons.Delete
const Document = Icons.Document
const Folder = Icons.Folder
const Plus = Icons.Plus
const Refresh = Icons.Refresh
const Warning = Icons.Warning

function showMessage(msg, type = 'info') {
  const inst = Vue.getCurrentInstance()
  if (inst) inst.appContext.config.globalProperties.$message({ message: msg, type })
}

function showConfirm(msg, title, opts) {
  const inst = Vue.getCurrentInstance()
  return inst.appContext.config.globalProperties.$confirm(msg, title, opts)
}

ctx.exports = {
  props: {
    profileId: { type: String, default: '' },
    exec: { type: Function, required: true },
    callSsh: { type: Function, default: null },
  },
  template: `<div class="nginx-manager">
    <!-- 未安装提示 -->
    <div v-if="checkDone && !installed" class="nginx-not-installed">
      <template v-if="!installing">
        <div class="text-center py-8">
          <el-icon size="48" class="text-gray-300 mb-3"><Warning /></el-icon>
          <p class="text-gray-500 mb-4">未检测到 Nginx，是否自动安装？</p>
          <el-button type="primary" @click="startInstall">安装 Nginx（官方源）</el-button>
        </div>
      </template>
      <template v-else>
        <div class="install-log-panel">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-semibold">安装进度</span>
            <el-tag :type="installStatus === 'done' ? 'success' : installStatus === 'error' ? 'danger' : 'warning'" size="small">{{ installStatusLabel }}</el-tag>
          </div>
          <div ref="installLogRef" class="install-log">
            <pre>{{ installLog }}</pre>
          </div>
          <div v-if="installStatus === 'done'" class="mt-2">
            <el-button type="primary" size="small" @click="recheckNginx">完成，刷新状态</el-button>
          </div>
        </div>
      </template>
    </div>

    <!-- 已安装 — 管理面板 -->
    <template v-if="checkDone && installed">
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <el-tag type="success" effect="dark">Nginx {{ version }}</el-tag>
        <el-tag :type="statusTag">{{ statusLabel }}</el-tag>
        <template v-if="latestVersion">
          <el-tag v-if="hasUpdate" type="warning" effect="plain" class="cursor-pointer" @click="showUpdateConfirm">
            最新版 {{ latestVersion }}，可更新
          </el-tag>
          <el-tag v-else type="info" effect="plain">已是最新</el-tag>
        </template>
        <el-button v-if="!latestVersion" size="small" text :loading="checkingUpdate" @click="checkLatestVersion">检测更新</el-button>
        <div class="flex-1"></div>
        <el-button v-if="hasUpdate" size="small" type="warning" @click="showUpdateConfirm">更新 Nginx</el-button>
        <el-button size="small" :icon="Refresh" @click="refreshAll" :loading="loading">刷新</el-button>
      </div>

      <!-- 服务控制 -->
      <div class="mgr-card mb-3">
        <h3 class="mgr-card-title">服务控制</h3>
        <div class="flex flex-wrap gap-2">
          <el-button size="small" type="success" :disabled="status.active === 'active'" @click="doAction('start')">启动</el-button>
          <el-button size="small" type="danger" :disabled="status.active !== 'active'" @click="doAction('stop')">停止</el-button>
          <el-button size="small" type="warning" @click="doAction('restart')">重启</el-button>
          <el-button size="small" type="primary" @click="doAction('reload')">重载配置</el-button>
          <el-button size="small" @click="doTestConfig">测试配置 (nginx -t)</el-button>
          <el-button size="small" :type="status.enabled ? '' : 'info'" @click="doAction(status.enabled ? 'disable' : 'enable')">
            {{ status.enabled ? '取消开机启动' : '设置开机启动' }}
          </el-button>
        </div>
        <div v-if="actionResult" class="mt-2 text-xs rounded bg-slate-50 p-2 whitespace-pre-wrap">{{ actionResult }}</div>
      </div>

      <el-tabs v-model="activeTab" class="mgr-tabs">
        <!-- 站点管理 -->
        <el-tab-pane label="站点配置" name="sites">
          <div class="flex gap-2 mb-2 items-center flex-wrap">
            <el-button size="small" :icon="Refresh" @click="loadSitesAuto" :loading="loadingSites">自动解析</el-button>
            <div class="dir-picker">
              <el-input v-model="customSiteDir" size="small" readonly placeholder="附加目录" class="dir-picker-input">
                <template #prepend><el-icon><Folder /></el-icon></template>
              </el-input>
              <el-button size="small" @click="openDirBrowser('site')" class="dir-picker-btn">选择</el-button>
            </div>
            <el-button size="small" type="primary" @click="loadSitesFromDir" :loading="loadingSites">扫描</el-button>
            <el-button size="small" @click="resetSiteDir" :loading="loadingSites">重置</el-button>
            <div class="flex-1"></div>
            <el-button size="small" :icon="Plus" @click="newSite">新建站点</el-button>
          </div>
          <div v-if="nginxConfPath" class="text-xs text-gray-400 mb-2">
            主配置: {{ nginxConfPath }}
            <span v-if="parsedIncludes.length"> | include 目录: {{ parsedIncludes.join(', ') }}</span>
          </div>
          <el-table :data="sites" border size="small" max-height="400" v-loading="loadingSites">
            <el-table-column label="配置文件" min-width="220">
              <template #default="{ row }">
                <div class="flex items-center gap-1">
                  <el-tag v-if="row.isMain" size="small" type="warning" class="mr-1">主配置</el-tag>
                  <span class="truncate">{{ row.name }}</span>
                </div>
                <div class="text-xs text-gray-400" v-if="row.dir">{{ row.dir }}</div>
              </template>
            </el-table-column>
            <el-table-column label="来源" width="120">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.source || 'include' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" align="center">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="editSite(row)">编辑</el-button>
                <el-popconfirm v-if="!row.isMain" title="确认删除此配置？" @confirm="removeSite(row)">
                  <template #reference><el-button size="small" text type="danger">删除</el-button></template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 日志 -->
        <el-tab-pane label="日志查看" name="logs">
          <div class="flex gap-2 mb-2 items-center flex-wrap">
            <el-radio-group v-model="logType" size="small" @change="onLogTypeChange">
              <el-radio-button value="access_log">Access</el-radio-button>
              <el-radio-button value="error_log">Error</el-radio-button>
              <el-radio-button v-if="otherLogs.length" value="other">其他</el-radio-button>
            </el-radio-group>
            <el-select v-model="selectedLog" size="small" placeholder="选择日志文件" class="w-[240px]" @change="loadLog">
              <el-option v-for="f in currentTypeLogs" :key="f.path" :label="f.label" :value="f.path" />
            </el-select>
            <el-input-number v-model="logLines" :min="50" :max="5000" :step="100" size="small" class="w-[120px]" />
            <el-button size="small" :icon="Refresh" @click="loadLog" :loading="loadingLog">刷新</el-button>
            <el-divider direction="vertical" />
            <el-checkbox v-model="logAutoRefresh" size="small" @change="toggleLogAutoRefresh">自动刷新</el-checkbox>
            <el-select v-if="logAutoRefresh" v-model="logRefreshInterval" size="small" class="w-[80px]" @change="restartLogTimer">
              <el-option :value="3" label="3秒" />
              <el-option :value="5" label="5秒" />
              <el-option :value="10" label="10秒" />
              <el-option :value="30" label="30秒" />
            </el-select>
            <el-checkbox v-model="logStickBottom" size="small">保持底部</el-checkbox>
          </div>
          <div ref="logViewRef" class="log-view" :class="{ 'log-view-tall': logAutoRefresh }">
            <pre>{{ logContent || '选择日志文件后点击加载' }}</pre>
          </div>
        </el-tab-pane>

        <!-- SSL -->
        <el-tab-pane label="SSL 证书" name="ssl">
          <div class="flex gap-2 mb-2 items-center flex-wrap">
            <div class="dir-picker">
              <el-input v-model="certScanDir" size="small" readonly placeholder="证书目录" class="dir-picker-input">
                <template #prepend><el-icon><Folder /></el-icon></template>
              </el-input>
              <el-button size="small" @click="openDirBrowser('cert')" class="dir-picker-btn">选择</el-button>
            </div>
            <el-button size="small" type="primary" @click="scanCertDir" :loading="loadingCerts">扫描</el-button>
            <el-button size="small" @click="loadCerts" :loading="loadingCerts">默认扫描</el-button>
          </div>
          <el-table :data="certs" border size="small" max-height="360" v-loading="loadingCerts">
            <el-table-column label="适用域名" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <span>{{ row.subject }}</span>
                <el-tag v-if="row.domains && row.domains.length > 1" size="small" effect="plain" class="ml-1">+{{ row.domains.length - 1 }}</el-tag>
                <el-tag v-if="row.isKey" size="small" type="info" class="ml-1">私钥</el-tag>
                <el-tag v-if="row.keyPath" size="small" type="success" class="ml-1">含私钥</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="issuer" label="颁发者" min-width="160" show-overflow-tooltip />
            <el-table-column label="到期时间" width="180">
              <template #default="{ row }">
                <span :class="row.expired ? 'text-red-500 font-semibold' : ''">{{ row.expiry || '未知' }}</span>
                <el-tag v-if="row.expired" size="small" type="danger" class="ml-1">已过期</el-tag>
                <el-tag v-else-if="row.daysLeft != null && row.daysLeft <= 30" size="small" type="warning" class="ml-1">即将到期</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="100" />
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="showCertDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="certs.length === 0 && !loadingCerts" class="text-xs text-gray-400 py-4 text-center">未检测到 SSL 证书，可输入目录后点击扫描</div>
        </el-tab-pane>
      </el-tabs>
    </template>

    <!-- 站点编辑弹窗 -->
    <el-dialog v-model="siteEditorVisible" :title="siteEditorName ? '编辑: ' + siteEditorName : '新建站点'" width="70vw" top="5vh" :close-on-click-modal="false" append-to-body>
      <div v-if="siteEditorIsNew" class="new-site-form mb-3">
        <el-form label-position="left" label-width="90px" size="small">
          <el-form-item label="文件名">
            <el-input v-model="newSiteFilename" placeholder="如 mysite.conf" />
          </el-form-item>
          <el-form-item label="域名">
            <el-input v-model="newSiteDomain" placeholder="如 example.com（多个用空格分隔）" />
          </el-form-item>
          <el-form-item label="SSL 证书">
            <el-select v-model="newSiteCertIndex" placeholder="不启用 HTTPS" clearable class="w-full" @change="regenerateSiteConfig">
              <el-option :value="-1" label="不启用 HTTPS" />
              <el-option v-for="(c, i) in availableCerts" :key="i" :value="i">
                <span>{{ c.subject }}</span>
                <span v-if="c.domains?.length > 1" class="text-gray-400 text-xs ml-1">(+{{ c.domains.length - 1 }}域名)</span>
                <el-tag v-if="c.expired" size="small" type="danger" class="ml-1">已过期</el-tag>
                <el-tag v-else-if="c.daysLeft != null && c.daysLeft <= 30" size="small" type="warning" class="ml-1">{{ c.daysLeft }}天</el-tag>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>

        <!-- Location 块列表 -->
        <div class="loc-blocks-header">
          <span class="text-xs font-medium text-gray-600">Location 块</span>
          <el-dropdown trigger="click" @command="addBlock">
            <el-button size="small" text type="primary" :icon="Plus">添加块</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="proxy">反向代理</el-dropdown-item>
                <el-dropdown-item command="static">静态文件</el-dropdown-item>
                <el-dropdown-item command="rewrite">伪静态/重写</el-dropdown-item>
                <el-dropdown-item command="cache">静态资源缓存</el-dropdown-item>
                <el-dropdown-item command="deny">禁止访问</el-dropdown-item>
                <el-dropdown-item command="redirect">301 重定向</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div v-for="(blk, bi) in newSiteBlocks" :key="bi" class="loc-block-card">
          <div class="loc-block-head" @click="blk.collapsed = !blk.collapsed">
            <el-icon class="loc-block-arrow" :class="{ 'is-collapsed': blk.collapsed }"><Back /></el-icon>
            <el-tag size="small" :type="blockModeTag(blk.mode)" disable-transitions>{{ blockModeLabel(blk.mode) }}</el-tag>
            <code class="loc-block-path">{{ blk.path || '/' }}</code>
            <div class="flex-1"></div>
            <el-button :icon="Delete" text type="danger" size="small" @click.stop="removeBlock(bi)" />
          </div>
          <div v-show="!blk.collapsed" class="loc-block-body">
            <el-form label-position="left" label-width="90px" size="small">
              <div class="loc-block-grid">
                <el-form-item label="路径">
                  <el-input v-model="blk.path" placeholder="/" @input="regenerateSiteConfig" />
                </el-form-item>
                <el-form-item label="模式">
                  <el-select v-model="blk.mode" class="w-full" @change="regenerateSiteConfig">
                    <el-option value="proxy" label="反向代理" />
                    <el-option value="static" label="静态文件" />
                    <el-option value="rewrite" label="伪静态/重写" />
                    <el-option value="cache" label="静态资源缓存" />
                    <el-option value="deny" label="禁止访问" />
                    <el-option value="redirect" label="301 重定向" />
                  </el-select>
                </el-form-item>

                <!-- 反向代理参数 -->
                <template v-if="blk.mode === 'proxy'">
                  <el-form-item label="上游地址">
                    <el-input v-model="blk.upstream" placeholder="http://127.0.0.1:3000" @input="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="WebSocket">
                    <el-switch v-model="blk.websocket" @change="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="缓冲区大小">
                    <el-input v-model="blk.proxyBufferSize" placeholder="如 16k" @input="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="连接超时">
                    <el-input v-model="blk.proxyConnectTimeout" placeholder="如 60s" @input="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="读取超时">
                    <el-input v-model="blk.proxyReadTimeout" placeholder="如 60s" @input="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="发送超时">
                    <el-input v-model="blk.proxySendTimeout" placeholder="如 60s" @input="regenerateSiteConfig" />
                  </el-form-item>
                </template>

                <!-- 静态文件参数 -->
                <template v-if="blk.mode === 'static'">
                  <el-form-item label="根目录">
                    <el-input v-model="blk.root" placeholder="/var/www/html" @input="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="索引文件">
                    <el-input v-model="blk.index" placeholder="index.html" @input="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="try_files">
                    <el-input v-model="blk.tryFiles" placeholder="$uri $uri/ =404" @input="regenerateSiteConfig" />
                  </el-form-item>
                </template>

                <!-- 伪静态/重写 -->
                <template v-if="blk.mode === 'rewrite'">
                  <el-form-item label="重写规则" class="grid-full">
                    <el-input v-model="blk.rewriteRules" type="textarea" :rows="3" placeholder="每行一条 rewrite 或 if 语句" @input="regenerateSiteConfig" />
                  </el-form-item>
                </template>

                <!-- 静态资源缓存 -->
                <template v-if="blk.mode === 'cache'">
                  <el-form-item label="匹配规则">
                    <el-input v-model="blk.cacheTypes" placeholder="~* \\\\.(js|css|png|jpg)$" @input="regenerateSiteConfig" />
                  </el-form-item>
                  <el-form-item label="过期时间">
                    <el-input v-model="blk.cacheExpires" placeholder="7d" @input="regenerateSiteConfig" />
                  </el-form-item>
                </template>

                <!-- 301 重定向 -->
                <template v-if="blk.mode === 'redirect'">
                  <el-form-item label="目标地址">
                    <el-input v-model="blk.upstream" placeholder="https://new-domain.com$request_uri" @input="regenerateSiteConfig" />
                  </el-form-item>
                </template>

                <!-- 通用可选项 -->
                <template v-if="blk.mode !== 'deny' && blk.mode !== 'redirect'">
                  <el-form-item label="启用缓存">
                    <div class="flex items-center gap-2">
                      <el-switch v-model="blk.enableCache" @change="regenerateSiteConfig" />
                      <el-input v-if="blk.enableCache" v-model="blk.cacheExpires" placeholder="7d" style="width: 100px" @input="regenerateSiteConfig" />
                    </div>
                  </el-form-item>
                  <el-form-item label="请求体限制">
                    <el-input v-model="blk.clientMaxBodySize" placeholder="如 50m" @input="regenerateSiteConfig" />
                  </el-form-item>
                </template>

                <!-- 块自定义指令 -->
                <el-form-item v-if="blk.mode !== 'deny'" label="自定义指令" class="grid-full">
                  <el-input v-model="blk.customDirectives" type="textarea" :rows="2" placeholder="每行一条 Nginx 指令" @input="regenerateSiteConfig" />
                </el-form-item>
              </div>
            </el-form>
          </div>
        </div>

        <!-- Server 级选项 -->
        <el-collapse class="server-opts-collapse">
          <el-collapse-item name="server-opts">
            <template #title>
              <span class="text-xs text-gray-400">Server 级选项</span>
            </template>
            <el-form label-position="left" label-width="90px" size="small">
              <div class="advanced-opts-grid">
                <el-form-item label="请求体限制">
                  <el-input v-model="newSiteServerOpts.clientMaxBodySize" placeholder="如 50m（默认 1m）" @input="regenerateSiteConfig" />
                </el-form-item>
                <el-form-item label="启用 Gzip">
                  <el-switch v-model="newSiteServerOpts.gzip" @change="regenerateSiteConfig" />
                </el-form-item>
                <el-form-item label="Access Log">
                  <el-input v-model="newSiteServerOpts.accessLog" placeholder="如 /var/log/nginx/mysite_access.log" @input="regenerateSiteConfig" />
                </el-form-item>
                <el-form-item label="Error Log">
                  <el-input v-model="newSiteServerOpts.errorLog" placeholder="如 /var/log/nginx/mysite_error.log" @input="regenerateSiteConfig" />
                </el-form-item>
                <el-form-item label="自定义指令" class="grid-full">
                  <el-input v-model="newSiteServerOpts.customDirectives" type="textarea" :rows="2" placeholder="每行一条 Nginx 指令，放在 server 块内" @input="regenerateSiteConfig" />
                </el-form-item>
              </div>
            </el-form>
          </el-collapse-item>
        </el-collapse>

        <div class="flex justify-end mt-2 mb-1">
          <el-button size="small" text type="primary" @click="regenerateSiteConfig">重新生成配置</el-button>
        </div>
      </div>
      <el-input v-model="siteEditorContent" type="textarea" :rows="siteEditorIsNew ? 16 : 22" spellcheck="false" class="nginx-editor" />
      <template #footer>
        <el-button @click="siteEditorVisible = false">取消</el-button>
        <el-button @click="doTestAndSave" :loading="savingSite">测试并保存</el-button>
        <el-button type="primary" @click="saveSite" :loading="savingSite">保存</el-button>
      </template>
    </el-dialog>

    <!-- 远程目录浏览器 -->
    <el-dialog v-model="dirBrowserVisible" title="选择目录" width="520px" append-to-body :close-on-click-modal="false">
      <div class="dir-browser">
        <div class="dir-browser-path">
          <el-input v-model="dirBrowserPath" size="small" @keyup.enter="browseTo(dirBrowserPath)">
            <template #prepend>/</template>
            <template #append>
              <el-button :icon="Refresh" @click="browseTo(dirBrowserPath)" :loading="dirBrowserLoading" />
            </template>
          </el-input>
        </div>
        <div class="dir-browser-list" v-loading="dirBrowserLoading">
          <div class="dir-browser-item dir-browser-parent" @click="browseUp" v-if="dirBrowserPath !== '/'">
            <el-icon><Back /></el-icon>
            <span>..</span>
          </div>
          <div v-for="item in dirBrowserItems" :key="item.name"
            class="dir-browser-item" :class="{ 'is-dir': item.isDir, 'is-selected': item.name === dirBrowserSelected }"
            @click="item.isDir ? browseInto(item.name) : null"
            @dblclick="item.isDir ? confirmDirSelect(dirBrowserPath + '/' + item.name) : null">
            <el-icon><Folder v-if="item.isDir" /><Document v-else /></el-icon>
            <span class="flex-1 truncate">{{ item.name }}</span>
            <span class="text-xs text-gray-400" v-if="!item.isDir">{{ item.size }}</span>
          </div>
          <div v-if="!dirBrowserLoading && dirBrowserItems.length === 0" class="text-center text-xs text-gray-400 py-4">空目录</div>
        </div>
      </div>
      <template #footer>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 flex-1 truncate">{{ normalizePath(dirBrowserPath) }}</span>
          <el-button @click="dirBrowserVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmDirSelect(dirBrowserPath)">选择此目录</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 证书详情弹窗 -->
    <el-dialog v-model="certDetailVisible" :title="'证书详情: ' + certDetailData.subject" width="620px" append-to-body>
      <div class="cert-detail-grid" v-if="certDetailData.subject">
        <div class="cert-row"><span class="cert-label">主域名</span><span class="cert-val">{{ certDetailData.subject }}</span></div>
        <div class="cert-row" v-if="certDetailData.domains && certDetailData.domains.length">
          <span class="cert-label">适用域名</span>
          <span class="cert-val">
            <el-tag v-for="d in certDetailData.domains" :key="d" size="small" class="cert-domain-tag" effect="plain">{{ d }}</el-tag>
          </span>
        </div>
        <div class="cert-row"><span class="cert-label">颁发者</span><span class="cert-val">{{ certDetailData.issuer }}</span></div>
        <div class="cert-row"><span class="cert-label">生效时间</span><span class="cert-val">{{ certDetailData.notBefore }}</span></div>
        <div class="cert-row"><span class="cert-label">到期时间</span>
          <span class="cert-val" :class="certDetailData.expired ? 'text-red-500' : ''">
            {{ certDetailData.expiry }}
            <el-tag v-if="certDetailData.expired" size="small" type="danger" class="ml-1">已过期</el-tag>
            <el-tag v-else-if="certDetailData.daysLeft != null" size="small" :type="certDetailData.daysLeft <= 30 ? 'warning' : 'success'" class="ml-1">
              剩余 {{ certDetailData.daysLeft }} 天
            </el-tag>
          </span>
        </div>
        <div class="cert-row"><span class="cert-label">序列号</span><span class="cert-val">{{ certDetailData.serial }}</span></div>
        <div class="cert-row"><span class="cert-label">签名算法</span><span class="cert-val">{{ certDetailData.sigAlg }}</span></div>
        <div class="cert-row">
          <span class="cert-label">证书文件</span>
          <span class="cert-val">
            {{ certDetailData.path }}
            <span class="cert-file-actions">
              <el-button size="small" text type="primary" @click="copyCertFile(certDetailData.path)">复制内容</el-button>
              <el-button size="small" text type="primary" @click="downloadCertFile(certDetailData.path)">下载</el-button>
            </span>
          </span>
        </div>
        <div class="cert-row" v-if="certDetailData.keyPath">
          <span class="cert-label">私钥文件</span>
          <span class="cert-val">
            {{ certDetailData.keyPath }}
            <span class="cert-file-actions">
              <el-button size="small" text type="primary" @click="copyCertFile(certDetailData.keyPath)">复制内容</el-button>
              <el-button size="small" text type="primary" @click="downloadCertFile(certDetailData.keyPath)">下载</el-button>
            </span>
          </span>
        </div>
      </div>
    </el-dialog>

    <!-- 更新确认弹窗 -->
    <el-dialog v-model="updateVisible" title="更新 Nginx" width="520px" append-to-body :close-on-click-modal="false">
      <template v-if="!updating">
        <p class="mb-3">当前版本: <strong>{{ version }}</strong> → 最新版本: <strong>{{ latestVersion }}</strong></p>
        <p class="text-xs text-gray-500">将通过包管理器（apt/yum）更新 Nginx 到最新版本。更新过程中 Nginx 服务会短暂中断。</p>
      </template>
      <template v-else>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm font-semibold">更新进度</span>
          <el-tag :type="updateStatus === 'done' ? 'success' : updateStatus === 'error' ? 'danger' : 'warning'" size="small">
            {{ updateStatus === 'done' ? '更新完成' : updateStatus === 'error' ? '更新失败' : '更新中...' }}
          </el-tag>
        </div>
        <div ref="updateLogRef" class="install-log">
          <pre>{{ updateLog }}</pre>
        </div>
      </template>
      <template #footer>
        <template v-if="!updating">
          <el-button @click="updateVisible = false">取消</el-button>
          <el-button type="warning" @click="doUpdate">确认更新</el-button>
        </template>
        <template v-else-if="updateStatus === 'done'">
          <el-button type="primary" @click="finishUpdate">完成</el-button>
        </template>
      </template>
    </el-dialog>

    <div v-if="!checkDone" class="text-center py-10 text-gray-400">
      <el-icon class="is-loading" size="24"><Refresh /></el-icon>
      <p class="mt-2">检测 Nginx 状态...</p>
    </div>
  </div>`,
  setup(props) {
    let remoteConfig = null

    const checkDone = ref(false)
    const installed = ref(false)
    const version = ref('')
    const status = ref({ active: 'unknown', enabled: false })
    const loading = ref(false)
    const sites = ref([])
    const useConfD = ref(false)
    const activeTab = ref('sites')
    const nginxConfPath = ref('')
    const parsedIncludes = ref([])
    const actionResult = ref('')
    const installing = ref(false)
    const installLog = ref('')
    const installStatus = ref('running')
    const installLogRef = ref(null)
    const siteEditorVisible = ref(false)
    const siteEditorName = ref('')
    const siteEditorContent = ref('')
    const siteEditorIsNew = ref(false)
    const savingSite = ref(false)
    const newSiteFilename = ref('')
    const newSiteDomain = ref('')
    const newSiteCertIndex = ref(-1)
    const newSiteBlocks = ref([])
    const newSiteServerOpts = ref({
      clientMaxBodySize: '',
      gzip: false,
      accessLog: '',
      errorLog: '',
      customDirectives: ''
    })

    function createBlock(mode, path) {
      if (mode === undefined) mode = 'proxy'
      if (path === undefined) path = '/'
      return {
        mode,
        path,
        collapsed: false,
        root: '/var/www/html',
        index: 'index.html',
        tryFiles: '$uri $uri/ =404',
        upstream: 'http://127.0.0.1:3000',
        websocket: false,
        proxyBufferSize: '',
        proxyConnectTimeout: '',
        proxyReadTimeout: '',
        proxySendTimeout: '',
        rewriteRules: '',
        enableCache: false,
        cacheExpires: '7d',
        cacheTypes: '~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$',
        clientMaxBodySize: '',
        customDirectives: ''
      }
    }

    const logFiles = ref([])
    const logType = ref('access_log')
    const selectedLog = ref('')
    const logLines = ref(200)
    const logContent = ref('')
    const loadingLog = ref(false)
    const logAutoRefresh = ref(false)
    const logRefreshInterval = ref(5)
    const logStickBottom = ref(true)
    const logViewRef = ref(null)
    let logTimer = null
    const latestVersion = ref('')
    const checkingUpdate = ref(false)
    const hasUpdate = computed(() => latestVersion.value && version.value && latestVersion.value !== version.value && compareVersions(latestVersion.value, version.value) > 0)
    const updateVisible = ref(false)
    const updating = ref(false)
    const updateLog = ref('')
    const updateStatus = ref('')
    const updateLogRef = ref(null)
    const certs = ref([])
    const loadingCerts = ref(false)
    const certScanDir = ref('')
    const certDetailVisible = ref(false)
    const certDetailData = ref({})
    const customSiteDir = ref('')
    const customSiteDirActive = ref(false)
    const currentSiteDir = ref('')
    const loadingSites = ref(false)
    const dirBrowserVisible = ref(false)
    const dirBrowserPath = ref('/')
    const dirBrowserItems = ref([])
    const dirBrowserLoading = ref(false)
    const dirBrowserSelected = ref('')
    const dirBrowserTarget = ref('')

    const statusLabel = computed(() => {
      const map = { active: '运行中', inactive: '已停止', failed: '异常' }
      return map[status.value.active] || '未知'
    })
    const statusTag = computed(() => {
      const map = { active: 'success', inactive: 'info', failed: 'danger' }
      return map[status.value.active] || 'warning'
    })
    const installStatusLabel = computed(() => {
      const map = { running: '安装中...', done: '安装完成', error: '安装失败' }
      return map[installStatus.value] || ''
    })

    async function exec(cmd) {
      return await props.exec(cmd)
    }

    function shellQuote(value) {
      return "'" + String(value ?? '').replace(/'/g, "'\"'\"'") + "'"
    }

    async function checkNginx() {
      const r = await exec('which nginx 2>/dev/null')
      installed.value = r.code === 0 && r.stdout.trim() !== ''
      if (installed.value) {
        const vr = await exec('nginx -v 2>&1')
        version.value = (vr.stdout + vr.stderr).replace(/.*nginx\//, '').trim()
      }
      checkDone.value = true
    }

    async function loadStatus() {
      const [active, enabled] = await Promise.all([
        exec('systemctl is-active nginx 2>/dev/null'),
        exec('systemctl is-enabled nginx 2>/dev/null'),
      ])
      status.value = {
        active: active.stdout.trim() || 'unknown',
        enabled: enabled.stdout.trim() === 'enabled',
      }
    }

    async function findNginxConf() {
      for (const p of ['/etc/nginx/nginx.conf', '/usr/local/nginx/conf/nginx.conf']) {
        const r = await exec("test -f '" + p + "' && echo ok")
        if (r.code === 0 && r.stdout.trim() === 'ok') return p
      }
      const which = await exec("nginx -t 2>&1 | grep -oP '(?<=file )\\S+'")
      return which.stdout.trim() || '/etc/nginx/nginx.conf'
    }

    function parseIncludes(confContent) {
      const includes = []
      const httpMatch = confContent.match(/http\s*\{([\s\S]*)\}[\s\S]*$/)
      const block = httpMatch ? httpMatch[1] : confContent
      const re = /^\s*include\s+([^;]+);/gm
      let m
      while ((m = re.exec(block)) !== null) {
        includes.push(m[1].trim())
      }
      return includes
    }

    async function expandIncludePattern(pattern) {
      const r = await exec('sudo ls -1 ' + pattern + ' 2>/dev/null')
      if (r.code !== 0 || !r.stdout.trim()) return []
      return r.stdout.trim().split('\n').map((item) => item.trim()).filter(Boolean)
    }

    async function loadSitesAuto() {
      loadingSites.value = true
      sites.value = []
      parsedIncludes.value = []

      const confPath = await findNginxConf()
      nginxConfPath.value = confPath

      const confR = await exec("sudo cat '" + confPath + "' 2>/dev/null")
      const result = []

      result.push({
        name: confPath.split('/').pop(),
        dir: confPath.substring(0, confPath.lastIndexOf('/')),
        fullPath: confPath,
        source: '主配置',
        isMain: true,
      })

      if (confR.code === 0 && confR.stdout.trim()) {
        const includes = parseIncludes(confR.stdout)
        const seenDirs = new Set()

        for (const pattern of includes) {
          const files = await expandIncludePattern(pattern)
          const patDir = pattern.substring(0, pattern.lastIndexOf('/'))
          const isSitePattern = /[*?\[]/.test(pattern) && !/modules-(?:available|enabled)/.test(pattern)
          if (patDir && isSitePattern) seenDirs.add(patDir)

          for (const fp of files) {
            if (!fp.endsWith('.conf') && !/sites-(?:available|enabled)/.test(fp)) continue
            const dir = fp.substring(0, fp.lastIndexOf('/'))
            const name = fp.substring(fp.lastIndexOf('/') + 1)
            result.push({ name, dir, fullPath: fp, source: patDir || 'include' })
          }
        }
        parsedIncludes.value = [...seenDirs].sort((a, b) => {
          const score = (dir) => dir.includes('/conf.d') ? 0 : dir.includes('/sites-enabled') ? 1 : 2
          return score(a) - score(b)
        })
      }

      if (customSiteDir.value.trim()) {
        const extraFiles = await expandIncludePattern(customSiteDir.value.trim() + '/*')
        for (const fp of extraFiles) {
          if (result.some((s) => s.fullPath === fp)) continue
          const dir = fp.substring(0, fp.lastIndexOf('/'))
          const name = fp.substring(fp.lastIndexOf('/') + 1)
          result.push({ name, dir, fullPath: fp, source: '自定义' })
        }
      }

      sites.value = result
      loadingSites.value = false
    }

    async function loadSites() {
      await loadSitesAuto()
    }

    async function loadSitesFromDir() {
      const dir = customSiteDir.value.trim()
      if (!dir) { await loadSitesAuto(); return }
      await loadSitesAuto()
    }

    async function resetSiteDir() {
      customSiteDir.value = ''
      customSiteDirActive.value = false
      if (remoteConfig) await remoteConfig.set('nginx', 'siteDir', '')
      await loadSitesAuto()
    }

    function parseLogPaths(confContent) {
      const logs = []
      const seen = new Set()
      const re = /^\s*(error_log|access_log)\s+([^\s;]+)/gm
      let m
      while ((m = re.exec(confContent)) !== null) {
        const type = m[1]
        const logPath = m[2].trim()
        if (logPath === 'off' || logPath === '/dev/null' || seen.has(logPath)) continue
        seen.add(logPath)
        logs.push({ type, path: logPath, label: logPath.split('/').pop() + ' (' + type + ')' })
      }
      return logs
    }

    async function loadLogFiles() {
      const confPath = nginxConfPath.value || '/etc/nginx/nginx.conf'
      const confR = await exec("sudo cat '" + confPath + "' 2>/dev/null")
      const fromConf = confR.code === 0 ? parseLogPaths(confR.stdout) : []

      for (const site of sites.value) {
        if (!site.fullPath || site.isMain) continue
        const sr = await exec("sudo cat '" + site.fullPath + "' 2>/dev/null")
        if (sr.code === 0) {
          const siteLogs = parseLogPaths(sr.stdout)
          for (const l of siteLogs) {
            if (!fromConf.some((e) => e.path === l.path)) {
              l.label = l.path.split('/').pop() + ' (' + site.name + ')'
              fromConf.push(l)
            }
          }
        }
      }

      const dirR = await exec("ls -1 /var/log/nginx/ 2>/dev/null")
      if (dirR.code === 0 && dirR.stdout.trim()) {
        for (const name of dirR.stdout.trim().split('\n').filter(Boolean)) {
          const fp = '/var/log/nginx/' + name
          if (!fromConf.some((e) => e.path === fp)) {
            const type = name.includes('error') ? 'error_log' : name.includes('access') ? 'access_log' : 'other'
            fromConf.push({ type, path: fp, label: name })
          }
        }
      }

      logFiles.value = fromConf
      if (!selectedLog.value && fromConf.length) {
        const accessList = fromConf.filter((l) => l.type === 'access_log')
        logType.value = 'access_log'
        selectedLog.value = accessList.length ? accessList[0].path : fromConf[0].path
        await loadLog()
      }
    }

    function onLogTypeChange() {
      const list = currentTypeLogs.value
      selectedLog.value = list.length ? list[0].path : ''
      logContent.value = ''
      if (selectedLog.value) loadLog()
    }

    const errorLogs = computed(() => logFiles.value.filter((l) => l.type === 'error_log'))
    const accessLogs = computed(() => logFiles.value.filter((l) => l.type === 'access_log'))
    const otherLogs = computed(() => logFiles.value.filter((l) => l.type === 'other'))
    const availableCerts = computed(() => certs.value.filter((c) => !c.isKey && c.path))
    const currentTypeLogs = computed(() => {
      if (logType.value === 'error_log') return errorLogs.value
      if (logType.value === 'access_log') return accessLogs.value
      return otherLogs.value
    })

    async function refreshAll() {
      loading.value = true
      await Promise.all([loadStatus(), loadSitesAuto(), loadLogFiles()])
      loading.value = false
    }

    async function recheckNginx() {
      installing.value = false
      installLog.value = ''
      checkDone.value = false
      await checkNginx()
      if (installed.value) await refreshAll()
    }

    async function doAction(action) {
      actionResult.value = ''
      const r = await exec('sudo systemctl ' + action + ' nginx 2>&1')
      actionResult.value = r.stdout + r.stderr || (r.code === 0 ? '操作成功' : '操作失败')
      await loadStatus()
    }

    async function doTestConfig() {
      actionResult.value = ''
      const r = await exec('sudo nginx -t 2>&1')
      actionResult.value = r.stdout + r.stderr
    }

    function compareVersions(a, b) {
      const pa = a.replace(/[^\d.]/g, '').split('.').map(Number)
      const pb = b.replace(/[^\d.]/g, '').split('.').map(Number)
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0, nb = pb[i] || 0
        if (na > nb) return 1
        if (na < nb) return -1
      }
      return 0
    }

    async function checkLatestVersion() {
      checkingUpdate.value = true
      const distro = await exec(". /etc/os-release 2>/dev/null && echo $ID")
      const dist = distro.stdout.trim().toLowerCase()
      let latest = ''
      if (['debian', 'ubuntu'].includes(dist)) {
        await exec('sudo apt-get update -qq 2>/dev/null')
        const r = await exec("apt-cache policy nginx 2>/dev/null | grep Candidate")
        latest = r.stdout.replace(/.*Candidate:\s*/, '').trim().split('-')[0]
      } else {
        const r = await exec("yum info nginx 2>/dev/null | grep Version || dnf info nginx 2>/dev/null | grep Version")
        latest = r.stdout.replace(/.*Version\s*:\s*/, '').trim()
      }
      if (!latest) {
        const r = await exec("curl -sf 'https://nginx.org/en/download.html' 2>/dev/null | grep -oP 'nginx-\\K[0-9]+\\.[0-9]+\\.[0-9]+' | head -1")
        latest = r.stdout.trim()
      }
      latestVersion.value = latest || ''
      checkingUpdate.value = false
      if (!latest) showMessage('无法获取最新版本信息', 'info')
    }

    function showUpdateConfirm() {
      updating.value = false
      updateLog.value = ''
      updateStatus.value = ''
      updateVisible.value = true
    }

    async function doUpdate() {
      updating.value = true
      updateLog.value = ''
      updateStatus.value = 'running'
      const distro = await exec(". /etc/os-release 2>/dev/null && echo $ID")
      const dist = distro.stdout.trim().toLowerCase()
      let steps = []
      if (['debian', 'ubuntu'].includes(dist)) {
        steps = ['sudo apt-get update -y', 'sudo apt-get install -y --only-upgrade nginx']
      } else {
        steps = ['sudo yum update -y nginx || sudo dnf update -y nginx']
      }
      steps.push('sudo nginx -t 2>&1', 'sudo systemctl restart nginx 2>&1')
      for (const cmd of steps) {
        updateLog.value += '$ ' + cmd + '\n'
        scrollUpdateLog()
        const r = await exec(cmd)
        updateLog.value += (r.stdout || '') + (r.stderr ? r.stderr : '') + '\n'
        scrollUpdateLog()
      }
      const vr = await exec('nginx -v 2>&1')
      const newVer = (vr.stdout + vr.stderr).replace(/.*nginx\//, '').trim()
      if (newVer) version.value = newVer
      updateStatus.value = 'done'
      updateLog.value += '\n' + '更新完成，当前版本: ' + newVer + '\n'
      scrollUpdateLog()
    }

    function scrollUpdateLog() {
      nextTick(() => { if (updateLogRef.value) updateLogRef.value.scrollTop = updateLogRef.value.scrollHeight })
    }

    async function finishUpdate() {
      updateVisible.value = false
      latestVersion.value = ''
      await Promise.all([loadStatus(), checkLatestVersion()])
    }

    function siteDir() {
      if (customSiteDir.value.trim()) return customSiteDir.value.trim().replace(/\/+$/, '')
      if (customSiteDirActive.value && currentSiteDir.value) return currentSiteDir.value
      if (parsedIncludes.value.length) return parsedIncludes.value[0]
      return useConfD.value ? '/etc/nginx/conf.d' : '/etc/nginx/sites-available'
    }

    let currentEditingRow = null

    async function editSite(row) {
      const fp = row.fullPath || (siteDir() + '/' + row.name)
      const r = await exec("sudo cat '" + fp + "' 2>/dev/null")
      siteEditorName.value = row.name
      siteEditorContent.value = r.stdout
      siteEditorIsNew.value = false
      siteEditorVisible.value = true
      currentEditingRow = row
    }

    function newSite() {
      siteEditorName.value = ''
      siteEditorIsNew.value = true
      newSiteFilename.value = ''
      newSiteDomain.value = ''
      newSiteCertIndex.value = -1
      newSiteBlocks.value = [createBlock('static', '/')]
      newSiteServerOpts.value = {
        clientMaxBodySize: '', gzip: false, accessLog: '', errorLog: '', customDirectives: ''
      }
      currentEditingRow = null
      regenerateSiteConfig()
      siteEditorVisible.value = true
    }

    function addBlock(mode) {
      const defaults = { proxy: '/api', static: '/', rewrite: '/', cache: '/', deny: '/hidden', redirect: '/old' }
      newSiteBlocks.value.push(createBlock(mode, defaults[mode] || '/'))
      regenerateSiteConfig()
    }

    function removeBlock(index) {
      newSiteBlocks.value.splice(index, 1)
      regenerateSiteConfig()
    }

    function blockModeLabel(mode) {
      return { proxy: '反向代理', static: '静态文件', rewrite: '伪静态', cache: '资源缓存', deny: '禁止访问', redirect: '重定向' }[mode] || mode
    }

    function blockModeTag(mode) {
      return { proxy: 'primary', static: 'success', rewrite: 'warning', cache: 'info', deny: 'danger', redirect: '' }[mode] || ''
    }

    function generateBlockLines(blk, I) {
      const II = I + I
      const lines = []
      const locPath = blk.path?.trim() || '/'

      if (blk.mode === 'cache') {
        const pattern = blk.cacheTypes?.trim() || '~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$'
        lines.push(I + 'location ' + pattern + ' {')
        lines.push(II + 'expires ' + (blk.cacheExpires || '7d') + ';')
        lines.push(II + 'add_header Cache-Control "public, immutable";')
        lines.push(II + 'access_log off;')
      } else if (blk.mode === 'deny') {
        lines.push(I + 'location ' + locPath + ' {')
        lines.push(II + 'deny all;')
        lines.push(II + 'return 403;')
      } else if (blk.mode === 'redirect') {
        lines.push(I + 'location ' + locPath + ' {')
        lines.push(II + 'return 301 ' + (blk.upstream?.trim() || '/') + ';')
      } else if (blk.mode === 'proxy') {
        const upstream = blk.upstream?.trim() || 'http://127.0.0.1:3000'
        lines.push(I + 'location ' + locPath + ' {')
        lines.push(II + 'proxy_pass ' + upstream + ';')
        lines.push(II + 'proxy_set_header Host $host;')
        lines.push(II + 'proxy_set_header X-Real-IP $remote_addr;')
        lines.push(II + 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')
        lines.push(II + 'proxy_set_header X-Forwarded-Proto $scheme;')
        if (blk.websocket) {
          lines.push(II + 'proxy_http_version 1.1;')
          lines.push(II + 'proxy_set_header Upgrade $http_upgrade;')
          lines.push(II + 'proxy_set_header Connection "upgrade";')
        }
        if (blk.proxyBufferSize) lines.push(II + 'proxy_buffer_size ' + blk.proxyBufferSize + ';')
        if (blk.proxyConnectTimeout) lines.push(II + 'proxy_connect_timeout ' + blk.proxyConnectTimeout + ';')
        if (blk.proxyReadTimeout) lines.push(II + 'proxy_read_timeout ' + blk.proxyReadTimeout + ';')
        if (blk.proxySendTimeout) lines.push(II + 'proxy_send_timeout ' + blk.proxySendTimeout + ';')
      } else if (blk.mode === 'static') {
        lines.push(I + 'location ' + locPath + ' {')
        if (blk.root) lines.push(II + 'root ' + blk.root + ';')
        if (blk.index) lines.push(II + 'index ' + blk.index + ';')
        if (blk.tryFiles) lines.push(II + 'try_files ' + blk.tryFiles + ';')
      } else if (blk.mode === 'rewrite') {
        lines.push(I + 'location ' + locPath + ' {')
        if (blk.rewriteRules?.trim()) {
          for (const r of blk.rewriteRules.trim().split('\n')) {
            const t = r.trim()
            if (t) lines.push(II + t)
          }
        }
      }

      if (blk.mode !== 'deny' && blk.mode !== 'redirect' && blk.mode !== 'cache') {
        if (blk.enableCache && blk.cacheExpires) {
          lines.push(II + 'expires ' + blk.cacheExpires + ';')
          lines.push(II + 'add_header Cache-Control "public";')
        }
        if (blk.clientMaxBodySize) lines.push(II + 'client_max_body_size ' + blk.clientMaxBodySize + ';')
      }

      if (blk.mode !== 'deny' && blk.customDirectives?.trim()) {
        for (const d of blk.customDirectives.trim().split('\n')) {
          const t = d.trim()
          if (t) lines.push(II + t)
        }
      }

      lines.push(I + '}')
      return lines
    }

    function regenerateSiteConfig() {
      const domain = newSiteDomain.value.trim() || 'example.com'
      const useSsl = newSiteCertIndex.value >= 0
      const cert = useSsl ? availableCerts.value[newSiteCertIndex.value] : null
      const opts = newSiteServerOpts.value
      const I = '    '
      let lines = []

      if (useSsl) {
        lines.push('server {')
        lines.push(I + 'listen 80;')
        lines.push(I + 'server_name ' + domain + ';')
        lines.push(I + 'return 301 https://$host$request_uri;')
        lines.push('}')
        lines.push('')
      }

      lines.push('server {')
      lines.push(useSsl ? I + 'listen 443 ssl;' : I + 'listen 80;')
      lines.push(I + 'server_name ' + domain + ';')

      if (useSsl && cert) {
        lines.push('')
        lines.push(I + 'ssl_certificate ' + cert.path + ';')
        lines.push(I + 'ssl_certificate_key ' + (cert.keyPath || cert.path.replace(/\.(pem|crt|cer|cert)$/, '.key')) + ';')
        lines.push(I + 'ssl_protocols TLSv1.2 TLSv1.3;')
        lines.push(I + 'ssl_ciphers HIGH:!aNULL:!MD5;')
      }

      if (opts.clientMaxBodySize) lines.push(I + 'client_max_body_size ' + opts.clientMaxBodySize + ';')
      if (opts.accessLog) lines.push(I + 'access_log ' + opts.accessLog + ';')
      if (opts.errorLog) lines.push(I + 'error_log ' + opts.errorLog + ';')

      if (opts.gzip) {
        lines.push('')
        lines.push(I + 'gzip on;')
        lines.push(I + 'gzip_vary on;')
        lines.push(I + 'gzip_min_length 1024;')
        lines.push(I + 'gzip_proxied any;')
        lines.push(I + 'gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;')
      }

      if (opts.customDirectives?.trim()) {
        lines.push('')
        for (const d of opts.customDirectives.trim().split('\n')) {
          const t = d.trim()
          if (t) lines.push(I + t)
        }
      }

      lines.push('')

      for (const blk of newSiteBlocks.value) {
        lines.push(...generateBlockLines(blk, I))
        lines.push('')
      }

      lines.push('}')
      siteEditorContent.value = lines.join('\n') + '\n'
    }

    function autoMatchCert() {
      const domain = newSiteDomain.value.trim().split(/\s+/)[0]
      if (!domain) return
      const idx = availableCerts.value.findIndex((c) =>
        c.domains?.some((d) => d === domain || (d.startsWith('*.') && domain.endsWith(d.slice(1))))
      )
      if (idx >= 0) {
        newSiteCertIndex.value = idx
        regenerateSiteConfig()
      }
    }

    watch(newSiteDomain, () => {
      if (siteEditorIsNew.value) autoMatchCert()
    })

    async function saveSite() {
      let targetPath = ''
      if (currentEditingRow?.fullPath) {
        targetPath = currentEditingRow.fullPath
      } else {
        let name = siteEditorIsNew.value ? newSiteFilename.value.trim() : siteEditorName.value.trim()
        if (!name) {
          showMessage('请输入配置文件名', 'warning')
          return
        }
        if (!name.endsWith('.conf')) name += '.conf'
        if (!/^[A-Za-z0-9._-]+$/.test(name) || name === '.' || name === '..') {
          showMessage('文件名只能包含字母、数字、点、下划线和连字符', 'warning')
          return
        }
        targetPath = siteDir() + '/' + name
      }
      savingSite.value = true
      const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'))
      const bytes = new TextEncoder().encode(siteEditorContent.value)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      const encoded = btoa(binary)
      const command = 'sudo mkdir -p ' + shellQuote(targetDir)
        + ' && printf %s ' + shellQuote(encoded)
        + ' | base64 -d | sudo tee ' + shellQuote(targetPath) + ' > /dev/null'
        + ' && sudo test -f ' + shellQuote(targetPath)
      const r = await exec(command)
      savingSite.value = false
      if (r.code !== 0) { showMessage('保存失败: ' + (r.stderr || r.stdout || '远程文件未写入'), 'error'); return }
      showMessage('已保存', 'success')
      siteEditorVisible.value = false
      currentEditingRow = null
      await loadSitesAuto()
      if (!sites.value.some((site) => site.fullPath === targetPath)) {
        sites.value.push({
          name: targetPath.substring(targetPath.lastIndexOf('/') + 1),
          dir: targetDir,
          fullPath: targetPath,
          source: '刚刚保存',
        })
      }
    }

    async function doTestAndSave() {
      await saveSite()
      if (siteEditorVisible.value) return
      const tr = await exec('sudo nginx -t 2>&1')
      actionResult.value = tr.stdout + tr.stderr
      if (tr.code === 0) {
        await exec('sudo nginx -s reload 2>&1')
        showMessage('配置测试通过，已重载', 'success')
        await loadStatus()
      } else {
        showMessage('配置测试不通过，请检查', 'warning')
      }
    }

    async function removeSite(row) {
      const fp = row.fullPath || (siteDir() + '/' + row.name)
      await exec("sudo rm -f '" + fp + "'")
      await loadSitesAuto()
    }

    async function loadLog() {
      if (!selectedLog.value) return
      loadingLog.value = true
      const r = await exec("sudo tail -n " + logLines.value + " '" + selectedLog.value + "' 2>/dev/null")
      logContent.value = r.stdout || r.stderr || '（无内容）'
      loadingLog.value = false
      if (logStickBottom.value) scrollLogView()
    }

    function scrollLogView() {
      nextTick(() => {
        if (logViewRef.value) logViewRef.value.scrollTop = logViewRef.value.scrollHeight
      })
    }

    function toggleLogAutoRefresh(val) {
      if (val) startLogTimer()
      else stopLogTimer()
    }

    function startLogTimer() {
      stopLogTimer()
      logTimer = setInterval(() => { loadLog() }, logRefreshInterval.value * 1000)
    }

    function stopLogTimer() {
      if (logTimer) { clearInterval(logTimer); logTimer = null }
    }

    function restartLogTimer() {
      if (logAutoRefresh.value) startLogTimer()
    }

    async function parseCertInfo(certPath, source) {
      let informFlag = ''
      let r = await exec("sudo openssl x509 -in '" + certPath + "' -noout -subject -issuer -dates -serial 2>/dev/null")
      if (r.code !== 0 || !r.stdout.trim()) {
        r = await exec("sudo openssl x509 -inform DER -in '" + certPath + "' -noout -subject -issuer -dates -serial 2>/dev/null")
        if (r.code === 0) informFlag = '-inform DER '
      }
      if (r.code !== 0 && !r.stdout.trim()) return null
      const text = r.stdout + (r.stderr || '')
      const get = (key) => { const m = text.match(new RegExp(key + '\\s*=\\s*(.*)', 'i')); return m ? m[1].trim() : '' }
      const subject = get('subject') || get('CN') || certPath.split('/').pop()
      const issuer = get('issuer')
      const notBefore = text.match(/notBefore=(.*)/)?.[1]?.trim() || ''
      const notAfter = text.match(/notAfter=(.*)/)?.[1]?.trim() || ''
      const serial = text.match(/serial=(.*)/i)?.[1]?.trim() || ''

      const sanR = await exec("sudo openssl x509 " + informFlag + "-in '" + certPath + "' -noout -text 2>/dev/null | grep -A1 'Subject Alternative Name'")
      const domains = []
      if (sanR.code === 0 && sanR.stdout) {
        const dnsMatches = sanR.stdout.match(/DNS:\s*([^\s,]+)/g)
        if (dnsMatches) {
          for (const m of dnsMatches) domains.push(m.replace(/^DNS:\s*/, ''))
        }
      }
      const cnMatch = subject.match(/CN\s*=\s*([^,/]+)/)
      const displaySubject = cnMatch ? cnMatch[1].trim() : subject
      if (displaySubject && !domains.includes(displaySubject)) domains.unshift(displaySubject)

      let sigR = await exec("sudo openssl x509 " + informFlag + "-in '" + certPath + "' -noout -text 2>/dev/null | grep 'Signature Algorithm' | head -1")
      const sigAlg = sigR.stdout?.replace(/.*Signature Algorithm:\s*/, '').trim() || ''

      let expired = false
      let daysLeft = null
      if (notAfter) {
        const expDate = new Date(notAfter)
        const now = new Date()
        expired = expDate < now
        daysLeft = Math.ceil((expDate - now) / 86400000)
        if (daysLeft < 0) daysLeft = 0
      }

      return {
        subject: displaySubject, domains, issuer, notBefore, expiry: notAfter, serial, sigAlg,
        path: certPath, source, expired, daysLeft,
      }
    }

    async function scanDir(dir, source) {
      const r = await exec("sudo ls -1R '" + dir + "' 2>/dev/null || ls -1R '" + dir + "' 2>/dev/null")
      if (r.code !== 0 || !r.stdout.trim()) return []
      const allFiles = []
      let currentDir = dir
      for (const line of r.stdout.split('\n')) {
        if (line.endsWith(':')) {
          currentDir = line.slice(0, -1)
        } else if (line.trim()) {
          allFiles.push(currentDir + '/' + line.trim())
        }
      }
      const certExts = ['.pem', '.crt', '.cer', '.cert']
      const files = allFiles.filter((f) => {
        const lower = f.toLowerCase()
        return certExts.some((ext) => lower.endsWith(ext)) || lower.endsWith('.key')
      })
      const results = []
      const keyFiles = []
      for (const fp of files) {
        if (fp.toLowerCase().endsWith('.key')) {
          keyFiles.push(fp)
          continue
        }
        let check = await exec("sudo openssl x509 -in '" + fp + "' -noout 2>/dev/null")
        if (check.code !== 0) {
          check = await exec("sudo openssl x509 -inform DER -in '" + fp + "' -noout 2>/dev/null")
        }
        if (check.code !== 0) continue
        const info = await parseCertInfo(fp, source)
        if (info) results.push(info)
      }
      for (const kf of keyFiles) {
        const name = kf.split('/').pop()
        const matchedCert = results.find((c) => {
          const certBase = c.path.replace(/\.(pem|crt|cer|cert)$/, '')
          const keyBase = kf.replace(/\.key$/, '')
          return certBase === keyBase
        })
        if (matchedCert) {
          matchedCert.keyPath = kf
        } else {
          results.push({ subject: name, issuer: '', notBefore: '', expiry: '', serial: '', san: '', sigAlg: '', path: kf, source, expired: false, daysLeft: null, isKey: true })
        }
      }
      return results
    }

    function parseCertDirs(confContent) {
      const dirs = new Set()
      const re = /^\s*ssl_certificate(?:_key)?\s+([^;]+);/gm
      let m
      while ((m = re.exec(confContent)) !== null) {
        const fp = m[1].trim()
        const dir = fp.substring(0, fp.lastIndexOf('/'))
        if (dir) dirs.add(dir)
      }
      return [...dirs]
    }

    async function loadCerts() {
      loadingCerts.value = true
      const result = []
      const seenPaths = new Set()

      const le = await exec("sudo ls /etc/letsencrypt/live/ 2>/dev/null")
      if (le.code === 0 && le.stdout.trim()) {
        for (const domain of le.stdout.trim().split('\n').filter(Boolean)) {
          if (domain === 'README') continue
          const certPath = '/etc/letsencrypt/live/' + domain + '/fullchain.pem'
          const info = await parseCertInfo(certPath, "Let's Encrypt")
          if (info) { result.push(info); seenPaths.add(certPath) }
        }
      }

      const autoDirs = new Set(['/etc/nginx/ssl', '/etc/nginx/certificate'])
      for (const site of sites.value) {
        if (!site.fullPath) continue
        const sr = await exec("sudo cat '" + site.fullPath + "' 2>/dev/null")
        if (sr.code === 0 && sr.stdout) {
          for (const d of parseCertDirs(sr.stdout)) autoDirs.add(d)
        }
      }

      for (const scanPath of autoDirs) {
        const dirCerts = await scanDir(scanPath, scanPath.split('/').pop())
        for (const c of dirCerts) {
          if (!seenPaths.has(c.path)) { result.push(c); seenPaths.add(c.path) }
        }
      }
      certs.value = result
      loadingCerts.value = false
      saveCertsToConfig()
    }

    async function scanCertDir() {
      const dir = certScanDir.value.trim()
      if (!dir) { showMessage('请输入要扫描的目录路径', 'warning'); return }
      loadingCerts.value = true
      const result = await scanDir(dir, dir)
      if (result.length === 0) {
        showMessage('该目录下未发现有效的 SSL 证书文件', 'info')
      }
      certs.value = result
      loadingCerts.value = false
      saveCertsToConfig()
    }

    function saveCertsToConfig() {
      const certList = certs.value
        .filter((c) => !c.isKey && c.path)
        .map((c) => ({
          path: c.path,
          keyPath: c.keyPath || '',
          subject: c.subject || '',
          issuer: c.issuer || '',
          notBefore: c.notBefore || '',
          expiry: c.expiry || '',
          domains: c.domains || [],
          source: c.source || '',
          expired: c.expired || false,
          daysLeft: c.daysLeft ?? null
        }))
      remoteConfig.set('nginx', 'certs', certList)
      remoteConfig.save()
    }

    function showCertDetail(row) {
      certDetailData.value = row
      certDetailVisible.value = true
    }

    async function copyCertFile(remotePath) {
      const r = await exec("sudo cat '" + remotePath + "' 2>/dev/null")
      if (r.code !== 0 || !r.stdout.trim()) { showMessage('读取文件失败', 'error'); return }
      try {
        await navigator.clipboard.writeText(r.stdout)
        showMessage('已复制到剪贴板', 'success')
      } catch (e) { showMessage('复制失败', 'error') }
    }

    async function downloadCertFile(remotePath) {
      const r = await exec("sudo cat '" + remotePath + "' 2>/dev/null")
      if (r.code !== 0 || !r.stdout.trim()) { showMessage('读取文件失败', 'error'); return }
      const name = remotePath.split('/').pop()
      const blob = new Blob([r.stdout], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showMessage('已下载 ' + name, 'success')
    }

    function normalizePath(p) {
      return ('/' + p).replace(/\/+/g, '/').replace(/\/$/, '') || '/'
    }

    async function openDirBrowser(target) {
      dirBrowserTarget.value = target
      const initial = target === 'site' ? (customSiteDir.value || '/etc/nginx') : (certScanDir.value || '/etc')
      dirBrowserPath.value = initial
      dirBrowserSelected.value = ''
      dirBrowserVisible.value = true
      await browseTo(initial)
    }

    async function browseTo(path) {
      const dir = normalizePath(path)
      dirBrowserPath.value = dir
      dirBrowserLoading.value = true
      dirBrowserItems.value = []
      dirBrowserSelected.value = ''
      const r = await exec("ls -lA '" + dir + "' 2>/dev/null")
      if (r.code !== 0 || !r.stdout.trim()) {
        dirBrowserLoading.value = false
        return
      }
      const items = []
      for (const line of r.stdout.trim().split('\n')) {
        const parts = line.split(/\s+/)
        if (parts.length < 9 || parts[0].startsWith('total')) continue
        const isDir = parts[0].startsWith('d')
        const name = parts.slice(8).join(' ')
        if (!name || name === '.' || name === '..') continue
        const size = isDir ? '' : parts[4]
        items.push({ name, isDir, size })
      }
      items.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
      dirBrowserItems.value = items
      dirBrowserLoading.value = false
    }

    function browseUp() {
      const parts = dirBrowserPath.value.split('/').filter(Boolean)
      parts.pop()
      browseTo('/' + parts.join('/'))
    }

    function browseInto(name) {
      browseTo(dirBrowserPath.value + '/' + name)
    }

    async function confirmDirSelect(path) {
      const dir = normalizePath(path)
      if (dirBrowserTarget.value === 'site') {
        customSiteDir.value = dir
        if (remoteConfig) await remoteConfig.set('nginx', 'siteDir', dir)
        loadSitesFromDir()
      } else {
        certScanDir.value = dir
        if (remoteConfig) await remoteConfig.set('nginx', 'certDir', dir)
        scanCertDir()
      }
      dirBrowserVisible.value = false
    }

    async function startInstall() {
      installing.value = true
      installLog.value = ''
      installStatus.value = 'running'
      const distro = await exec(". /etc/os-release 2>/dev/null && echo $ID")
      const dist = distro.stdout.trim().toLowerCase()
      let steps = []
      if (['debian', 'ubuntu'].includes(dist)) {
        steps = [
          'sudo apt-get update -y',
          'sudo apt-get install -y curl gnupg2 ca-certificates lsb-release',
          'curl -fsSL https://nginx.org/keys/nginx_signing.key | sudo gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg --yes',
          'echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/' + dist + '/ $(lsb_release -cs) nginx" | sudo tee /etc/apt/sources.list.d/nginx.list',
          'sudo apt-get update -y',
          'sudo apt-get install -y nginx',
          'sudo systemctl enable nginx',
          'sudo systemctl start nginx',
        ]
      } else {
        steps = [
          "sudo tee /etc/yum.repos.d/nginx.repo > /dev/null <<'EOF'\n[nginx-stable]\nname=nginx stable repo\nbaseurl=http://nginx.org/packages/centos/$releasever/$basearch/\ngpgcheck=1\nenabled=1\ngpgkey=https://nginx.org/keys/nginx_signing.key\nmodule_hotfixes=true\nEOF",
          'sudo yum install -y nginx || sudo dnf install -y nginx',
          'sudo systemctl enable nginx',
          'sudo systemctl start nginx',
        ]
      }
      for (const cmd of steps) {
        installLog.value += '\n$ ' + cmd + '\n'
        scrollLog()
        const r = await exec(cmd)
        installLog.value += r.stdout + (r.stderr ? '\n' + r.stderr : '')
        scrollLog()
        if (r.code !== 0 && !cmd.includes('gpg')) {
          installStatus.value = 'error'
          installLog.value += '\n安装失败\n'
          return
        }
      }
      installStatus.value = 'done'
      installLog.value += '\nNginx 安装完成\n'
    }

    function scrollLog() {
      nextTick(() => {
        if (installLogRef.value) installLogRef.value.scrollTop = installLogRef.value.scrollHeight
      })
    }

    async function initWithConfig() {
      remoteConfig = useRemoteConfig(exec)
      await remoteConfig.ensureLoaded()
      const savedSiteDir = remoteConfig.get('nginx', 'siteDir', '')
      const savedCertDir = remoteConfig.get('nginx', 'certDir', '')
      if (savedSiteDir) customSiteDir.value = savedSiteDir
      if (savedCertDir) certScanDir.value = savedCertDir
      const savedCerts = remoteConfig.get('nginx', 'certs', [])
      if (savedCerts.length && !certs.value.length) certs.value = savedCerts
      latestVersion.value = ''

      await checkNginx()
      if (installed.value) {
        await refreshAll()
        checkLatestVersion()
      }
    }

    onMounted(async () => {
      if (!props.profileId) return
      await initWithConfig()
    })

    watch(() => props.profileId, async (id) => {
      stopLogTimer()
      logAutoRefresh.value = false
      if (!id) return
      checkDone.value = false
      installed.value = false
      await initWithConfig()
    })

    onBeforeUnmount(() => {
      stopLogTimer()
    })

    return {
      checkDone, installed, version, status, loading, sites, useConfD,
      activeTab, nginxConfPath, parsedIncludes, actionResult,
      installing, installLog, installStatus, installLogRef,
      siteEditorVisible, siteEditorName, siteEditorContent, siteEditorIsNew,
      savingSite, newSiteFilename, newSiteDomain, newSiteCertIndex,
      newSiteBlocks, newSiteServerOpts,
      logFiles, logType, selectedLog, logLines, logContent, loadingLog,
      logAutoRefresh, logRefreshInterval, logStickBottom, logViewRef,
      latestVersion, checkingUpdate, hasUpdate,
      updateVisible, updating, updateLog, updateStatus, updateLogRef,
      certs, loadingCerts, certScanDir, certDetailVisible, certDetailData,
      customSiteDir, customSiteDirActive, currentSiteDir, loadingSites,
      dirBrowserVisible, dirBrowserPath, dirBrowserItems, dirBrowserLoading,
      dirBrowserSelected, dirBrowserTarget,
      statusLabel, statusTag, installStatusLabel,
      errorLogs, accessLogs, otherLogs, availableCerts, currentTypeLogs,
      Back, Delete, Document, Folder, Plus, Refresh, Warning,
      startInstall, recheckNginx, refreshAll, doAction, doTestConfig,
      checkLatestVersion, showUpdateConfirm, doUpdate, finishUpdate,
      loadSitesAuto, loadSites, loadSitesFromDir, resetSiteDir,
      editSite, newSite, saveSite, doTestAndSave, removeSite,
      addBlock, removeBlock, blockModeLabel, blockModeTag,
      regenerateSiteConfig,
      onLogTypeChange, loadLog, toggleLogAutoRefresh, restartLogTimer,
      loadCerts, scanCertDir, showCertDetail, copyCertFile, downloadCertFile,
      normalizePath, openDirBrowser, browseTo, browseUp, browseInto, confirmDirSelect,
    }
  }
}

})(this, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig);
