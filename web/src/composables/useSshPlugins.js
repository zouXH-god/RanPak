import { ref, reactive, shallowRef, markRaw } from 'vue'
import * as Vue from 'vue'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import { useRemoteConfig } from './useRemoteConfig'

const pluginList = ref([])
const pluginComponents = shallowRef({})
const loadedStyles = new Set()
const loading = ref(false)

let _initialized = false

function createPluginSandbox() {
  return {
    Vue,
    ref: Vue.ref,
    reactive: Vue.reactive,
    computed: Vue.computed,
    watch: Vue.watch,
    watchEffect: Vue.watchEffect,
    onMounted: Vue.onMounted,
    onBeforeUnmount: Vue.onBeforeUnmount,
    onUnmounted: Vue.onUnmounted,
    nextTick: Vue.nextTick,
    toRef: Vue.toRef,
    toRefs: Vue.toRefs,
    shallowRef: Vue.shallowRef,
    triggerRef: Vue.triggerRef,
    provide: Vue.provide,
    inject: Vue.inject,
    h: Vue.h,
    defineComponent: Vue.defineComponent,
    Icons: ElementPlusIcons,
    useRemoteConfig,
  }
}

function injectStyle(pluginId, css) {
  const styleId = `ssh-plugin-style-${pluginId}`
  if (loadedStyles.has(styleId)) return
  const el = document.createElement('style')
  el.id = styleId
  el.textContent = css
  document.head.appendChild(el)
  loadedStyles.add(styleId)
}

function removeStyle(pluginId) {
  const styleId = `ssh-plugin-style-${pluginId}`
  const el = document.getElementById(styleId)
  if (el) el.remove()
  loadedStyles.delete(styleId)
}

function evaluatePluginCode(code, manifest) {
  const sandbox = createPluginSandbox()
  const ctx = { exports: null }
  try {
    const fn = new Function(
      'ctx',
      'Vue',
      'ref', 'reactive', 'computed', 'watch', 'watchEffect',
      'onMounted', 'onBeforeUnmount', 'onUnmounted', 'nextTick',
      'toRef', 'toRefs', 'shallowRef', 'triggerRef',
      'provide', 'inject', 'h', 'defineComponent',
      'Icons',
      'useRemoteConfig',
      code,
    )
    fn.call(
      ctx, ctx,
      sandbox.Vue,
      sandbox.ref, sandbox.reactive, sandbox.computed, sandbox.watch, sandbox.watchEffect,
      sandbox.onMounted, sandbox.onBeforeUnmount, sandbox.onUnmounted, sandbox.nextTick,
      sandbox.toRef, sandbox.toRefs, sandbox.shallowRef, sandbox.triggerRef,
      sandbox.provide, sandbox.inject, sandbox.h, sandbox.defineComponent,
      sandbox.Icons,
      sandbox.useRemoteConfig,
    )
    return ctx.exports
  } catch (e) {
    console.error(`[ssh-plugin] failed to evaluate plugin "${manifest.id}":`, e)
    return null
  }
}

async function loadPlugin(pluginId) {
  if (pluginComponents.value[pluginId]) return pluginComponents.value[pluginId]

  const api = window.electronAPI?.sshPlugins
  if (!api) return null

  const res = await api.load(pluginId)
  if (!res?.ok) {
    console.error(`[ssh-plugin] load "${pluginId}" failed:`, res?.error)
    return null
  }

  const { code, style, manifest } = res.data
  if (style) injectStyle(pluginId, style)

  const component = evaluatePluginCode(code, manifest)
  if (!component) return null

  const wrapped = markRaw(component)
  pluginComponents.value = { ...pluginComponents.value, [pluginId]: wrapped }
  return wrapped
}

async function refreshPluginList() {
  const api = window.electronAPI?.sshPlugins
  if (!api) return
  loading.value = true
  try {
    const res = await api.list()
    if (res?.ok) pluginList.value = res.data
  } finally {
    loading.value = false
  }
}

async function initPlugins() {
  if (_initialized) return
  _initialized = true
  await refreshPluginList()
}

async function setPluginEnabled(pluginId, enabled) {
  const api = window.electronAPI?.sshPlugins
  if (!api) return
  await api.setEnabled(pluginId, enabled)
  if (!enabled) {
    removeStyle(pluginId)
    const next = { ...pluginComponents.value }
    delete next[pluginId]
    pluginComponents.value = next
  }
  await refreshPluginList()
}

async function installPluginFromUrl(url) {
  const api = window.electronAPI?.sshPlugins
  if (!api) return { ok: false, error: 'API not available' }
  const res = await api.installFromUrl(url)
  if (res?.ok) await refreshPluginList()
  return res
}

async function installPluginFromFile() {
  const api = window.electronAPI?.sshPlugins
  if (!api) return { ok: false, error: 'API not available' }
  const res = await api.installFromFile()
  if (res?.ok) await refreshPluginList()
  return res
}

async function uninstallPlugin(pluginId) {
  const api = window.electronAPI?.sshPlugins
  if (!api) return { ok: false, error: 'API not available' }
  removeStyle(pluginId)
  const next = { ...pluginComponents.value }
  delete next[pluginId]
  pluginComponents.value = next
  const res = await api.uninstall(pluginId)
  if (res?.ok) await refreshPluginList()
  return res
}

async function fetchRegistry(registryUrl) {
  const api = window.electronAPI?.sshPlugins
  if (!api) return []
  const res = await api.fetchRegistry(registryUrl)
  return res?.ok ? res.data : []
}

export function useSshPlugins() {
  return {
    pluginList,
    pluginComponents,
    loading,
    initPlugins,
    refreshPluginList,
    loadPlugin,
    setPluginEnabled,
    installPluginFromUrl,
    installPluginFromFile,
    uninstallPlugin,
    fetchRegistry,
  }
}
