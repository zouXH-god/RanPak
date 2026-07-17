const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const localStore = require('./local-store');

const HISTORY_ID = 'ran-pak.badge-print.history';
const ASSET_ROUTE = '/badge-history-assets/';
const MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);
const ASSET_NAME_PATTERN = /^[a-f0-9]{64}\.(?:png|jpg|webp|gif)$/;
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;

function runtimeRoot() {
  return process.env.RAN_PAK_RUNTIME_DIR || path.resolve(__dirname, '..', '..');
}

function assetDirectory() {
  return path.join(runtimeRoot(), 'assets', 'badge-history');
}

function relativeAssetPath(name) {
  return `assets/badge-history/${name}`;
}

function assetName(value) {
  if (typeof value !== 'string' || !value) return '';
  const normalized = value.replace(/\\/g, '/');
  const routeIndex = normalized.indexOf(ASSET_ROUTE);
  const candidate = routeIndex >= 0
    ? normalized.slice(routeIndex + ASSET_ROUTE.length).split(/[?#]/, 1)[0]
    : normalized.startsWith('assets/badge-history/')
      ? normalized.slice('assets/badge-history/'.length)
      : '';
  let decoded = '';
  try { decoded = decodeURIComponent(candidate); } catch { return ''; }
  return ASSET_NAME_PATTERN.test(decoded) ? decoded : '';
}

function writeDataUrl(value) {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(value || '');
  if (!match) return null;
  const extension = MIME_EXTENSIONS.get(match[1].toLowerCase());
  if (!extension) throw new Error(`不支持的历史图片格式: ${match[1]}`);
  const buffer = Buffer.from(match[2].replace(/[\r\n]/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('历史图片为空或超过 64MB 限制');
  const name = `${crypto.createHash('sha256').update(buffer).digest('hex')}.${extension}`;
  const directory = assetDirectory();
  const target = path.join(directory, name);
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(target)) {
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, buffer, { flag: 'wx', mode: 0o600 });
    try { fs.renameSync(temporary, target); }
    catch (error) {
      if (!fs.existsSync(target)) throw error;
      fs.rmSync(temporary, { force: true });
    }
  }
  return relativeAssetPath(name);
}

function storeImage(value) {
  if (!value) return '';
  if (typeof value !== 'string') throw new Error('历史图片字段格式无效');
  const written = writeDataUrl(value);
  if (written) return written;
  const name = assetName(value);
  if (!name) throw new Error('历史图片必须是受支持的数据图片或已保存的资产路径');
  const target = path.join(assetDirectory(), name);
  if (!fs.existsSync(target)) throw new Error(`历史图片文件不存在: ${name}`);
  return relativeAssetPath(name);
}

function mapGrid(grid, mapper) {
  return Array.isArray(grid) ? grid.map(row => Array.isArray(row) ? row.map(mapper) : []) : [];
}

function externalize(records) {
  if (!Array.isArray(records)) throw new Error('历史记录必须是数组');
  return records.map(record => ({
    ...record,
    images: mapGrid(record?.images, storeImage),
    tempImages: mapGrid(record?.tempImages, storeImage),
    thumbnail: storeImage(record?.thumbnail || ''),
  }));
}

function referencedNames(records) {
  const names = new Set();
  const add = value => { const name = assetName(value); if (name) names.add(name); };
  for (const record of records || []) {
    mapGrid(record.images, value => { add(value); return value; });
    mapGrid(record.tempImages, value => { add(value); return value; });
    add(record.thumbnail);
  }
  return names;
}

function removeUnreferenced(records) {
  const directory = assetDirectory();
  if (!fs.existsSync(directory)) return 0;
  const referenced = referencedNames(records);
  let removed = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && ASSET_NAME_PATTERN.test(entry.name) && !referenced.has(entry.name)) {
      fs.rmSync(path.join(directory, entry.name));
      removed += 1;
    }
  }
  return removed;
}

function browserImage(value, origin = '') {
  if (!value) return '';
  const name = assetName(value);
  if (!name) return value;
  return `${String(origin).replace(/\/$/, '')}${ASSET_ROUTE}${encodeURIComponent(name)}`;
}

function forBrowser(records, origin = '') {
  return (records || []).map(record => ({
    ...record,
    images: mapGrid(record.images, value => browserImage(value, origin)),
    tempImages: mapGrid(record.tempImages, value => browserImage(value, origin)),
    thumbnail: browserImage(record.thumbnail, origin),
  }));
}

function storedRecords() {
  const entity = localStore.get('local_storage', HISTORY_ID);
  if (!entity) return [];
  if (entity.encoding !== 'json' || !Array.isArray(entity.value)) throw new Error('徽章历史记录格式无效');
  return entity.value;
}

function save(records, origin = '') {
  const stored = externalize(records);
  localStore.put('local_storage', HISTORY_ID, { encoding: 'json', value: stored });
  removeUnreferenced(stored);
  return forBrowser(stored, origin);
}

function load(origin = '') {
  const records = storedRecords();
  const needsMigration = JSON.stringify(records).includes('data:image/');
  if (needsMigration) return save(records, origin);
  removeUnreferenced(records);
  return forBrowser(records, origin);
}

function resolveAsset(name) {
  if (!ASSET_NAME_PATTERN.test(String(name || ''))) return null;
  const target = path.join(assetDirectory(), name);
  return fs.existsSync(target) ? target : null;
}

module.exports = {
  HISTORY_ID,
  assetDirectory,
  resolveAsset,
  load,
  save,
  externalize,
  forBrowser,
  removeUnreferenced,
};
