import { computed, ref, watch } from 'vue'
import { featureKey } from '../data/features'

const STORAGE_KEY = 'ran-terminal.favorite-features'

function readStoredFavoriteKeys() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

const favoriteKeys = ref(readStoredFavoriteKeys())

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    favoriteKeys.value = readStoredFavoriteKeys()
  })
}

watch(favoriteKeys, (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}, { deep: true })

export function useFavorites() {
  const favoriteKeySet = computed(() => new Set(favoriteKeys.value))

  function isFavorite(item) {
    return favoriteKeySet.value.has(featureKey(item))
  }

  function toggleFavorite(item) {
    const key = featureKey(item)
    if (!key) return
    const next = new Set(favoriteKeys.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    favoriteKeys.value = [...next]
  }

  return {
    favoriteKeys,
    favoriteKeySet,
    isFavorite,
    toggleFavorite,
  }
}
