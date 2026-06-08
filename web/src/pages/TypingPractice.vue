<template>
  <div class="tool-page">
    <div class="mx-auto flex max-w-[1300px] flex-col gap-4">
      <header class="tool-header">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-gray-900">打字练习</h1>
          <p class="mt-1 text-sm text-gray-500">随机散文打字训练，实时统计速度、进度和准确率。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <el-button :icon="RefreshRight" type="primary" @click="pickRandomPassage">随机一篇</el-button>
          <el-button :icon="RefreshLeft" @click="resetPractice">重置</el-button>
        </div>
      </header>

      <section class="stats-bar">
        <div v-for="item in stats" :key="item.label" class="stat-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </section>

      <section class="tool-card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-900">练习文本</h2>
            <p class="mt-1 text-xs text-gray-500">{{ passageTitle }}</p>
          </div>
          <el-tag :type="isCompleted ? 'success' : hasStarted ? 'warning' : 'info'">{{ statusText }}</el-tag>
        </div>
        <div class="passage-box" @click="focusInput">
          <span
            v-for="(char, index) in passageChars"
            :key="`${index}-${char}`"
            :class="charClass(index)"
          >{{ char }}</span>
        </div>
      </section>

      <section class="tool-card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-900">输入区</h2>
          <el-progress class="min-w-[220px] flex-1 md:max-w-[360px]" :percentage="progress" :status="isCompleted ? 'success' : undefined" />
        </div>
        <el-input
          ref="inputRef"
          class="typing-input"
          v-model="typedText"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 14 }"
          :maxlength="currentPassage.text.length"
          placeholder="在这里输入上方散文..."
          @input="handleInput"
        />
        <el-alert
          v-if="isCompleted"
          class="mt-4"
          type="success"
          show-icon
          :closable="false"
          title="本轮练习完成"
          :description="`用时 ${elapsedText}，准确率 ${accuracy}% ，速度 ${cpm} CPM。`"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { RefreshLeft, RefreshRight } from '@element-plus/icons-vue'

const passages = [
  {
    title: '山雨',
    text: '山雨来得很轻，先在竹叶上落下一两声低语，随后沿着檐角铺开。远处的灯火被雾气揉得柔软，像有人把夜色折成一封信，递给还未归家的人。',
  },
  {
    title: '渡口',
    text: '清晨的渡口没有喧哗，只有水声慢慢拍着旧木桩。船夫把绳索解开，白鸟从芦苇里惊起，河面便多了一道细细的光，通向看不见的远方。',
  },
  {
    title: '旧书',
    text: '旧书摊藏在巷尾，纸页有潮湿的气味。翻到某一页时，夹着一枚褪色的车票，像是陌生人的春天忽然落在掌心，安静得令人不忍合上。',
  },
  {
    title: '晚风',
    text: '晚风穿过街边的梧桐，把一天的尘埃吹得很慢。有人在窗前煮茶，有人提着花束经过，城市短暂地松开眉头，把温柔藏进灯影里。',
  },
  {
    title: '旷野',
    text: '旷野尽头有一条细路，草色在黄昏里起伏。走得久了，连心事也变轻，只剩云从头顶经过，像不必回答的问候，也像迟来的拥抱。',
  },
  {
    title: '海边',
    text: '海边的夜色宽阔而清醒，浪花一遍遍写下又擦去月光。少年坐在堤岸上听潮声，仿佛世界所有未说出口的话，都能在这里慢慢抵达。',
  },
  {
    title: '花影',
    text: '院里的花开得正盛，影子落在青石板上。午后的时间像一只透明的杯，盛着蝉鸣、热茶和微尘，也盛着那些暂时不用奔赴的日子。',
  },
  {
    title: '归途',
    text: '归途总比来路更安静。车窗外的田野一格一格退后，暮色铺在肩上，心里却亮着一盏小灯，提醒自己仍有地方可以停靠。',
  },
]

const currentIndex = ref(Math.floor(Math.random() * passages.length))
const typedText = ref('')
const startTime = ref(0)
const elapsedSeconds = ref(0)
const timerId = ref(null)
const inputRef = ref(null)

