<template>
  <section class="rounded-lg border border-gray-200 bg-white">
    <div class="border-b border-gray-100 px-4 py-3">
      <div class="flex items-center gap-3">
        <span class="grid h-9 w-9 place-items-center rounded-md bg-sky-50 text-sky-700">
          <el-icon><component :is="module.icon" /></el-icon>
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900">{{ module.label }}</h2>
          <p class="text-xs text-gray-500">{{ module.summary }}</p>
        </div>
      </div>
    </div>

    <div class="p-4">
      <el-form label-position="top" size="small">
        <template v-if="module.infoOnly">
          <div class="rounded-md bg-slate-50 p-4 text-sm text-gray-600">选择文件后会自动读取视频信息，不会生成新文件。</div>
        </template>

        <el-form-item v-if="hasField('container')" label="目标格式">
          <el-select v-model="model.container">
            <el-option label="MP4（推荐）" value="mp4" />
            <el-option label="MKV" value="matroska" />
            <el-option label="WebM" value="webm" />
            <el-option label="MOV" value="mov" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="hasField('compressLevel')" label="压缩程度">
          <el-radio-group v-model="compressLevel">
            <el-radio-button label="light">清晰</el-radio-button>
            <el-radio-button label="normal">推荐</el-radio-button>
            <el-radio-button label="small">更小</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="hasField('resolution')" label="分辨率">
          <el-select v-model="model.resolution">
            <el-option label="保持原始" value="source" />
            <el-option label="1080p" value="1920x1080" />
            <el-option label="720p（推荐）" value="1280x720" />
            <el-option label="480p" value="854x480" />
          </el-select>
        </el-form-item>

        <div v-if="hasField('timeRange')" class="grid grid-cols-2 gap-3">
          <el-form-item label="开始时间">
            <el-input v-model="model.startTime" placeholder="00:00:00" />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-input v-model="model.endTime" placeholder="00:01:30" />
          </el-form-item>
        </div>

        <el-form-item v-if="hasField('audioFormat')" label="音频格式">
          <el-select v-model="model.audioCodec">
            <el-option label="MP3（推荐）" value="libmp3lame" />
            <el-option label="AAC" value="aac" />
            <el-option label="Opus" value="libopus" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="hasField('audioBitrate')" label="音频质量">
          <el-select v-model="model.audioBitrate">
            <el-option label="128k" value="128k" />
            <el-option label="192k（推荐）" value="192k" />
            <el-option label="320k" value="320k" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="hasField('snapshotTime')" label="截图时间">
          <el-input v-model="model.startTime" placeholder="00:00:01" />
        </el-form-item>

        <el-form-item v-if="hasField('imageFormat')" label="图片格式">
          <el-select v-model="model.imageFormat">
            <el-option label="JPG" value="jpg" />
            <el-option label="PNG" value="png" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="hasField('concatOrder')" label="合并顺序">
          <div class="w-full rounded-md bg-slate-50 p-3 text-xs leading-5 text-gray-500">文件会按选择顺序合并。建议选择编码和分辨率相近的视频。</div>
        </el-form-item>

        <template v-if="hasField('watermark')">
          <el-form-item label="水印文字">
            <el-input v-model="model.watermarkText" />
          </el-form-item>
          <div class="grid grid-cols-2 gap-3">
            <el-form-item label="位置">
              <el-select v-model="model.watermarkPosition">
                <el-option label="左上" value="leftTop" />
                <el-option label="右上" value="rightTop" />
                <el-option label="左下" value="leftBottom" />
                <el-option label="右下" value="rightBottom" />
              </el-select>
            </el-form-item>
            <el-form-item label="字号">
              <el-input-number v-model="model.watermarkSize" :min="12" :max="96" />
            </el-form-item>
          </div>
        </template>

        <template v-if="hasField('subtitle')">
          <el-form-item label="字幕文件路径">
            <el-input v-model="model.subtitlePath" placeholder="选择 .srt / .ass 字幕文件路径" />
          </el-form-item>
          <el-form-item label="处理方式">
            <el-radio-group v-model="model.subtitleMode">
              <el-radio-button label="burn">烧录到画面</el-radio-button>
              <el-radio-button label="copy">保留字幕轨</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </template>

        <el-form-item v-if="hasField('rotate')" label="旋转角度">
          <el-select v-model="model.rotate">
            <el-option label="不旋转" :value="0" />
            <el-option label="90 度" :value="90" />
            <el-option label="180 度" :value="180" />
            <el-option label="270 度" :value="270" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="hasField('fps')" label="帧率">
          <el-input-number v-model="model.fps" :min="0" :max="120" />
        </el-form-item>

        <template v-if="hasField('subMode')">
          <el-form-item label="处理类型">
            <el-radio-group v-model="model.subMode">
              <el-radio-button label="gif">制作 GIF</el-radio-button>
              <el-radio-button label="speed">调整倍速</el-radio-button>
              <el-radio-button label="batch">批量转换</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </template>

        <template v-if="hasField('gif') && model.subMode === 'gif'">
          <div class="grid grid-cols-2 gap-3">
            <el-form-item label="GIF 宽度">
              <el-input-number v-model="model.width" :min="160" :max="1280" />
            </el-form-item>
            <el-form-item label="GIF 帧率">
              <el-input-number v-model="model.fps" :min="6" :max="30" />
            </el-form-item>
          </div>
        </template>

        <el-form-item v-if="hasField('speed') && model.subMode === 'speed'" label="播放速度">
          <el-slider v-model="model.speed" :min="0.25" :max="4" :step="0.25" show-input />
        </el-form-item>

        <el-collapse class="mt-2">
          <el-collapse-item title="高级设置" name="advanced">
            <div class="grid grid-cols-2 gap-3">
              <el-form-item label="视频编码">
                <el-select v-model="model.videoCodec">
                  <el-option label="H.264" value="libx264" />
                  <el-option label="H.265" value="libx265" />
                  <el-option label="VP9" value="libvpx-vp9" />
                  <el-option label="复制原流" value="copy" />
                </el-select>
              </el-form-item>
              <el-form-item label="CRF">
                <el-input-number v-model="model.crf" :min="12" :max="36" />
              </el-form-item>
              <el-form-item label="Preset">
                <el-select v-model="model.preset">
                  <el-option label="fast" value="fast" />
                  <el-option label="medium" value="medium" />
                  <el-option label="slow" value="slow" />
                </el-select>
              </el-form-item>
              <el-form-item label="硬件加速">
                <el-select v-model="model.hardwareAccel">
                  <el-option label="关闭" value="none" />
                  <el-option label="Auto" value="auto" />
                  <el-option label="CUDA" value="cuda" />
                  <el-option label="QSV" value="qsv" />
                </el-select>
              </el-form-item>
            </div>
          </el-collapse-item>
        </el-collapse>

        <el-form-item class="!mt-4" label="输出目录">
          <div class="flex w-full gap-2">
            <el-input :model-value="outputDirectory" placeholder="默认保存到源文件同目录" readonly />
            <el-button @click="$emit('pick-output')">选择</el-button>
          </div>
        </el-form-item>
      </el-form>

      <el-button class="mt-2 w-full" size="large" type="primary" :loading="submitting" :disabled="disabled" @click="$emit('submit')">
        {{ module.primaryAction }}
      </el-button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  module: { type: Object, required: true },
  modelValue: { type: Object, required: true },
  outputDirectory: { type: String, default: '' },
  submitting: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'pick-output', 'submit'])

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const compressLevel = computed({
  get() {
    if (model.value.crf <= 24) return 'light'
    if (model.value.crf >= 31) return 'small'
    return 'normal'
  },
  set(value) {
    model.value.crf = value === 'light' ? 23 : value === 'small' ? 32 : 28
  },
})

function hasField(field) {
  return props.module.fields.includes(field)
}
</script>
