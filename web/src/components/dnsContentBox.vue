<script setup>
/**
 * DNS 解析记录编辑组件
 * 支持新增和修改解析记录
 */
import {ref} from "vue";
import {addDomainRecord, record_type_list, updateDomainRecord} from "../utils/api/dns.ts";
import {ElMessage} from "element-plus";

const props = defineProps({
  account: { type: String, default: '' },
  domainId: { type: String, default: '' },
  domain: { type: String, default: '' },
  record_id: { type: String, default: '' },
  rr: { type: String, default: '' },
  record_type: { type: String, default: '' },
  value: { type: String, default: '' },
  line: { type: String, default: '' },
  close: { type: Function },
})

const rr = ref(props.rr)
const record_type = ref(props.record_type)
const value = ref(props.value)
const line = ref(props.line)

/** 提交表单，根据 record_id 判断是新增还是修改 */
const submit = () => {
  const isAdd = props.record_id === ''
  const apiCall = isAdd
    ? addDomainRecord(props.account, {
        domainId: props.domainId,
        domain: props.domain,
        rr: rr.value,
        record_type: record_type.value,
        value: value.value,
        line: line.value
      })
    : updateDomainRecord(props.account, {
        domainId: props.domainId,
        domain: props.domain,
        record_id: props.record_id,
        rr: rr.value,
        record_type: record_type.value,
        value: value.value,
        line: line.value
      })

  apiCall.then((res) => {
    if (res) {
      ElMessage.success(isAdd ? '添加成功' : '更新成功')
      props.close()
    } else {
      ElMessage.error(isAdd ? '添加失败' : '更新失败')
    }
  }).catch(() => {
    ElMessage.error('操作失败')
  })
}
</script>

<template>
  <div class="mb-4 font-bold">解析记录</div>
  <div>
    <el-form
        label-width="auto"
        style="max-width: 600px"
        label-position="left"
    >
      <el-form-item label="解析记录">
        <el-input size="small" v-model="rr" />
      </el-form-item>
      <el-form-item label="解析类型">
        <el-select v-model="record_type" size="small" placeholder="记录类型" class="ml-5">
          <el-option v-for="type in record_type_list" :label="type.label" :value="type.value"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="解析值">
        <el-input size="small" v-model="value" />
      </el-form-item>
      <el-form-item label="解析线路">
        <el-input size="small" v-model="line" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submit">提交</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
</style>
