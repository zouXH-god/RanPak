<template>
  <div class="h-full min-h-0 overflow-auto bg-[#f8fafc] px-4 pb-4">
    <div class="mx-auto flex max-w-[1400px] flex-col gap-4">
      <header class="rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <h1 class="text-xl font-semibold text-gray-900">小说阅读器</h1>
        <p class="mt-1 text-sm text-gray-500">导入书源搜索小说，点击书架中的书籍打开独立阅读窗口。</p>
      </header>

      <el-tabs v-model="activeTab" class="novel-tabs">
        <el-tab-pane label="书架" name="bookshelf">
          <div v-if="bookshelf.length === 0" class="py-12 text-center text-sm text-gray-400">
            书架空空如也，去搜索页添加一本书吧
          </div>
          <div v-else class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <div
              v-for="book in bookshelf"
              :key="book.id"
              class="book-card"
              @click="openReader(book)"
            >
              <div class="book-cover">
                <img v-if="book.coverUrl" :src="book.coverUrl" alt="" class="h-full w-full object-cover" />
                <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 text-2xl font-bold text-blue-400">
                  {{ book.name?.charAt(0) || '书' }}
                </div>
              </div>
              <div class="book-meta">
                <strong class="truncate text-sm">{{ book.name }}</strong>
                <span class="truncate text-xs text-gray-400">{{ book.author }}</span>
                <span v-if="book.lastChapter" class="truncate text-xs text-gray-400">{{ book.lastChapter }}</span>
              </div>
              <el-button
                class="book-remove"
                :icon="Delete"
                text
                type="danger"
                size="small"
                @click.stop="removeBook(book.id)"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="搜索" name="search">
          <div class="mb-4 flex gap-2">
            <el-input
              v-model="searchKeyword"
              placeholder="输入书名或作者搜索..."
              clearable
              class="flex-1"
              @keyup.enter="doSearch"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="searching" @click="doSearch">搜索</el-button>
          </div>
          <div v-if="searchResults.length > 0" class="space-y-2">
            <div
              v-for="(item, index) in searchResults"
              :key="index"
              class="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <div class="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-100">
                <img v-if="item.coverUrl" :src="item.coverUrl" class="h-full w-full object-cover" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-gray-900">{{ item.name }}</div>
                <div class="truncate text-xs text-gray-500">{{ item.author }} · {{ item.sourceName }}</div>
                <div v-if="item.intro" class="mt-0.5 line-clamp-1 text-xs text-gray-400">{{ item.intro }}</div>
              </div>
              <div class="flex gap-1">
                <el-button size="small" @click="viewBookDetail(item)">详情</el-button>
                <el-button size="small" type="primary" @click="addBook(item)">加入书架</el-button>
              </div>
            </div>
          </div>
          <div v-else-if="searchDone && searchResults.length === 0" class="py-8 text-center text-sm text-gray-400">
            未找到匹配书籍
          </div>
        </el-tab-pane>

        <el-tab-pane label="书源管理" name="sources">
          <div class="mb-4 flex items-center gap-2">
            <el-button :icon="Upload" type="primary" @click="showImportDialog = true">导入书源</el-button>
            <el-button :icon="Delete" plain :disabled="selectedSourceIds.length === 0" @click="deleteSelectedSources">批量删除</el-button>
            <span class="ml-auto text-sm text-gray-400">共 {{ sources.length }} 个书源</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="source in sources"
              :key="source.id"
              class="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm"
            >
              <el-checkbox v-model="source._selected" @change="updateSelectedSources" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-gray-800">{{ source.bookSourceName }}</div>
                <div class="truncate text-xs text-gray-400">{{ source.bookSourceUrl }}</div>
              </div>
              <el-tag v-if="source.bookSourceGroup" size="small" effect="plain">{{ source.bookSourceGroup }}</el-tag>
              <el-switch v-model="source.enabled" size="small" @change="toggleSourceEnabled(source)" />
              <el-button :icon="Delete" text type="danger" size="small" @click="deleteOneSource(source.id)" />
            </div>
          </div>
          <el-empty v-if="sources.length === 0" description="暂无书源，点击上方导入" />
        </el-tab-pane>
      </el-tabs>

      <!-- 书源导入对话框 -->
      <el-dialog v-model="showImportDialog" title="导入书源" width="640px" :close-on-click-modal="false">
        <el-form label-position="top">
          <el-form-item label="JSON 内容">
            <div class="mb-2 flex gap-2">
              <el-button size="small" :icon="Upload" @click="importFromFile">从文件导入</el-button>
              <span class="text-xs leading-6 text-gray-400">选择 .json 文件自动填入，或直接粘贴文本</span>
            </div>
            <el-input
              v-model="importText"
              type="textarea"
              :rows="12"
              placeholder='粘贴 legado 书源 JSON 数组，例如：
[{"bookSourceName":"示例","bookSourceUrl":"https://example.com","searchUrl":"/search?keyword={{key}}","ruleSearch":{...},"ruleToc":{...},"ruleContent":{...}}]'
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showImportDialog = false">取消</el-button>
          <el-button type="primary" :loading="importing" @click="doImport">导入</el-button>
        </template>
      </el-dialog>

      <!-- 书籍详情/目录对话框 -->
      <el-dialog v-model="showDetailDialog" :title="detailBook?.name || '书籍详情'" width="600px">
        <div v-if="loadingChapters" class="py-8 text-center"><el-icon class="is-loading" :size="24"><Loading /></el-icon></div>
        <div v-else-if="detailChapters.length > 0">
          <div class="mb-3 text-sm text-gray-500">共 {{ detailChapters.length }} 章</div>
          <div class="max-h-[400px] overflow-auto space-y-1">
            <button
              v-for="(ch, idx) in detailChapters"
              :key="idx"
              class="block w-full truncate rounded px-3 py-1.5 text-left text-sm hover:bg-blue-50"
              @click="readChapter(idx)"
            >
              {{ ch.name }}
            </button>
          </div>
        </div>
        <template #footer>
          <el-button @click="showDetailDialog = false">关闭</el-button>
          <el-button type="primary" @click="addBook(detailBook)">加入书架</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Loading, Search, Upload } from '@element-plus/icons-vue'

