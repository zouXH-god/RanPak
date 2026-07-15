<template>
  <div class="mm-node">
    <div class="mm-self-wrap" :class="{ 'has-children': hasOutgoing }">
      <div
        class="mm-self"
        :class="{ 'is-root': depth === 0, 'is-link-source': isLinkSource }"
        :data-node-id="node.id"
        @click="actions.onNodeClick(node)"
        @dblclick="actions.edit(node)"
      >
        <span class="mm-title">{{ node.name || '未命名节点' }}</span>
        <span v-if="childCount" class="mm-badge">{{ childCount }}</span>
        <div class="mm-actions">
          <button type="button" class="mm-action" title="编辑" @click.stop="actions.edit(node)">
            <el-icon><EditPen /></el-icon>
          </button>
          <button type="button" class="mm-action" title="添加子节点" @click.stop="actions.addChild(node)">
            <el-icon><Plus /></el-icon>
          </button>
          <button type="button" class="mm-action" title="链接下一步（合并到已有节点）" @click.stop="actions.linkNext(node)">
            <el-icon><Connection /></el-icon>
          </button>
          <button type="button" class="mm-action is-danger" title="删除" @click.stop="actions.remove(node)">
            <el-icon><Delete /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <div v-if="hasOutgoing" class="mm-children">
      <MindMapNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
      />
      <!-- 每个链接占用一个独立的行槽，连线从此槽引出，避免与子节点重叠 -->
      <div v-for="linkId in (node.linkIds || [])" :key="`slot-${linkId}`" class="mm-node">
        <div class="mm-self-wrap">
          <div class="mm-link-slot" :data-link-anchor="`${node.id}|${linkId}`" :title="`链接到：${linkTitle(linkId)}`">
            <span class="mm-link-dot" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, computed } from 'vue'
import { EditPen, Plus, Delete, Connection } from '@element-plus/icons-vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
})

const actions = inject('mindmapActions')

const isLinkSource = computed(() => actions?.linkingSourceId?.value === props.node.id)

const childCount = computed(() => (props.node.children?.length || 0) + (props.node.linkIds?.length || 0))
const hasOutgoing = computed(() => childCount.value > 0)

function linkTitle(linkId) {
  return actions?.resolveNode?.(linkId)?.name || '未命名节点'
}
</script>

<style scoped>
.mm-node {
  display: flex;
  align-items: center;
}
.mm-self-wrap {
  display: flex;
  align-items: center;
  position: relative;
  padding: 6px 0;
}
.mm-self {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 168px;
  height: 42px;
  padding: 8px 14px;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.05);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  white-space: nowrap;
}
.mm-self:hover {
  border-color: rgba(37, 99, 235, 0.5);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}
.mm-self.is-root {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.28);
}
.mm-self.is-link-source {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35), 0 10px 24px rgba(37, 99, 235, 0.16);
}
.mm-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mm-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
}
.mm-self.is-root .mm-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.mm-actions {
  position: absolute;
  left: 50%;
  bottom: 100%;
  margin-bottom: 6px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}
/* 透明桥接：填补按钮与节点之间的空隙，避免鼠标经过时 hover 中断 */
.mm-actions::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  height: 12px;
}
.mm-self-wrap:hover .mm-actions,
.mm-actions:hover {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
.mm-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.mm-action:hover { background: #eff6ff; color: #2563eb; }
.mm-action.is-danger:hover { background: #fef2f2; color: #dc2626; }

/* 连接线 */
.mm-children {
  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 40px;
}
/* 父节点到竖直母线的连接桩（从节点中心引出） */
.mm-self-wrap.has-children::after {
  content: "";
  position: absolute;
  right: -20px;
  top: 50%;
  width: 20px;
  height: 2px;
  background: rgba(148, 163, 184, 0.6);
}
.mm-children > .mm-node {
  position: relative;
}
/* 子节点的水平连接线 */
.mm-children > .mm-node::before {
  content: "";
  position: absolute;
  left: -20px;
  top: 50%;
  width: 20px;
  height: 2px;
  background: rgba(148, 163, 184, 0.6);
}
/* 竖直母线段 */
.mm-children > .mm-node::after {
  content: "";
  position: absolute;
  left: -20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(148, 163, 184, 0.6);
}
.mm-children > .mm-node:first-child::after { top: 50%; }
.mm-children > .mm-node:last-child::after { bottom: 50%; }
.mm-children > .mm-node:only-child::after { display: none; }

/* 链接行槽：占用一个与节点同高的位置，连线从这里引出 */
.mm-link-slot {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 42px;
  padding: 0 6px;
}
.mm-link-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
</style>
