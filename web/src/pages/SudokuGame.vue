<template>
  <div class="game-page">
    <div class="mx-auto flex max-w-[1200px] flex-col gap-4">
      <header class="game-header">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-gray-900">数独</h1>
          <p class="mt-1 text-sm text-gray-500">选择难度后生成题目，支持候选标记、错误检查和提示。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <el-select v-model="difficulty" class="w-28" @change="newGame">
            <el-option label="简单" value="easy" />
            <el-option label="中等" value="medium" />
            <el-option label="困难" value="hard" />
          </el-select>
          <el-button :icon="RefreshRight" type="primary" @click="newGame">重开</el-button>
        </div>
      </header>

      <section class="stats-bar">
        <div v-for="item in stats" :key="item.label" class="stat-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </section>

      <section class="game-card">
        <div class="sudoku-board">
          <button
            v-for="cell in cells"
            :key="cell.index"
            class="sudoku-cell"
            :class="cellClass(cell.index)"
            @click="selectedIndex = cell.index"
          >
            <span v-if="grid[cell.index]" class="cell-value">{{ grid[cell.index] }}</span>
            <span v-else class="notes">{{ notes[cell.index].join(' ') }}</span>
          </button>
        </div>

        <div class="side-panel">
          <div class="number-pad">
            <el-button v-for="number in 9" :key="number" @click="setNumber(number)">{{ number }}</el-button>
          </div>
          <div class="flex flex-wrap gap-2">
            <el-button :type="noteMode ? 'primary' : 'default'" @click="noteMode = !noteMode">候选</el-button>
            <el-button @click="clearCell">清除</el-button>
            <el-button @click="checkErrors">检查错误</el-button>
            <el-button @click="giveHint">提示</el-button>
          </div>
          <el-alert v-if="message" :title="message" :type="messageType" show-icon :closable="false" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'

const difficulty = ref('medium')
const solution = ref(Array(81).fill(0))
const puzzle = ref(Array(81).fill(0))
const grid = ref(Array(81).fill(0))
const notes = ref(Array.from({ length: 81 }, () => []))
const selectedIndex = ref(0)
const elapsedSeconds = ref(0)
const errors = ref(0)
const hints = ref(0)
const message = ref('')
const messageType = ref('info')
const noteMode = ref(false)
let timerId = null

const blanksByDifficulty = { easy: 36, medium: 46, hard: 54 }
const difficultyLabel = computed(() => ({ easy: '简单', medium: '中等', hard: '困难' }[difficulty.value]))
const cells = computed(() => Array.from({ length: 81 }, (_, index) => ({ index })))
const isComplete = computed(() => grid.value.every((value, index) => value === solution.value[index]))
const elapsedText = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const stats = computed(() => [
  { label: '难度', value: difficultyLabel.value },
  { label: '用时', value: elapsedText.value },
  { label: '错误', value: errors.value },
  { label: '提示', value: hints.value },
  { label: '状态', value: isComplete.value ? '已完成' : '进行中' },
])

function shuffle(values) {
  const list = [...values]
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[list[index], list[target]] = [list[target], list[index]]
  }
  return list
}

function isValid(board, index, value) {
  const row = Math.floor(index / 9)
  const col = index % 9
  const boxRow = Math.floor(row / 3) * 3
  const boxCol = Math.floor(col / 3) * 3
  for (let offset = 0; offset < 9; offset += 1) {
    if (board[row * 9 + offset] === value) return false
    if (board[offset * 9 + col] === value) return false
    const boxIndex = (boxRow + Math.floor(offset / 3)) * 9 + boxCol + (offset % 3)
    if (board[boxIndex] === value) return false
  }
  return true
}

function fillBoard(board, index = 0) {
  if (index >= 81) return true
  if (board[index]) return fillBoard(board, index + 1)
  for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (!isValid(board, index, value)) continue
    board[index] = value
    if (fillBoard(board, index + 1)) return true
    board[index] = 0
  }
  return false
}

function buildPuzzle(fullBoard) {
  const nextPuzzle = [...fullBoard]
  for (const index of shuffle(Array.from({ length: 81 }, (_, item) => item)).slice(0, blanksByDifficulty[difficulty.value])) {
    nextPuzzle[index] = 0
  }
  return nextPuzzle
}

function startTimer() {
  if (timerId) window.clearInterval(timerId)
  timerId = window.setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
}

function stopTimer() {
  if (!timerId) return
  window.clearInterval(timerId)
  timerId = null
}

