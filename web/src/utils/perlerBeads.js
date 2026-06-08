import { colorSystemMapping } from '../data/perlerColorSystemMapping'

export const transparentPixel = { key: '透明', color: 'transparent', isExternal: true }

export function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function srgbChannelToLinear(channel) {
  const normalized = channel / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

function rgbToOklab(rgb) {
  const r = srgbChannelToLinear(rgb.r)
  const g = srgbChannelToLinear(rgb.g)
  const b = srgbChannelToLinear(rgb.b)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

const oklabCache = new Map()

function getOklab(rgb) {
  const key = `${rgb.r},${rgb.g},${rgb.b}`
  if (!oklabCache.has(key)) oklabCache.set(key, rgbToOklab(rgb))
  return oklabCache.get(key)
}

export function colorDistance(a, b) {
  const labA = getOklab(a)
  const labB = getOklab(b)
  const dl = labA.l - labB.l
  const da = labA.a - labB.a
  const db = labA.b - labB.b
  return Math.sqrt(dl * dl + da * da + db * db) * 100
}

export function buildPalette(colorSystem) {
  return Object.entries(colorSystemMapping).map(([hex, systems]) => ({
    key: systems[colorSystem] || systems.MARD || '?',
    color: hex,
    rgb: hexToRgb(hex),
  }))
}

export function findClosestPaletteColor(rgb, palette) {
  let closest = palette[0]
  let minDistance = Infinity
  for (const item of palette) {
    const distance = colorDistance(rgb, item.rgb)
    if (distance < minDistance) {
      closest = item
      minDistance = distance
    }
    if (distance === 0) break
  }
  return closest
}

function representativeColor(imageData, startX, startY, width, height, mode) {
  const data = imageData.data
  const imageWidth = imageData.width
  const counts = new Map()
  let rSum = 0
  let gSum = 0
  let bSum = 0
  let count = 0
  let dominant = null
  let dominantCount = 0

  for (let y = startY; y < startY + height; y++) {
    for (let x = startX; x < startX + width; x++) {
      const index = (y * imageWidth + x) * 4
      if (data[index + 3] < 128) continue
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      count += 1
      if (mode === 'average') {
        rSum += r
        gSum += g
        bSum += b
      } else {
        const key = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`
        const nextCount = (counts.get(key) || 0) + 1
        counts.set(key, nextCount)
        if (nextCount > dominantCount) {
          dominantCount = nextCount
          dominant = { r, g, b }
        }
      }
    }
  }

  if (!count) return null
  if (mode === 'average') {
    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    }
  }
  return dominant
}

export function calculatePixelGrid(image, gridWidth, gridHeight, palette, mode) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const cellWidth = canvas.width / gridWidth
  const cellHeight = canvas.height / gridHeight
  const grid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(null))

  for (let row = 0; row < gridHeight; row += 1) {
    for (let col = 0; col < gridWidth; col += 1) {
      const startX = Math.floor(col * cellWidth)
      const startY = Math.floor(row * cellHeight)
      const endX = Math.min(canvas.width, Math.ceil((col + 1) * cellWidth))
      const endY = Math.min(canvas.height, Math.ceil((row + 1) * cellHeight))
      const rgb = representativeColor(imageData, startX, startY, Math.max(1, endX - startX), Math.max(1, endY - startY), mode)
      grid[row][col] = rgb ? findClosestPaletteColor(rgb, palette) : { ...transparentPixel }
    }
  }

  return grid
}

export function mergeSimilarRegions(grid, threshold, palette) {
  if (!grid.length || threshold <= 0) return grid
  const height = grid.length
  const width = grid[0].length
  const visited = Array.from({ length: height }, () => Array(width).fill(false))
  const nextGrid = grid.map(row => row.map(cell => ({ ...cell })))
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      if (visited[row][col] || grid[row][col]?.isExternal) continue
      const base = grid[row][col]
      const stack = [[row, col]]
      const region = []
      const counts = new Map()
      visited[row][col] = true

      while (stack.length) {
        const [r, c] = stack.pop()
        const cell = grid[r][c]
        region.push([r, c])
        counts.set(cell.color, (counts.get(cell.color) || 0) + 1)
        for (const [dr, dc] of directions) {
          const nr = r + dr
          const nc = c + dc
          if (nr < 0 || nr >= height || nc < 0 || nc >= width || visited[nr][nc]) continue
          const neighbor = grid[nr][nc]
          if (!neighbor || neighbor.isExternal) continue
          if (colorDistance(hexToRgb(base.color), hexToRgb(neighbor.color)) <= threshold) {
            visited[nr][nc] = true
            stack.push([nr, nc])
          }
        }
      }

      if (region.length < 2) continue
      const [dominantColor] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      const mapped = palette.find(item => item.color === dominantColor) || base
      for (const [r, c] of region) nextGrid[r][c] = { ...mapped }
    }
  }

  return nextGrid
}

export function removeExternalBackground(grid, backgroundColors) {
  if (!grid.length || !backgroundColors.size) return grid
  const height = grid.length
  const width = grid[0].length
  const nextGrid = grid.map(row => row.map(cell => ({ ...cell })))
  const visited = Array.from({ length: height }, () => Array(width).fill(false))
  const stack = []

  for (let col = 0; col < width; col += 1) {
    stack.push([0, col], [height - 1, col])
  }
  for (let row = 0; row < height; row += 1) {
    stack.push([row, 0], [row, width - 1])
  }

  while (stack.length) {
    const [row, col] = stack.pop()
    if (row < 0 || row >= height || col < 0 || col >= width || visited[row][col]) continue
    visited[row][col] = true
    const cell = nextGrid[row][col]
    if (!cell || cell.isExternal || !backgroundColors.has(cell.color)) continue
    nextGrid[row][col] = { ...cell, isExternal: true }
    stack.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1])
  }

  return nextGrid
}

export function getColorStats(grid) {
  const total = grid.reduce((sum, row) => sum + row.filter(cell => cell && !cell.isExternal).length, 0)
  const map = new Map()
  for (const row of grid) {
    for (const cell of row) {
      if (!cell || cell.isExternal) continue
      const stat = map.get(cell.color) || { ...cell, count: 0, percent: 0 }
      stat.count += 1
      map.set(cell.color, stat)
    }
  }
  return [...map.values()]
    .map(item => ({ ...item, percent: total ? Math.round((item.count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => hueOf(a.color) - hueOf(b.color))
}

function hueOf(hex) {
  const { r, g, b } = hexToRgb(hex)
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const delta = max - min
  if (!delta) return 0
  if (max === nr) return ((ng - nb) / delta + (ng < nb ? 6 : 0)) * 60
  if (max === ng) return ((nb - nr) / delta + 2) * 60
  return ((nr - ng) / delta + 4) * 60
}
