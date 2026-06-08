<template>
  <div class="h-full px-4 pb-4">
    <div class="mx-auto max-w-5xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">{{ pageTitle }}</h1>
          <p class="mt-1 text-sm text-gray-500">{{ pageDescription }}</p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <el-button v-if="showLive2dConfig" :icon="Setting" @click="openLive2dSettings">Live2D 设置</el-button>
          <el-button type="primary" :icon="Monitor" @click="openWindow">打开子窗口</el-button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section class="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <el-form label-position="top">
            <template v-if="showWindowConfig">
              <h2 class="mb-4 text-sm font-semibold text-gray-800">窗口与显示</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="窗口宽度">
                  <el-input-number v-model="form.width" :min="260" :max="1200" controls-position="right" />
                </el-form-item>
                <el-form-item label="窗口高度">
                  <el-input-number v-model="form.height" :min="140" :max="1200" controls-position="right" />
                </el-form-item>
                <el-form-item label="锁定子窗口">
                  <el-switch v-model="form.locked" active-text="已锁定" inactive-text="可移动" @change="setLocked" />
                </el-form-item>
                <el-form-item label="组件选择与顺序" class="sm:col-span-2">
                  <div class="component-picker">
                    <div
                      class="component-column"
                      @dragover.prevent
                      @drop="dropOnAvailable"
                    >
                      <div class="component-column-title">可选择组件</div>
                      <div
                        v-for="component in availableComponents"
                        :key="component.type"
                        class="component-item"
                        draggable="true"
                        @dragstart="startComponentDrag(component.type, 'available')"
                      >
                        <span>{{ component.label }}</span>
                        <el-button size="small" text @click="addComponent(component.type)">添加</el-button>
                      </div>
                    </div>
                    <div
                      class="component-column active"
                      @dragover.prevent
                      @drop="dropOnLoaded(null)"
                    >
                      <div class="component-column-title">已加载组件</div>
                      <div
                        v-for="(component, index) in form.components"
                        :key="component.type"
                        class="component-item loaded"
                        draggable="true"
                        @dragstart="startComponentDrag(component.type, 'loaded', index)"
                        @dragover.prevent
                        @drop.stop="dropOnLoaded(index)"
                      >
                        <span class="drag-handle">::</span>
                        <span>{{ componentLabel(component.type) }}</span>
                        <el-input-number
                          v-model="component.height"
                          class="component-height"
                          :min="componentRule(component.type).min"
                          :max="componentRule(component.type).max"
                          :step="10"
                          controls-position="right"
                        />
                        <el-button size="small" text type="danger" @click="removeComponent(component.type)">移除</el-button>
                      </div>
                      <div v-if="!form.components.length" class="component-empty">拖入组件后显示</div>
                    </div>
                  </div>
                </el-form-item>
              </div>

              <h2 class="mb-4 mt-2 text-sm font-semibold text-gray-800">公共配置</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="背景颜色">
                  <el-color-picker v-model="form.common.backgroundColor" show-alpha />
                </el-form-item>
                <el-form-item label="背景透明度">
                  <el-slider v-model="form.common.backgroundOpacity" :min="0" :max="100" />
                </el-form-item>
                <el-form-item label="字体颜色">
                  <el-color-picker v-model="form.common.fontColor" />
                </el-form-item>
                <el-form-item label="字体">
                  <el-select v-model="form.common.fontFamily">
                    <el-option label="系统默认" value="system" />
                    <el-option label="Arial" value="Arial, sans-serif" />
                    <el-option label="Segoe UI" value="Segoe UI, sans-serif" />
                    <el-option label="Consolas" value="Consolas, monospace" />
                    <el-option label="DIN 风格" value="DIN Alternate, Bahnschrift, Arial, sans-serif" />
                    <el-option label="黑体" value="SimHei, Microsoft YaHei, sans-serif" />
                  </el-select>
                </el-form-item>
                <el-form-item label="字体大小">
                  <el-input-number v-model="form.common.fontSize" :min="24" :max="96" />
                </el-form-item>
                <el-form-item label="字重">
                  <el-select v-model="form.common.fontWeight">
                    <el-option label="常规" :value="400" />
                    <el-option label="中等" :value="500" />
                    <el-option label="半粗" :value="600" />
                    <el-option label="粗体" :value="700" />
                    <el-option label="特粗" :value="800" />
                  </el-select>
                </el-form-item>
              </div>

              <h2 class="mb-4 mt-2 text-sm font-semibold text-gray-800">快捷键</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="锁定/解锁子窗口">
                  <div class="shortcut-recorder">
                    <button
                      class="shortcut-button"
                      :class="{ recording: recordingShortcut === 'toggleLocked' }"
                      type="button"
                      @click="startShortcutRecording('toggleLocked')"
                    >
                      {{ shortcutButtonText('toggleLocked') }}
                    </button>
                    <el-button text type="danger" @click="clearShortcut('toggleLocked')">清空</el-button>
                  </div>
                </el-form-item>
                <el-form-item label="切换看板娘">
                  <div class="shortcut-recorder">
                    <button
                      class="shortcut-button"
                      :class="{ recording: recordingShortcut === 'switchLive2d' }"
                      type="button"
                      @click="startShortcutRecording('switchLive2d')"
                    >
                      {{ shortcutButtonText('switchLive2d') }}
                    </button>
                    <el-button text type="danger" @click="clearShortcut('switchLive2d')">清空</el-button>
                  </div>
                </el-form-item>
              </div>
              <p class="mb-4 text-xs leading-5 text-gray-500">
                点击后按下组合键完成录制；Esc 取消，Backspace/Delete 清空。
              </p>
            </template>

            <template v-if="showAlarmConfig">
              <h2 class="mb-4 mt-2 text-sm font-semibold text-gray-800">闹钟</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="启用闹钟">
                  <el-switch v-model="form.alarm.enabled" />
                </el-form-item>
                <el-form-item label="闹铃声音">
                  <el-switch v-model="form.alarm.soundEnabled" />
                </el-form-item>
                <el-form-item label="闹钟时间与备注" class="sm:col-span-2">
                  <div class="alarm-list">
                    <div v-for="(item, index) in form.alarm.items" :key="item.id" class="alarm-view-row">
                      <button class="alarm-view-main" type="button" @click="openEditAlarmDialog(index)">
                        <span class="alarm-time">{{ item.time }}</span>
                        <span class="alarm-meta">
                          <strong>{{ alarmRepeatText(item) }}</strong>
                          <small>{{ item.note || '无备注' }}</small>
                        </span>
                      </button>
                      <div class="alarm-view-actions">
                        <el-button size="small" text @click="openEditAlarmDialog(index)">编辑</el-button>
                        <el-button size="small" text type="danger" :disabled="form.alarm.items.length <= 1" @click="removeAlarmItem(index)">删除</el-button>
                      </div>
                    </div>
                    <el-button class="!self-start" @click="openCreateAlarmDialog">添加闹钟</el-button>
                  </div>
                </el-form-item>
                <el-form-item label="默认铃声文件" class="sm:col-span-2">
                  <div class="sound-picker">
                    <el-input v-model="form.alarm.soundPath" placeholder="未选择时使用内置提示音" readonly />
                    <el-button @click="selectSound('alarm')">选择</el-button>
                    <el-button text type="danger" @click="clearSound('alarm')">清空</el-button>
                  </div>
                </el-form-item>
              </div>

              <h2 class="mb-4 mt-2 text-sm font-semibold text-gray-800">秒表</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="启用秒表">
                  <el-switch v-model="form.stopwatch.enabled" />
                </el-form-item>
                <el-form-item label="打开后自动开始">
                  <el-switch v-model="form.stopwatch.autoStart" />
                </el-form-item>
                <el-form-item label="倒计时秒数">
                  <el-input-number v-model="form.stopwatch.durationSeconds" :min="1" :max="86400" controls-position="right" />
                </el-form-item>
                <el-form-item label="提示文字">
                  <el-input v-model="form.stopwatch.message" />
                </el-form-item>
                <el-form-item label="闹铃声音">
                  <el-switch v-model="form.stopwatch.soundEnabled" />
                </el-form-item>
                <el-form-item label="铃声文件" class="sm:col-span-2">
                  <div class="sound-picker">
                    <el-input v-model="form.stopwatch.soundPath" placeholder="未选择时使用内置提示音" readonly />
                    <el-button @click="selectSound('stopwatch')">选择</el-button>
                    <el-button text type="danger" @click="clearSound('stopwatch')">清空</el-button>
                  </div>
                </el-form-item>
              </div>
            </template>

            <template v-if="showClockConfig">
              <h2 class="mb-4 text-sm font-semibold text-gray-800">时钟设置</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="时间格式">
                  <el-select v-model="form.clock.format">
                    <el-option label="24 小时制 HH:mm:ss" value="24" />
                    <el-option label="12 小时制 hh:mm:ss A" value="12" />
                  </el-select>
                </el-form-item>
                <el-form-item label="显示日期">
                  <el-switch v-model="form.clock.showDate" />
                </el-form-item>
                <el-form-item label="显示农历日期">
                  <el-switch v-model="form.clock.showLunarDate" />
                </el-form-item>
                <el-form-item label="字距">
                  <el-input-number v-model="form.clock.letterSpacing" :min="-4" :max="16" :step="0.5" controls-position="right" />
                </el-form-item>
                <el-form-item label="横向缩放">
                  <el-input-number v-model="form.clock.scaleX" :min="0.5" :max="2" :step="0.05" :precision="2" controls-position="right" />
                </el-form-item>
                <el-form-item label="纵向缩放">
                  <el-input-number v-model="form.clock.scaleY" :min="0.5" :max="2" :step="0.05" :precision="2" controls-position="right" />
                </el-form-item>
                <el-form-item label="文字阴影">
                  <el-switch v-model="form.clock.textShadowEnabled" />
                </el-form-item>
                <el-form-item label="字体颜色">
                  <el-color-picker v-model="form.clock.style.fontColor" />
                </el-form-item>
                <el-form-item label="背景颜色">
                  <el-color-picker v-model="form.clock.style.backgroundColor" show-alpha />
                </el-form-item>
                <el-form-item label="背景透明度">
                  <el-slider v-model="form.clock.style.backgroundOpacity" :min="0" :max="100" />
                </el-form-item>
                <el-form-item label="阴影颜色">
                  <el-color-picker v-model="form.clock.style.shadowColor" show-alpha />
                </el-form-item>
              </div>
            </template>

            <template v-if="showLive2dConfig">
              <h2 class="mb-4 text-sm font-semibold text-gray-800">看板娘设置</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="看板娘">
                  <el-select v-model="form.live2d.modelId" filterable @change="handleModelChange">
                    <el-option v-for="model in modelOptions" :key="model.id" :label="model.name" :value="model.id">
                      <div class="model-option">
                        <img v-if="model.cover" class="model-option-cover" :src="model.cover" alt="" />
                        <div class="model-option-meta">
                          <span>{{ model.name }}</span>
                          <small>{{ model.defaultModel ? '默认模型' : '扩展模型' }}</small>
                        </div>
                      </div>
                    </el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="贴图/变体">
                  <el-select v-model="form.live2d.textureId" :disabled="textureOptions.length <= 1">
                    <el-option v-for="texture in textureOptions" :key="texture.value" :label="texture.label" :value="texture.value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="透明度">
                  <el-slider v-model="form.live2d.opacity" :min="20" :max="100" />
                </el-form-item>
                <el-form-item label="Widget 地址">
                  <el-input v-model="form.live2d.widgetUrl" />
                </el-form-item>
              </div>
            </template>

            <template v-if="showWeatherConfig">
              <h2 class="mb-4 text-sm font-semibold text-gray-800">天气设置</h2>
              <div class="grid gap-4 sm:grid-cols-2">
                <el-form-item label="位置名称">
                  <div class="location-row">
                    <el-input v-model="form.weather.locationName" placeholder="例如：上海" @keyup.enter="searchWeatherLocation" />
                    <el-button :loading="geocodingLoading" @click="searchWeatherLocation">查询站点</el-button>
                  </div>
                </el-form-item>
                <el-form-item label="刷新间隔（分钟）">
                  <el-input-number v-model="form.weather.refreshMinutes" :min="5" :max="120" controls-position="right" />
                </el-form-item>
                <el-form-item label="NMC 站点代码">
                  <el-input v-model="form.weather.nmcStationId" placeholder="例如：Wqsps" />
                </el-form-item>
                <el-form-item label="纬度">
                  <el-input-number v-model="form.weather.latitude" :min="-90" :max="90" :step="0.0001" :precision="4" controls-position="right" />
                </el-form-item>
                <el-form-item label="经度">
                  <el-input-number v-model="form.weather.longitude" :min="-180" :max="180" :step="0.0001" :precision="4" controls-position="right" />
                </el-form-item>
                <el-form-item label="显示体感温度">
                  <el-switch v-model="form.weather.showApparent" />
                </el-form-item>
                <el-form-item label="显示湿度">
                  <el-switch v-model="form.weather.showHumidity" />
                </el-form-item>
                <el-form-item label="显示风速">
                  <el-switch v-model="form.weather.showWind" />
                </el-form-item>
                <el-form-item label="显示最高/最低温">
                  <el-switch v-model="form.weather.showDailyRange" />
                </el-form-item>
                <el-form-item label="字体颜色">
                  <el-color-picker v-model="form.weather.style.fontColor" />
                </el-form-item>
                <el-form-item label="背景颜色">
                  <el-color-picker v-model="form.weather.style.backgroundColor" show-alpha />
                </el-form-item>
                <el-form-item label="背景透明度">
                  <el-slider v-model="form.weather.style.backgroundOpacity" :min="0" :max="100" />
                </el-form-item>
                <el-form-item label="阴影">
                  <el-switch v-model="form.weather.style.shadowEnabled" />
                </el-form-item>
                <el-form-item label="阴影颜色">
                  <el-color-picker v-model="form.weather.style.shadowColor" show-alpha />
                </el-form-item>
              </div>
            </template>

            <div class="action-bar">
              <el-button type="primary" @click="updateWindow">应用到子窗口</el-button>
              <el-button :type="form.locked ? 'warning' : 'default'" @click="toggleLocked">
                {{ form.locked ? '解锁子窗口' : '锁定子窗口' }}
              </el-button>
              <el-button @click="closeWindow">关闭子窗口</el-button>
            </div>
          </el-form>
        </section>

        <section class="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h2 class="mb-4 text-sm font-semibold text-gray-800">预览</h2>
          <div ref="previewBox" class="preview-box">
            <iframe
              ref="previewFrame"
              class="preview-frame"
              :style="previewFrameStyle"
              src="/preview-child-window"
              title="桌面部件预览"
              @load="postPreviewOptions"
            ></iframe>
          </div>
          <p class="mt-3 text-xs leading-5 text-gray-500">锁定后窗口会鼠标穿透；需要从本面板解锁。</p>
        </section>
      </div>
    </div>

    <SourceCredit :sources="sources" class="mt-3" />

    <el-dialog
      v-model="alarmDialogVisible"
      :title="editingAlarmIndex >= 0 ? '编辑闹钟' : '新增闹钟'"
      width="560px"
      append-to-body
    >
      <el-form label-position="top">
        <div class="alarm-dialog-grid">
          <el-form-item label="时间">
            <el-time-picker v-model="alarmDraft.time" value-format="HH:mm" format="HH:mm" placeholder="选择时间" />
          </el-form-item>
          <el-form-item label="触发周期">
            <el-select v-model="alarmDraft.repeat" @change="normalizeAlarmItemSchedule(alarmDraft)">
              <el-option label="仅一次" value="once" />
              <el-option label="每天" value="daily" />
              <el-option label="每周" value="weekly" />
              <el-option label="每月" value="monthly" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="alarmDraft.repeat === 'once'" label="日期" class="alarm-dialog-wide">
            <el-date-picker v-model="alarmDraft.date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" placeholder="选择日期" />
          </el-form-item>
          <el-form-item v-else-if="alarmDraft.repeat === 'weekly'" label="星期" class="alarm-dialog-wide">
            <el-checkbox-group v-model="alarmDraft.weekdays">
              <el-checkbox-button v-for="day in weekdayOptions" :key="day.value" :label="day.value">{{ day.label }}</el-checkbox-button>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item v-else-if="alarmDraft.repeat === 'monthly'" label="每月日期" class="alarm-dialog-wide">
            <el-input-number v-model="alarmDraft.dayOfMonth" :min="1" :max="31" controls-position="right" />
          </el-form-item>
          <el-form-item label="备注" class="alarm-dialog-wide">
            <el-input v-model="alarmDraft.note" placeholder="例如 起床 / 喝水 / 出门" />
          </el-form-item>
          <el-form-item label="单独铃声" class="alarm-dialog-wide">
            <div class="sound-picker">
              <el-input v-model="alarmDraft.soundPath" placeholder="未选择时使用闹钟默认铃声" readonly />
              <el-button @click="selectAlarmItemSound(alarmDraft)">选择</el-button>
              <el-button text type="danger" @click="clearAlarmItemSound(alarmDraft)">清空</el-button>
            </div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="alarmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAlarmDialog">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Monitor, Setting } from '@element-plus/icons-vue'
