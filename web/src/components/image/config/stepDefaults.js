/**
 * 图片工作流步骤的默认参数与展示用文案
 * 供 StepConfig、WorkflowPanel 等模块复用，避免魔法数字分散在各处
 */

/** 按步骤类型划分的默认参数字段（与后端 StepType / processor 约定一致） */
export const DEFAULT_PARAMS_BY_TYPE = {
  crop: { x: 0, y: 0, width: 200, height: 200 },
  rotate: { angle: 0 },
  resize: { mode: 'pixels', width: 800, height: 600, keep_ratio: true, percent: 100 },
  flip: { direction: 'horizontal' },
  brightness: { factor: 1.0 },
  contrast: { factor: 1.0 },
  saturation: { factor: 1.0 },
  blur: { radius: 2.0 },
  sharpen: {},
  grayscale: {},
  watermark: {
    content: '水印',
    size: 32,
    color: '#111827',
    opacity: 0.22,
    angle: -30,
    gap_x: 220,
    gap_y: 160,
  },
  text: {
    content: '文字',
    x: 80,
    y: 80,
    size: 32,
    color: '#111827',
  },
  sticker: {
    image_id: '',
    preview_url: '',
    x: 80,
    y: 80,
    width: 160,
    height: 160,
    angle: 0,
  },
}

/** 步骤类型的中文标题（参数面板顶部） */
export const STEP_CONFIG_TITLES = {
  rotate: '旋转设置',
  resize: '缩放设置',
  flip: '翻转设置',
  brightness: '亮度调整',
  contrast: '对比度调整',
  saturation: '饱和度调整',
  blur: '模糊设置',
  crop: '裁剪设置',
  sharpen: '锐化',
  grayscale: '灰度',
  watermark: '水印设置',
  text: '文字设置',
  sticker: '贴图设置',
}

/** 工作流列表中展示的中文名称 */
export const STEP_LABELS = {
  crop: '裁剪',
  rotate: '旋转',
  resize: '缩放',
  flip: '翻转',
  brightness: '亮度',
  contrast: '对比度',
  saturation: '饱和度',
  blur: '模糊',
  sharpen: '锐化',
  grayscale: '灰度',
  watermark: '水印',
  text: '文字',
  sticker: '贴纸',
  format: '格式转换',
}

/**
 * 合并默认参数与可选的已有参数，用于「新增步骤」或「编辑步骤」初始化表单
 * @param {string} type - 步骤类型
 * @param {Record<string, unknown> | null | undefined} initial - 已有参数（编辑时传入）
 * @returns {Record<string, unknown>}
 */
export function mergeStepParams(type, initial) {
  const base = { ...(DEFAULT_PARAMS_BY_TYPE[type] || {}) }
  if (initial && typeof initial === 'object') {
    Object.assign(base, initial)
  }
  return base
}
