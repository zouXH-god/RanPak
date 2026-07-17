import { ElMessage } from 'element-plus'
import { persistentStorage } from './sqliteStorage'

const STORE_FALLBACK_KEY = 'ranpak:dev-tools:store'

export function formatBytes(bytes) {
  const size = Math.max(0, Number(bytes || 0))
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  if (size === 0) return '0 B'
  const i = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / Math.pow(1024, i)
  return `${i === 0 ? value : value.toFixed(2)} ${units[i]}`
}

export function formatJson(value) {
  try {
    return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2)
  } catch {
    return String(value ?? '')
  }
}

export async function copyText(text, message = '已复制') {
  await navigator.clipboard.writeText(String(text ?? ''))
  ElMessage.success(message)
}

export function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([String(text ?? '')], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function loadDevToolStore() {
  if (window.electronAPI?.devTools?.loadDevToolStore) {
    return await window.electronAPI.devTools.loadDevToolStore()
  }
  try {
    return JSON.parse(persistentStorage.getItem(STORE_FALLBACK_KEY) || '{}')
  } catch {
    return {}
  }
}

export async function saveDevToolStore(store) {
  if (window.electronAPI?.devTools?.saveDevToolStore) {
    return await window.electronAPI.devTools.saveDevToolStore(store || {})
  }
  persistentStorage.setItem(STORE_FALLBACK_KEY, JSON.stringify(store || {}))
  return store || {}
}

export function textToBytes(text) {
  return new TextEncoder().encode(String(text ?? ''))
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export async function digestText(algorithm, text, output = 'hex') {
  const buffer = await crypto.subtle.digest(algorithm, textToBytes(text))
  const bytes = new Uint8Array(buffer)
  return output === 'base64' ? bytesToBase64(bytes) : bytesToHex(bytes)
}

export async function hmacText(algorithm, secret, text, output = 'hex') {
  const key = await crypto.subtle.importKey(
    'raw',
    textToBytes(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, textToBytes(text))
  const bytes = new Uint8Array(signature)
  return output === 'base64' ? bytesToBase64(bytes) : bytesToHex(bytes)
}

export function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function base64UrlToText(value) {
  return new TextDecoder().decode(base64UrlToBytes(value))
}

export function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function safeParseJson(text, fallback = null) {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

export function unixTimeParts(date = new Date()) {
  const time = date.getTime()
  return {
    seconds: Math.floor(time / 1000),
    milliseconds: time,
    local: date.toLocaleString(),
    iso: date.toISOString(),
  }
}