import SourceCredit from '../components/SourceCredit.vue'
import { fetchLive2dCatalog } from '../utils/api/tools'
import { baseUrl } from '../utils/api/requests'

const DEFAULT_WIDGET_URL = '/vendor/live2d-widget/local-autoload.js'
const sources = [
  { name: 'live2d-widget', url: 'https://github.com/stevenjoezhang/live2d-widget' },
]
const COMPONENT_CATALOG = [
  { type: 'clock', label: '时钟', min: 64, max: 260, height: 112 },
  { type: 'live2d', label: '看板娘', min: 160, max: 900, height: 360 },
  { type: 'weather', label: '天气', min: 96, max: 360, height: 150 },
]
const route = useRoute()
const router = useRouter()
const now = ref(new Date())
const previewBox = ref(null)
const previewFrame = ref(null)
const previewBoxSize = reactive({ width: 0, height: 0 })
const recordingShortcut = ref('')
const geocodingLoading = ref(false)
const dragState = ref(null)
let timer = null
let previewResizeObserver = null
let alarmItemId = 1
const weekdayOptions = [
  { label: '日', value: 0 },
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
]

const modelOptions = ref([])
const pageMode = computed(() => {
  if (route.path === '/child-window-clock') return 'clock'
  if (route.path === '/child-window-live2d' || route.path === '/live2d-window') return 'live2d'
  if (route.path === '/child-window-weather') return 'weather'
  return 'config'
})
const showWindowConfig = computed(() => pageMode.value === 'config')
const showClockConfig = computed(() => pageMode.value === 'clock')
const showLive2dConfig = computed(() => pageMode.value === 'live2d')
const showWeatherConfig = computed(() => pageMode.value === 'weather')
const showAlarmConfig = computed(() => false)
const pageTitle = computed(() => ({
  config: '子窗口配置',
  clock: '时钟',
  live2d: '看板娘',
  weather: '天气',
}[pageMode.value]))
const pageDescription = computed(() => ({
  config: '配置透明置顶子窗口的尺寸、显示部件、锁定状态和公共样式。',
  clock: '调整悬浮时钟的显示格式、字距、缩放和阴影。',
  live2d: '选择看板娘模型、贴图变体和透明度。',
  weather: '基于 Open-Meteo 按经纬度显示实时天气。',
}[pageMode.value]))

