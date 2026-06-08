<template>
  <div class="grid gap-2">
    <div v-for="(row, index) in rows" :key="index" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_40px] gap-2">
      <el-input v-model="row.key" placeholder="Key" @input="emitRows" />
      <el-input v-model="row.value" placeholder="Value" @input="emitRows" />
      <el-button :icon="Delete" plain @click="removeRow(index)" />
    </div>
    <div>
      <el-button :icon="Plus" plain @click="addRow">添加一行</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])
const rows = ref(normalizeRows(props.modelValue))

watch(() => props.modelValue, (value) => {
  rows.value = normalizeRows(value)
}, { deep: true })

function normalizeRows(value) {
  const nextRows = Array.isArray(value) ? value.map((row) => ({
    key: String(row?.key || ''),
    value: String(row?.value ?? ''),
  })) : []
  return nextRows.length > 0 ? nextRows : [{ key: '', value: '' }]
}

function emitRows() {
  emit('update:modelValue', rows.value.map((row) => ({ ...row })))
}

function addRow() {
  rows.value.push({ key: '', value: '' })
  emitRows()
}

function removeRow(index) {
  rows.value.splice(index, 1)
  if (rows.value.length === 0) rows.value.push({ key: '', value: '' })
  emitRows()
}
</script>
