<template>
  <div class="h-full min-h-0 overflow-auto bg-[#f8fafc] px-4 pb-4">
    <div class="mx-auto flex max-w-[1400px] flex-col gap-4">
      <header class="task-flow-header">
        <div>
          <h1 class="text-xl font-bold text-gray-900">任务流助手</h1>
          <p class="mt-1 text-sm text-gray-500">创建和管理任务流程，逐步执行节点。</p>
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
              <span class="flow-item-count">{{ flow.nodes.length }} 步</span>
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

            <div class="node-list">
              <div
                v-for="(node, index) in activeFlow.nodes"
                :key="node.id"
                class="node-card"
                draggable="true"
                @dragstart="onNodeDragStart(index)"
                @dragover.prevent="onNodeDragOver(index)"
                @drop.prevent="onNodeDrop(index)"
                @dragend="dragIndex = -1"
              >
                <div class="node-card-header">
                  <span class="node-index">{{ index + 1 }}</span>
                  <el-input
                    v-model="node.name"
                    class="node-name-input"
                    placeholder="节点名称"
                    @change="saveFlows"
                  />
                  <el-button :icon="Delete" text type="danger" size="small" @click="removeNode(index)" />
                </div>
                <el-input
                  v-model="node.description"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 6 }"
                  placeholder="详细描述（可选）"
                  @change="saveFlows"
                />
              </div>
              <el-empty v-if="activeFlow.nodes.length === 0" description="暂无节点，点击下方按钮添加" :image-size="48" />
            </div>

            <div class="flow-editor-footer">
              <el-button :icon="Plus" plain @click="addNode">新增节点</el-button>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, CaretRight, List, Upload, Download } from '@element-plus/icons-vue'

const STORAGE_KEY = 'ran-pak-task-flows'
const flows = ref([])
const activeFlowId = ref('')
const dragIndex = ref(-1)

const overlayConfig = reactive({
  backgroundColor: 'rgba(15, 23, 42, 0.82)',
  fontColor: '#f1f5f9',
})

const activeFlow = computed(() => flows.value.find((f) => f.id === activeFlowId.value) || null)

onMounted(async () => {
  loadFlows()
  const config = await window.electronAPI?.getTaskFlowConfig?.()
  if (config) {
    overlayConfig.backgroundColor = config.backgroundColor || overlayConfig.backgroundColor
    overlayConfig.fontColor = config.fontColor || overlayConfig.fontColor
  }
})

function loadFlows() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    flows.value = raw ? JSON.parse(raw) : []
  } catch {
    flows.value = []
  }
}

function saveFlows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flows.value))
  syncActiveFlowToOverlay()
}

function syncActiveFlowToOverlay() {
  if (!activeFlow.value) return
  window.electronAPI?.syncTaskFlowNodes?.({
    flowId: activeFlow.value.id,
    flowName: activeFlow.value.name,
    nodes: activeFlow.value.nodes.map((n) => ({ name: n.name, description: n.description })),
  })
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
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

function addNode() {
  if (!activeFlow.value) return
  activeFlow.value.nodes.push({ id: createId(), name: '', description: '' })
  saveFlows()
}

function removeNode(index) {
  if (!activeFlow.value) return
  activeFlow.value.nodes.splice(index, 1)
  saveFlows()
}

function onNodeDragStart(index) {
  dragIndex.value = index
}

function onNodeDragOver(index) {
  if (dragIndex.value < 0 || dragIndex.value === index) return
  const nodes = activeFlow.value.nodes
  const dragged = nodes.splice(dragIndex.value, 1)[0]
  nodes.splice(index, 0, dragged)
  dragIndex.value = index
}

function onNodeDrop() {
  dragIndex.value = -1
  saveFlows()
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
    nodes: activeFlow.value.nodes.map((n) => ({ name: n.name, description: n.description })),
    currentIndex: 0,
  })
}

async function exportFlow(format) {
  if (!activeFlow.value) return
  const flow = {
    name: activeFlow.value.name,
    nodes: activeFlow.value.nodes.map((n) => ({ name: n.name, description: n.description })),
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
    nodes: nodes.map((n) => ({ id: createId(), name: n.name || '', description: n.description || '' })),
  }
  flows.value.push(flow)
  activeFlowId.value = flow.id
  saveFlows()
  ElMessage.success(`已导入「${flow.name}」，共 ${nodes.length} 个节点`)
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
.node-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
}
.node-card {
  border: 1px solid rgba(226,232,240,.85);
  border-radius: 14px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: grab;
  transition: border-color .15s, box-shadow .15s;
}
.node-card:hover {
  border-color: rgba(37,99,235,.3);
  box-shadow: 0 8px 20px rgba(15,23,42,.05);
}
.node-card:active { cursor: grabbing; opacity: 0.7; }
.node-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.node-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.node-name-input { flex: 1; }
.node-name-input :deep(.el-input__wrapper) { border-radius: 8px; }
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
</style>