const form = reactive({
  width: 420,
  height: 560,
  locked: false,
  showClock: true,
  showLive2d: true,
  showWeather: false,
  showAlarm: false,
  showStopwatch: false,
  components: [
    { type: 'clock', height: 112 },
    { type: 'live2d', height: 360 },
  ],
  common: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundOpacity: 0,
    fontColor: '#111827',
    fontFamily: 'system',
    fontWeight: 700,
    fontStyle: 'normal',
    fontSize: 48,
  },
  shortcuts: {
    toggleLocked: '',
    switchLive2d: '',
  },
  clock: {
    letterSpacing: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    rotate: 0,
    textShadowEnabled: true,
    textShadowColor: 'rgba(15, 23, 42, 0.16)',
    textShadowX: 0,
    textShadowY: 10,
    textShadowBlur: 28,
    format: '24',
    showDate: false,
    showLunarDate: false,
    style: {
      fontColor: '',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundOpacity: 0,
      shadowColor: 'rgba(15, 23, 42, 0.16)',
    },
  },
  live2d: {
    widgetUrl: DEFAULT_WIDGET_URL,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 100,
    modelId: 0,
    textureId: 0,
  },
  weather: {
    locationName: '上海',
    latitude: 31.2304,
    longitude: 121.4737,
    nmcStationId: 'Wqsps',
    refreshMinutes: 15,
    position: 'top-left',
    showApparent: true,
    showHumidity: true,
    showWind: true,
    showDailyRange: true,
    style: {
      fontColor: '',
      backgroundColor: 'rgba(255, 255, 255, 0.72)',
      backgroundOpacity: 72,
      shadowEnabled: true,
      shadowColor: 'rgba(15, 23, 42, 0.12)',
      shadowX: 0,
      shadowY: 16,
      shadowBlur: 42,
    },
  },
  alarm: {
    enabled: false,
    time: '08:00',
    message: '闹钟时间到',
    items: [{ id: 1, time: '08:00', note: '闹钟时间到', repeat: 'daily', date: todayString(), weekdays: [1, 2, 3, 4, 5], dayOfMonth: 1, soundPath: '' }],
    soundEnabled: true,
    soundPath: '',
  },
  stopwatch: {
    enabled: false,
    autoStart: false,
    durationSeconds: 300,
    message: '秒表时间到',
    soundEnabled: true,
    soundPath: '',
  },
})

