/**
 * Browser-side image workflow preview.
 * This intentionally mirrors the backend step names while keeping export as the
 * source of truth on the server.
 */

function clampNumber(value, fallback, min = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, number)
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function drawSourceToCanvas(source) {
  const canvas = createCanvas(source.width || source.naturalWidth, source.height || source.naturalHeight)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0)
  return canvas
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.src = url
  })
}

function canvasToObjectUrl(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? URL.createObjectURL(blob) : '')
    }, 'image/png')
  })
}

function cropCanvas(source, params = {}) {
  const x = Math.min(source.width - 1, clampNumber(params.x, 0))
  const y = Math.min(source.height - 1, clampNumber(params.y, 0))
  const width = Math.min(source.width - x, clampNumber(params.width, 100, 1))
  const height = Math.min(source.height - y, clampNumber(params.height, 100, 1))
  const canvas = createCanvas(width, height)
  canvas.getContext('2d').drawImage(source, x, y, width, height, 0, 0, width, height)
  return canvas
}

function rotateCanvas(source, params = {}) {
  const angle = -clampNumber(params.angle, 0) * Math.PI / 180
  const sin = Math.abs(Math.sin(angle))
  const cos = Math.abs(Math.cos(angle))
  const width = source.width * cos + source.height * sin
  const height = source.width * sin + source.height * cos
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(angle)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return canvas
}

function resizeCanvas(source, params = {}) {
  if (params.mode === 'percent') {
    const scale = clampNumber(params.percent, 100, 1) / 100
    const canvas = createCanvas(source.width * scale, source.height * scale)
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  const targetWidth = clampNumber(params.width, 800, 1)
  const targetHeight = clampNumber(params.height, 600, 1)
  let width = targetWidth
  let height = targetHeight

  if (params.keep_ratio !== false) {
    const scale = Math.min(targetWidth / source.width, targetHeight / source.height)
    width = source.width * scale
    height = source.height * scale
  }

  const canvas = createCanvas(width, height)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function flipCanvas(source, params = {}) {
  const canvas = createCanvas(source.width, source.height)
  const ctx = canvas.getContext('2d')
  if (params.direction === 'vertical') {
    ctx.translate(0, canvas.height)
    ctx.scale(1, -1)
  } else {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, 0, 0)
  return canvas
}

function filterCanvas(source, cssFilter) {
  const canvas = createCanvas(source.width, source.height)
  const ctx = canvas.getContext('2d')
  ctx.filter = cssFilter
  ctx.drawImage(source, 0, 0)
  ctx.filter = 'none'
  return canvas
}

function sharpenCanvas(source) {
  const canvas = createCanvas(source.width, source.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const input = imageData.data
  const output = new Uint8ClampedArray(input)
  const width = canvas.width
  const height = canvas.height
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const target = (y * width + x) * 4
      for (let channel = 0; channel < 3; channel += 1) {
        let value = 0
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const sourceIndex = ((y + ky) * width + (x + kx)) * 4 + channel
            const kernelIndex = (ky + 1) * 3 + (kx + 1)
            value += input[sourceIndex] * kernel[kernelIndex]
          }
        }
        output[target + channel] = Math.max(0, Math.min(255, value))
      }
      output[target + 3] = input[target + 3]
    }
  }

  ctx.putImageData(new ImageData(output, width, height), 0, 0)
  return canvas
}

function hexToRgb(hex) {
  const normalized = String(hex || '#111827').replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((item) => item + item).join('')
    : normalized
  const number = Number.parseInt(value, 16)
  if (!Number.isFinite(number)) return { r: 17, g: 24, b: 39 }
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  }
}

function watermarkCanvas(source, params = {}) {
  const canvas = drawSourceToCanvas(source)
  const ctx = canvas.getContext('2d')
  const text = String(params.content || '')
  if (!text) return canvas

  const size = clampNumber(params.size, 32, 8)
  const opacity = Math.min(1, clampNumber(params.opacity, 0.22, 0.05))
  const angle = clampNumber(params.angle, -30) * Math.PI / 180
  const gapX = clampNumber(params.gap_x, 220, 40)
  const gapY = clampNumber(params.gap_y, 160, 40)
  const { r, g, b } = hexToRgb(params.color)

  ctx.save()
  ctx.font = `${size}px Microsoft YaHei, PingFang SC, Arial, sans-serif`
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let y = -canvas.height; y < canvas.height * 2; y += gapY) {
    for (let x = -canvas.width; x < canvas.width * 2; x += gapX) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }
  }
  ctx.restore()
  return canvas
}

function textCanvas(source, params = {}) {
  const canvas = drawSourceToCanvas(source)
  const ctx = canvas.getContext('2d')
  const text = String(params.content || '')
  if (!text) return canvas

  const size = clampNumber(params.size, 32, 8)
  ctx.save()
  ctx.font = `${size}px Microsoft YaHei, PingFang SC, Arial, sans-serif`
  ctx.fillStyle = params.color || '#111827'
  ctx.textBaseline = 'top'
  ctx.fillText(text, clampNumber(params.x, 80), clampNumber(params.y, 80))
  ctx.restore()
  return canvas
}

async function stickerCanvas(source, params = {}) {
  const url = params.preview_url
  if (!url) return drawSourceToCanvas(source)

  const sticker = await loadImageElement(url)
  const canvas = drawSourceToCanvas(source)
  const ctx = canvas.getContext('2d')
  const x = clampNumber(params.x, 80)
  const y = clampNumber(params.y, 80)
  const width = clampNumber(params.width, sticker.width || 160, 1)
  const height = clampNumber(params.height, sticker.height || 160, 1)
  const angle = clampNumber(params.angle, 0) * Math.PI / 180

  ctx.save()
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate(angle)
  ctx.drawImage(sticker, -width / 2, -height / 2, width, height)
  ctx.restore()
  return canvas
}

async function applyStep(source, step = {}) {
  const params = step.params || {}
  if (step.type === 'crop') return cropCanvas(source, params)
  if (step.type === 'rotate') return rotateCanvas(source, params)
  if (step.type === 'resize') return resizeCanvas(source, params)
  if (step.type === 'flip') return flipCanvas(source, params)
  if (step.type === 'brightness') return filterCanvas(source, `brightness(${clampNumber(params.factor, 1)})`)
  if (step.type === 'contrast') return filterCanvas(source, `contrast(${clampNumber(params.factor, 1)})`)
  if (step.type === 'saturation') return filterCanvas(source, `saturate(${clampNumber(params.factor, 1)})`)
  if (step.type === 'blur') return filterCanvas(source, `blur(${clampNumber(params.radius, 2, 0.3)}px)`)
  if (step.type === 'grayscale') return filterCanvas(source, 'grayscale(1)')
  if (step.type === 'sharpen') return sharpenCanvas(source)
  if (step.type === 'watermark') return watermarkCanvas(source, params)
  if (step.type === 'text') return textCanvas(source, params)
  if (step.type === 'sticker') return await stickerCanvas(source, params)
  return drawSourceToCanvas(source)
}

/**
 * Apply workflow steps in the browser and return a PNG object URL.
 * @param {string} sourceUrl
 * @param {{ type: string, params?: object }[]} steps
 * @returns {Promise<{ url: string, width: number, height: number }>}
 */
export async function renderWorkflowPreview(sourceUrl, steps = []) {
  const image = await loadImageElement(sourceUrl)
  let canvas = drawSourceToCanvas(image)
  for (const step of steps) {
    canvas = await applyStep(canvas, step)
  }
  const url = await canvasToObjectUrl(canvas)
  return { url, width: canvas.width, height: canvas.height }
}
