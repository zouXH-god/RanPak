<template>
  <div class="game-page">
    <div class="mx-auto flex max-w-[1200px] flex-col gap-4">
      <header class="game-header">
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-gray-900">恐龙跑酷</h1>
          <p class="mt-1 text-sm text-gray-500">使用 release 包内的 Chrome 离线恐龙跑酷完整代码，本地离线加载。</p>
        </div>
        <el-button :icon="RefreshRight" type="primary" @click="reloadGame">刷新游戏</el-button>
      </header>

      <section class="game-card">
        <iframe
          :key="frameKey"
          class="game-frame game-frame-dino"
          src="/games/dion.html"
          title="恐龙跑酷"
        />
      </section>
      <SourceCredit :sources="sources" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'
import SourceCredit from '../components/SourceCredit.vue'

const frameKey = ref(0)
const sources = [
  { name: 'Chromium T-Rex Runner', url: 'https://source.chromium.org/chromium/chromium/src/+/main:components/neterror/resources/offline.js' },
]

function reloadGame() {
  frameKey.value += 1
}
</script>

<style scoped>
.game-page { min-height: 100%; overflow: auto; background: #f8fafc; padding: 0 1rem 1rem; }
.game-header,
.game-card { border: 1px solid #f3f4f6; border-radius: 1rem; background: white; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }
.game-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 20px 24px; }
.game-card { padding: 20px; }
.game-frame { display: block; width: 100%; border: 0; border-radius: 14px; background: #f7f7f7; }
.game-frame-dino { min-height: min(70vh, 620px); }
</style>