const previewTime = computed(() => formatTime(now.value, form.clock.format))
const alarmDialogVisible = ref(false)
const editingAlarmIndex = ref(-1)
const alarmDraft = reactive(createAlarmItem({ id: 0, time: '08:00', note: '' }))
const currentModel = computed(() => modelOptions.value.find((model) => model.id === form.live2d.modelId) || modelOptions.value[0] || { textures: 1 })
const textureOptions = computed(() => Array.from({ length: Math.max(1, Number(currentModel.value.textures || 1)) }, (_item, index) => ({
  value: index,
  label: currentModel.value.textures === 1 ? '默认贴图' : `变体 ${index + 1}`,
})))
const clockTextStyle = computed(() => buildClockTextStyle(form.common, form.clock))
const availableComponents = computed(() => COMPONENT_CATALOG.filter((component) => !form.components.some((item) => item.type === component.type)))
const previewScale = computed(() => {
  const width = Math.max(1, Number(form.width || 1))
  const height = Math.max(1, Number(form.height || 1))
  const boxWidth = Math.max(1, previewBoxSize.width || 1)
  const boxHeight = Math.max(1, previewBoxSize.height || 1)
  return Math.min(boxWidth / width, boxHeight / height, 1)
})
const previewFrameStyle = computed(() => ({
  width: `${Math.max(1, Number(form.width || 1))}px`,
  height: `${Math.max(1, Number(form.height || 1))}px`,
  transform: `translate(-50%, -50%) scale(${previewScale.value})`,
}))

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
  updatePreviewBoxSize()
  previewResizeObserver = new ResizeObserver(updatePreviewBoxSize)
  if (previewBox.value) previewResizeObserver.observe(previewBox.value)
  loadModelCatalog().then(loadSavedConfig)
  window.addEventListener('message', handlePreviewReady)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  previewResizeObserver?.disconnect()
  stopShortcutRecording()
  window.removeEventListener('message', handlePreviewReady)
})

