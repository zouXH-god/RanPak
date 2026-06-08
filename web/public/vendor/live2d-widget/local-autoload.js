/*!
 * Local Live2D Widget loader for RanPak.
 * Assets are vendored under /vendor/live2d-widget.
 */
const runtimeBase = '/vendor/live2d-widget/';
const widgetDist = `${runtimeBase}live2d-widgets/dist/`;
let resourcesReady = null;
let localWaifuTipsUrl = null;
let localWaifuTipsKey = '';
let modelCatalogReady = null;
let modelCatalogKey = '';

function runtimeConfig() {
  return window.RAN_PAK_LIVE2D_CONFIG || {};
}

  function assetUrl(value) {
    const raw = String(value || '').replace(/\\/g, '/');
  if (!raw || /^(https?:|data:|blob:)/i.test(raw)) return raw;
    const baseUrl = runtimeConfig().baseUrl || '/live2d-assets/';
  const normalizedBaseUrl = baseUrl.replace(/\/?$/, '/');
  if (raw.startsWith('/live2d-assets/')) {
    return `${normalizedBaseUrl}${raw.slice('/live2d-assets/'.length)}`;
  }
  if (raw.startsWith('/')) return raw;
  return `${normalizedBaseUrl}${raw.replace(/^\/+/, '')}`;
  }

function loadLocalResource(url, type) {
  return new Promise((resolve, reject) => {
    let tag = null;
    if (type === 'css') {
      tag = document.createElement('link');
      tag.rel = 'stylesheet';
      tag.href = url;
    } else if (type === 'js') {
      tag = document.createElement('script');
      tag.type = 'module';
      tag.src = url;
    }
    if (!tag) return reject(url);
    tag.onload = () => resolve(url);
    tag.onerror = () => reject(url);
    document.head.appendChild(tag);
  });
}

async function getModelCatalog() {
  const config = runtimeConfig();
  const catalogUrl = config.catalogUrl || '/api/live2d/catalog';
  if (modelCatalogReady && modelCatalogKey === catalogUrl) return modelCatalogReady;
  modelCatalogKey = catalogUrl;
  modelCatalogReady = fetch(catalogUrl)
    .then((response) => response.json())
    .then((payload) => Array.isArray(payload) ? payload : payload.data)
    .then((catalog) => {
      if (!Array.isArray(catalog)) throw new Error('Invalid Live2D catalog');
      return catalog.map((model, index) => ({
      ...model,
      id: index,
      message: model.message || model.name,
      paths: Array.isArray(model.paths) ? model.paths.map(assetUrl) : [],
      cover: model.cover ? assetUrl(model.cover) : model.cover,
    }));
    });
  return modelCatalogReady;
}

function clampIndex(value, max) {
  const index = Number.parseInt(value, 10);
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(index, 0), Math.max(max - 1, 0));
}

async function getLocalWaifuTipsUrl() {
  const config = runtimeConfig();
  const catalogUrl = config.catalogUrl || '/api/live2d/catalog';
  if (localWaifuTipsUrl && localWaifuTipsKey === catalogUrl) return localWaifuTipsUrl;
  if (localWaifuTipsUrl) URL.revokeObjectURL(localWaifuTipsUrl);
  localWaifuTipsKey = catalogUrl;
  const response = await fetch(`${widgetDist}waifu-tips.json`);
  const tips = await response.json();
  const models = await getModelCatalog();
  tips.models = models;
  localWaifuTipsUrl = URL.createObjectURL(new Blob([JSON.stringify(tips)], {
    type: 'application/json',
  }));
  return localWaifuTipsUrl;
}

async function ensureLive2dResources() {
  if (resourcesReady) return resourcesReady;
  const OriginalImage = window.Image;
  if (!window.__RAN_PAK_LIVE2D_IMAGE_PATCHED__) {
    window.Image = function(...args) {
      const img = new OriginalImage(...args);
      img.crossOrigin = 'anonymous';
      return img;
    };
    window.Image.prototype = OriginalImage.prototype;
    window.__RAN_PAK_LIVE2D_IMAGE_PATCHED__ = true;
  }

  resourcesReady = Promise.all([
    loadLocalResource(`${widgetDist}waifu.css`, 'css'),
    loadLocalResource(`${widgetDist}waifu-tips.js`, 'js'),
  ]);
  return resourcesReady;
}

window.RAN_PAK_INIT_LIVE2D = async function initRanPakLive2d() {
  await ensureLive2dResources();
  const models = await getModelCatalog();
  const waifuPath = await getLocalWaifuTipsUrl();
  const runtimeConfig = window.RAN_PAK_LIVE2D_CONFIG || {};
  const modelId = clampIndex(runtimeConfig.modelId, models.length);
  const textureId = clampIndex(runtimeConfig.textureId, models[modelId]?.paths?.length || 1);
  window.__RAN_PAK_LIVE2D_MODELS__ = models.map((model, index) => ({
    id: index,
    name: model.message,
    textures: model.paths.length,
  }));
  localStorage.setItem('modelId', String(modelId));
  localStorage.setItem('modelTexturesId', String(textureId));
  localStorage.removeItem('waifu-disabled');
  localStorage.removeItem('waifu-display');

  window.initWidget({
    waifuPath,
    cubism2Path: `${widgetDist}live2d.min.js`,
    cubism5Path: `${runtimeBase}live2dcubismcore.min.js`,
    tools: [],
    modelId,
    models,
    logLevel: 'warn',
    drag: false,
  });
};

window.RAN_PAK_INIT_LIVE2D();
