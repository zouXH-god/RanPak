<template>
  <div class="h-full min-h-0 overflow-auto bg-[#f8fafc] px-4 pb-4">
    <div class="mx-auto flex max-w-[1400px] flex-col gap-4">
      <header class="task-flow-header">
        <div>
          <h1 class="text-xl font-bold text-gray-900">任务流助手</h1>
          <p class="mt-1 text-sm text-gray-500">以思维导图方式组织任务节点，一个节点可分支出多个子节点。</p>
        </div>
        <el-button :icon="Plus" type="primary" @click="createFlow">新建任务流</el-button>
      </header>

      <div class="task-flow-layout">
        <aside class="flow-list-panel">
          <div class="flow-list-title">任务流列表</div>
          <div class="flow-list">
            <button
              v-for="flow in flows"
              :key="flow.id"
              class="flow-item"
              :class="flow.id === activeFlowId ? 'is-active' : ''"
              @click="activeFlowId = flow.id"
            >
              <span class="flow-item-name">{{ flow.name || '未命名任务流' }}</span>
              <span class="flow-item-count">{{ countNodes(flow.nodes) }} 节点</span>
            </button>
            <el-empty v-if="flows.length === 0" description="暂无任务流" :image-size="60" />
          </div>

          <div class="color-config">
            <div class="color-config-title">弹窗外观</div>
            <div class="color-row">
              <span class="color-label">背景色</span>
              <el-color-picker v-model="overlayConfig.backgroundColor" show-alpha size="small" @change="saveOverlayConfig" />
            </div>
            <div class="color-row">
              <span class="color-label">字体色</span>
              <el-color-picker v-model="overlayConfig.fontColor" size="small" @change="saveOverlayConfig" />
            </div>
          </div>
        </aside>

        <section class="flow-editor-panel">
          <template v-if="activeFlow">
            <div class="flow-editor-head">
              <el-input
                v-model="activeFlow.name"
                class="flow-name-input"
                placeholder="任务流名称"
                @change="saveFlows"
              />
              <div class="flex gap-2">
                <el-button :icon="CaretRight" type="primary" :disabled="activeFlow.nodes.length === 0" @click="startFlow">开始任务</el-button>
                <el-button :icon="Delete" type="danger" plain @click="deleteFlow">删除</el-button>
              </div>
            </div>

            <div v-if="isLinking" class="linking-banner">
              <span class="linking-banner-dot" />
              <span>正在为「{{ linkingSourceName }}」选择下一步，点击目标节点完成链接。</span>
              <el-button text size="small" @click="cancelLinking">取消</el-button>
            </div>

            <div ref="canvasRef" class="mindmap-canvas" :class="{ 'is-linking': isLinking }">
              <div v-if="activeFlow.nodes.length === 0" class="mindmap-empty">
                <el-empty description="暂无节点，点击下方按钮添加根节点" :image-size="48" />
              </div>
              <div v-else ref="treeRef" class="mindmap-tree">
                <MindMapNode
                  v-for="node in activeFlow.nodes"
                  :key="node.id"
                  :node="node"
                  :depth="0"
                />
                <svg class="mm-link-layer" :style="linkLayerStyle">
                  <path
                    v-for="line in linkLines"
                    :key="line.id"
                    :d="line.path"
                    class="mm-link-path"
                  />
                </svg>
                <div class="mm-link-buttons">
                  <button
                    v-for="line in linkLines"
                    :key="`${line.id}-btn`"
                    type="button"
                    class="mm-link-del"
                    :class="{ 'is-disabled': !line.deletable }"
                    :style="{ left: `${line.mx}px`, top: `${line.my}px` }"
                    :title="line.deletable ? '删除该连接' : '该节点仅剩一条连接，不能删除'"
                    @click="onDeleteLink(line)"
                  >
                    <el-icon><Close /></el-icon>
                  </button>
                </div>
              </div>
            </div>

            <div class="flow-editor-footer">
              <el-button :icon="Plus" plain @click="addRootNode">新增根节点</el-button>
              <div class="flex-1" />
              <el-dropdown trigger="click" @command="exportFlow">
                <el-button :icon="Upload" plain size="small">导出</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="txt">导出为 Text</el-dropdown-item>
                    <el-dropdown-item command="md">导出为 Markdown</el-dropdown-item>
                    <el-dropdown-item command="docx">导出为 Word</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button :icon="Download" plain size="small" @click="importFlow">导入</el-button>
            </div>
          </template>

          <div v-else class="flow-empty-editor">
            <div class="flow-empty-icon"><el-icon><List /></el-icon></div>
            <h3>选择或新建任务流</h3>
            <p>从左侧选择一个任务流进行编辑，或点击「新建任务流」开始创建。</p>
          </div>
        </section>
      </div>
    </div>

    <el-dialog v-model="editDialogVisible" title="编辑节点" width="860px" top="6vh" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="节点名称">
          <el-input v-model="editForm.name" placeholder="节点标题（思维导图中展示的文字）" />
        </el-form-item>
        <el-form-item label="节点内容">
          <RichTextEditor v-model="editForm.content" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEditNode">保存</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick, provide } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { persistentStorage } from '../utils/sqliteStorage'
