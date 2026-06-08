/**
 * Fabric 画布上的可编辑文字（Textbox）
 * 使用 Textbox 而非裸 IText，便于拖拽与边界调整；关闭 objectCaching 避免命中区域异常
 */
import * as fabric from 'fabric'

/**
 * 创建可点击、拖拽、缩放宽度并支持键盘编辑的文字对象
 * @param {object} [options]
 * @param {string} [options.content]
 * @param {number} [options.left]
 * @param {number} [options.top]
 * @param {number} [options.width] - 文本框宽度，影响换行
 * @param {number} [options.fontSize]
 * @param {string} [options.fill]
 * @param {string} [options.fontFamily]
 * @returns {import('fabric').Textbox}
 */
export function createEditableTextbox(options = {}) {
  return new fabric.Textbox(options.content || '单击编辑文字', {
    left: options.left ?? 120,
    top: options.top ?? 120,
    width: options.width ?? 280,
    fontSize: options.fontSize ?? 24,
    fill: options.fill || '#111827',
    fontFamily: options.fontFamily || 'Microsoft YaHei, "PingFang SC", sans-serif',
    selectable: true,
    evented: true,
    editable: true,
    /** 关闭缓存，避免部分环境下选区/点击区域与绘制不一致 */
    objectCaching: false,
    hasControls: true,
    hasBorders: true,
    lockRotation: false,
    lockScalingFlip: true,
    /** 按 grapheme 换行，中文更自然 */
    splitByGrapheme: true,
  })
}

/**
 * 判断是否为画布上可导出的文字叠加（Textbox 继承链含 IText）
 * @param {object} obj
 * @returns {boolean}
 */
export function isFabricTextOverlay(obj) {
  return obj instanceof fabric.IText
}