const activeTab = ref('bookshelf')
const bookshelf = ref([])
const sources = ref([])
const selectedSourceIds = ref([])

const searchKeyword = ref('')
const searching = ref(false)
const searchDone = ref(false)
const searchResults = ref([])

const showImportDialog = ref(false)
const importText = ref('')
const importing = ref(false)

const showDetailDialog = ref(false)
const detailBook = ref(null)
const detailChapters = ref([])
const loadingChapters = ref(false)

onMounted(async () => {
  await loadBookshelf()
  await loadSources()
})

async function callReader(action, ...args) {
  const fn = window.electronAPI?.novelReader?.[action]
  if (!fn) return { ok: false, error: 'API 不可用' }
  return await fn(...args)
}

async function loadBookshelf() {
  const res = await callReader('getBookshelf')
  if (res?.ok) bookshelf.value = res.data || []
}

async function loadSources() {
  const res = await callReader('listSources')
  if (res?.ok) sources.value = (res.data || []).map((s) => ({ ...s, _selected: false }))
}

async function doSearch() {
  if (!searchKeyword.value.trim()) return
  searching.value = true
  searchDone.value = false
  searchResults.value = []
  const res = await callReader('search', { keyword: searchKeyword.value.trim() })
  searching.value = false
  searchDone.value = true
  if (res?.ok) searchResults.value = res.data?.results || []
  else ElMessage.error(res?.error || '搜索失败')
}

async function addBook(item) {
  const res = await callReader('addToBookshelf', {
    sourceUrl: item.sourceUrl,
    bookUrl: item.bookUrl,
    name: item.name,
    author: item.author,
    coverUrl: item.coverUrl,
  })
  if (res?.ok) {
    ElMessage.success('已加入书架')
    await loadBookshelf()
  } else {
    ElMessage.error(res?.error || '加入失败')
  }
}

async function removeBook(id) {
  const confirmed = await ElMessageBox.confirm('确定从书架移除？', '移除', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  await callReader('removeFromBookshelf', id)
  await loadBookshelf()
}

async function openReader(book) {
  await callReader('openReaderWindow', {
    bookId: book.id,
    bookName: book.name,
    sourceUrl: book.sourceUrl,
    bookUrl: book.bookUrl,
    chapterIndex: book.progress?.chapterIndex || 0,
    scrollTop: book.progress?.scrollTop || 0,
  })
}

async function viewBookDetail(item) {
  detailBook.value = item
  detailChapters.value = []
  loadingChapters.value = true
  showDetailDialog.value = true
  const res = await callReader('getChapterList', { sourceUrl: item.sourceUrl, bookUrl: item.bookUrl })
  loadingChapters.value = false
  if (res?.ok) detailChapters.value = res.data?.chapters || []
  else ElMessage.error(res?.error || '获取目录失败')
}

async function readChapter(index) {
  showDetailDialog.value = false
  const book = detailBook.value
  const added = await callReader('addToBookshelf', {
    sourceUrl: book.sourceUrl,
    bookUrl: book.bookUrl,
    name: book.name,
    author: book.author,
    coverUrl: book.coverUrl,
  })
  const bookId = added?.data?.id
  if (bookId) {
    await callReader('updateProgress', { bookId, chapterIndex: index, scrollTop: 0 })
    await loadBookshelf()
  }
  await callReader('openReaderWindow', {
    bookId,
    bookName: book.name,
    sourceUrl: book.sourceUrl,
    bookUrl: book.bookUrl,
    chapterIndex: index,
    scrollTop: 0,
  })
}

function updateSelectedSources() {
  selectedSourceIds.value = sources.value.filter((s) => s._selected).map((s) => s.id)
}

async function toggleSourceEnabled(source) {
  await callReader('toggleSource', source.id, source.enabled)
}

async function deleteOneSource(id) {
  await callReader('deleteSources', [id])
  await loadSources()
  ElMessage.success('已删除')
}

async function deleteSelectedSources() {
  if (selectedSourceIds.value.length === 0) return
  await callReader('deleteSources', selectedSourceIds.value)
  selectedSourceIds.value = []
  await loadSources()
  ElMessage.success('已删除')
}

async function doImport() {
  if (!importText.value.trim()) { ElMessage.warning('请输入 JSON 内容'); return }
  importing.value = true
  const res = await callReader('importSources', importText.value)
  importing.value = false
  if (res?.ok) {
    ElMessage.success(`导入完成：新增 ${res.data.added}，更新 ${res.data.updated}`)
    showImportDialog.value = false
    importText.value = ''
    await loadSources()
  } else {
    ElMessage.error(res?.error || '导入失败')
  }
}

async function importFromFile() {
  const result = await window.electronAPI?.selectAnyFile?.()
  if (!result) return
  const resp = await window.electronAPI?.httpFetch?.(`file://${result}`, {})
  if (resp?.ok && resp.data) {
    importText.value = resp.data
  }
}
</script>

<style scoped>
.book-card {
  position: relative;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-radius: 0.75rem;
  border: 1px solid #f1f5f9;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}
.book-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.book-cover {
  height: 160px;
  overflow: hidden;
}
.book-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.75rem;
}
.book-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.book-card:hover .book-remove {
  opacity: 1;
}
</style>
