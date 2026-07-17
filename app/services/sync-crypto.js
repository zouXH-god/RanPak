const crypto = require('crypto');
const fs = require('fs');

let masterKey = null;
let keyId = '';
function checksum(key) { return crypto.createHash('sha256').update(Buffer.concat([Buffer.from('ranpak-recovery-v1'),key])).digest('hex'); }
function createRecovery(filePath) {
  masterKey = crypto.randomBytes(32); keyId = crypto.randomUUID();
  const doc={format:'ranpak-recovery-key',version:1,keyId,key:masterKey.toString('base64'),checksum:checksum(masterKey)};
  fs.writeFileSync(filePath, JSON.stringify(doc,null,2), {encoding:'utf8',mode:0o600}); return {keyId,filePath};
}
function importRecovery(filePath) {
  const doc=JSON.parse(fs.readFileSync(filePath,'utf8'));
  if(doc.format!=='ranpak-recovery-key'||doc.version!==1) throw new Error('恢复密钥文件格式不受支持');
  const key=Buffer.from(doc.key,'base64');
  if(key.length!==32||checksum(key)!==doc.checksum) throw new Error('恢复密钥校验失败');
  masterKey=key; keyId=doc.keyId; return {keyId};
}
function lock(){ if(masterKey) masterKey.fill(0); masterKey=null; keyId=''; }
function status(){ return {locked:!masterKey,keyId}; }
function exportForCache(){ if(!masterKey)return null; return Buffer.from(JSON.stringify({version:1,keyId,key:masterKey.toString('base64')}),'utf8'); }
function importFromCache(buffer){ const doc=JSON.parse(Buffer.from(buffer).toString('utf8')); const key=Buffer.from(doc.key,'base64'); if(doc.version!==1||key.length!==32)throw new Error('缓存密钥格式错误'); masterKey=key;keyId=doc.keyId;return {keyId}; }
function encrypt(value,aad={}) { if(!masterKey) throw new Error('同步密钥尚未解锁'); const nonce=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',masterKey,nonce); cipher.setAAD(Buffer.from(JSON.stringify(aad))); const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]); return {version:1,algorithm:'AES-256-GCM',keyId,nonce:nonce.toString('base64'),ciphertext:ciphertext.toString('base64'),tag:cipher.getAuthTag().toString('base64')}; }
function decrypt(box,aad={}) { if(!masterKey) throw new Error('同步密钥尚未解锁'); if(box.keyId!==keyId) throw new Error('恢复密钥与同步空间不匹配'); const decipher=crypto.createDecipheriv('aes-256-gcm',masterKey,Buffer.from(box.nonce,'base64')); decipher.setAAD(Buffer.from(JSON.stringify(aad))); decipher.setAuthTag(Buffer.from(box.tag,'base64')); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(box.ciphertext,'base64')),decipher.final()]).toString('utf8')); }
module.exports={createRecovery,importRecovery,exportForCache,importFromCache,lock,status,encrypt,decrypt};
