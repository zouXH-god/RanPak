<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import * as Icons from '@element-plus/icons-vue'
import { House, Search } from '@element-plus/icons-vue'
import mascotUrl from '../static/images/home-mascot.png'
import { featureGroups, filterFeatureGroups } from '../data/features'

const searchText = ref('')
const visibleFeatureGroups = computed(() => searchText.value.trim() ? filterFeatureGroups(searchText.value) : featureGroups)
</script>

<template>
  <div class="home-page">
    <div class="home-bg">
      <span class="petal petal-a"></span>
      <span class="petal petal-b"></span>
      <span class="petal petal-c"></span>
      <span class="spark spark-a">✦</span>
      <span class="spark spark-b">✧</span>
      <span class="spark spark-c">✦</span>
    </div>

    <section class="hero-panel">
      <div class="hero-copy">
        <div class="home-mark">
          <el-icon><House /></el-icon>
          RanTerminal
        </div>
        <h1>逝染</h1>
        <p class="hero-prose">你我终会相逢,就像山川合流,就像万河归海。我涉旷野丛林而过,你撑船渡我,入灿灿花海。我把对你的喜欢藏进云里,隐于风里,揉进眼里</p>
      </div>

      <div class="mascot-stage" aria-hidden="true">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <img class="mascot" :src="mascotUrl" alt="" />
        <div class="status-card status-card-a">Ready</div>
        <div class="status-card status-card-b">✨ Tool Hub</div>
      </div>
    </section>

    <section id="feature-directory" class="feature-directory">
      <div class="section-heading">
        <div>
          <h2>全部功能</h2>
          <p>按工作流分组整理，直接点击进入对应页面。</p>
        </div>
        <el-input v-model="searchText" class="feature-search" clearable placeholder="搜索功能、关键词或路径">
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <div class="feature-groups">
        <section v-for="group in visibleFeatureGroups" :key="group.title" class="feature-group" :class="`tone-${group.tone}`">
          <div class="group-header">
            <h3>{{ group.title }}</h3>
            <span>{{ group.items.length }} 项</span>
          </div>
          <div class="feature-grid">
            <RouterLink v-for="item in group.items" :key="item.label" class="feature-card" :to="item.to">
              <span class="feature-icon">
                <el-icon><component :is="Icons[item.icon]" /></el-icon>
              </span>
              <span class="feature-text">
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </span>
            </RouterLink>
          </div>
        </section>
        <div v-if="searchText && visibleFeatureGroups.length === 0" class="empty-search">
          没有找到匹配的功能
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  position: relative;
  min-height: calc(100vh - 1rem);
  padding: 1.5rem 1.75rem 2.5rem;
  overflow: hidden;
  color: #1f2937;
  /* background: #fff8fb; */
}

.home-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.home-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.24;
  background-image:
    radial-gradient(circle, rgba(255, 126, 172, 0.35) 1px, transparent 1px),
    radial-gradient(circle, rgba(44, 212, 217, 0.26) 1px, transparent 1px);
  background-position: 0 0, 18px 18px;
  background-size: 36px 36px;
}

.petal,
.spark {
  position: absolute;
  z-index: 1;
}

.petal {
  width: 22px;
  height: 14px;
  border-radius: 80% 0 80% 0;
  background: linear-gradient(135deg, #ff9bc1, #fff1f7);
  box-shadow: 0 8px 18px rgba(255, 105, 153, 0.2);
  animation: floatPetal 8s ease-in-out infinite;
}

.petal-a { left: 10%; top: 12%; }
.petal-b { right: 18%; top: 30%; animation-delay: -2s; }
.petal-c { left: 55%; top: 10%; animation-delay: -4s; }

.spark {
  color: #ff8fb8;
  font-size: 1.25rem;
  text-shadow: 0 0 14px rgba(255, 143, 184, 0.55);
  animation: twinkle 3.4s ease-in-out infinite;
}

.spark-a { left: 39%; top: 14%; }
.spark-b { right: 8%; top: 16%; animation-delay: -1s; }
.spark-c { left: 7%; top: 58%; animation-delay: -2s; }

.hero-panel {
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 22rem;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 28rem);
  gap: 2rem;
  align-items: center;
  padding: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 60px rgba(77, 111, 130, 0.14);
  backdrop-filter: blur(18px);
}

.home-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #ff6f9f;
  font-size: 0.95rem;
  font-weight: 700;
}

.hero-copy {
  position: relative;
  z-index: 4;
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(3rem, 7vw, 5.6rem);
  line-height: 0.98;
  font-weight: 900;
  color: transparent;
  letter-spacing: 0;
  background: linear-gradient(135deg, #162033 0%, #be4f77 52%, #178fa3 100%);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 12px 30px rgba(190, 79, 119, 0.14);
}

.hero-prose {
    position: relative;
    max-width: 36rem;
    margin: 1.35rem 0 0;
    /* border: 1px solid rgba(226, 232, 240, 0.72); */
    border-radius: 0.85rem;
    padding: 1rem 1.15rem;
    color: #33415561;
    font-size: clamp(1rem, 1.5vw, 1.2rem);
    line-height: 2;
    font-weight: 600;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.75), 0 8px 22px rgba(77, 111, 130, 0.12);
    /* background: rgb(255 255 255 / 26%); */
    box-shadow: 0 14px 20px rgb(209 31 163 / 5%);
    backdrop-filter: blur(18px) saturate(1.12);
    -webkit-backdrop-filter: blur(18px) saturate(1.12);
}

