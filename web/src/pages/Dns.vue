<template>
  <div class="p-10">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-2xl font-semibold text-brand-ink mb-4 mr-8">域名解析</h2>
      <el-select @change="_getDomainList" v-model="account" placeholder="请选择访问账号" style="width: 240px">
        <el-option
            v-for="item in accountList"
            :key="item.value"
            :label="item.label"
            :value="item.value"
        >
          <div class="flex">
            <div class="flex-1">{{ item.label }}</div>
            <div class="flex-1 text-gray-400">({{ item.type }})</div>
          </div>
        </el-option>
      </el-select>
      <el-button type="primary" plain @click="openAccountDialog">添加账号</el-button>
    </div>
    <div class="flex">
      <h2 class="text-2xl font-semibold text-brand-ink mb-4 mr-8">解析记录</h2>
      <el-button type="primary" plain v-if="domainList.length > 0" @click="expandAllDomains">展开全部</el-button>
      <el-button type="primary" plain v-if="domainList.length > 0" @click="putAllDomains">折叠全部</el-button>
    </div>
    <div>
      <!-- 域名解析列表 -->
      <div class="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden"
      v-for="(domain, index) in domainList" :key="domain.domain" >
        <!-- 解析列表头部 -->
        <div class="ml-3 mt-2 mb-2 flex" style="border-left: 5px solid #fbbda8;padding-left: 5px;border-radius: 5px;">
          <div>{{ domain.domain }}</div>
          <div class="flex ml-8">
            <div class="flex" v-if="domain.target">
              <el-input size="small" v-model="domain.key" placeholder="关键词筛选" @change="_getDnsRecords(domain)"></el-input>
              <el-select v-model="domain.record_type" @change="_getDnsRecords(domain)" size="small" placeholder="记录类型" class="ml-5">
                <el-option v-for="type in record_type_list" :label="type.label" :value="type.value"></el-option>
              </el-select>
              <el-button class="ml-5" size="small" type="success" @click="_getDnsRecords(domain)" plain>刷新</el-button>
              <el-button class="ml-5" size="small" type="success" @click="updateSelectRecord(index)" plain>新增解析</el-button>
            </div>
            <el-button class="ml-5" size="small" type="warning" plain
                       @click="domain.target=!domain.target;_getDnsRecords(domain, false)" >
              <span v-if="domain.target">收起</span>
              <span v-else>展开</span>
            </el-button>
          </div>
        </div>
        <!-- 解析列表 -->
        <el-table v-if="domain.target" v-loading="domain.loading" :data="domain.records" cell-class-name="record_box" border style="width: 100%">
          <el-table-column prop="record_id" label="ID" />
          <el-table-column prop="rr" label="记录" />
          <el-table-column prop="value" label="解析值" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="status" label="状态" width="80">
            <template #default="scope">
              <div>
                <el-tag v-if="isGoDaddyAccount" type="info" effect="light">不支持</el-tag>
                <el-tag v-else-if="scope.row.status==='ENABLE'" type="success" effect="light">启用</el-tag>
                <el-tag v-else type="info" effect="light">禁用</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260">
            <template #default="scope">
              <div class="flex">
              <el-button size="small" type="info" @click="_targetRecordState(domain, scope.row)" v-if="!isGoDaddyAccount && scope.row.status==='ENABLE'" plain>暂停</el-button>
              <el-button size="small" type="success" @click="_targetRecordState(domain, scope.row)" v-else-if="!isGoDaddyAccount" plain>启用</el-button>
              <el-button size="small" type="warning" plain @click="updateSelectRecord(index, scope.row)">修改</el-button>
                <el-popconfirm
                    class="box-item"
                    title="确认删除记录？"
                    placement="top-start"
                    @confirm="_deleteRecord(domain, scope.row)"
                >
                  <template #reference>
                    <el-button size="small" type="danger" plain>删除</el-button>
                  </template>
                </el-popconfirm>
              <el-button size="small" type="success" plain @click="copyDomainToClipboard(domain, scope.row)">复制</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <!-- 翻页组件 -->
        <div v-if="domain.target" class="flex justify-end m-4">
          <el-pagination
              background
              layout="prev, pager, next"
              :current-page="domain.page"
              :page-size="domain.limit"
              :total="domain.total_count"
              @current-change="(page)=>{domain.page=page;_getDnsRecords(domain)}"
          >
          </el-pagination>
        </div>
      </div>

      <el-dialog v-model="showAccountDialog" title="添加 DNS 账号" width="520px" :close-on-click-modal="false">
        <el-form ref="accountFormRef" :model="accountForm" :rules="accountRules" label-width="132px" label-position="left">
          <el-form-item label="账号名称" prop="name">
            <el-input v-model="accountForm.name" placeholder="例如：my-aliyun" />
          </el-form-item>
          <el-form-item label="服务商" prop="type">
            <el-select v-model="accountForm.type" class="w-full" placeholder="请选择服务商">
              <el-option label="阿里云 AliDNS" value="ali" />
              <el-option label="腾讯云 DNSPod" value="tencent" />
              <el-option label="Cloudflare" value="cloudflare" />
              <el-option label="GoDaddy" value="godaddy" />
            </el-select>
          </el-form-item>
          <el-form-item label="AccessKey ID" prop="access_key_id">
            <el-input v-model="accountForm.access_key_id" placeholder="请输入 AccessKey ID" />
          </el-form-item>
          <el-form-item label="AccessKey Secret" prop="access_key_secret">
            <el-input v-model="accountForm.access_key_secret" type="password" show-password placeholder="请输入 AccessKey Secret" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showAccountDialog = false">取消</el-button>
          <el-button type="primary" :loading="savingAccount" @click="saveDnsAccount">保存</el-button>
        </template>
      </el-dialog>

      <!-- 解析信息遮罩层 -->
      <div class="fixed inset-0 bg-black bg-opacity-50 z-10 flex justify-center items-center" v-if="showRecordBox" @click="closeRecordBox">
        <!-- 解析信息弹窗 -->
        <div class="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden z-20 p-6" @click.stop="false">
          <dns-content-box
              :account="account"
              :domainId="selectRecord.domainId"
              :domain="selectRecord.domain"
              :record_id="selectRecord.record_id"
              :rr="selectRecord.rr"
              :record_type="selectRecord.record_type"
              :value="selectRecord.value"
              :line="selectRecord.line"
              :close="closeRecordBox"
          />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import {computed, onMounted, ref} from 'vue'
