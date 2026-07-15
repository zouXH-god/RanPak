;(function(ctx, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig) {

const Plus = Icons.Plus
const Refresh = Icons.Refresh
const Search = Icons.Search
const Warning = Icons.Warning

function showMessage(msg, type = 'info') {
  const inst = Vue.getCurrentInstance()
  if (inst) inst.appContext.config.globalProperties.$message({ message: msg, type })
}

ctx.exports = {
  props: {
    profileId: { type: String, default: '' },
    exec: { type: Function, required: true },
    callSsh: { type: Function, default: null },
  },
  template: `<div class="systemd-manager">
    <!-- 检测中 -->
    <div v-if="!checkDone" class="text-center py-12 text-gray-400">
      <el-icon class="is-loading" size="24"><Refresh /></el-icon>
      <p class="mt-2">检测 Systemd 状态...</p>
    </div>

    <!-- 不可用 -->
    <div v-if="checkDone && !available" class="text-center py-12 text-gray-400">
      <el-icon size="48" class="text-gray-300 mb-3"><Warning /></el-icon>
      <p class="text-gray-500">当前系统未检测到 systemd</p>
    </div>

    <!-- 管理面板 -->
    <template v-if="checkDone && available">
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <el-tag type="success" effect="dark">Systemd {{ systemdVersion }}</el-tag>
        <div class="flex-1"></div>
        <el-input v-model="searchQuery" size="small" placeholder="搜索服务名..." clearable class="w-[240px]" :prefix-icon="Search" />
        <el-select v-model="filterType" size="small" class="w-[120px]">
          <el-option label="全部" value="all" />
          <el-option label="运行中" value="active" />
          <el-option label="已停止" value="inactive" />
          <el-option label="异常" value="failed" />
        </el-select>
        <el-button size="small" :icon="Plus" type="primary" @click="openCreateDialog">新建服务</el-button>
        <el-button size="small" :icon="Refresh" @click="refreshAll" :loading="loading">刷新</el-button>
      </div>

      <el-tabs v-model="activeTab" class="mgr-tabs">
        <!-- 服务列表 -->
        <el-tab-pane label="服务列表" name="services">
          <el-table :data="filteredServices" border size="small" max-height="520" v-loading="loading" @row-click="selectService" highlight-current-row>
            <el-table-column label="服务名" min-width="200" sortable :sort-method="(a, b) => a.unit.localeCompare(b.unit)">
              <template #default="{ row }">
                <div class="flex items-center gap-1">
                  <span class="service-dot" :class="'dot-' + row.activeState"></span>
                  <span class="font-medium truncate">{{ row.unit }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="stateTagType(row.activeState)" size="small">{{ stateLabel(row.activeState) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="开机启动" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.enabled === 'enabled' ? 'success' : 'info'" size="small" effect="plain">
                  {{ row.enabled === 'enabled' ? '已启用' : '未启用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="320" align="center">
              <template #default="{ row }">
                <el-button size="small" text type="success" :disabled="row.activeState === 'active'" @click.stop="doAction(row.unit, 'start')">启动</el-button>
                <el-button size="small" text type="danger" :disabled="row.activeState !== 'active'" @click.stop="doAction(row.unit, 'stop')">停止</el-button>
                <el-button size="small" text type="warning" @click.stop="doAction(row.unit, 'restart')">重启</el-button>
                <el-button size="small" text type="primary" @click.stop="viewLogs(row.unit)">日志</el-button>
                <el-dropdown trigger="click" @command="(cmd) => handleMore(cmd, row)" @click.stop>
                  <el-button size="small" text>更多</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="reload">重载配置</el-dropdown-item>
                      <el-dropdown-item :command="row.enabled === 'enabled' ? 'disable' : 'enable'">
                        {{ row.enabled === 'enabled' ? '取消开机启动' : '设置开机启动' }}
                      </el-dropdown-item>
                      <el-dropdown-item command="status">查看状态</el-dropdown-item>
                      <el-dropdown-item command="edit">编辑单元文件</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>
                        <span class="text-red-500">删除服务</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
          <div class="text-xs text-gray-400 mt-2">共 {{ filteredServices.length }} 个服务</div>
        </el-tab-pane>

        <!-- 日志查看 -->
        <el-tab-pane label="日志查看" name="logs">
          <div class="flex gap-2 mb-2 items-center flex-wrap">
            <el-select v-model="logUnit" size="small" filterable placeholder="选择服务" class="w-[240px]">
              <el-option v-for="s in services" :key="s.unit" :label="s.unit" :value="s.unit" />
            </el-select>
            <el-select v-model="logLines" size="small" class="w-[100px]">
              <el-option :value="50" label="50 行" />
              <el-option :value="100" label="100 行" />
              <el-option :value="200" label="200 行" />
              <el-option :value="500" label="500 行" />
            </el-select>
            <el-checkbox v-model="logFollow" size="small">自动刷新</el-checkbox>
            <el-button size="small" :icon="Refresh" @click="loadLogs" :loading="loadingLog">查看日志</el-button>
            <div class="flex-1"></div>
            <el-button size="small" @click="logContent = ''">清空</el-button>
          </div>
          <div ref="logRef" class="log-view" :class="{ 'log-view-tall': logContent.length > 2000 }">
            <pre>{{ logContent || '选择服务后点击"查看日志"' }}</pre>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 操作结果 -->
      <div v-if="actionResult" class="mt-3 text-xs rounded-lg bg-slate-50 p-3 whitespace-pre-wrap border border-slate-200">
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold text-gray-600">操作结果</span>
          <el-button size="small" text @click="actionResult = ''">关闭</el-button>
        </div>
        {{ actionResult }}
      </div>
    </template>

    <!-- 新建/编辑服务 -->
    <el-dialog v-model="createDialogVisible" :title="editMode ? '编辑单元文件' : '新建 Systemd 服务'" width="680px" top="5vh" :close-on-click-modal="false" append-to-body>
      <el-form label-width="100px" size="small">
        <el-form-item label="服务名称">
          <el-input v-model="serviceForm.name" :disabled="editMode" placeholder="my-app（自动追加 .service）">
            <template #append>.service</template>
          </el-input>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="serviceForm.description" placeholder="My Application Service" />
        </el-form-item>
        <el-form-item label="启动命令">
          <el-input v-model="serviceForm.execStart" placeholder="/usr/bin/node /opt/app/index.js" />
        </el-form-item>
        <el-form-item label="工作目录">
          <el-input v-model="serviceForm.workingDirectory" placeholder="/opt/app（可选）" />
        </el-form-item>
        <el-form-item label="运行用户">
          <el-input v-model="serviceForm.user" placeholder="root（可选）" />
        </el-form-item>
        <el-form-item label="重启策略">
          <el-select v-model="serviceForm.restart" class="w-full">
            <el-option label="on-failure（异常退出时重启）" value="on-failure" />
            <el-option label="always（总是重启）" value="always" />
            <el-option label="on-abnormal" value="on-abnormal" />
            <el-option label="no（不重启）" value="no" />
          </el-select>
        </el-form-item>
        <el-form-item label="重启延迟(秒)">
          <el-input-number v-model="serviceForm.restartSec" :min="0" :max="600" />
        </el-form-item>
        <el-form-item label="依赖服务">
          <el-input v-model="serviceForm.after" placeholder="network.target（可选）" />
        </el-form-item>
        <el-form-item label="环境变量">
          <el-input v-model="serviceForm.environment" type="textarea" :rows="2" placeholder="NODE_ENV=production PORT=3000" />
        </el-form-item>
        <el-collapse v-model="advancedCollapse" class="mt-2">
          <el-collapse-item title="高级配置 / 直接编辑" name="advanced">
            <el-form-item label="单元文件">
              <el-input v-model="serviceForm.rawContent" type="textarea" :rows="12" placeholder="直接编辑 .service 文件内容（填写后将覆盖上方表单配置）" class="unit-editor" />
            </el-form-item>
            <el-button size="small" @click="generateRawContent">从表单生成</el-button>
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveService">{{ editMode ? '保存' : '创建并启动' }}</el-button>
      </template>
    </el-dialog>

    <!-- 状态详情 -->
    <el-dialog v-model="statusDialogVisible" title="服务状态" width="700px" top="5vh" append-to-body>
      <div class="log-view">
        <pre>{{ statusContent }}</pre>
      </div>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog v-model="deleteDialogVisible" title="删除服务" width="460px" append-to-body>
      <p class="text-sm text-gray-600">确定要删除服务 <strong>{{ deleteTarget }}</strong> 吗？</p>
      <p class="text-xs text-gray-400 mt-1">将停止服务并移除单元文件</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">确认删除</el-button>
      </template>
    </el-dialog>
  </div>`,
  setup(props) {
    let remoteConfig = null
    const checkDone = ref(false)
    const available = ref(false)
    const systemdVersion = ref('')
    const loading = ref(false)
    const services = ref([])
    const searchQuery = ref('')
    const filterType = ref('all')
    const activeTab = ref('services')
    const actionResult = ref('')

    const logUnit = ref('')
    const logLines = ref(100)
    const logFollow = ref(false)
    const logContent = ref('')
    const loadingLog = ref(false)
    const logRef = ref(null)
    let logTimer = null

    const createDialogVisible = ref(false)
    const editMode = ref(false)
    const saving = ref(false)
    const advancedCollapse = ref([])
    const serviceForm = ref(createServiceForm())

    const statusDialogVisible = ref(false)
    const statusContent = ref('')

    const deleteDialogVisible = ref(false)
    const deleteTarget = ref('')
    const deleting = ref(false)

    function createServiceForm() {
      return {
        name: '',
        description: '',
        execStart: '',
        workingDirectory: '',
        user: '',
        restart: 'on-failure',
        restartSec: 5,
        after: 'network.target',
        environment: '',
        rawContent: '',
      }
    }

    const filteredServices = computed(() => {
      let list = services.value
      if (filterType.value !== 'all') {
        list = list.filter(s => s.activeState === filterType.value)
      }
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.trim().toLowerCase()
        list = list.filter(s => s.unit.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q))
      }
      return list
    })

    function stateTagType(state) {
      const map = { active: 'success', inactive: 'info', failed: 'danger', activating: 'warning', deactivating: 'warning' }
      return map[state] || 'info'
    }

    function stateLabel(state) {
      const map = { active: '运行中', inactive: '已停止', failed: '异常', activating: '启动中', deactivating: '停止中' }
      return map[state] || state
    }

    async function exec(cmd) {
      return await props.exec(cmd)
    }

    async function checkSystemd() {
      const r = await exec('systemctl --version 2>/dev/null | head -1')
      if (r.code === 0 && r.stdout.includes('systemd')) {
        available.value = true
        const match = r.stdout.match(/systemd\s+(\d+)/)
        systemdVersion.value = match ? match[1] : ''
      }
      checkDone.value = true
    }

    async function loadServices() {
      loading.value = true
      const r = await exec("systemctl list-units --type=service --all --no-pager --no-legend --plain 2>/dev/null")
      if (r.code === 0 && r.stdout.trim()) {
        const lines = r.stdout.trim().split('\n').filter(Boolean)
        const list = []
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length < 4) continue
          const unit = parts[0].replace(/●\s*/, '')
          if (!unit.endsWith('.service')) continue
          const activeState = parts[2] || 'unknown'
          const description = parts.slice(4).join(' ')
          list.push({ unit, load: parts[1], activeState, sub: parts[3], description })
        }
        const enabledR = await exec("systemctl list-unit-files --type=service --no-pager --no-legend --plain 2>/dev/null")
        const enabledMap = {}
        if (enabledR.code === 0 && enabledR.stdout.trim()) {
          for (const line of enabledR.stdout.trim().split('\n')) {
            const p = line.trim().split(/\s+/)
            if (p.length >= 2) enabledMap[p[0]] = p[1]
          }
        }
        for (const s of list) {
          s.enabled = enabledMap[s.unit] || 'unknown'
        }
        services.value = list
      }
      loading.value = false
    }

    async function refreshAll() {
      await loadServices()
    }

    async function doAction(unit, action) {
      actionResult.value = ''
      const r = await exec('sudo systemctl ' + action + ' ' + unit + ' 2>&1')
      actionResult.value = ('[' + action + '] ' + unit + '\n' + (r.stdout || '') + (r.stderr || '')).trim() || (r.code === 0 ? '操作成功' : '操作失败')
      if (r.code === 0) {
        showMessage(unit + ' ' + action + ' 成功', 'success')
      } else {
        showMessage(unit + ' ' + action + ' 失败', 'error')
      }
      await loadServices()
    }

    async function handleMore(cmd, row) {
      if (cmd === 'enable' || cmd === 'disable') {
        await doAction(row.unit, cmd)
      } else if (cmd === 'reload') {
        await doAction(row.unit, 'reload')
      } else if (cmd === 'status') {
        await showStatus(row.unit)
      } else if (cmd === 'edit') {
        await openEditDialog(row.unit)
      } else if (cmd === 'delete') {
        deleteTarget.value = row.unit
        deleteDialogVisible.value = true
      }
    }

    function selectService(row) {
      logUnit.value = row.unit
    }

    async function viewLogs(unit) {
      logUnit.value = unit
      activeTab.value = 'logs'
      await nextTick()
      await loadLogs()
    }

    async function loadLogs() {
      if (!logUnit.value) {
        showMessage('请先选择服务', 'warning')
        return
      }
      loadingLog.value = true
      const r = await exec('sudo journalctl -u ' + logUnit.value + ' -n ' + logLines.value + ' --no-pager 2>&1')
      logContent.value = r.stdout || r.stderr || '无日志输出'
      loadingLog.value = false
      scrollLog()
    }

    function scrollLog() {
      nextTick(() => {
        if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
      })
    }

    function startLogTimer() {
      stopLogTimer()
      if (logFollow.value && logUnit.value) {
        logTimer = setInterval(() => loadLogs(), 5000)
      }
    }

    function stopLogTimer() {
      if (logTimer) {
        clearInterval(logTimer)
        logTimer = null
      }
    }

    watch(logFollow, (val) => {
      if (val) startLogTimer()
      else stopLogTimer()
    })

    function openCreateDialog() {
      editMode.value = false
      serviceForm.value = createServiceForm()
      advancedCollapse.value = []
      createDialogVisible.value = true
    }

    async function openEditDialog(unit) {
      editMode.value = true
      serviceForm.value = createServiceForm()
      serviceForm.value.name = unit.replace(/\.service$/, '')
      advancedCollapse.value = ['advanced']

      const pathR = await exec('systemctl show ' + unit + ' -p FragmentPath --value 2>/dev/null')
      const filePath = pathR.stdout.trim() || '/etc/systemd/system/' + unit
      const r = await exec("sudo cat '" + filePath + "' 2>/dev/null")
      if (r.code === 0 && r.stdout.trim()) {
        serviceForm.value.rawContent = r.stdout
        parseRawContent(r.stdout)
      }
      createDialogVisible.value = true
    }

    function parseRawContent(content) {
      const getVal = (key) => {
        const m = content.match(new RegExp('^' + key + '=(.*)$', 'm'))
        return m ? m[1].trim() : ''
      }
      serviceForm.value.description = getVal('Description')
      serviceForm.value.execStart = getVal('ExecStart')
      serviceForm.value.workingDirectory = getVal('WorkingDirectory')
      serviceForm.value.user = getVal('User')
      serviceForm.value.restart = getVal('Restart') || 'on-failure'
      serviceForm.value.restartSec = parseInt(getVal('RestartSec')) || 5
      serviceForm.value.after = getVal('After')
      const envLines = []
      const envRe = /^Environment=(.*)$/gm
      let em
      while ((em = envRe.exec(content)) !== null) {
        envLines.push(em[1].trim())
      }
      serviceForm.value.environment = envLines.join('\n')
    }

    function buildUnitContent() {
      const f = serviceForm.value
      let content = '[Unit]\n'
      content += 'Description=' + (f.description || f.name + ' service') + '\n'
      if (f.after) content += 'After=' + f.after + '\n'
      content += '\n[Service]\n'
      content += 'Type=simple\n'
      if (f.user) content += 'User=' + f.user + '\n'
      if (f.workingDirectory) content += 'WorkingDirectory=' + f.workingDirectory + '\n'
      content += 'ExecStart=' + f.execStart + '\n'
      content += 'Restart=' + f.restart + '\n'
      content += 'RestartSec=' + f.restartSec + '\n'
      if (f.environment.trim()) {
        var envLines = f.environment.trim().split('\n').filter(Boolean)
        for (var i = 0; i < envLines.length; i++) {
          content += 'Environment=' + envLines[i].trim() + '\n'
        }
      }
      content += '\n[Install]\nWantedBy=multi-user.target\n'
      return content
    }

    function generateRawContent() {
      serviceForm.value.rawContent = buildUnitContent()
    }

    async function saveService() {
      const f = serviceForm.value
      if (!f.name.trim()) {
        showMessage('请输入服务名称', 'warning')
        return
      }
      const content = f.rawContent.trim() || buildUnitContent()
      if (!content.includes('ExecStart') && !f.rawContent.trim()) {
        showMessage('请输入启动命令', 'warning')
        return
      }
      saving.value = true
      const unitName = f.name.trim().replace(/\.service$/, '') + '.service'
      const filePath = '/etc/systemd/system/' + unitName

      const writeR = await exec("sudo tee '" + filePath + "' > /dev/null <<'RANPAK_EOF'\n" + content + "\nRANPAK_EOF")
      if (writeR.code !== 0) {
        showMessage('写入单元文件失败: ' + writeR.stderr, 'error')
        saving.value = false
        return
      }

      await exec('sudo systemctl daemon-reload 2>&1')

      if (!editMode.value) {
        await exec('sudo systemctl enable ' + unitName + ' 2>&1')
        await exec('sudo systemctl start ' + unitName + ' 2>&1')
        showMessage(unitName + ' 已创建并启动', 'success')
      } else {
        showMessage(unitName + ' 单元文件已保存，已 daemon-reload', 'success')
      }

      saving.value = false
      createDialogVisible.value = false
      await loadServices()
    }

    async function showStatus(unit) {
      const r = await exec('sudo systemctl status ' + unit + ' --no-pager 2>&1')
      statusContent.value = r.stdout || r.stderr || '无法获取状态'
      statusDialogVisible.value = true
    }

    async function confirmDelete() {
      const unit = deleteTarget.value
      if (!unit) return
      deleting.value = true
      await exec('sudo systemctl stop ' + unit + ' 2>&1')
      await exec('sudo systemctl disable ' + unit + ' 2>&1')

      const pathR = await exec('systemctl show ' + unit + ' -p FragmentPath --value 2>/dev/null')
      const filePath = pathR.stdout.trim() || '/etc/systemd/system/' + unit
      await exec("sudo rm -f '" + filePath + "'")
      await exec('sudo systemctl daemon-reload 2>&1')
      await exec('sudo systemctl reset-failed 2>&1')

      showMessage(unit + ' 已删除', 'success')
      deleting.value = false
      deleteDialogVisible.value = false
      await loadServices()
    }

    async function initWithConfig() {
      remoteConfig = useRemoteConfig(exec)
      await remoteConfig.ensureLoaded()
      await checkSystemd()
      if (available.value) {
        await refreshAll()
      }
    }

    onMounted(async () => {
      if (!props.profileId) return
      await initWithConfig()
    })

    watch(() => props.profileId, async (id) => {
      stopLogTimer()
      logFollow.value = false
      if (!id) return
      checkDone.value = false
      available.value = false
      await initWithConfig()
    })

    onBeforeUnmount(() => {
      stopLogTimer()
    })

    return {
      Plus,
      Refresh,
      Search,
      Warning,
      checkDone,
      available,
      systemdVersion,
      loading,
      services,
      searchQuery,
      filterType,
      activeTab,
      actionResult,
      logUnit,
      logLines,
      logFollow,
      logContent,
      loadingLog,
      logRef,
      createDialogVisible,
      editMode,
      saving,
      advancedCollapse,
      serviceForm,
      statusDialogVisible,
      statusContent,
      deleteDialogVisible,
      deleteTarget,
      deleting,
      filteredServices,
      stateTagType,
      stateLabel,
      refreshAll,
      doAction,
      handleMore,
      selectService,
      viewLogs,
      loadLogs,
      openCreateDialog,
      generateRawContent,
      saveService,
      confirmDelete,
    }
  }
}

})(this, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig);
