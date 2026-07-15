import { computed, ref } from 'vue'
import { featureKey } from '../data/features'
import { fetchFeatureVisibility, updateFeatureVisibility } from '../utils/api/tools'

const hiddenFeatures = ref([])
let _loaded = false
let _saveTimer = null

async function loadVisibility() {
  try {
    const res = await fetchFeatureVisibility()
    if (res?.code === 200 && res.data) {
      hiddenFeatures.value = Array.isArray(res.data.hiddenFeatures) ? res.data.hiddenFeatures : []
    }
    _loaded = true
  } catch {}
}

function debouncedSave() {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    updateFeatureVisibility({ hiddenFeatures: hiddenFeatures.value })
  }, 300)
}

export function useFeatureVisibility() {
  if (!_loaded) loadVisibility()

  const hiddenSet = computed(() => new Set(hiddenFeatures.value))

  function isHidden(item) {
    return hiddenSet.value.has(featureKey(item))
  }

  function setHidden(item, hidden) {
    const key = featureKey(item)
    if (!key) return
    const next = new Set(hiddenFeatures.value)
    if (hidden) next.add(key)
    else next.delete(key)
    hiddenFeatures.value = [...next]
    debouncedSave()
  }

  function setMultipleHidden(items, hidden) {
    const next = new Set(hiddenFeatures.value)
    for (const item of items) {
      const key = featureKey(item)
      if (!key) continue
      if (hidden) next.add(key)
      else next.delete(key)
    }
    hiddenFeatures.value = [...next]
    debouncedSave()
  }

  function toggleVisibility(item) {
    setHidden(item, !isHidden(item))
  }

  function applyCloudUpdate(data) {
    if (Array.isArray(data?.hiddenFeatures)) {
      hiddenFeatures.value = data.hiddenFeatures
    }
  }

  return {
    hiddenFeatures,
    hiddenSet,
    isHidden,
    setHidden,
    setMultipleHidden,
    toggleVisibility,
    loadVisibility,
    applyCloudUpdate,
  }
}
