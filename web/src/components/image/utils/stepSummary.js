/**
 * 工作流步骤在列表中的摘要文案生成
 */

/**
 * 根据步骤类型与 params 生成一行简短说明，供列表副标题展示
 * @param {{ type: string, params?: Record<string, unknown> }} step
 * @returns {string}
 */
export function buildStepSummary(step) {
  const p = step.params || {}
  switch (step.type) {
    case 'rotate':
      return `${p.angle ?? 0}°`
    case 'resize':
      if (p.mode === 'percent') return `${p.percent ?? 100}%`
      return `${p.width}×${p.height}${p.keep_ratio ? ' 保持比例' : ''}`
    case 'flip':
      return p.direction === 'vertical' ? '垂直翻转' : '水平翻转'
    case 'brightness':
    case 'contrast':
    case 'saturation':
      return `${((p.factor ?? 1) * 100).toFixed(0)}%`
    case 'blur':
      return `半径 ${p.radius ?? 2}`
    case 'crop':
      return `(${p.x ?? 0},${p.y ?? 0}) ${p.width ?? 0}×${p.height ?? 0}${p.aspect_ratio_label ? ` ${p.aspect_ratio_label}` : ''}`
    case 'sharpen':
      return '无附加参数'
    case 'grayscale':
      return '无附加参数'
    case 'watermark':
      return `${p.content || '水印'} ${p.size ?? 32}px ${Math.round((p.opacity ?? 0.22) * 100)}%`
    case 'text':
      return `(${p.x ?? 0},${p.y ?? 0}) ${p.content || '文字'} ${p.size ?? 32}px`
    case 'sticker':
      return `(${p.x ?? 0},${p.y ?? 0}) ${p.width ?? 0}×${p.height ?? 0} ${p.angle ?? 0}°`
    default:
      return ''
  }
}