watch(form, () => {
  postPreviewOptions()
}, { deep: true })

async function openWindow() {
  try {
    if (!ensureChildWindowApi()) return
    await window.electronAPI.openChildWindow(buildOptions())
    ElMessage.success('桌面部件子窗口已打开')
  } catch (error) {
    console.error('打开子窗口失败:', error)
    ElMessage.error('打开子窗口失败')
  }
}

function openLive2dSettings() {
  router.push({ path: '/settings', query: { section: 'live2d' } })
}

function toBackendAssetUrl(value) {
  const raw = String(value || '').trim()
  if (!raw || /^(https?:|data:|blob:)/i.test(raw)) return raw
  if (!raw.startsWith('/live2d-assets/')) return raw
  const api = new URL(baseUrl, window.location.href)
  return `${api.origin}${raw}`
}

async function updateWindow() {
  try {
    if (!ensureChildWindowApi()) return
    const options = buildOptions()
    await window.electronAPI.openChildWindow(options)
    await window.electronAPI.updateChildWindow(options)
    ElMessage.success('设置已应用')
  } catch (error) {
    console.error('应用子窗口设置失败:', error)
    ElMessage.error('应用设置失败')
  }
}

async function closeWindow() {
  await window.electronAPI?.closeChildWindow?.()
}

function ensureChildWindowApi() {
  if (window.electronAPI?.openChildWindow && window.electronAPI?.updateChildWindow) return true
  ElMessage.error('当前运行环境无法控制子窗口，请在 Electron 应用中使用')
  return false
}

async function toggleLocked() {
  form.locked = !form.locked
  await setLocked(form.locked)
}

async function setLocked(locked) {
  form.locked = Boolean(locked)
  const updated = await window.electronAPI?.setChildWindowLocked?.(form.locked)
  if (updated) ElMessage.success(form.locked ? '子窗口已锁定' : '子窗口已解锁')
  else await window.electronAPI?.updateChildWindow?.(buildOptions())
}

async function selectSound(target) {
  const filePath = await window.electronAPI?.selectAlarmSound?.()
  if (!filePath) return
  form[target].soundPath = filePath
  form[target].soundEnabled = true
}

async function selectAlarmItemSound(item) {
  const filePath = await window.electronAPI?.selectAlarmSound?.()
  if (!filePath) return
  item.soundPath = filePath
  form.alarm.soundEnabled = true
}

function clearSound(target) {
  form[target].soundPath = ''
}

function clearAlarmItemSound(item) {
  item.soundPath = ''
}

function openCreateAlarmDialog() {
  editingAlarmIndex.value = -1
  assignAlarmDraft(createAlarmItem({ id: 0, time: '08:00', note: '' }))
  alarmDialogVisible.value = true
}

function openEditAlarmDialog(index) {
  const item = form.alarm.items[index]
  if (!item) return
  editingAlarmIndex.value = index
  assignAlarmDraft(item)
  alarmDialogVisible.value = true
}

function saveAlarmDialog() {
  const item = createAlarmItem(alarmDraft)
  if (!item.time) {
    ElMessage.warning('请选择闹钟时间')
    return
  }
  if (editingAlarmIndex.value >= 0) {
    form.alarm.items.splice(editingAlarmIndex.value, 1, item)
  } else {
    alarmItemId += 1
    item.id = alarmItemId
    form.alarm.items.push(item)
  }
  alarmDialogVisible.value = false
}

function assignAlarmDraft(item) {
  const next = createAlarmItem(item)
  Object.assign(alarmDraft, next)
}

function removeAlarmItem(index) {
  if (form.alarm.items.length <= 1) return
  form.alarm.items.splice(index, 1)
}

function normalizeAlarmItems(alarm = {}) {
  const source = Array.isArray(alarm.items) && alarm.items.length
    ? alarm.items
    : [{ time: alarm.time || '08:00', note: alarm.message || '闹钟时间到', repeat: 'daily', soundPath: alarm.soundPath || '' }]
  const items = source
    .map((item) => createAlarmItem(item))
    .filter((item) => item.time)
  const normalized = items.length ? items : [createAlarmItem({ time: '08:00', note: '闹钟时间到' })]
  normalized.forEach((item) => {
    if (!item.id) {
      alarmItemId += 1
      item.id = alarmItemId
    }
    alarmItemId = Math.max(alarmItemId, item.id)
  })
  return normalized
}

function createAlarmItem(item = {}) {
  const repeat = ['once', 'daily', 'weekly', 'monthly'].includes(item.repeat) ? item.repeat : 'daily'
  const next = {
    id: Number(item.id || 0),
    time: /^\d{2}:\d{2}$/.test(String(item.time || '')) ? String(item.time) : '08:00',
    note: String(item.note ?? item.message ?? '').trim(),
    repeat,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? String(item.date) : todayString(),
    weekdays: Array.isArray(item.weekdays) && item.weekdays.length ? item.weekdays.map(Number).filter((day) => day >= 0 && day <= 6) : [1, 2, 3, 4, 5],
    dayOfMonth: Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31),
    soundPath: String(item.soundPath || ''),
  }
  normalizeAlarmItemSchedule(next)
  return next
}

function normalizeAlarmItemSchedule(item) {
  if (item.repeat === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ''))) item.date = todayString()
  if (item.repeat === 'weekly' && (!Array.isArray(item.weekdays) || !item.weekdays.length)) item.weekdays = [1, 2, 3, 4, 5]
  if (item.repeat === 'monthly') item.dayOfMonth = Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31)
}