import { Plus, Delete, CaretRight, List, Upload, Download, Close } from '@element-plus/icons-vue'
import MindMapNode from '../components/MindMapNode.vue'
import RichTextEditor from '../components/RichTextEditor.vue'

const STORAGE_KEY = 'ran-pak-task-flows'
const flows = ref([])
const activeFlowId = ref('')

const editDialogVisible = ref(false)
const editingNode = ref(null)
const editForm = reactive({ name: '', content: '' })

const linkingSourceId = ref('')
const linkingSourceName = computed(() => nodeMap.value[linkingSourceId.value]?.name || '该节点')
const isLinking = computed(() => Boolean(linkingSourceId.value))

const overlayConfig = reactive({
  backgroundColor: 'rgba(15, 23, 42, 0.82)',
  fontColor: '#f1f5f9',
})

const activeFlow = computed(() => flows.value.find((f) => f.id === activeFlowId.value) || null)

const nodeMap = computed(() => {
  const map = {}
  const walk = (list) => (list || []).forEach((node) => { map[node.id] = node; walk(node.children) })
  if (activeFlow.value) walk(activeFlow.value.nodes)
  return map
})

function resolveNode(id) {
  return nodeMap.value[id] || null
}

provide('mindmapActions', {
  edit: openEditNode,
  addChild: addChildNode,
  remove: removeNode,
  linkNext: startLinking,
  onNodeClick: onNodeClickInLinking,
  resolveNode,
  linkingSourceId,
})

const canvasRef = ref(null)
const treeRef = ref(null)
const linkLines = ref([])
const linkLayer = reactive({ width: 0, height: 0 })
const linkLayerStyle = computed(() => ({ width: `${linkLayer.width}px`, height: `${linkLayer.height}px` }))
let linkResizeObserver = null

const layoutSignature = computed(() => {
  if (!activeFlow.value) return ''
  const serialize = (list) => (list || [])
    .map((node) => `${node.id}:${node.name}:[${(node.linkIds || []).join(',')}]:(${serialize(node.children)})`)
    .join('|')
  return serialize(activeFlow.value.nodes)
})

function incomingCount(id) {
  if (!activeFlow.value) return 0
  const isRoot = activeFlow.value.nodes.some((node) => node.id === id)
  let count = isRoot ? 0 : 1
  Object.values(nodeMap.value).forEach((node) => {
    if ((node.linkIds || []).includes(id)) count += 1
  })
  return count
}

function computeLinkLines() {
  const tree = treeRef.value
  if (!tree || !activeFlow.value) {
    linkLines.value = []
    return
  }
  const treeRect = tree.getBoundingClientRect()
  const lines = []
  Object.values(nodeMap.value).forEach((source) => {
    ;(source.linkIds || []).forEach((targetId) => {
      // 连线从该链接的「行槽」引出，行槽已在子节点列预留独立位置
      const anchorEl = tree.querySelector(`[data-link-anchor="${CSS.escape(`${source.id}|${targetId}`)}"]`)
      const targetEl = tree.querySelector(`[data-node-id="${CSS.escape(targetId)}"]`)
      if (!anchorEl || !targetEl) return
      const a = anchorEl.getBoundingClientRect()
      const t = targetEl.getBoundingClientRect()
      const sx = a.right - treeRect.left
      const sy = a.top + a.height / 2 - treeRect.top
      const targetCenterX = t.left + t.width / 2 - treeRect.left
      const targetCenterY = t.top + t.height / 2 - treeRect.top
      // 源在目标上方则接入顶部中心，否则接入底部中心
      const fromAbove = sy <= targetCenterY
      const tx = targetCenterX
      const ty = fromAbove ? (t.top - treeRect.top) : (t.bottom - treeRect.top)
      lines.push({
        id: `${source.id}->${targetId}`,
        sourceId: source.id,
        targetId,
        // 行槽 → 水平出线 → 在目标中心列竖直接入目标的上/下侧中心
        path: `M ${sx},${sy} L ${tx},${sy} L ${tx},${ty}`,
        // X 放在靠源一侧的横线中点
        mx: (sx + tx) / 2,
        my: sy,
        deletable: incomingCount(targetId) > 1,
      })
    })
  })
  linkLines.value = lines
  linkLayer.width = tree.scrollWidth
  linkLayer.height = tree.scrollHeight
}

