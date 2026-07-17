const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../services/local-store');
const assets = require('../services/badge-history-assets');

const root = path.join(os.tmpdir(), `ranpak-badge-assets-test-${Date.now()}`);
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

try {
  process.env.RAN_PAK_RUNTIME_DIR = root;
  store.init();
  const record = { id: 'one', images: [[png]], tempImages: [[png]], thumbnail: png };
  const browserRecords = assets.save([record], 'http://127.0.0.1:8000');
  const stored = store.get('local_storage', assets.HISTORY_ID).value[0];
  assert.match(stored.images[0][0], /^assets\/badge-history\/[a-f0-9]{64}\.png$/);
  assert.equal(stored.images[0][0], stored.tempImages[0][0], 'identical images should share one content-addressed file');
  assert.equal(JSON.stringify(stored).includes('data:image/'), false, 'SQLite must contain paths rather than image data');
  assert.match(browserRecords[0].thumbnail, /^http:\/\/127\.0\.0\.1:8000\/badge-history-assets\//);
  assert.equal(fs.readdirSync(assets.assetDirectory()).length, 1);
  assert.equal(store.pending('').length, 0, 'local history must not generate empty-space sync logs');
  assert.deepEqual(assets.load('http://127.0.0.1:8000'), browserRecords);
  assets.save([], 'http://127.0.0.1:8000');
  assert.equal(fs.readdirSync(assets.assetDirectory()).length, 0, 'deleting history must remove unreferenced image files');
  console.log('badge history asset tests passed');
} finally {
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
}