const currentPassage = computed(() => passages[currentIndex.value])
const passageTitle = computed(() => `《${currentPassage.value.title}》`)
const passageChars = computed(() => Array.from(currentPassage.value.text))
const inputChars = computed(() => Array.from(typedText.value))
const hasStarted = computed(() => startTime.value > 0)
const isCompleted = computed(() => inputChars.value.length === passageChars.value.length && wrongCount.value === 0)
const progress = computed(() => Math.min(100, Math.round((inputChars.value.length / passageChars.value.length) * 100)))
const correctCount = computed(() => inputChars.value.filter((char, index) => char === passageChars.value[index]).length)
const wrongCount = computed(() => inputChars.value.filter((char, index) => char !== passageChars.value[index]).length)
const accuracy = computed(() => {
  if (inputChars.value.length === 0) return 100
  return Math.round((correctCount.value / inputChars.value.length) * 100)
})
const cpm = computed(() => {
  if (elapsedSeconds.value < 1) return 0
  return Math.round(correctCount.value / (elapsedSeconds.value / 60))
})
const elapsedText = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const statusText = computed(() => {
  if (isCompleted.value) return '已完成'
  if (hasStarted.value) return '练习中'
  return '未开始'
})
const stats = computed(() => [
  { label: '用时', value: elapsedText.value },
  { label: '进度', value: `${progress.value}%` },
  { label: '正确', value: correctCount.value },
  { label: '错误', value: wrongCount.value },
  { label: '准确率', value: `${accuracy.value}%` },
  { label: 'CPM', value: cpm.value },
])

function startTimer() {
  if (timerId.value) return
  startTime.value = Date.now()
  timerId.value = window.setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - startTime.value) / 1000)
  }, 250)
}

function stopTimer() {
  if (!timerId.value) return
  window.clearInterval(timerId.value)
  timerId.value = null
  if (startTime.value) elapsedSeconds.value = Math.floor((Date.now() - startTime.value) / 1000)
}

function handleInput() {
  if (typedText.value.length > 0 && !hasStarted.value) startTimer()
  if (typedText.value.length === 0 && !isCompleted.value) {
    stopTimer()
    startTime.value = 0
    elapsedSeconds.value = 0
  }
  if (isCompleted.value) stopTimer()
}

function resetPractice() {
  stopTimer()
  typedText.value = ''
  startTime.value = 0
  elapsedSeconds.value = 0
  focusInput()
}

function pickRandomPassage() {
  const nextIndexes = passages.map((_, index) => index).filter((index) => index !== currentIndex.value)
  currentIndex.value = nextIndexes[Math.floor(Math.random() * nextIndexes.length)] ?? 0
  resetPractice()
}

function focusInput() {
  nextTick(() => inputRef.value?.focus?.())
}

function charClass(index) {
  if (index === inputChars.value.length && !isCompleted.value) return 'char char-current'
  if (index >= inputChars.value.length) return 'char char-pending'
  return inputChars.value[index] === passageChars.value[index] ? 'char char-correct' : 'char char-wrong'
}

onBeforeUnmount(stopTimer)
</script>

<style scoped>
.tool-page {
  --typing-box-min-height: 180px;
  --typing-box-radius: 14px;
  --typing-box-padding: 22px;
  --typing-font-size: 20px;
  --typing-line-height: 2.1;
  --typing-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  min-height: 100%;
  overflow: auto;
  background: #f8fafc;
  padding: 0 1rem 1rem;
}
.tool-header,
.tool-card,
.stats-bar { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.tool-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 20px 24px; }
.tool-card { padding: 20px; }
.stats-bar { display: flex; align-items: center; gap: 0; overflow-x: auto; padding: 10px 14px; }
.stat-item { display: inline-flex; min-width: max-content; align-items: baseline; gap: 6px; padding: 0 16px; border-right: 1px solid #e5e7eb; }
.stat-item:first-child { padding-left: 4px; }
.stat-item:last-child { border-right: 0; padding-right: 4px; }
.stat-item span { color: #64748b; font-size: 12px; }
.stat-item strong { color: #111827; font-size: 16px; font-weight: 800; line-height: 1; }
.passage-box {
  box-sizing: border-box;
  min-height: var(--typing-box-min-height);
  border-radius: var(--typing-box-radius);
  border: 1px solid #e5e7eb;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  color: #334155;
  cursor: text;
  font-family: var(--typing-font-family);
  font-size: var(--typing-font-size);
  font-weight: 400;
  letter-spacing: 0;
  line-height: var(--typing-line-height);
  padding: var(--typing-box-padding);
  text-rendering: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.typing-input { display: block; }
.char {
  border-radius: 3px;
  padding: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.char-pending { color: #475569; }
.char-current { background: #dbeafe; box-shadow: inset 0 -2px 0 #3b82f6; color: #1e3a8a; }
.char-correct { background: #dcfce7; color: #166534; }
.char-wrong { background: #fee2e2; color: #b91c1c; }
:deep(.typing-input .el-textarea__inner) {
  box-sizing: border-box;
  min-height: var(--typing-box-min-height) !important;
  border-radius: var(--typing-box-radius);
  color: #334155;
  font-family: var(--typing-font-family);
  font-size: var(--typing-font-size);
  font-weight: 400;
  letter-spacing: 0;
  line-height: var(--typing-line-height);
  overflow-wrap: normal;
  padding: var(--typing-box-padding);
  resize: none;
  text-rendering: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