function scheduleRelayout() {
  nextTick(() => requestAnimationFrame(computeLinkLines))
}

function onDeleteLink(line) {
  if (!line.deletable) {
    ElMessage.warning('该节点仅剩一条连接，无法删除')
    return
  }
  const source = nodeMap.value[line.sourceId]
  if (source && Array.isArray(source.linkIds)) {
    source.linkIds = source.linkIds.filter((id) => id !== line.targetId)
    saveFlows()
    scheduleRelayout()
  }
}

watch(layoutSignature, scheduleRelayout)
watch(activeFlowId, scheduleRelayout)

onMounted(async () => {
  loadFlows()
  window.addEventListener('keydown', onLinkingKeyDown)
  window.addEventListener('resize', scheduleRelayout)
  linkResizeObserver = new ResizeObserver(() => scheduleRelayout())
  if (canvasRef.value) linkResizeObserver.observe(canvasRef.value)
  const config = await window.electronAPI?.getTaskFlowConfig?.()
  if (config) {
    overlayConfig.backgroundColor = config.backgroundColor || overlayConfig.backgroundColor
    overlayConfig.fontColor = config.fontColor || overlayConfig.fontColor
  }
  scheduleRelayout()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onLinkingKeyDown)
  window.removeEventListener('resize', scheduleRelayout)
  linkResizeObserver?.disconnect()
})

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function normalizeNode(node = {}) {
  return {
    id: node.id || createId(),
    name: node.name || '',
    content: node.content != null ? node.content : (node.description ? escapeHtml(node.description) : ''),
    children: Array.isArray(node.children) ? node.children.map(normalizeNode) : [],
    linkIds: Array.isArray(node.linkIds) ? node.linkIds.filter((id) => typeof id === 'string') : [],
  }
}

function loadFlows() {
  try {
    const raw = persistentStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    flows.value = parsed.map((flow) => ({
      id: flow.id || createId(),
      name: flow.name || '',
      createdAt: flow.createdAt || new Date().toISOString(),
      nodes: Array.isArray(flow.nodes) ? flow.nodes.map(normalizeNode) : [],
    }))
  } catch {
    flows.value = []
  }
}

function saveFlows() {
  persistentStorage.setItem(STORAGE_KEY, JSON.stringify(flows.value))
  syncActiveFlowToOverlay()
}

function countNodes(nodes = []) {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children || []), 0)
}

function syncActiveFlowToOverlay() {
  if (!activeFlow.value) return
  window.electronAPI?.syncTaskFlowNodes?.({
    flowId: activeFlow.value.id,
    flowName: activeFlow.value.name,
    nodes: cloneNodes(activeFlow.value.nodes),
  })
}

function cloneNodes(nodes = []) {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    content: node.content || '',
    children: cloneNodes(node.children || []),
    linkIds: Array.isArray(node.linkIds) ? [...node.linkIds] : [],
  }))
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function createBlankNode() {
  return { id: createId(), name: '', content: '', children: [], linkIds: [] }
}

function createFlow() {
  const flow = { id: createId(), name: '', createdAt: new Date().toISOString(), nodes: [] }
  flows.value.push(flow)
  activeFlowId.value = flow.id
  saveFlows()
}

async function deleteFlow() {
  if (!activeFlow.value) return
  const confirmed = await ElMessageBox.confirm('确定删除该任务流？', '删除', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  flows.value = flows.value.filter((f) => f.id !== activeFlowId.value)
  activeFlowId.value = flows.value[0]?.id || ''
  saveFlows()
}

function addRootNode() {
  if (!activeFlow.value) return
  const node = createBlankNode()
  activeFlow.value.nodes.push(node)
  saveFlows()
  openEditNode(node)
}

function addChildNode(parent) {
  const node = createBlankNode()
  parent.children.push(node)
  saveFlows()
  openEditNode(node)
}

function findAndRemove(nodes, id) {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) {
    nodes.splice(index, 1)
    return true
  }
  return nodes.some((node) => findAndRemove(node.children || [], id))
}