function alarmRepeatText(item) {
  const repeat = item?.repeat || 'daily'
  if (repeat === 'once') return `仅一次 ${item.date || todayString()}`
  if (repeat === 'monthly') return `每月 ${Math.min(Math.max(Number(item.dayOfMonth || 1), 1), 31)} 日`
  if (repeat === 'weekly') {
    const selected = Array.isArray(item.weekdays) ? item.weekdays.map(Number) : []
    const labels = weekdayOptions
      .filter((day) => selected.includes(day.value))
      .map((day) => `周${day.label}`)
      .join('、')
    return labels ? `每周 ${labels}` : '每周'
  }
  return '每天'
}

function todayString() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function loadModelCatalog() {
  try {
    const response = await fetchLive2dCatalog()
    const catalog = Array.isArray(response?.data) ? response.data : []
    if (!catalog.length) throw new Error(response?.message || 'Live2D catalog 为空')
      modelOptions.value = catalog.map((model, index) => ({
        ...model,
        id: index,
        cover: toBackendAssetUrl(model.cover),
        textures: Number(model.textures || model.paths?.length || 1),
      }))
  } catch (error) {
    console.error('加载看板娘模型目录失败:', error)
    modelOptions.value = [{ id: 0, name: '未配置 Live2D 资源', textures: 1, cover: '' }]
  }
}

async function searchWeatherLocation() {
  const keyword = String(form.weather.locationName || '').trim()
  if (!keyword) {
    ElMessage.warning('请输入位置名称')
    return
  }
  geocodingLoading.value = true
  try {
    const data = await geocodeLocation(keyword)
    const location = data.results?.[0]
    if (!location) {
      ElMessage.warning('没有找到匹配位置')
      return
    }
    form.weather.locationName = [location.name, location.admin1, location.country].filter(Boolean).join(' · ')
    form.weather.latitude = Number(location.latitude)
    form.weather.longitude = Number(location.longitude)
    if (location.nmcStationId) form.weather.nmcStationId = location.nmcStationId
    ElMessage.success('天气站点已更新')
  } catch (error) {
    ElMessage.error(error?.message || '查询站点失败')
  } finally {
    geocodingLoading.value = false
  }
}