import {
  deleteDomainRecord,
  getAccountList,
  getDomainList,
  getDomainRecords,
  record_type_list,
  saveAccount,
  toggleDomainRecordStatus
} from "../utils/api/dns.ts";
import {ElMessage} from "element-plus";
import DnsContentBox from "../components/dnsContentBox.vue";

const account = ref('')
const accountType = ref('')
const accountFormRef = ref()
const showAccountDialog = ref(false)
const savingAccount = ref(false)
const accountForm = ref({
  name: '',
  type: 'ali',
  access_key_id: '',
  access_key_secret: '',
})
const accountRules = {
  name: [{ required: true, message: '请输入账号名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择服务商', trigger: 'change' }],
  access_key_id: [{ required: true, message: '请输入 AccessKey ID', trigger: 'blur' }],
  access_key_secret: [{ required: true, message: '请输入 AccessKey Secret', trigger: 'blur' }],
}
const showRecordBox = ref(false)
const selectRecord = ref({
  domainId: '',
  domain: '',
  record_id: '',
  rr: '',
  record_type: '',
  value: '',
  line: '',
})
const selectDomainIndex = ref()

/** 打开解析记录编辑弹窗 */
const updateSelectRecord = (domainIndex, record=null) => {
  const domain = domainList.value[domainIndex]
  selectDomainIndex.value = domainIndex
  selectRecord.value = {
    domainId: domain.domainId,
    domain: domain.domain,
  }
  if (record){
    selectRecord.value = {
      domainId: domain.domainId,
      domain: domain.domain,
      record_id: record.record_id,
      rr: record.rr,
      record_type: record.type,
      value: record.value,
      line: record.line,
    }
  }
  showRecordBox.value = true
}

