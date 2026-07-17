<template>
  <div class="h-full min-h-0 overflow-auto px-4 pb-6">
    <div class="mx-auto flex max-w-[1100px] flex-col gap-4">
      <header class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">云端管理</h1>
          <p class="mt-1 text-sm text-gray-500">管理云端同步数据与账号。</p>
        </div>
        <el-button :loading="refreshing" @click="refreshAll(true)">刷新</el-button>
      </header>

      <div v-if="!status.loggedIn" class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <el-icon class="text-4xl text-gray-300"><Connection /></el-icon>
        <p class="mt-3 text-sm text-gray-500">请先在设置中配置并登录云端服务</p>
        <el-button class="mt-4" type="primary" @click="goToSettings">前往设置</el-button>
      </div>

      <template v-else>
        <section class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div class="mb-4">
            <h2 class="text-base font-semibold text-gray-900">数据概览</h2>
            <p class="mt-1 text-sm text-gray-500">当前账号云端数据统计</p>
          </div>

          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div v-for="item in dataSummary" :key="item.type" class="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
              <div class="text-2xl font-bold text-blue-600">{{ item.count }}</div>
              <div class="mt-1 text-xs text-gray-500">{{ item.label }}</div>
              <div v-if="item.updatedAt" class="mt-1 text-xs text-gray-400">{{ formatTime(item.updatedAt) }}</div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <span class="text-sm text-gray-500">上次同步：{{ formatTime(status.lastSyncAt) }}</span>
            <div class="flex gap-2">
              <el-button :loading="syncing" size="small" @click="syncNow">立即同步</el-button>
              <el-button :loading="forcing" size="small" type="danger" plain @click="forceSync">强制同步</el-button>
            </div>
          </div>
        </section>

        <section v-if="status.role === 'admin'" class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div class="mb-4">
            <h2 class="text-base font-semibold text-gray-900">服务设置</h2>
            <p class="mt-1 text-sm text-gray-500">控制云端服务的注册与审核策略</p>
          </div>

          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-gray-700">允许新用户注册</div>
                <div class="text-xs text-gray-400">关闭后，新用户无法自行注册，只能由管理员创建</div>
              </div>
              <el-switch v-model="serverSettings.allowRegistration" :loading="settingsSaving" @change="saveServerSettings" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-gray-700">新用户需要审核</div>
                <div class="text-xs text-gray-400">开启后，新注册用户需管理员审核通过才能使用</div>
              </div>
              <el-switch v-model="serverSettings.requireApproval" :loading="settingsSaving" @change="saveServerSettings" />
            </div>
          </div>
        </section>

        <section v-if="status.role === 'admin'" class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-gray-900">用户管理</h2>
              <p class="mt-1 text-sm text-gray-500">管理云端服务的注册用户</p>
            </div>
            <el-button type="primary" size="small" @click="showCreateDialog">新增用户</el-button>
          </div>

          <el-table :data="users" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="username" label="用户名" />
            <el-table-column prop="role" label="角色" width="100">
              <template #default="{ row }">
                <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
                  {{ row.role === 'admin' ? '管理员' : '普通用户' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'pending'" type="warning" size="small">待审核</el-tag>
                <el-tag v-else type="success" size="small">活跃</el-tag>
                <el-tag v-if="row.totpEnabled" type="info" size="small" class="ml-1">2FA</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'pending'" size="small" link type="success" @click="handleApprove(row)">通过</el-button>
                <el-button size="small" link type="primary" @click="showEditDialog(row)">编辑</el-button>
                <el-button size="small" link type="danger" :disabled="row.username === status.username" @click="handleDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </template>
    </div>

    <el-dialog v-model="userDialogVisible" :title="editingUser ? '编辑用户' : '新增用户'" width="400px">
      <el-form label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="userForm.username" :disabled="!!editingUser" placeholder="3-32 个字符" />
        </el-form-item>
        <el-form-item :label="editingUser ? '新密码（留空不修改）' : '密码'">
          <el-input v-model="userForm.password" type="password" show-password placeholder="至少 6 个字符" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" class="w-full">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="userSaving" @click="saveUser">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Connection } from '@element-plus/icons-vue'

const router = useRouter()
const status = reactive({ loggedIn: false, username: '', role: '', lastSyncAt: 0 })
const syncing = ref(false)
const forcing = ref(false)
const refreshing = ref(false)
const users = ref([])
const cloudData = ref({})

const dataSummary = computed(() => {
  const types = [
    { type: 'ai_config', label: 'AI 配置' },
    { type: 'ssh_profiles', label: 'SSH 连接' },
    { type: 'ssh_history', label: 'SSH 历史' },
    { type: 'dns_accounts', label: '域名账号' },
  ]
  return types.map((t) => {
    const d = cloudData.value[t.type]
    const count = Number(d?.count || 0)
    return { ...t, count, updatedAt: d?.updatedAt }
  })
})

const userDialogVisible = ref(false)
const editingUser = ref(null)
const userSaving = ref(false)
const userForm = reactive({ username: '', password: '', role: 'user' })

const serverSettings = reactive({ allowRegistration: true, requireApproval: false })
const settingsSaving = ref(false)

onMounted(async () => {
  await refreshAll(false)
})

async function loadStatus() {
  const res = await window.electronAPI?.cloudSync?.getStatus?.()
  if (res?.ok && res.data) {
    Object.assign(status, res.data)
  }
}

async function refreshAll(showMessage = false) {
  refreshing.value = true
  const res = await window.electronAPI?.cloudSync?.refreshStatus?.()
  refreshing.value = false
  if (res?.ok && res.data) {
    Object.assign(status, res.data)
    cloudData.value = res.data.remote?.overview || {}
    if (status.role === 'admin') await Promise.all([loadUsers(), loadServerSettings()])
    if (showMessage) ElMessage.success('云端状态已刷新')
  } else {
    await loadStatus()
    if (showMessage) ElMessage.error(res?.error || '刷新失败')
  }
}

async function loadUsers() {
  const res = await window.electronAPI?.cloudSync?.getUsers?.()
  if (res?.ok && res.data) {
    users.value = res.data
  }
}

async function syncNow() {
  syncing.value = true
  const res = await window.electronAPI?.cloudSync?.syncNow?.()
  syncing.value = false
  if (res?.ok) {
    const summary = res.data?.summary || {}
    ElMessage.success(summary.protocolVersion === 2 ? `同步完成：上传 ${summary.pushed || 0} 项，应用 ${summary.applied || 0} 项` : `同步完成：拉取更新 ${summary.pulled?.length || 0} 项`)
    await refreshAll(false)
  } else {
    ElMessage.error(res?.error || '同步失败')
  }
}

async function forceSync() {
  try {
    await ElMessageBox.confirm('将完整拉取云端数据，并删除或覆盖本机全部可同步数据。本机未上传的修改会永久丢失；仅本机图片资产不受影响。', '确认强制同步', { type: 'error', confirmButtonText: '强制覆盖本机', cancelButtonText: '取消' })
    forcing.value = true
    const res = await window.electronAPI?.cloudSync?.forcePull?.()
    if (!res?.ok) throw new Error(res?.error || '强制同步失败')
    ElMessage.success(`强制同步完成：已读取 ${res.data?.operations || 0} 个操作，恢复 ${res.data?.entities || 0} 条数据`)
    await refreshAll(false)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '强制同步失败')
  } finally { forcing.value = false }
}

function goToSettings() {
  router.push({ path: '/settings', query: { section: 'cloud' } })
}

function showCreateDialog() {
  editingUser.value = null
  Object.assign(userForm, { username: '', password: '', role: 'user' })
  userDialogVisible.value = true
}

function showEditDialog(user) {
  editingUser.value = user
  Object.assign(userForm, { username: user.username, password: '', role: user.role })
  userDialogVisible.value = true
}

async function saveUser() {
  if (!editingUser.value && (!userForm.username || !userForm.password)) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  userSaving.value = true

  let res
  if (editingUser.value) {
    const data = { id: editingUser.value.id, role: userForm.role }
    if (userForm.password) data.password = userForm.password
    res = await window.electronAPI?.cloudSync?.updateUser?.(data)
  } else {
    res = await window.electronAPI?.cloudSync?.createUser?.(userForm)
  }

  userSaving.value = false
  if (res?.ok) {
    ElMessage.success(editingUser.value ? '更新成功' : '创建成功')
    userDialogVisible.value = false
    await loadUsers()
  } else {
    ElMessage.error(res?.error || '操作失败')
  }
}

async function loadServerSettings() {
  const res = await window.electronAPI?.cloudSync?.getServerSettings?.()
  if (res?.ok && res.data) {
    serverSettings.allowRegistration = res.data.allowRegistration
    serverSettings.requireApproval = res.data.requireApproval
  }
}

async function saveServerSettings() {
  settingsSaving.value = true
  const res = await window.electronAPI?.cloudSync?.updateServerSettings?.({
    allowRegistration: serverSettings.allowRegistration,
    requireApproval: serverSettings.requireApproval,
  })
  settingsSaving.value = false
  if (res?.ok) {
    ElMessage.success('设置已保存')
  } else {
    ElMessage.error(res?.error || '保存失败')
    await loadServerSettings()
  }
}

async function handleApprove(user) {
  try {
    await ElMessageBox.confirm(`确定通过用户「${user.username}」的注册审核？`, '审核确认', {
      type: 'info',
      confirmButtonText: '通过',
      cancelButtonText: '取消',
    })
  } catch { return }

  const res = await window.electronAPI?.cloudSync?.approveUser?.(user.id)
  if (res?.ok) {
    ElMessage.success('用户已通过审核')
    await loadUsers()
  } else {
    ElMessage.error(res?.error || '操作失败')
  }
}

async function handleDelete(user) {
  try {
    await ElMessageBox.confirm(`确定删除用户「${user.username}」？该操作将同时删除其云端数据。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch { return }

  const res = await window.electronAPI?.cloudSync?.deleteUser?.(user.id)
  if (res?.ok) {
    ElMessage.success('删除成功')
    await loadUsers()
  } else {
    ElMessage.error(res?.error || '删除失败')
  }
}

function formatTime(ts) {
  if (!ts) return '从未'
  return new Date(ts).toLocaleString()
}
</script>
