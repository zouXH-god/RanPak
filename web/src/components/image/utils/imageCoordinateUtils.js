/**
 * 图片编辑器：场景坐标 ↔ 图片像素坐标、图片在页面中的包围盒计算
 * 与 Fabric.js v6 的 viewportTransform / calcTransformMatrix 配合使用
 */

import { Point, util } from 'fabric'

/**
 * 将画布「场景坐标系」中的点转换到背景图对象的局部坐标（即图片像素坐标，原点在图左上角）
 * @param {import('fabric').FabricImage} fabricImage - 背景 FabricImage
 * @param {number} sceneX - 场景 X
 * @param {number} sceneY - 场景 Y
 * @returns {{ x: number, y: number }}
 */
export function scenePointToImagePixel(fabricImage, sceneX, sceneY) {
  return util.sendPointToPlane(new Point(sceneX, sceneY), undefined, fabricImage.calcTransformMatrix())
}

/**
 * 判断局部坐标是否落在图片像素矩形内（含边界内缩一点容差，避免浮点误差）
 * @param {{ x: number, y: number }} local - scenePointToImagePixel 的结果
 * @param {import('fabric').FabricImage} fabricImage
 * @param {number} [eps=1e-3]
 * @returns {boolean}
 */
export function isInsideImagePixel(local, fabricImage, eps = 1e-3) {
  const w = fabricImage.width
  const h = fabricImage.height
  return (
    local.x >= -eps &&
    local.y >= -eps &&
    local.x <= w + eps &&
    local.y <= h + eps
  )
}

/**
 * 将背景图在场景中的轴对齐包围盒，换算为相对「外层包裹元素」的 CSS 像素矩形（用于叠坐标轴）
 * @param {import('fabric').Canvas} canvas - Fabric Canvas 实例
 * @param {import('fabric').FabricImage} fabricImage - 背景图
 * @param {HTMLElement} wrapperEl - 与画布同级的包裹层（position: relative）
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
export function getImageFrameRelativeToWrapper(canvas, fabricImage, wrapperEl) {
  if (!canvas || !fabricImage || !wrapperEl) return null

  fabricImage.setCoords?.()
  const bbox = fabricImage.getBoundingRect()
  const upper = canvas.upperCanvasEl
  if (!upper) return null

  const wrapRect = wrapperEl.getBoundingClientRect()
  const canvasRect = upper.getBoundingClientRect()

  const cw = canvas.getWidth()
  const ch = canvas.getHeight()
  if (!cw || !ch) return null

  /** 场景坐标 → 画布逻辑像素（与 getWidth/getHeight 一致） */
  const scaleX = canvasRect.width / cw
  const scaleY = canvasRect.height / ch

  const tl = util.transformPoint(new Point(bbox.left, bbox.top), canvas.viewportTransform)
  const br = util.transformPoint(
    new Point(bbox.left + bbox.width, bbox.top + bbox.height),
    canvas.viewportTransform
  )

  const leftOnCanvas = tl.x * scaleX
  const topOnCanvas = tl.y * scaleY
  const widthOnCanvas = (br.x - tl.x) * scaleX
  const heightOnCanvas = (br.y - tl.y) * scaleY

  const offsetLeft = canvasRect.left - wrapRect.left
  const offsetTop = canvasRect.top - wrapRect.top

  return {
    left: offsetLeft + leftOnCanvas,
    top: offsetTop + topOnCanvas,
    width: Math.max(0, widthOnCanvas),
    height: Math.max(0, heightOnCanvas),
  }
}

/**
 * 根据图片宽高生成用于坐标轴的刻度值列表（约 5 段，首尾含 0 与最大边）
 * @param {number} maxPixel - 该轴最大像素坐标（宽或高）
 * @param {number} [segments=4] - 分段数（刻度点数为 segments + 1）
 * @returns {number[]}
 */
export function buildAxisTickValues(maxPixel, segments = 4) {
  if (maxPixel <= 0) return [0]
  const n = Math.max(1, Math.floor(segments))
  const out = []
  for (let i = 0; i <= n; i++) {
    out.push(Math.round((maxPixel * i) / n))
  }
  return [...new Set(out)].sort((a, b) => a - b)
}