async function geocodeLocation(keyword) {
  if (window.electronAPI?.weather?.geocode) {
    const result = await window.electronAPI.weather.geocode({ name: keyword, count: 1, language: 'zh' })
    if (result?.ok === false) throw new Error(result.error || '查询坐标失败')
    return result?.data || result
  }
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', keyword)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'zh')
  url.searchParams.set('format', 'json')
  const response = await fetch(url.toString())
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function loadSavedConfig() {
  const config = await window.electronAPI?.getChildWindowConfig?.()
  if (!config) return
  form.width = Number(config.bounds?.width || form.width)
  form.height = Number(config.bounds?.height || form.height)
  form.locked = Boolean(config.locked)
  form.showClock = config.showClock ?? form.showClock
  form.showLive2d = config.showLive2d ?? form.showLive2d
  form.showWeather = config.showWeather ?? form.showWeather
  form.showAlarm = false
  form.showStopwatch = false
  form.components.splice(0, form.components.length, ...normalizeComponents(config.components || componentsFromFlags(config)))
  syncComponentFlags()
  Object.assign(form.common, migrateCommonConfig(config))
  Object.assign(form.shortcuts, config.shortcuts || {})
  const clockStyle = { ...form.clock.style, ...(config.clock?.style || {}) }
  Object.assign(form.clock, config.clock || {})
  form.clock.style = clockStyle
  Object.assign(form.live2d, config.live2d || {})
  const weatherStyle = { ...form.weather.style, ...(config.weather?.style || {}) }
  Object.assign(form.weather, config.weather || {})
  form.weather.style = weatherStyle
  Object.assign(form.alarm, config.alarm || {})
  form.alarm.items = normalizeAlarmItems(form.alarm)
  Object.assign(form.stopwatch, config.stopwatch || {})
  form.common.backgroundColor = form.common.backgroundColorInput || form.common.backgroundColor
  form.live2d.widgetUrl = String(form.live2d.widgetUrl || '').includes('live2d-widgets@1.0.1') ? DEFAULT_WIDGET_URL : (form.live2d.widgetUrl || DEFAULT_WIDGET_URL)
  form.live2d.modelId = clampModelId(form.live2d.modelId)
  form.live2d.textureId = clampTextureId(form.live2d.modelId, form.live2d.textureId)
  postPreviewOptions()
}

function buildOptions() {
  const modelId = clampModelId(form.live2d.modelId)
  const textureId = clampTextureId(modelId, form.live2d.textureId)
  const components = normalizeComponents(form.components)
  const alarmItems = normalizeAlarmItems(form.alarm)
    return toIpcPayload({
      apiBaseUrl: baseUrl,
      bounds: { width: form.width, height: form.height },
    locked: form.locked,
    showClock: components.some((component) => component.type === 'clock'),
    showLive2d: components.some((component) => component.type === 'live2d'),
    showWeather: components.some((component) => component.type === 'weather'),
    showAlarm: false,
    showStopwatch: false,
    components,
    common: {
      ...form.common,
      backgroundColor: normalizeBackground(form.common.backgroundColor, form.common.backgroundOpacity),
      backgroundColorInput: form.common.backgroundColor,
      fontStyle: form.common.fontStyle || 'normal',
    },
    shortcuts: {
      toggleLocked: String(form.shortcuts.toggleLocked || '').trim(),
      switchLive2d: String(form.shortcuts.switchLive2d || '').trim(),
    },
    clock: {
      ...form.clock,
      style: {
        ...form.clock.style,
        backgroundColor: normalizeBackground(form.clock.style.backgroundColor, form.clock.style.backgroundOpacity),
      },
    },
    live2d: {
      ...form.live2d,
      widgetUrl: form.live2d.widgetUrl || DEFAULT_WIDGET_URL,
      modelId,
      textureId,
    },
    weather: {
      ...form.weather,
      locationName: form.weather.locationName || '当前位置',
      latitude: Number(form.weather.latitude),
      longitude: Number(form.weather.longitude),
      nmcStationId: String(form.weather.nmcStationId || 'Wqsps').trim() || 'Wqsps',
      refreshMinutes: Math.max(5, Number(form.weather.refreshMinutes || 15)),
      position: form.weather.position || 'top-left',
      style: {
        ...form.weather.style,
        backgroundColor: normalizeBackground(form.weather.style.backgroundColor, form.weather.style.backgroundOpacity),
      },
    },
    alarm: {
      ...form.alarm,
      items: alarmItems.map(({ time, note, repeat, date, weekdays, dayOfMonth, soundPath }) => ({
        time,
        note,
        repeat,
        date,
        weekdays,
        dayOfMonth,
        soundPath,
      })),
      time: alarmItems[0]?.time || '08:00',
      message: alarmItems[0]?.note || '闹钟时间到',
      soundEnabled: Boolean(form.alarm.soundEnabled),
      soundPath: String(form.alarm.soundPath || ''),
    },
    stopwatch: {
      ...form.stopwatch,
      durationSeconds: Math.max(1, Number(form.stopwatch.durationSeconds || 1)),
      message: form.stopwatch.message || '秒表时间到',
      soundEnabled: Boolean(form.stopwatch.soundEnabled),
      soundPath: String(form.stopwatch.soundPath || ''),
    },
  })
}

function componentRule(type) {
  return COMPONENT_CATALOG.find((component) => component.type === type) || COMPONENT_CATALOG[0]
}

function componentLabel(type) {
  return componentRule(type).label
}

function componentsFromFlags(config) {
  return [
    ...(config.showClock !== false ? [{ type: 'clock', height: 112 }] : []),
    ...(config.showLive2d !== false ? [{ type: 'live2d', height: 360 }] : []),
    ...(config.showWeather ? [{ type: 'weather', height: 150 }] : []),
  ]
}

function normalizeComponents(components) {
  const seen = new Set()
  return (Array.isArray(components) ? components : [])
    .map((component) => {
      const type = typeof component === 'string' ? component : component?.type
      const rule = COMPONENT_CATALOG.find((item) => item.type === type)
      if (!rule || seen.has(type)) return null
      seen.add(type)
      const height = Math.min(Math.max(Number(component?.height || rule.height), rule.min), rule.max)
      return { type, height }
    })
    .filter(Boolean)
}

function syncComponentFlags() {
  form.showClock = form.components.some((component) => component.type === 'clock')
  form.showLive2d = form.components.some((component) => component.type === 'live2d')
  form.showWeather = form.components.some((component) => component.type === 'weather')
  form.showAlarm = false
  form.showStopwatch = false
}

function addComponent(type, targetIndex = form.components.length) {
  if (form.components.some((component) => component.type === type)) return
  const rule = componentRule(type)
  form.components.splice(targetIndex, 0, { type, height: rule.height })
  syncComponentFlags()
}

function removeComponent(type) {
  const index = form.components.findIndex((component) => component.type === type)
  if (index >= 0) form.components.splice(index, 1)
  syncComponentFlags()
}

function startComponentDrag(type, source, index = null) {
  dragState.value = { type, source, index }
}

function dropOnLoaded(targetIndex) {
  const drag = dragState.value
  if (!drag) return
  const insertIndex = targetIndex === null ? form.components.length : targetIndex
  if (drag.source === 'available') {
    addComponent(drag.type, insertIndex)
  } else {
    const currentIndex = form.components.findIndex((component) => component.type === drag.type)
    if (currentIndex < 0) return
    const [item] = form.components.splice(currentIndex, 1)
    const nextIndex = currentIndex < insertIndex ? Math.max(0, insertIndex - 1) : insertIndex
    form.components.splice(nextIndex, 0, item)
  }
  syncComponentFlags()
  dragState.value = null
}

function dropOnAvailable() {
  const drag = dragState.value
  if (drag?.source === 'loaded') removeComponent(drag.type)
  dragState.value = null
}

function handleModelChange() {
  form.live2d.modelId = clampModelId(form.live2d.modelId)
  form.live2d.textureId = clampTextureId(form.live2d.modelId, form.live2d.textureId)
  postPreviewOptions()
}

function handlePreviewReady(event) {
  if (event.data?.type === 'ran-pak-child-preview-ready') postPreviewOptions()
}

function postPreviewOptions() {
  const frameWindow = previewFrame.value?.contentWindow
  if (!frameWindow) return
  frameWindow.postMessage({
    type: 'ran-pak-child-preview-options',
    options: buildOptions(),
  }, '*')
}

function startShortcutRecording(name) {
  if (recordingShortcut.value === name) {
    stopShortcutRecording()
    return
  }
  stopShortcutRecording()
  recordingShortcut.value = name
  window.addEventListener('keydown', handleShortcutRecording, true)
}

function stopShortcutRecording() {
  if (!recordingShortcut.value) return
  recordingShortcut.value = ''
  window.removeEventListener('keydown', handleShortcutRecording, true)
}

function handleShortcutRecording(event) {
  if (!recordingShortcut.value) return
  event.preventDefault()
  event.stopPropagation()
  const key = normalizeShortcutKey(event)
  if (key === 'Escape') {
    stopShortcutRecording()
    return
  }
  if (key === 'Backspace' || key === 'Delete') {
    clearShortcut(recordingShortcut.value)
    stopShortcutRecording()
    return
  }
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(key)
  form.shortcuts[recordingShortcut.value] = parts.join('+')
  stopShortcutRecording()
}

function normalizeShortcutKey(event) {
  const key = event.key || ''
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return key
  const aliases = {
    ' ': 'Space',
    Spacebar: 'Space',
    Esc: 'Escape',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    '+': 'Plus',
    '-': 'Minus',
    '=': 'Plus',
    ',': 'Comma',
    '.': 'Period',
    '/': 'Slash',
    '\\': 'Backslash',
    ';': 'Semicolon',
    "'": 'Quote',
    '[': 'LeftBracket',
    ']': 'RightBracket',
    '`': 'Grave',
  }
  if (aliases[key]) return aliases[key]
  if (key.length === 1) return key.toUpperCase()
  return key
}

function shortcutButtonText(name) {
  if (recordingShortcut.value === name) return '请按下快捷键...'
  return form.shortcuts[name] || '点击录制'
}

function clearShortcut(name) {
  form.shortcuts[name] = ''
}

function updatePreviewBoxSize() {
  if (!previewBox.value) return
  previewBoxSize.width = previewBox.value.clientWidth
  previewBoxSize.height = previewBox.value.clientHeight
}

function clampModelId(value) {
  const id = Number.parseInt(value, 10)
  return modelOptions.value.some((model) => model.id === id) ? id : 0
}

function clampTextureId(modelId, value) {
  const model = modelOptions.value.find((item) => item.id === modelId) || modelOptions.value[0] || { textures: 1 }
  const textureId = Number.parseInt(value, 10)
  if (!Number.isFinite(textureId)) return 0
  return Math.min(Math.max(textureId, 0), Math.max(Number(model.textures || 1) - 1, 0))
}

function buildClockTextStyle(common, clock) {
  return {
    fontFamily: common.fontFamily === 'system' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : common.fontFamily,
    fontWeight: common.fontWeight,
    fontStyle: common.fontStyle,
    fontSize: `${common.fontSize}px`,
    letterSpacing: `${clock.letterSpacing}px`,
    textShadow: clock.textShadowEnabled ? `${clock.textShadowX}px ${clock.textShadowY}px ${clock.textShadowBlur}px ${clock.textShadowColor}` : 'none',
    transform: `scale(${clock.scaleX}, ${clock.scaleY}) skewX(${clock.skewX}deg) rotate(${clock.rotate}deg)`,
  }
}

function migrateCommonConfig(config) {
  const oldClock = config.clock || {}
  return {
    backgroundColor: oldClock.backgroundColor || form.common.backgroundColor,
    backgroundColorInput: oldClock.backgroundColorInput || oldClock.backgroundColor || form.common.backgroundColorInput,
    backgroundOpacity: oldClock.backgroundOpacity ?? form.common.backgroundOpacity,
    fontColor: oldClock.fontColor || form.common.fontColor,
    fontFamily: oldClock.fontFamily || form.common.fontFamily,
    fontWeight: oldClock.fontWeight ?? form.common.fontWeight,
    fontStyle: oldClock.fontStyle || form.common.fontStyle,
    fontSize: oldClock.fontSize ?? form.common.fontSize,
    ...(config.common || {}),
  }
}

function normalizeBackground(color, opacity) {
  if (!color || opacity === 0) return 'rgba(0, 0, 0, 0)'
  if (color.startsWith('rgba')) return color.replace(/,\s*[\d.]+\)$/, `, ${opacity / 100})`)
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
  }
  return color
}

