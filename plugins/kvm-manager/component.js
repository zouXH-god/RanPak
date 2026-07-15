;(function (ctx, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig) {

var Plus = Icons.Plus
var Refresh = Icons.Refresh
var Search = Icons.Search
var Warning = Icons.Warning
var Delete = Icons.Delete
var VideoPlay = Icons.VideoPlay
var VideoPause = Icons.VideoPause
var SwitchButton = Icons.SwitchButton
var Document = Icons.Document
var Monitor = Icons.Monitor
var Connection = Icons.Connection
var FolderOpened = Icons.FolderOpened
var InfoFilled = Icons.InfoFilled

function showMessage(msg, type) {
  var inst = Vue.getCurrentInstance()
  if (inst) inst.appContext.config.globalProperties.$message({ message: msg, type: type || 'info' })
}

function showConfirm(msg, title, opts) {
  var inst = Vue.getCurrentInstance()
  if (!inst) return Promise.reject()
  return inst.appContext.config.globalProperties.$confirm(msg, title, opts || {})
}

ctx.exports = {
  props: {
    profileId: { type: String, default: '' },
    exec: { type: Function, required: true },
    callSsh: { type: Function, default: null },
  },

  template: [
'<div class="kvm-manager">',

  '<div v-if="!checkDone" class="text-center py-10 text-gray-400">',
    '<el-icon class="is-loading" :size="24"><component :is="RefreshIcon" /></el-icon>',
    '<p class="mt-2">检测 libvirt/virsh 状态...</p>',
  '</div>',

  '<div v-if="checkDone && !installed" class="text-center py-10">',
    '<el-icon :size="48" class="text-gray-300 mb-3"><component :is="WarningIcon" /></el-icon>',
    '<p class="text-gray-500 mb-4">未检测到 virsh (libvirt)，请先安装 libvirt 工具包。</p>',
    '<div class="install-hint mx-auto text-left text-xs text-gray-400" style="max-width:480px">',
      '<p class="font-semibold mb-1">常见安装方式：</p>',
      '<p>Debian/Ubuntu: <code>sudo apt install -y qemu-kvm libvirt-daemon-system virtinst</code></p>',
      '<p>CentOS/RHEL: <code>sudo yum install -y qemu-kvm libvirt virt-install</code></p>',
      '<el-button class="mt-3" type="primary" size="small" @click="checkVirsh">重新检测</el-button>',
    '</div>',
  '</div>',

  '<template v-if="checkDone && installed">',
    '<div class="flex items-center gap-2 mb-4 flex-wrap">',
      '<el-tag type="success" effect="dark">libvirt {{ virshVersion }}</el-tag>',
      '<div class="flex-1"></div>',
      '<el-button :icon="RefreshIcon" :loading="loading" size="small" @click="refreshAll">刷新</el-button>',
    '</div>',

    '<el-tabs v-model="activeTab">',

      // ── VM 列表 ──
      '<el-tab-pane label="虚拟机" name="vms">',
        '<div class="flex items-center gap-2 mb-3 flex-wrap">',
          '<el-input v-model="vmSearch" size="small" placeholder="搜索虚拟机..." clearable class="w-[220px]" :prefix-icon="SearchIcon" />',
          '<el-select v-model="vmFilter" size="small" class="w-[120px]">',
            '<el-option label="全部" value="all" />',
            '<el-option label="运行中" value="running" />',
            '<el-option label="已关机" value="shut off" />',
            '<el-option label="已暂停" value="paused" />',
          '</el-select>',
          '<div class="flex-1"></div>',
          '<el-button :icon="PlusIcon" size="small" type="primary" @click="openCreateDialog">创建虚拟机</el-button>',
        '</div>',

        '<el-table :data="filteredVms" border size="small" :loading="loading">',
          '<el-table-column label="名称" prop="name" min-width="160" />',
          '<el-table-column label="状态" width="110">',
            '<template #default="{ row }">',
              '<el-tag :type="stateTagType(row.state)" size="small" effect="dark">{{ stateLabel(row.state) }}</el-tag>',
            '</template>',
          '</el-table-column>',
          '<el-table-column label="ID" prop="id" width="70" />',
          '<el-table-column label="自启" width="70">',
            '<template #default="{ row }">',
              '<el-tag v-if="row.autostart" type="success" size="small">是</el-tag>',
              '<el-tag v-else type="info" size="small">否</el-tag>',
            '</template>',
          '</el-table-column>',
          '<el-table-column label="操作" width="340" fixed="right">',
            '<template #default="{ row }">',
              '<div class="flex flex-wrap gap-1">',
                '<el-button v-if="row.state !== \'running\'" size="small" type="success" text @click="vmAction(row.name, \'start\')">启动</el-button>',
                '<el-button v-if="row.state === \'running\'" size="small" type="warning" text @click="vmAction(row.name, \'shutdown\')">关机</el-button>',
                '<el-button v-if="row.state === \'running\'" size="small" text @click="vmAction(row.name, \'reboot\')">重启</el-button>',
                '<el-button v-if="row.state === \'running\'" size="small" text @click="vmAction(row.name, \'suspend\')">暂停</el-button>',
                '<el-button v-if="row.state === \'paused\'" size="small" type="success" text @click="vmAction(row.name, \'resume\')">恢复</el-button>',
                '<el-button v-if="row.state === \'running\'" size="small" type="danger" text @click="vmForceOff(row.name)">强制关机</el-button>',
                '<el-button size="small" text @click="openDetail(row)">详情</el-button>',
                '<el-button size="small" text @click="openSnapshots(row)">快照</el-button>',
                '<el-button size="small" type="danger" text :icon="DeleteIcon" @click="vmDelete(row)" />',
              '</div>',
            '</template>',
          '</el-table-column>',
        '</el-table>',
      '</el-tab-pane>',

      // ── 存储池 ──
      '<el-tab-pane label="存储池" name="pools">',
        '<div class="flex items-center gap-2 mb-3">',
          '<div class="flex-1"></div>',
          '<el-button :icon="RefreshIcon" size="small" :loading="poolLoading" @click="loadPools">刷新</el-button>',
        '</div>',
        '<el-table :data="pools" border size="small" :loading="poolLoading">',
          '<el-table-column label="名称" prop="name" min-width="140" />',
          '<el-table-column label="状态" width="100">',
            '<template #default="{ row }">',
              '<el-tag :type="row.state === \'active\' ? \'success\' : \'info\'" size="small">{{ row.state }}</el-tag>',
            '</template>',
          '</el-table-column>',
          '<el-table-column label="自启" width="80" prop="autostart" />',
          '<el-table-column label="操作" width="160">',
            '<template #default="{ row }">',
              '<el-button size="small" text @click="loadVolumes(row.name)">查看卷</el-button>',
              '<el-button v-if="row.state !== \'active\'" size="small" type="success" text @click="poolAction(row.name, \'start\')">激活</el-button>',
              '<el-button v-else size="small" type="warning" text @click="poolAction(row.name, \'destroy\')">停用</el-button>',
            '</template>',
          '</el-table-column>',
        '</el-table>',
        '<template v-if="selectedPool">',
          '<h3 class="text-sm font-semibold mt-4 mb-2">{{ selectedPool }} 的卷列表</h3>',
          '<el-table :data="volumes" border size="small" :loading="volLoading">',
            '<el-table-column label="名称" prop="name" min-width="200" />',
            '<el-table-column label="路径" prop="path" min-width="260" />',
            '<el-table-column label="容量" prop="capacity" width="120" />',
            '<el-table-column label="已用" prop="allocation" width="120" />',
          '</el-table>',
        '</template>',
      '</el-tab-pane>',

      // ── 虚拟网络 ──
      '<el-tab-pane label="虚拟网络" name="networks">',
        '<div class="flex items-center gap-2 mb-3">',
          '<div class="flex-1"></div>',
          '<el-button :icon="RefreshIcon" size="small" :loading="netLoading" @click="loadNetworks">刷新</el-button>',
        '</div>',
        '<el-table :data="networks" border size="small" :loading="netLoading">',
          '<el-table-column label="名称" prop="name" min-width="160" />',
          '<el-table-column label="状态" width="100">',
            '<template #default="{ row }">',
              '<el-tag :type="row.state === \'active\' ? \'success\' : \'info\'" size="small">{{ row.state }}</el-tag>',
            '</template>',
          '</el-table-column>',
          '<el-table-column label="自启" width="80" prop="autostart" />',
          '<el-table-column label="持久化" width="80" prop="persistent" />',
          '<el-table-column label="操作" width="180">',
            '<template #default="{ row }">',
              '<el-button size="small" text @click="showNetDetail(row.name)">详情</el-button>',
              '<el-button v-if="row.state !== \'active\'" size="small" type="success" text @click="netAction(row.name, \'start\')">激活</el-button>',
              '<el-button v-else size="small" type="warning" text @click="netAction(row.name, \'destroy\')">停用</el-button>',
            '</template>',
          '</el-table-column>',
        '</el-table>',
      '</el-tab-pane>',

      // ── 宿主机信息 ──
      '<el-tab-pane label="宿主机" name="host">',
        '<div class="flex items-center gap-2 mb-3">',
          '<div class="flex-1"></div>',
          '<el-button :icon="RefreshIcon" size="small" @click="loadHostInfo">刷新</el-button>',
        '</div>',
        '<pre v-if="hostInfo" class="kvm-pre">{{ hostInfo }}</pre>',
        '<div v-else class="text-center py-6 text-gray-400">点击刷新加载宿主机信息</div>',
      '</el-tab-pane>',

    '</el-tabs>',
  '</template>',

  // ── VM 详情对话框 ──
  '<el-dialog v-model="detailVisible" :title="\'虚拟机详情 - \' + detailVm.name" width="720px" top="6vh">',
    '<el-tabs v-model="detailTab">',
      '<el-tab-pane label="基本信息" name="info">',
        '<pre class="kvm-pre">{{ detailInfo }}</pre>',
      '</el-tab-pane>',
      '<el-tab-pane label="磁盘" name="disks">',
        '<el-table :data="detailDisks" border size="small">',
          '<el-table-column label="目标" prop="target" width="100" />',
          '<el-table-column label="源" prop="source" min-width="300" />',
        '</el-table>',
      '</el-tab-pane>',
      '<el-tab-pane label="网卡" name="nics">',
        '<el-table :data="detailNics" border size="small">',
          '<el-table-column label="接口" prop="iface" width="100" />',
          '<el-table-column label="类型" prop="type" width="120" />',
          '<el-table-column label="源" prop="source" width="160" />',
          '<el-table-column label="模型" prop="model" width="120" />',
          '<el-table-column label="MAC" prop="mac" min-width="180" />',
        '</el-table>',
      '</el-tab-pane>',
      '<el-tab-pane label="XML" name="xml">',
        '<div class="flex justify-end mb-2">',
          '<el-button size="small" @click="copyXml">复制</el-button>',
        '</div>',
        '<pre class="kvm-pre kvm-pre-xml">{{ detailXml }}</pre>',
      '</el-tab-pane>',
      '<el-tab-pane label="控制台日志" name="console">',
        '<div class="flex items-center gap-2 mb-2">',
          '<el-button size="small" @click="loadConsoleLog">刷新日志</el-button>',
          '<span class="text-xs text-gray-400">显示 virsh console 输出（仅限串口配置的虚拟机）</span>',
        '</div>',
        '<pre class="kvm-pre">{{ consoleLog || "(无日志)" }}</pre>',
      '</el-tab-pane>',
    '</el-tabs>',
  '</el-dialog>',

  // ── 快照管理对话框 ──
  '<el-dialog v-model="snapVisible" :title="\'快照管理 - \' + snapVm" width="640px" top="8vh">',
    '<div class="flex items-center gap-2 mb-3">',
      '<el-input v-model="newSnapName" size="small" placeholder="快照名称" class="w-[200px]" />',
      '<el-input v-model="newSnapDesc" size="small" placeholder="描述（可选）" class="flex-1" />',
      '<el-button :icon="PlusIcon" size="small" type="primary" :loading="snapCreating" @click="createSnapshot">创建</el-button>',
      '<el-button :icon="RefreshIcon" size="small" :loading="snapLoading" @click="loadSnapshots(snapVm)">刷新</el-button>',
    '</div>',
    '<el-table :data="snapshots" border size="small" :loading="snapLoading">',
      '<el-table-column label="名称" prop="name" min-width="140" />',
      '<el-table-column label="创建时间" prop="creationTime" min-width="180" />',
      '<el-table-column label="状态" prop="state" width="100" />',
      '<el-table-column label="操作" width="160">',
        '<template #default="{ row }">',
          '<el-button size="small" type="warning" text @click="revertSnapshot(row.name)">回滚</el-button>',
          '<el-button size="small" type="danger" text @click="deleteSnapshot(row.name)">删除</el-button>',
        '</template>',
      '</el-table-column>',
    '</el-table>',
  '</el-dialog>',

  // ── 网络详情对话框 ──
  '<el-dialog v-model="netDetailVisible" :title="\'网络详情 - \' + netDetailName" width="600px">',
    '<pre class="kvm-pre">{{ netDetailXml }}</pre>',
  '</el-dialog>',

  // ── 创建虚拟机对话框 ──
  '<el-dialog v-model="createVisible" title="创建虚拟机" width="540px" top="8vh">',
    '<el-form label-position="top" class="kvm-create-form">',
      '<el-form-item label="名称" required>',
        '<el-input v-model="createForm.name" placeholder="vm-name" />',
      '</el-form-item>',
      '<div class="grid gap-3 grid-cols-2">',
        '<el-form-item label="vCPU">',
          '<el-input-number v-model="createForm.vcpus" :min="1" :max="128" class="w-full" />',
        '</el-form-item>',
        '<el-form-item label="内存 (MB)">',
          '<el-input-number v-model="createForm.memory" :min="256" :step="256" class="w-full" />',
        '</el-form-item>',
      '</div>',
      '<el-form-item label="磁盘大小 (GB)">',
        '<el-input-number v-model="createForm.diskSize" :min="1" :step="10" class="w-full" />',
      '</el-form-item>',
      '<el-form-item label="ISO 镜像路径">',
        '<el-input v-model="createForm.isoPath" placeholder="/path/to/install.iso" />',
      '</el-form-item>',
      '<el-form-item label="网络">',
        '<el-select v-model="createForm.network" class="w-full">',
          '<el-option label="default (NAT)" value="default" />',
          '<el-option v-for="n in networks" :key="n.name" :label="n.name" :value="n.name" />',
        '</el-select>',
      '</el-form-item>',
      '<el-form-item label="OS Variant (可选)">',
        '<el-input v-model="createForm.osVariant" placeholder="如 ubuntu22.04, centos-stream9" />',
      '</el-form-item>',
    '</el-form>',
    '<template #footer>',
      '<el-button @click="createVisible = false">取消</el-button>',
      '<el-button type="primary" :loading="creating" @click="doCreateVm">创建</el-button>',
    '</template>',
  '</el-dialog>',

'</div>'
  ].join('\n'),

  setup: function (props) {
    var RefreshIcon = Refresh
    var SearchIcon = Search
    var WarningIcon = Warning
    var DeleteIcon = Delete
    var PlusIcon = Plus

    var checkDone = ref(false)
    var installed = ref(false)
    var virshVersion = ref('')
    var loading = ref(false)
    var activeTab = ref('vms')

    // ── VM ──
    var vms = ref([])
    var vmSearch = ref('')
    var vmFilter = ref('all')

    var filteredVms = computed(function () {
      var list = vms.value
      if (vmFilter.value !== 'all') list = list.filter(function (v) { return v.state === vmFilter.value })
      var kw = vmSearch.value.trim().toLowerCase()
      if (kw) list = list.filter(function (v) { return v.name.toLowerCase().indexOf(kw) >= 0 })
      return list
    })

    // ── VM Detail ──
    var detailVisible = ref(false)
    var detailVm = reactive({ name: '' })
    var detailTab = ref('info')
    var detailInfo = ref('')
    var detailDisks = ref([])
    var detailNics = ref([])
    var detailXml = ref('')
    var consoleLog = ref('')

    // ── Snapshots ──
    var snapVisible = ref(false)
    var snapVm = ref('')
    var snapshots = ref([])
    var snapLoading = ref(false)
    var snapCreating = ref(false)
    var newSnapName = ref('')
    var newSnapDesc = ref('')

    // ── Pools ──
    var pools = ref([])
    var poolLoading = ref(false)
    var selectedPool = ref('')
    var volumes = ref([])
    var volLoading = ref(false)

    // ── Networks ──
    var networks = ref([])
    var netLoading = ref(false)
    var netDetailVisible = ref(false)
    var netDetailName = ref('')
    var netDetailXml = ref('')

    // ── Host ──
    var hostInfo = ref('')

    // ── Create VM ──
    var createVisible = ref(false)
    var creating = ref(false)
    var createForm = reactive({
      name: '',
      vcpus: 2,
      memory: 2048,
      diskSize: 20,
      isoPath: '',
      network: 'default',
      osVariant: '',
    })

    function exec(cmd) {
      return props.exec(cmd)
    }

    // ── 检测 ──
    async function checkVirsh() {
      checkDone.value = false
      var r = await exec('which virsh 2>/dev/null')
      if (r.code !== 0 || !r.stdout.trim()) {
        installed.value = false
        checkDone.value = true
        return
      }
      installed.value = true
      var vr = await exec('virsh version --daemon 2>/dev/null')
      var lines = (vr.stdout || '').trim().split('\n')
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('libvirt') >= 0 || lines[i].indexOf('Running') >= 0) {
          virshVersion.value = lines[i].replace(/.*:\s*/, '').trim()
          break
        }
      }
      if (!virshVersion.value) virshVersion.value = 'detected'
      checkDone.value = true
    }

    // ── VM 列表 ──
    async function loadVms() {
      loading.value = true
      try {
        var r = await exec('virsh list --all 2>/dev/null')
        if (r.code !== 0) { vms.value = []; return }
        var lines = r.stdout.trim().split('\n')
        var list = []
        for (var i = 2; i < lines.length; i++) {
          var parts = lines[i].trim().split(/\s+/)
          if (parts.length < 2) continue
          var id = parts[0] === '-' ? '-' : parts[0]
          var name = parts[1]
          var state = parts.slice(2).join(' ')
          list.push({ id: id, name: name, state: state, autostart: false })
        }
        // get autostart info
        var ar = await exec('virsh list --all --autostart --name 2>/dev/null')
        var autoNames = new Set((ar.stdout || '').trim().split('\n').map(function (s) { return s.trim() }).filter(Boolean))
        for (var j = 0; j < list.length; j++) {
          list[j].autostart = autoNames.has(list[j].name)
        }
        vms.value = list
      } finally {
        loading.value = false
      }
    }

    function stateTagType(state) {
      if (state === 'running') return 'success'
      if (state === 'paused') return 'warning'
      if (state === 'shut off') return 'info'
      return 'danger'
    }

    function stateLabel(state) {
      var map = { 'running': '运行中', 'shut off': '已关机', 'paused': '已暂停', 'idle': '空闲', 'crashed': '已崩溃', 'in shutdown': '关机中', 'pmsuspended': '挂起' }
      return map[state] || state
    }

    async function vmAction(name, action) {
      var r = await exec('virsh ' + action + ' ' + name + ' 2>&1')
      if (r.code === 0) {
        showMessage(name + ' ' + action + ' 成功', 'success')
      } else {
        showMessage((r.stdout || r.stderr || '').trim() || action + ' 失败', 'error')
      }
      await loadVms()
    }

    async function vmForceOff(name) {
      try {
        await showConfirm('强制关闭虚拟机「' + name + '」？等同于拔电源，可能导致数据丢失。', '强制关机', { type: 'warning' })
      } catch (e) { return }
      var r = await exec('virsh destroy ' + name + ' 2>&1')
      if (r.code === 0) showMessage(name + ' 已强制关闭', 'success')
      else showMessage((r.stdout || '').trim() || '强制关机失败', 'error')
      await loadVms()
    }

    async function vmDelete(row) {
      try {
        await showConfirm('确定删除虚拟机「' + row.name + '」？此操作将取消定义该虚拟机（不删除磁盘文件）。', '删除虚拟机', { type: 'warning' })
      } catch (e) { return }
      if (row.state === 'running') await exec('virsh destroy ' + row.name + ' 2>&1')
      var r = await exec('virsh undefine ' + row.name + ' 2>&1')
      if (r.code === 0) showMessage(row.name + ' 已删除', 'success')
      else showMessage((r.stdout || '').trim() || '删除失败', 'error')
      await loadVms()
    }

    // ── VM 详情 ──
    async function openDetail(row) {
      detailVm.name = row.name
      detailTab.value = 'info'
      detailInfo.value = ''
      detailDisks.value = []
      detailNics.value = []
      detailXml.value = ''
      consoleLog.value = ''
      detailVisible.value = true

      var infoR = await exec('virsh dominfo ' + row.name + ' 2>/dev/null')
      detailInfo.value = (infoR.stdout || '').trim() || '(无数据)'

      var diskR = await exec('virsh domblklist ' + row.name + ' 2>/dev/null')
      var diskLines = (diskR.stdout || '').trim().split('\n')
      var disks = []
      for (var i = 2; i < diskLines.length; i++) {
        var parts = diskLines[i].trim().split(/\s+/)
        if (parts.length >= 2) disks.push({ target: parts[0], source: parts.slice(1).join(' ') })
      }
      detailDisks.value = disks

      var nicR = await exec('virsh domiflist ' + row.name + ' 2>/dev/null')
      var nicLines = (nicR.stdout || '').trim().split('\n')
      var nics = []
      for (var j = 2; j < nicLines.length; j++) {
        var p = nicLines[j].trim().split(/\s+/)
        if (p.length >= 4) nics.push({ iface: p[0], type: p[1], source: p[2], model: p[3], mac: p[4] || '' })
      }
      detailNics.value = nics

      var xmlR = await exec('virsh dumpxml ' + row.name + ' 2>/dev/null')
      detailXml.value = (xmlR.stdout || '').trim()
    }

    function copyXml() {
      if (navigator.clipboard && detailXml.value) {
        navigator.clipboard.writeText(detailXml.value)
        showMessage('已复制到剪贴板', 'success')
      }
    }

    async function loadConsoleLog() {
      var r = await exec('virsh console ' + detailVm.name + ' --force --safe 2>&1 & sleep 2 && kill $! 2>/dev/null; wait 2>/dev/null')
      if (r.stdout) consoleLog.value = r.stdout.trim()
      else {
        var logR = await exec('virsh domblklist ' + detailVm.name + ' --details 2>/dev/null && journalctl -u libvirtd --no-pager -n 50 2>/dev/null | grep ' + detailVm.name + ' || true')
        consoleLog.value = (logR.stdout || '').trim() || '(无可用日志，虚拟机可能未配置串口输出)'
      }
    }

    // ── 快照 ──
    function openSnapshots(row) {
      snapVm.value = row.name
      snapshots.value = []
      newSnapName.value = ''
      newSnapDesc.value = ''
      snapVisible.value = true
      loadSnapshots(row.name)
    }

    async function loadSnapshots(vmName) {
      snapLoading.value = true
      try {
        var r = await exec('virsh snapshot-list ' + vmName + ' 2>/dev/null')
        if (r.code !== 0) { snapshots.value = []; return }
        var lines = r.stdout.trim().split('\n')
        var list = []
        for (var i = 2; i < lines.length; i++) {
          var line = lines[i].trim()
          if (!line) continue
          var parts = line.split(/\s{2,}/)
          if (parts.length >= 3) list.push({ name: parts[0].trim(), creationTime: parts[1].trim(), state: parts[2].trim() })
        }
        snapshots.value = list
      } finally {
        snapLoading.value = false
      }
    }

    async function createSnapshot() {
      var name = newSnapName.value.trim()
      if (!name) { showMessage('请输入快照名称', 'warning'); return }
      snapCreating.value = true
      try {
        var desc = newSnapDesc.value.trim()
        var cmd = 'virsh snapshot-create-as ' + snapVm.value + ' ' + name
        if (desc) cmd += ' --description "' + desc.replace(/"/g, '\\"') + '"'
        var r = await exec(cmd + ' 2>&1')
        if (r.code === 0) { showMessage('快照已创建', 'success'); newSnapName.value = ''; newSnapDesc.value = '' }
        else showMessage((r.stdout || '').trim() || '创建失败', 'error')
        await loadSnapshots(snapVm.value)
      } finally {
        snapCreating.value = false
      }
    }

    async function revertSnapshot(name) {
      try {
        await showConfirm('确定回滚到快照「' + name + '」？当前未保存的状态将丢失。', '回滚快照', { type: 'warning' })
      } catch (e) { return }
      var r = await exec('virsh snapshot-revert ' + snapVm.value + ' ' + name + ' 2>&1')
      if (r.code === 0) showMessage('已回滚到 ' + name, 'success')
      else showMessage((r.stdout || '').trim() || '回滚失败', 'error')
      await loadSnapshots(snapVm.value)
    }

    async function deleteSnapshot(name) {
      try {
        await showConfirm('确定删除快照「' + name + '」？', '删除快照', { type: 'warning' })
      } catch (e) { return }
      var r = await exec('virsh snapshot-delete ' + snapVm.value + ' ' + name + ' 2>&1')
      if (r.code === 0) showMessage('快照已删除', 'success')
      else showMessage((r.stdout || '').trim() || '删除失败', 'error')
      await loadSnapshots(snapVm.value)
    }

    // ── 存储池 ──
    async function loadPools() {
      poolLoading.value = true
      try {
        var r = await exec('virsh pool-list --all 2>/dev/null')
        if (r.code !== 0) { pools.value = []; return }
        var lines = r.stdout.trim().split('\n')
        var list = []
        for (var i = 2; i < lines.length; i++) {
          var parts = lines[i].trim().split(/\s+/)
          if (parts.length >= 3) list.push({ name: parts[0], state: parts[1], autostart: parts[2] })
        }
        pools.value = list
      } finally {
        poolLoading.value = false
      }
    }

    async function poolAction(name, action) {
      var r = await exec('virsh pool-' + action + ' ' + name + ' 2>&1')
      if (r.code === 0) showMessage(name + ' ' + action + ' 成功', 'success')
      else showMessage((r.stdout || '').trim() || action + ' 失败', 'error')
      await loadPools()
    }

    async function loadVolumes(poolName) {
      selectedPool.value = poolName
      volLoading.value = true
      try {
        var r = await exec('virsh vol-list ' + poolName + ' --details 2>/dev/null')
        if (r.code !== 0) { volumes.value = []; return }
        var lines = r.stdout.trim().split('\n')
        var list = []
        for (var i = 2; i < lines.length; i++) {
          var line = lines[i].trim()
          if (!line) continue
          var parts = line.split(/\s{2,}/)
          if (parts.length >= 4) list.push({ name: parts[0].trim(), path: parts[1].trim(), type: parts[2].trim(), capacity: parts[3].trim(), allocation: parts[4] ? parts[4].trim() : '' })
        }
        volumes.value = list
      } finally {
        volLoading.value = false
      }
    }

    // ── 虚拟网络 ──
    async function loadNetworks() {
      netLoading.value = true
      try {
        var r = await exec('virsh net-list --all 2>/dev/null')
        if (r.code !== 0) { networks.value = []; return }
        var lines = r.stdout.trim().split('\n')
        var list = []
        for (var i = 2; i < lines.length; i++) {
          var parts = lines[i].trim().split(/\s+/)
          if (parts.length >= 4) list.push({ name: parts[0], state: parts[1], autostart: parts[2], persistent: parts[3] })
        }
        networks.value = list
      } finally {
        netLoading.value = false
      }
    }

    async function netAction(name, action) {
      var r = await exec('virsh net-' + action + ' ' + name + ' 2>&1')
      if (r.code === 0) showMessage(name + ' ' + action + ' 成功', 'success')
      else showMessage((r.stdout || '').trim() || action + ' 失败', 'error')
      await loadNetworks()
    }

    async function showNetDetail(name) {
      netDetailName.value = name
      netDetailXml.value = '加载中...'
      netDetailVisible.value = true
      var r = await exec('virsh net-dumpxml ' + name + ' 2>/dev/null')
      netDetailXml.value = (r.stdout || '').trim() || '(无数据)'
    }

    // ── 宿主机 ──
    async function loadHostInfo() {
      hostInfo.value = '加载中...'
      var r = await exec('virsh nodeinfo 2>/dev/null')
      var r2 = await exec('virsh version 2>/dev/null')
      hostInfo.value = '--- Node Info ---\n' + ((r.stdout || '').trim() || '(无数据)') + '\n\n--- Version ---\n' + ((r2.stdout || '').trim() || '(无数据)')
    }

    // ── 创建虚拟机 ──
    function openCreateDialog() {
      createForm.name = ''
      createForm.vcpus = 2
      createForm.memory = 2048
      createForm.diskSize = 20
      createForm.isoPath = ''
      createForm.network = 'default'
      createForm.osVariant = ''
      createVisible.value = true
      if (networks.value.length === 0) loadNetworks()
    }

    async function doCreateVm() {
      var name = createForm.name.trim()
      if (!name) { showMessage('请输入虚拟机名称', 'warning'); return }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) { showMessage('名称只能包含字母、数字、点、下划线、连字符，且以字母数字开头', 'warning'); return }
      creating.value = true
      try {
        var cmd = 'virt-install --name ' + name +
          ' --vcpus ' + createForm.vcpus +
          ' --memory ' + createForm.memory +
          ' --disk size=' + createForm.diskSize +
          ' --network network=' + createForm.network
        if (createForm.isoPath.trim()) cmd += ' --cdrom ' + createForm.isoPath.trim()
        else cmd += ' --import --boot hd'
        if (createForm.osVariant.trim()) cmd += ' --os-variant ' + createForm.osVariant.trim()
        cmd += ' --graphics vnc,listen=0.0.0.0 --noautoconsole 2>&1'
        var r = await exec(cmd)
        if (r.code === 0) {
          showMessage('虚拟机「' + name + '」创建成功', 'success')
          createVisible.value = false
          await loadVms()
        } else {
          showMessage((r.stdout || '').trim() || '创建失败', 'error')
        }
      } finally {
        creating.value = false
      }
    }

    // ── 刷新 ──
    async function refreshAll() {
      await loadVms()
      if (activeTab.value === 'pools') await loadPools()
      if (activeTab.value === 'networks') await loadNetworks()
    }

    watch(function () { return activeTab.value }, function (tab) {
      if (tab === 'pools' && pools.value.length === 0) loadPools()
      if (tab === 'networks' && networks.value.length === 0) loadNetworks()
      if (tab === 'host' && !hostInfo.value) loadHostInfo()
    })

    watch(function () { return props.profileId }, function () {
      checkDone.value = false
      installed.value = false
      vms.value = []
      pools.value = []
      networks.value = []
      hostInfo.value = ''
      checkVirsh().then(function () {
        if (installed.value) loadVms()
      })
    })

    onMounted(function () {
      checkVirsh().then(function () {
        if (installed.value) loadVms()
      })
    })

    return {
      RefreshIcon: RefreshIcon,
      SearchIcon: SearchIcon,
      WarningIcon: WarningIcon,
      DeleteIcon: DeleteIcon,
      PlusIcon: PlusIcon,
      checkDone: checkDone,
      installed: installed,
      virshVersion: virshVersion,
      loading: loading,
      activeTab: activeTab,
      vms: vms,
      vmSearch: vmSearch,
      vmFilter: vmFilter,
      filteredVms: filteredVms,
      stateTagType: stateTagType,
      stateLabel: stateLabel,
      vmAction: vmAction,
      vmForceOff: vmForceOff,
      vmDelete: vmDelete,
      checkVirsh: checkVirsh,
      refreshAll: refreshAll,
      openDetail: openDetail,
      detailVisible: detailVisible,
      detailVm: detailVm,
      detailTab: detailTab,
      detailInfo: detailInfo,
      detailDisks: detailDisks,
      detailNics: detailNics,
      detailXml: detailXml,
      consoleLog: consoleLog,
      copyXml: copyXml,
      loadConsoleLog: loadConsoleLog,
      openSnapshots: openSnapshots,
      snapVisible: snapVisible,
      snapVm: snapVm,
      snapshots: snapshots,
      snapLoading: snapLoading,
      snapCreating: snapCreating,
      newSnapName: newSnapName,
      newSnapDesc: newSnapDesc,
      createSnapshot: createSnapshot,
      revertSnapshot: revertSnapshot,
      deleteSnapshot: deleteSnapshot,
      pools: pools,
      poolLoading: poolLoading,
      selectedPool: selectedPool,
      volumes: volumes,
      volLoading: volLoading,
      loadPools: loadPools,
      poolAction: poolAction,
      loadVolumes: loadVolumes,
      networks: networks,
      netLoading: netLoading,
      netDetailVisible: netDetailVisible,
      netDetailName: netDetailName,
      netDetailXml: netDetailXml,
      loadNetworks: loadNetworks,
      netAction: netAction,
      showNetDetail: showNetDetail,
      hostInfo: hostInfo,
      loadHostInfo: loadHostInfo,
      createVisible: createVisible,
      creating: creating,
      createForm: createForm,
      openCreateDialog: openCreateDialog,
      doCreateVm: doCreateVm,
    }
  },
}

})(this, Vue, ref, reactive, computed, watch, watchEffect, onMounted, onBeforeUnmount, onUnmounted, nextTick, toRef, toRefs, shallowRef, triggerRef, provide, inject, h, defineComponent, Icons, useRemoteConfig);
