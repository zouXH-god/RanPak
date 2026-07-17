const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../services/local-store');
const { SshRuntime } = require('../services/ssh');

const root = path.join(os.tmpdir(), `ranpak-ssh-portable-test-${Date.now()}`);
const makeSafeStorage = (device) => ({
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`${device}:${value}`, 'utf8'),
  decryptString: (value) => {
    const text = Buffer.from(value).toString('utf8');
    if (!text.startsWith(`${device}:`)) throw new Error('wrong device key');
    return text.slice(device.length + 1);
  },
});

try {
  const safeA = makeSafeStorage('device-a');
  process.env.RAN_PAK_RUNTIME_DIR = path.join(root, 'a');
  store.configure({ safeStorage: safeA });
  store.init();
  store.setMeta('active_sync_space', 'space');
  const legacyPassword = safeA.encryptString('correct horse').toString('base64');
  store.put('ssh_profile', 'profile', {
    id: 'profile', name: 'server', host: 'example.test', port: 22, username: 'root',
    secrets: { password: legacyPassword, passphrase: '' }, jumpHosts: [],
  });
  const runtimeA = new SshRuntime({ safeStorage: safeA });
  const portable = store.get('ssh_profile', 'profile');
  assert.match(portable.secrets.password, /^ranpak-secret-v1:/, 'legacy device-bound secret must be migrated');
  assert.equal(runtimeA.getAuthOptions(portable).password, 'correct horse');
  const raw = store.init().prepare("SELECT content FROM entities WHERE entity_type='ssh_profile' AND entity_id='profile'").get().content;
  assert.equal(raw.includes('correct horse'), false, 'portable secret must remain protected by entity-level safeStorage encryption');

  store.close();
  const safeB = makeSafeStorage('device-b');
  process.env.RAN_PAK_RUNTIME_DIR = path.join(root, 'b');
  store.configure({ safeStorage: safeB });
  store.init();
  store.put('ssh_profile', 'profile', portable, { syncSpaceId: 'space' });
  const runtimeB = new SshRuntime({ safeStorage: safeB });
  assert.equal(runtimeB.getAuthOptions(store.get('ssh_profile', 'profile')).password, 'correct horse', 'another device must decrypt synchronized SSH credentials');
  console.log('ssh portable secret tests passed');
} finally {
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
}
