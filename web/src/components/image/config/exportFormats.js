/**
 * 图片导出/下载可选格式（与后端 format_support 约定一致）
 * HEIF/SVG 解码依赖后端可选依赖，导出 SVG 为「内嵌位图的 SVG 包装」
 */

/** @type {{ value: string, label: string }[]} */
export const IMAGE_EXPORT_FORMAT_OPTIONS = [
  { value: 'PNG', label: 'PNG' },
  { value: 'JPEG', label: 'JPEG' },
  { value: 'GIF', label: 'GIF' },
  { value: 'BMP', label: 'BMP' },
  { value: 'TIFF', label: 'TIFF' },
  { value: 'WEBP', label: 'WebP' },
  { value: 'ICO', label: 'ICO' },
  { value: 'HEIF', label: 'HEIF / HEIC' },
  { value: 'SVG', label: 'SVG（内嵌图）' },
]

/**
 * 根据格式得到下载文件名后缀（小写）
 * @param {string} fmt
 */
export function downloadExtensionForFormat(fmt) {
  const u = (fmt || 'PNG').toUpperCase()
  if (u === 'JPEG' || u === 'JPG') return 'jpg'
  if (u === 'TIFF' || u === 'TIF') return 'tiff'
  return u.toLowerCase()
}