/** 关闭编辑弹窗并刷新记录 */
const closeRecordBox = () => {
  showRecordBox.value = false
  selectRecord.value = {
    domainId: '',
    domain: '',
    record_id: '',
    rr: '',
    record_type: '',
    value: '',
    line: '',
  }
  _getDnsRecords(domainList.value[selectDomainIndex.value])
}

/** 展开全部域名的解析记录 */
const expandAllDomains = () => {
  domainList.value.forEach(domain=>{
    domain.target = true
    _getDnsRecords(domain, false)
  })
}

/** 折叠全部域名 */
const putAllDomains = () => {
  domainList.value.forEach(domain=>{
    domain.target = false
  })
}

const accountList = ref([])
onMounted(() => {
  loadAccountList()
})

const loadAccountList = async () => {
  const res = await getAccountList()
  if (!res) return
  accountList.value = res.data.map(item=>({
    value: item.name,
    label: item.name,
    type: item.type
  }))
}

const openAccountDialog = () => {
  accountForm.value = {
    name: '',
    type: 'ali',
    access_key_id: '',
    access_key_secret: '',
  }
  showAccountDialog.value = true
}

const saveDnsAccount = () => {
  accountFormRef.value?.validate(async (valid) => {
    if (!valid) return
    savingAccount.value = true
    try {
      const res = await saveAccount(accountForm.value)
      if (!res) return
      ElMessage.success('账号已保存')
      showAccountDialog.value = false
      await loadAccountList()
      account.value = accountForm.value.name
      _getDomainList()
    } finally {
      savingAccount.value = false
    }
  })
}

const domainList = ref([])
const isGoDaddyAccount = computed(() => accountType.value.toLowerCase() === 'godaddy')

/** 获取域名列表 */
const _getDomainList = () => {
  const selectedAccount = accountList.value.find(item => item.value === account.value)
  accountType.value = selectedAccount?.type || ''
  getDomainList(account.value).then(res=>{
    if (!res) return
    domainList.value = res.data.map(item=>({
      domain: item.domain,
      domainId: item.domainId,
      target: false,
      loading: false,
      limit: 8,
      page: 1,
      total_count: 0,
      key: "",
      record_type: "",
      records: []
    }))
  })
}

/** 获取指定域名的解析记录 */
const _getDnsRecords = (domain, refresh=true) => {
  if(domain.records.length <= 0 || refresh){
    domain.loading = true
    getDomainRecords(
        account.value, domain.domainId, domain.domain,
        domain.limit, domain.page, domain.key, domain.record_type
    ).then(res=>{
      if (!res) return
      domain.records = res.data.domain_records
      domain.total_count = res.data.total_count
    }).finally(()=>{
      domain.loading = false
    })
  }
}

/** 切换解析记录启用/暂停状态 */
const _targetRecordState = (domain, record) => {
  const oldStatus = record.status
  record.status = record.status === 'ENABLE' ? 'DISABLE' : 'ENABLE'
  toggleDomainRecordStatus(
      account.value, {
        record_id: record.record_id,
        domainId: domain.domainId,
        domain: domain.domain,
        status: record.status
      }
  ).then(res=>{
    if (res) {
      ElMessage.success("操作成功")
    } else {
      record.status = oldStatus
    }
  }).catch(() => {
    record.status = oldStatus
  }).finally(()=>{
    _getDnsRecords(domain)
  })
}

/** 删除解析记录 */
const _deleteRecord = (domain, record) => {
  deleteDomainRecord(
      account.value, {
        record_id: record.record_id,
        domainId: domain.domainId,
        domain: domain.domain
      }
  ).then(res=>{
    if (res) ElMessage.success("删除成功")
  }).finally(()=>{
    _getDnsRecords(domain)
  })
}

/** 复制完整域名到剪贴板 */
const copyDomainToClipboard = (domain, record) => {
  const subDomain = (record.rr === "@" ? "" : record.rr + ".") + domain.domain
  navigator.clipboard.writeText(subDomain).then(() => {
    ElMessage.success("域名已复制到剪贴板")
  })
}
</script>

<style>
.record_box div{
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
</style>