function formatTime(date, format) {
  let hours = date.getHours()
  const suffix = hours >= 12 ? 'PM' : 'AM'
  if (format === '12') hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}${format === '12' ? ` ${suffix}` : ''}`
}

function toIpcPayload(payload) {
  return JSON.parse(JSON.stringify(payload))
}
</script>

<style scoped>
.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  border-top: 1px solid #e5e7eb;
  padding-top: 14px;
}

.shortcut-recorder {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
}

.sound-picker {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
}

.alarm-list {
  display: grid;
  width: 100%;
  gap: 10px;
}

.alarm-view-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.alarm-view-row:hover {
  border-color: #bfdbfe;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.alarm-view-main {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.alarm-time {
  color: #111827;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.alarm-meta {
  display: grid;
  min-width: 0;
  gap: 4px;
  color: #64748b;
  line-height: 1.35;
}

.alarm-meta strong {
  overflow: hidden;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alarm-meta small {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alarm-view-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.alarm-dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 16px;
}

.alarm-dialog-wide {
  grid-column: 1 / -1;
}

.shortcut-button {
  min-height: 32px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  padding: 0 11px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-button:hover,
.shortcut-button.recording {
  border-color: #409eff;
  color: #1d4ed8;
}

.shortcut-button.recording {
  background: #eff6ff;
}

.preview-box {
  position: relative;
  display: block;
  height: 260px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px dashed #d1d5db;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
}

.preview-frame {
  position: absolute;
  left: 50%;
  top: 50%;
  border: 0;
  background: transparent;
  pointer-events: none;
  transform-origin: center;
}

.location-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
}

.component-picker {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr);
  gap: 12px;
  width: 100%;
}

.component-column {
  min-height: 154px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px;
}

.component-column.active {
  border-style: solid;
  background: #fff;
}

.component-column-title {
  margin-bottom: 8px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.component-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  padding: 6px 8px;
  cursor: grab;
}

.component-item.loaded {
  grid-template-columns: auto minmax(54px, 1fr) 118px auto;
}

.component-item:active {
  cursor: grabbing;
}

.component-height {
  width: 118px;
}

.drag-handle {
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: -2px;
}

.component-empty {
  display: grid;
  min-height: 70px;
  place-items: center;
  border-radius: 8px;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 12px;
}

@media (max-width: 720px) {
  .alarm-view-row,
  .alarm-view-main,
  .alarm-dialog-grid {
    grid-template-columns: 1fr;
  }

  .alarm-view-actions {
    justify-content: flex-end;
  }

  .component-picker {
    grid-template-columns: 1fr;
  }

  .component-item.loaded {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .component-height,
  .component-item.loaded :deep(.el-button) {
    grid-column: 2;
  }
}

.model-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
}

.model-option-cover {
  width: 34px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 6px;
  background: #f8fafc;
  object-fit: contain;
}

.model-option-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.2;
}

.model-option-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-option-meta small {
  color: #9ca3af;
  font-size: 11px;
}
</style>