function newGame() {
  const fullBoard = Array(81).fill(0)
  fillBoard(fullBoard)
  solution.value = fullBoard
  puzzle.value = buildPuzzle(fullBoard)
  grid.value = [...puzzle.value]
  notes.value = Array.from({ length: 81 }, () => [])
  selectedIndex.value = puzzle.value.findIndex((value) => value === 0)
  elapsedSeconds.value = 0
  errors.value = 0
  hints.value = 0
  message.value = ''
  noteMode.value = false
  startTimer()
}

function isFixed(index) {
  return puzzle.value[index] !== 0
}

function setNumber(number) {
  const index = selectedIndex.value
  if (index < 0 || isFixed(index) || isComplete.value) return
  if (noteMode.value) {
    const current = notes.value[index]
    notes.value[index] = current.includes(number) ? current.filter((item) => item !== number) : [...current, number].sort()
    return
  }
  grid.value[index] = number
  notes.value[index] = []
  if (isComplete.value) {
    stopTimer()
    showMessage('恭喜完成本局数独', 'success')
  }
}

function clearCell() {
  const index = selectedIndex.value
  if (index < 0 || isFixed(index) || isComplete.value) return
  grid.value[index] = 0
  notes.value[index] = []
}

function checkErrors() {
  const wrong = grid.value.filter((value, index) => value && value !== solution.value[index]).length
  if (wrong > 0) errors.value += wrong
  showMessage(wrong ? `发现 ${wrong} 处错误` : '当前填写没有错误', wrong ? 'warning' : 'success')
}

function giveHint() {
  const indexes = grid.value.map((value, index) => (value === solution.value[index] ? -1 : index)).filter((index) => index >= 0 && !isFixed(index))
  if (!indexes.length) return
  const index = indexes[Math.floor(Math.random() * indexes.length)]
  grid.value[index] = solution.value[index]
  notes.value[index] = []
  selectedIndex.value = index
  hints.value += 1
  showMessage('已填入一个提示数字', 'info')
  if (isComplete.value) {
    stopTimer()
    showMessage('恭喜完成本局数独', 'success')
  }
}

function showMessage(text, type) {
  message.value = text
  messageType.value = type
}

function cellClass(index) {
  const row = Math.floor(index / 9)
  const col = index % 9
  return {
    selected: selectedIndex.value === index,
    fixed: isFixed(index),
    wrong: grid.value[index] && grid.value[index] !== solution.value[index],
    'box-right': col === 2 || col === 5,
    'box-bottom': row === 2 || row === 5,
  }
}

onMounted(newGame)
onBeforeUnmount(stopTimer)
</script>

<style scoped>
.game-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.game-header,
.game-card,
.stats-bar { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.game-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 20px 24px; }
.stats-bar { display: flex; align-items: center; overflow-x: auto; padding: 10px 14px; }
.stat-item { display: inline-flex; min-width: max-content; align-items: baseline; gap: 6px; padding: 0 18px; border-right: 1px solid #e5e7eb; }
.stat-item:first-child { padding-left: 4px; }
.stat-item:last-child { border-right: 0; padding-right: 4px; }
.stat-item span { color: #64748b; font-size: 12px; }
.stat-item strong { color: #111827; font-size: 16px; font-weight: 800; }
.game-card { display: grid; gap: 20px; padding: 20px; }
.sudoku-board { display: grid; width: min(86vw, 560px); aspect-ratio: 1; grid-template-columns: repeat(9, 1fr); border: 2px solid #334155; background: #334155; }
.sudoku-cell { position: relative; display: grid; place-items: center; border: 0; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; background: white; color: #1e293b; cursor: pointer; font-size: clamp(18px, 5vw, 30px); font-weight: 700; }
.sudoku-cell.fixed { background: #f1f5f9; color: #0f172a; }
.sudoku-cell.selected { background: #dbeafe; }
.sudoku-cell.wrong:not(.fixed) { color: #dc2626; }
.sudoku-cell.box-right { border-right: 2px solid #334155; }
.sudoku-cell.box-bottom { border-bottom: 2px solid #334155; }
.notes { display: block; max-width: 80%; color: #64748b; font-size: clamp(9px, 2vw, 12px); line-height: 1.1; word-break: break-word; }
.side-panel { display: flex; flex-direction: column; gap: 14px; }
.number-pad { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-width: 320px; }
@media (min-width: 1024px) {
  .game-card { grid-template-columns: auto minmax(260px, 1fr); align-items: start; }
}
</style>