.mascot-stage {
  position: relative;
  min-height: 22rem;
  isolation: isolate;
}

.orbit {
  position: absolute;
  border: 1px dashed rgba(255, 124, 171, 0.34);
  border-radius: 999px;
  inset: 2rem 1rem 1rem;
  transform: rotate(-12deg);
}

.orbit-two {
  inset: 3.2rem 2.1rem 2.2rem;
  border-color: rgba(44, 212, 217, 0.38);
  transform: rotate(18deg);
}

.mascot {
  position: absolute;
  right: -1.5rem;
  bottom: -2.3rem;
  z-index: 2;
  width: min(25rem, 106%);
  max-height: 28rem;
  object-fit: contain;
  filter: drop-shadow(0 26px 42px rgba(255, 124, 171, 0.22));
  animation: mascotFloat 5.5s ease-in-out infinite;
}

.status-card {
  position: absolute;
  z-index: 3;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 0.9rem;
  padding: 0.55rem 0.8rem;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 14px 32px rgba(77, 111, 130, 0.16);
}

.status-card-a { left: 1rem; top: 4.5rem; }
.status-card-b { right: 0.5rem; bottom: 3.8rem; }

.feature-directory {
  position: relative;
  z-index: 2;
  margin-top: 1.5rem;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-heading h2 {
  margin: 0;
  color: #162033;
  font-size: 1.55rem;
  font-weight: 850;
}

.section-heading p {
  margin: 0;
  color: #64748b;
  font-size: 0.95rem;
}

.feature-search {
  width: min(24rem, 100%);
  flex: 0 0 auto;
}

.feature-groups {
  display: grid;
  gap: 1rem;
}

.empty-search {
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 1rem;
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.72);
}

.feature-group {
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 42px rgba(77, 111, 130, 0.1);
  backdrop-filter: blur(16px);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.group-header h3 {
  margin: 0;
  color: #263449;
  font-size: 1rem;
  font-weight: 850;
}

.group-header span {
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(248, 250, 252, 0.9);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14.5rem, 1fr));
  gap: 0.75rem;
}

.feature-card {
  display: flex;
  min-height: 5.25rem;
  align-items: flex-start;
  gap: 0.8rem;
  border: 1px solid rgba(226, 232, 240, 0.78);
  border-radius: 0.9rem;
  padding: 0.85rem;
  color: inherit;
  background: rgba(255, 255, 255, 0.7);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 124, 171, 0.42);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 16px 30px rgba(77, 111, 130, 0.14);
}

.feature-icon {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  color: #be4f77;
  font-size: 1.1rem;
  background: #fff0f6;
  box-shadow: 0 10px 20px rgba(255, 143, 184, 0.15);
}

.feature-text {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.feature-text strong {
  color: #243247;
  font-size: 0.96rem;
  line-height: 1.35;
}

.feature-text small {
  color: #64748b;
  font-size: 0.8rem;
  line-height: 1.55;
}

.tone-cyan .feature-icon {
  color: #178fa3;
  background: #e9fbff;
  box-shadow: 0 10px 20px rgba(44, 212, 217, 0.14);
}

.tone-violet .feature-icon {
  color: #6f63c8;
  background: #f3f1ff;
  box-shadow: 0 10px 20px rgba(143, 140, 255, 0.14);
}

.tone-green .feature-icon {
  color: #238a59;
  background: #ecfff4;
  box-shadow: 0 10px 20px rgba(87, 214, 141, 0.14);
}

.tone-slate .feature-icon {
  color: #475569;
  background: #f1f5f9;
  box-shadow: 0 10px 20px rgba(100, 116, 139, 0.12);
}

@keyframes mascotFloat {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(1.3deg); }
}

@keyframes mascotFloatNarrow {
  0%, 100% { transform: translateX(-50%) translateY(0) rotate(0deg); }
  50% { transform: translateX(-50%) translateY(-10px) rotate(1.3deg); }
}

@keyframes floatPetal {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50% { transform: translate3d(18px, 22px, 0) rotate(22deg); }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.42; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
}

@media (max-width: 1100px) {
  .hero-panel {
    grid-template-columns: 1fr;
    padding: 2rem;
  }

  .mascot-stage {
    margin-top: 1.5rem;
    min-height: 18rem;
  }

  .mascot {
    left: 50%;
    right: auto;
    bottom: -3rem;
    width: min(24rem, 90%);
    animation-name: mascotFloatNarrow;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .feature-search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .home-page {
    padding: 1rem;
  }

  .hero-panel {
    padding: 1.25rem;
    border-radius: 1rem;
  }

  .hero-copy h1 {
    font-size: 3rem;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