function collectIds(node) {
  const ids = [node.id]
  ;(node.children || []).forEach((child) => ids.push(...collectIds(child)))
  return ids
}

function pruneLinks(list, removedIds) {
  ;(list || []).forEach((node) => {
    if (Array.isArray(node.linkIds)) node.linkIds = node.linkIds.filter((id) => !removedIds.includes(id))
    pruneLinks(node.children || [], removedIds)
  })
}

async function removeNode(node) {
  const childCount = countNodes(node.children || [])
  const tip = childCount > 0 ? `该节点包含 ${childCount} 个子节点，删除后将一并移除，确定继续？` : '确定删除该节点？'
  const confirmed = await ElMessageBox.confirm(tip, '删除节点', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  if (!activeFlow.value) return
  const removedIds = collectIds(node)
  findAndRemove(activeFlow.value.nodes, node.id)
  pruneLinks(activeFlow.value.nodes, removedIds)
  saveFlows()
}

function descendantIds(node) {
  const ids = new Set()
  const walk = (list) => (list || []).forEach((child) => { ids.add(child.id); walk(child.children) })
  walk(node.children)
  return ids
}

function ancestorIds(targetId) {
  const result = new Set()
  const dfs = (list, chain) => {
    for (const node of list || []) {
      if (node.id === targetId) {
        chain.forEach((id) => result.add(id))
        return true
      }
      if (dfs(node.children || [], [...chain, node.id])) return true
    }
    return false
  }
  if (activeFlow.value) dfs(activeFlow.value.nodes, [])
  return result
}

function startLinking(node) {
  linkingSourceId.value = node.id
  ElMessage.info('请点击要作为「下一步」的节点（按 Esc 取消）')
}

function cancelLinking() {
  linkingSourceId.value = ''
}

function onNodeClickInLinking(node) {
  if (!linkingSourceId.value) return
  const source = nodeMap.value[linkingSourceId.value]
  if (!source) {
    cancelLinking()
    return
  }
  const targetId = node.id
  if (targetId === source.id) {
    ElMessage.warning('不能链接到自身')
    return
  }
  if (descendantIds(source).has(targetId)) {
    ElMessage.warning('不能链接到自己的子孙节点')
    return
  }
  if (ancestorIds(source.id).has(targetId)) {
    ElMessage.warning('不能链接到自己的上级节点（会形成循环）')
    return
  }
  if (!Array.isArray(source.linkIds)) source.linkIds = []
  if (source.linkIds.includes(targetId)) {
    ElMessage.warning('已链接到该节点')
    return
  }
  source.linkIds.push(targetId)
  saveFlows()
  ElMessage.success(`已将「${node.name || '未命名节点'}」设为「${source.name || '未命名节点'}」的下一步`)
  cancelLinking()
}

function onLinkingKeyDown(event) {
  if (event.key === 'Escape' && linkingSourceId.value) cancelLinking()
}

function openEditNode(node) {
  editingNode.value = node
  editForm.name = node.name || ''
  editForm.content = node.content || ''
  editDialogVisible.value = true
}

function saveEditNode() {
  if (editingNode.value) {
    editingNode.value.name = editForm.name
    editingNode.value.content = editForm.content
    saveFlows()
  }
  editDialogVisible.value = false
}

function saveOverlayConfig() {
  window.electronAPI?.updateTaskFlowConfig?.({
    backgroundColor: overlayConfig.backgroundColor,
    fontColor: overlayConfig.fontColor,
  })
}

function startFlow() {
  if (!activeFlow.value || activeFlow.value.nodes.length === 0) {
    ElMessage.warning('当前任务流没有节点')
    return
  }
  window.electronAPI?.openTaskFlowWindow?.({
    flowId: activeFlow.value.id,
    flowName: activeFlow.value.name,
    nodes: cloneNodes(activeFlow.value.nodes),
    currentPath: [],
  })
}

async function exportFlow(format) {
  if (!activeFlow.value) return
  const flow = {
    name: activeFlow.value.name,
    nodes: cloneNodes(activeFlow.value.nodes),
  }
  const result = await window.electronAPI?.exportTaskFlow?.({ flow, format })
  if (result?.ok) {
    ElMessage.success('导出成功')
  } else if (result?.error && result.error !== '已取消') {
    ElMessage.error(result.error)
  }
}

async function importFlow() {
  const result = await window.electronAPI?.importTaskFlow?.({})
  if (!result?.ok) {
    if (result?.error && result.error !== '已取消') ElMessage.error(result.error)
    return
  }
  const { name, nodes } = result.data
  if (!nodes || nodes.length === 0) {
    ElMessage.warning('未解析到有效节点')
    return
  }
  const flow = {
    id: createId(),
    name: name || '导入的任务流',
    createdAt: new Date().toISOString(),
    nodes: nodes.map(normalizeNode),
  }
  flows.value.push(flow)
  activeFlowId.value = flow.id
  saveFlows()
  ElMessage.success(`已导入「${flow.name}」，共 ${countNodes(flow.nodes)} 个节点`)
}
</script>

<style scoped>
.task-flow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-radius: 18px;
  border: 1px solid rgba(226,232,240,.82);
  background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,250,252,.92));
  padding: 16px 20px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
}
.task-flow-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  min-height: 600px;
}
.flow-list-panel {
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.flow-list-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}
.flow-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}
.flow-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  text-align: left;
  font-size: 13px;
  color: #334155;
  transition: background .15s, border-color .15s, transform .15s;
}
.flow-item:hover { background: #f1f5f9; transform: translateX(2px); }
.flow-item.is-active {
  border-color: rgba(37,99,235,.3);
  background: rgba(239,246,255,.8);
  color: #1d4ed8;
  font-weight: 600;
}
.flow-item-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flow-item-count { font-size: 11px; color: #94a3b8; flex-shrink: 0; }
.color-config {
  border-top: 1px solid rgba(226,232,240,.8);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.color-config-title {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}
.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.color-label {
  font-size: 12px;
  color: #64748b;
}
.flow-editor-panel {
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 18px;
  background: #ffffff;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.flow-editor-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.flow-name-input { flex: 1; }
.flow-name-input :deep(.el-input__wrapper) { border-radius: 10px; font-size: 16px; font-weight: 600; }
.mindmap-canvas {
  flex: 1;
  overflow: auto;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  border-radius: 16px;
  background:
    linear-gradient(135deg, #ffffff, #f8fafc),
    radial-gradient(circle at 16px 16px, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: cover, 28px 28px;
  padding: 24px;
  min-height: 360px;
}
.mindmap-empty {
  display: grid;
  place-items: center;
  min-height: 320px;
}
.mindmap-tree {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  min-width: 100%;
}
.mm-link-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 1;
}
.mm-link-path {
  fill: none;
  stroke: #6366f1;
  stroke-width: 2;
  stroke-dasharray: 6 5;
  opacity: 0.85;
}
.mm-link-buttons {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}
.mm-link-del {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(99, 102, 241, 0.5);
  border-radius: 999px;
  background: #ffffff;
  color: #6366f1;
  font-size: 12px;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
  transition: background 0.15s, color 0.15s, transform 0.15s;
}
.mm-link-del:hover {
  background: #6366f1;
  color: #ffffff;
  transform: translate(-50%, -50%) scale(1.12);
}
.mm-link-del.is-disabled {
  border-color: rgba(148, 163, 184, 0.5);
  color: #cbd5e1;
  cursor: not-allowed;
}
.mm-link-del.is-disabled:hover {
  background: #ffffff;
  color: #cbd5e1;
  transform: translate(-50%, -50%);
}
.flow-editor-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}
.flow-empty-editor {
  display: grid;
  min-height: 400px;
  align-content: center;
  justify-items: center;
  gap: 10px;
  border: 1px dashed rgba(148,163,184,.5);
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  padding: 24px;
  text-align: center;
}
.flow-empty-editor h3 { margin: 0; color: #0f172a; font-size: 18px; font-weight: 700; }
.flow-empty-editor p { max-width: 320px; margin: 0; color: #64748b; font-size: 13px; }
.flow-empty-icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 16px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 24px;
}
.linking-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid rgba(37, 99, 235, 0.35);
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 500;
}
.linking-banner-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
  animation: linking-pulse 1.2s ease-in-out infinite;
}
@keyframes linking-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.mindmap-canvas.is-linking :deep(.mm-self) {
  cursor: crosshair;
}
</style>
