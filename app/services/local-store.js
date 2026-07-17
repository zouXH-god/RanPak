const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { DatabaseSync } = require('node:sqlite');

const events = new EventEmitter();
const SENSITIVE_TYPES = new Set(['app_config', 'cloud_config', 'dns_account', 'ssh_profile', 'ssh_private_key', 'ssh_import_source']);
const SYNCABLE_TYPES = new Set(['ssh_profile','ssh_folder','ssh_private_key','ssh_import_source','ssh_preset_command','dns_account','ssh_history','local_storage']);
const LOCAL_ONLY_ENTITIES = new Set(['local_storage:ran-pak.badge-print.history']);
let db;
let dbPath;
let safeStorage;
let transactionDepth = 0;

function runtimeRoot() { return process.env.RAN_PAK_RUNTIME_DIR || path.resolve(__dirname, '..', '..'); }
function configure(options = {}) { safeStorage = options.safeStorage || safeStorage; }
function ensureColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
function init() {
  if (db) return db;
  const dir = path.join(runtimeRoot(), 'data'); fs.mkdirSync(dir, { recursive: true });
  dbPath = path.join(dir, 'ranpak.db'); db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entities (
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, content TEXT NOT NULL,
      content_hash TEXT NOT NULL, head_op_id TEXT, version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL, deleted_at INTEGER, PRIMARY KEY(entity_type, entity_id));
    CREATE TABLE IF NOT EXISTS change_log (
      op_id TEXT NOT NULL, sync_space_id TEXT NOT NULL DEFAULT '', device_id TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, parent_op_id TEXT, merge_parents TEXT,
      payload TEXT NOT NULL, content_hash TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, sync_state TEXT NOT NULL DEFAULT 'pending', server_seq INTEGER,
      PRIMARY KEY(sync_space_id,op_id));
    CREATE TABLE IF NOT EXISTS sync_heads_v2 (
      sync_space_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      op_id TEXT NOT NULL, content_hash TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(sync_space_id,entity_type,entity_id,op_id));
    CREATE TABLE IF NOT EXISTS sync_cursors (
      sync_space_id TEXT PRIMARY KEY, cursor INTEGER NOT NULL DEFAULT 0, protocol_version INTEGER NOT NULL DEFAULT 2);
    CREATE TABLE IF NOT EXISTS conflicts_v2 (
      id TEXT PRIMARY KEY, sync_space_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      local_op_id TEXT NOT NULL, remote_op_id TEXT NOT NULL, base_op_id TEXT,
      local_payload TEXT NOT NULL, remote_payload TEXT NOT NULL, local_deleted INTEGER NOT NULL DEFAULT 0,
      remote_deleted INTEGER NOT NULL DEFAULT 0, heads TEXT NOT NULL, created_at INTEGER NOT NULL,
      resolved_at INTEGER, resolution_op_id TEXT);
    CREATE TABLE IF NOT EXISTS sync_aliases_v2 (
      sync_space_id TEXT NOT NULL, op_id TEXT NOT NULL, canonical_op_id TEXT NOT NULL,
      PRIMARY KEY(sync_space_id,op_id));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_open_conflict_entity ON conflicts_v2(sync_space_id,entity_type,entity_id) WHERE resolved_at IS NULL;
  `);
  ensureColumn('change_log', 'sync_space_id', "TEXT NOT NULL DEFAULT ''");
  const changeLogInfo=db.prepare('PRAGMA table_info(change_log)').all();
  const changeLogPrimaryKey=changeLogInfo.filter(column=>column.pk).sort((a,b)=>a.pk-b.pk).map(column=>column.name).join(',');
  if(changeLogPrimaryKey!=='sync_space_id,op_id'){
    db.exec(`ALTER TABLE change_log RENAME TO change_log_legacy_pk;
      CREATE TABLE change_log (
        op_id TEXT NOT NULL, sync_space_id TEXT NOT NULL DEFAULT '', device_id TEXT NOT NULL,
        entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, parent_op_id TEXT, merge_parents TEXT,
        payload TEXT NOT NULL, content_hash TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, sync_state TEXT NOT NULL DEFAULT 'pending', server_seq INTEGER,
        PRIMARY KEY(sync_space_id,op_id));
      INSERT OR IGNORE INTO change_log SELECT op_id,sync_space_id,device_id,entity_type,entity_id,parent_op_id,merge_parents,payload,content_hash,deleted,created_at,sync_state,server_seq FROM change_log_legacy_pk;
      DROP TABLE change_log_legacy_pk;`);
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_change_space_pending ON change_log(sync_space_id,sync_state,created_at)');
  const cursorColumns=db.prepare('PRAGMA table_info(sync_cursors)').all();
  if(!cursorColumns.some(column=>column.name==='sync_space_id')){db.exec('ALTER TABLE sync_cursors RENAME TO sync_cursors_legacy; CREATE TABLE sync_cursors(sync_space_id TEXT PRIMARY KEY,cursor INTEGER NOT NULL DEFAULT 0,protocol_version INTEGER NOT NULL DEFAULT 2);');}
  if (!getMeta('device_id')) setMeta('device_id', crypto.randomUUID());
  setMeta('schema_version', '3'); return db;
}
function transaction(fn) { if(transactionDepth)return fn();init().exec('BEGIN IMMEDIATE');transactionDepth++;try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}finally{transactionDepth--;}}
function getMeta(key) { return init().prepare('SELECT value FROM app_meta WHERE key=?').get(key)?.value; }
function setMeta(key,value) { init().prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(value)); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function plaintext(value) { return JSON.stringify(value === undefined ? null : value); }
function encode(type,value) {
  const raw=plaintext(value); if(!SENSITIVE_TYPES.has(type)) return raw;
  if(!safeStorage?.isEncryptionAvailable?.()) throw new Error(`系统安全存储不可用，无法保存敏感数据 ${type}`);
  return JSON.stringify({_localEncrypted:1,data:safeStorage.encryptString(raw).toString('base64')});
}
function decode(type,value) { const parsed=JSON.parse(value); if(!parsed?._localEncrypted)return parsed; if(!safeStorage?.isEncryptionAvailable?.())throw new Error(`系统安全存储不可用，无法读取 ${type}`);return JSON.parse(safeStorage.decryptString(Buffer.from(parsed.data,'base64'))); }
function getRaw(type,id){return init().prepare('SELECT * FROM entities WHERE entity_type=? AND entity_id=?').get(type,id);}
function get(type,id){const row=getRaw(type,id);return !row||row.deleted_at?null:decode(type,row.content);}
function list(type,includeDeleted=false){return init().prepare(`SELECT * FROM entities WHERE entity_type=? ${includeDeleted?'':'AND deleted_at IS NULL'} ORDER BY updated_at,entity_id`).all(type).map(row=>({...row,value:decode(type,row.content)}));}
function all(){return init().prepare('SELECT * FROM entities WHERE deleted_at IS NULL ORDER BY entity_type,entity_id').all().map(row=>({...row,value:decode(row.entity_type,row.content)}));}
function heads(space,type,id){return init().prepare('SELECT * FROM sync_heads_v2 WHERE sync_space_id=? AND entity_type=? AND entity_id=? ORDER BY op_id').all(space,type,id);}
function replaceHeads(space,type,id,newHeads){init().prepare('DELETE FROM sync_heads_v2 WHERE sync_space_id=? AND entity_type=? AND entity_id=?').run(space,type,id);const stmt=init().prepare('INSERT INTO sync_heads_v2 VALUES(?,?,?,?,?,?)');for(const h of newHeads)stmt.run(space,type,id,h.opId,h.contentHash,h.deleted?1:0);}
function canonicalOp(space,opId){let current=opId||null;for(let i=0;current&&i<32;i++){const next=init().prepare('SELECT canonical_op_id FROM sync_aliases_v2 WHERE sync_space_id=? AND op_id=?').get(space,current)?.canonical_op_id;if(!next||next===current)break;current=next;}return current;}
function setAlias(space,opId,canonical){if(!opId||!canonical||opId===canonical)return;init().prepare('INSERT INTO sync_aliases_v2(sync_space_id,op_id,canonical_op_id) VALUES(?,?,?) ON CONFLICT(sync_space_id,op_id) DO UPDATE SET canonical_op_id=excluded.canonical_op_id').run(space,opId,canonical);}
function advanceHeads(space,type,id,op,parents=[]){const current=heads(space,type,id),merge=new Set((parents||[]).map(parent=>canonicalOp(space,parent)));if(current.length&&current.every(head=>merge.has(canonicalOp(space,head.op_id))))return[{opId:op.opId,contentHash:op.contentHash,deleted:Boolean(op.deleted)}];if(!current.length)return[{opId:op.opId,contentHash:op.contentHash,deleted:Boolean(op.deleted)}];const parent=canonicalOp(space,op.parentOpId);const index=current.findIndex(head=>canonicalOp(space,head.op_id)===parent);if(index<0)return[...current.map(head=>({opId:head.op_id,contentHash:head.content_hash,deleted:Boolean(head.deleted)})),{opId:op.opId,contentHash:op.contentHash,deleted:Boolean(op.deleted)}];return current.map((head,i)=>i===index?{opId:op.opId,contentHash:op.contentHash,deleted:Boolean(op.deleted)}:{opId:head.op_id,contentHash:head.content_hash,deleted:Boolean(head.deleted)});}
function updateOpenConflict(space,type,id,fields,newHeads){const open=init().prepare('SELECT id FROM conflicts_v2 WHERE sync_space_id=? AND entity_type=? AND entity_id=? AND resolved_at IS NULL').get(space,type,id);if(!open)return;const assignments=['heads=?'],values=[JSON.stringify(newHeads.map(head=>head.opId))];for(const[key,value]of Object.entries(fields)){assignments.push(`${key}=?`);values.push(value);}values.push(open.id);init().prepare(`UPDATE conflicts_v2 SET ${assignments.join(',')} WHERE id=?`).run(...values);}
function emitChange(type,id,deleted,origin='local'){queueMicrotask(()=>events.emit('changed',{type,id,deleted:Boolean(deleted),origin}));}
function isSyncable(type,id){return !LOCAL_ONLY_ENTITIES.has(`${type}:${id}`)&&(SYNCABLE_TYPES.has(type)||(type==='app_config'&&['ai','feature_visibility'].includes(id)));}

function put(type,id,value,options={}) {
  const raw=plaintext(value), contentHash=hash(raw), current=getRaw(type,id);
  if(!options.force && current && !current.deleted_at && current.content_hash===contentHash) return {opId:current.head_op_id,contentHash,unchanged:true};
  const opId=options.opId||crypto.randomUUID(), now=Date.now(), space=options.syncSpaceId??getMeta('active_sync_space')??'';
  const currentHeads=heads(space,type,id),parentHead=currentHeads.some(head=>head.op_id===current?.head_op_id)?current.head_op_id:currentHeads[0]?.op_id||null;
  transaction(()=>{
    init().prepare(`INSERT INTO entities(entity_type,entity_id,content,content_hash,head_op_id,version,updated_at,deleted_at) VALUES(?,?,?,?,?,1,?,NULL)
      ON CONFLICT(entity_type,entity_id) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,head_op_id=excluded.head_op_id,version=entities.version+1,updated_at=excluded.updated_at,deleted_at=NULL`).run(type,id,encode(type,value),contentHash,opId,now);
    if(!options.noChangeLog&&space&&isSyncable(type,id)){const parentOpId=options.parentOpId??parentHead,mergeParents=options.mergeParents||[];init().prepare(`INSERT OR IGNORE INTO change_log(op_id,sync_space_id,device_id,entity_type,entity_id,parent_op_id,merge_parents,payload,content_hash,deleted,created_at,sync_state) VALUES(?,?,?,?,?,?,?,?,?,0,?,?)`).run(opId,space,getMeta('device_id'),type,id,parentOpId,JSON.stringify(mergeParents),encode(type,value),contentHash,now,options.syncState||'pending');const newHeads=advanceHeads(space,type,id,{opId,parentOpId,contentHash,deleted:false},mergeParents);replaceHeads(space,type,id,newHeads);updateOpenConflict(space,type,id,{local_op_id:opId,local_payload:encode(type,value),local_deleted:0},newHeads);}
  }); emitChange(type,id,false,options.origin);return {opId,contentHash};
}
function remove(type,id,options={}) {
  const current=getRaw(type,id); if(current?.deleted_at&&!options.force)return {opId:current.head_op_id,unchanged:true};
  const opId=options.opId||crypto.randomUUID(),now=Date.now(),space=options.syncSpaceId??getMeta('active_sync_space')??'',nullHash=hash('null');
  const currentHeads=heads(space,type,id),parentHead=currentHeads.some(head=>head.op_id===current?.head_op_id)?current.head_op_id:currentHeads[0]?.op_id||null;
  transaction(()=>{init().prepare(`INSERT INTO entities(entity_type,entity_id,content,content_hash,head_op_id,version,updated_at,deleted_at) VALUES(?,?,?,?,?,1,?,?) ON CONFLICT(entity_type,entity_id) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,head_op_id=excluded.head_op_id,version=entities.version+1,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at`).run(type,id,encode(type,null),nullHash,opId,now,now);if(!options.noChangeLog&&space&&isSyncable(type,id)){const parentOpId=options.parentOpId??parentHead,mergeParents=options.mergeParents||[];init().prepare(`INSERT OR IGNORE INTO change_log(op_id,sync_space_id,device_id,entity_type,entity_id,parent_op_id,merge_parents,payload,content_hash,deleted,created_at,sync_state) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)`).run(opId,space,getMeta('device_id'),type,id,parentOpId,JSON.stringify(mergeParents),encode(type,null),nullHash,now,options.syncState||'pending');const newHeads=advanceHeads(space,type,id,{opId,parentOpId,contentHash:nullHash,deleted:true},mergeParents);replaceHeads(space,type,id,newHeads);updateOpenConflict(space,type,id,{local_op_id:opId,local_payload:encode(type,null),local_deleted:1},newHeads);}});emitChange(type,id,true,options.origin);return {opId,contentHash:nullHash};
}
function replaceType(type,items,idOf){const existing=new Map(list(type,true).map(r=>[r.entity_id,r]));return transactionBatch(()=>{for(const [index,item] of items.entries()){const id=String(idOf(item,index));existing.delete(id);put(type,id,item);}for(const id of existing.keys())remove(type,id);});}
function transactionBatch(fn){return transaction(fn);}
function pending(space,limit=500){return init().prepare("SELECT * FROM change_log WHERE sync_space_id=? AND sync_state='pending' ORDER BY created_at LIMIT ?").all(space,limit);}
function markSynced(space,opId,seq){init().prepare("UPDATE change_log SET sync_state='synced',server_seq=? WHERE sync_space_id=? AND op_id=?").run(seq,space,opId);}
function getCursor(space){return Number(init().prepare('SELECT cursor FROM sync_cursors WHERE sync_space_id=?').get(space)?.cursor||0);}
function setCursor(space,cursor){init().prepare('INSERT INTO sync_cursors(sync_space_id,cursor) VALUES(?,?) ON CONFLICT(sync_space_id) DO UPDATE SET cursor=excluded.cursor').run(space,Number(cursor));}
function resetSyncSpace(space){transaction(()=>{init().prepare('DELETE FROM change_log WHERE sync_space_id=?').run(space);init().prepare('DELETE FROM sync_heads_v2 WHERE sync_space_id=?').run(space);init().prepare('DELETE FROM sync_aliases_v2 WHERE sync_space_id=?').run(space);init().prepare('DELETE FROM conflicts_v2 WHERE sync_space_id=?').run(space);init().prepare('DELETE FROM sync_cursors WHERE sync_space_id=?').run(space);});}
function retireUnboundSyncState(){resetSyncSpace('');}
function ensureBaseline(space){transaction(()=>{for(const row of all()){if(!isSyncable(row.entity_type,row.entity_id))continue;const exists=init().prepare('SELECT 1 FROM change_log WHERE sync_space_id=? AND entity_type=? AND entity_id=?').get(space,row.entity_type,row.entity_id);if(!exists)put(row.entity_type,row.entity_id,row.value,{syncSpaceId:space,force:true,parentOpId:null});}setMeta('active_sync_space',space);});}
function payloadOf(row){return decode(row.entity_type,row.payload);}
function hasOperation(space,opId){return !!init().prepare('SELECT 1 FROM change_log WHERE sync_space_id=? AND op_id=?').get(space,opId);}
function recordRemote(space,op,value,state='synced'){init().prepare(`INSERT OR IGNORE INTO change_log(op_id,sync_space_id,device_id,entity_type,entity_id,parent_op_id,merge_parents,payload,content_hash,deleted,created_at,sync_state,server_seq) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(op.opId,space,op.deviceId,op.entityType,op.entityId,op.parentOpId||null,JSON.stringify(op.mergeParents||[]),encode(op.entityType,value),op.contentHash,op.deleted?1:0,Date.parse(op.createdAt)||Date.now(),state,op.seq);}
function applyRemote(space,op,value){
  if(hasOperation(space,op.opId))return {duplicate:true};
  const current=getRaw(op.entityType,op.entityId),currentHeads=heads(space,op.entityType,op.entityId);
  const merge=new Set((op.mergeParents||[]).map(parent=>canonicalOp(space,parent)));
  const parent=canonicalOp(space,op.parentOpId);
  const parentIndex=currentHeads.findIndex(head=>canonicalOp(space,head.op_id)===parent);
  const resolves=currentHeads.length>0&&currentHeads.every(head=>merge.has(canonicalOp(space,head.op_id)));
  const sameContent=Boolean(current&&current.content_hash===op.contentHash&&Boolean(current.deleted_at)===Boolean(op.deleted));

  if(sameContent&&!resolves&&parentIndex<0){
    transaction(()=>{recordRemote(space,op,value);const equivalent=currentHeads.find(head=>head.content_hash===op.contentHash&&Boolean(head.deleted)===Boolean(op.deleted))||currentHeads[0];if(equivalent)setAlias(space,op.opId,equivalent.op_id);});
    return {duplicateContent:true,resolved:false};
  }

  const sequential=currentHeads.length===0||(currentHeads.length===1&&parentIndex===0);
  if(sequential||resolves){
    transaction(()=>{recordRemote(space,op,value);if(op.deleted)remove(op.entityType,op.entityId,{opId:op.opId,syncSpaceId:space,noChangeLog:true,force:true,origin:'remote'});else put(op.entityType,op.entityId,value,{opId:op.opId,syncSpaceId:space,noChangeLog:true,force:true,origin:'remote'});replaceHeads(space,op.entityType,op.entityId,[{opId:op.opId,contentHash:op.contentHash,deleted:op.deleted}]);if(resolves)init().prepare('UPDATE conflicts_v2 SET resolved_at=?,resolution_op_id=? WHERE sync_space_id=? AND entity_type=? AND entity_id=? AND resolved_at IS NULL').run(Date.now(),op.opId,space,op.entityType,op.entityId);});
    return sameContent?{duplicateContent:true,resolved:resolves}:{applied:true,resolved:resolves};
  }

  const nextHeads=advanceHeads(space,op.entityType,op.entityId,op,op.mergeParents||[]);
  transaction(()=>{
    recordRemote(space,op,value);
    const advancesVisible=parentIndex>=0&&canonicalOp(space,current?.head_op_id)===canonicalOp(space,currentHeads[parentIndex]?.op_id);
    if(advancesVisible){if(op.deleted)remove(op.entityType,op.entityId,{opId:op.opId,syncSpaceId:space,noChangeLog:true,force:true,origin:'remote'});else put(op.entityType,op.entityId,value,{opId:op.opId,syncSpaceId:space,noChangeLog:true,force:true,origin:'remote'});}
    replaceHeads(space,op.entityType,op.entityId,nextHeads);
    const open=init().prepare('SELECT * FROM conflicts_v2 WHERE sync_space_id=? AND entity_type=? AND entity_id=? AND resolved_at IS NULL').get(space,op.entityType,op.entityId);
    const headIds=nextHeads.map(head=>head.opId);
    if(open){const fields=advancesVisible?{local_op_id:op.opId,local_payload:encode(op.entityType,value),local_deleted:op.deleted?1:0}:{remote_op_id:op.opId,remote_payload:encode(op.entityType,value),remote_deleted:op.deleted?1:0};updateOpenConflict(space,op.entityType,op.entityId,fields,nextHeads);}
    else init().prepare(`INSERT INTO conflicts_v2(id,sync_space_id,entity_type,entity_id,local_op_id,remote_op_id,base_op_id,local_payload,remote_payload,local_deleted,remote_deleted,heads,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(),space,op.entityType,op.entityId,current?.head_op_id||currentHeads[0]?.op_id||'',op.opId,op.parentOpId||null,current?.content||encode(op.entityType,null),encode(op.entityType,value),current?.deleted_at?1:0,op.deleted?1:0,JSON.stringify(headIds),Date.now());
  });
  return {conflict:true,branchAdvanced:parentIndex>=0};
}
function conflicts(space=getMeta('active_sync_space')||''){
  return init().prepare('SELECT * FROM conflicts_v2 WHERE sync_space_id=? AND resolved_at IS NULL ORDER BY created_at').all(space).map(row=>{
    const headIds=JSON.parse(row.heads),branches=headIds.map(opId=>init().prepare('SELECT op_id,device_id,payload,deleted FROM change_log WHERE sync_space_id=? AND op_id=?').get(space,opId)).filter(Boolean).map(branch=>({opId:branch.op_id,deviceId:branch.device_id,value:decode(row.entity_type,branch.payload),deleted:Boolean(branch.deleted)}));
    return{...row,localValue:decode(row.entity_type,row.local_payload),remoteValue:decode(row.entity_type,row.remote_payload),heads:headIds,branches};
  });
}
function resolveConflict(id,choice,mergedValue,mergedDeleted=false){return transaction(()=>{const c=init().prepare('SELECT * FROM conflicts_v2 WHERE id=? AND resolved_at IS NULL').get(id);if(!c)throw new Error('冲突不存在或已处理');if(!['local','remote','merged'].includes(choice))throw new Error('无效的冲突解决方式');if(choice==='merged'&&mergedValue===undefined&&!mergedDeleted)throw new Error('手工合并必须提供值');const deleted=choice==='local'?Boolean(c.local_deleted):choice==='remote'?Boolean(c.remote_deleted):Boolean(mergedDeleted);const value=choice==='local'?decode(c.entity_type,c.local_payload):choice==='remote'?decode(c.entity_type,c.remote_payload):mergedValue;const options={syncSpaceId:c.sync_space_id,mergeParents:JSON.parse(c.heads),parentOpId:null,force:true};const result=deleted?remove(c.entity_type,c.entity_id,options):put(c.entity_type,c.entity_id,value,options);init().prepare('UPDATE conflicts_v2 SET resolved_at=?,resolution_op_id=? WHERE id=?').run(Date.now(),result.opId,id);return result;});}
function resolveConflicts(ids,choice){
  const unique=[...new Set((ids||[]).map(String).filter(Boolean))];
  if(!unique.length)throw new Error('请选择要处理的冲突');
  if(unique.length>500)throw new Error('单次最多处理 500 条冲突');
  if(!['local','remote'].includes(choice))throw new Error('批量处理仅支持保留本机或采用远端');
  for(const id of unique)if(!init().prepare('SELECT 1 FROM conflicts_v2 WHERE id=? AND resolved_at IS NULL').get(id))throw new Error('所选冲突不存在或已处理，请刷新后重试');
  return transaction(()=>unique.map(id=>resolveConflict(id,choice)));
}
function replaceFromRemote(space,entries,cursor=0){
  if(!space)throw new Error('同步空间无效');
  if(!Array.isArray(entries))throw new Error('远端操作格式无效');
  const ordered=[...entries].sort((a,b)=>Number(a.op.seq)-Number(b.op.seq));
  const latest=new Map();
  for(const entry of ordered){
    if(!entry?.op?.opId||!isSyncable(entry.op.entityType,entry.op.entityId))continue;
    latest.set(`${entry.op.entityType}\u0000${entry.op.entityId}`,entry);
  }
  const removed=[];
  transaction(()=>{
    resetSyncSpace(space);
    const existing=init().prepare('SELECT entity_type,entity_id FROM entities').all();
    for(const row of existing){
      if(!isSyncable(row.entity_type,row.entity_id))continue;
      init().prepare('DELETE FROM entities WHERE entity_type=? AND entity_id=?').run(row.entity_type,row.entity_id);
      if(!latest.has(`${row.entity_type}\u0000${row.entity_id}`))removed.push(row);
    }
    for(const entry of ordered){
      const {op,value}=entry;
      if(isSyncable(op.entityType,op.entityId))recordRemote(space,op,value);
    }
    for(const {op,value} of latest.values()){
      const options={opId:op.opId,syncSpaceId:space,noChangeLog:true,force:true,origin:'remote'};
      if(op.deleted)remove(op.entityType,op.entityId,options);else put(op.entityType,op.entityId,value,options);
      replaceHeads(space,op.entityType,op.entityId,[{opId:op.opId,contentHash:op.contentHash,deleted:Boolean(op.deleted)}]);
    }
    setCursor(space,Number(cursor)||0);
    setMeta('active_sync_space',space);
  });
  for(const row of removed)emitChange(row.entity_type,row.entity_id,true,'remote');
  return{operations:ordered.length,entities:latest.size,cursor:Number(cursor)||0};
}
function subscribe(listener){events.on('changed',listener);return()=>events.off('changed',listener);}
function close(){if(db){db.close();db=null;}}

module.exports={configure,init,close,getMeta,setMeta,put,upsert:put,remove,get,list,all,replaceType,pending,markSynced,getCursor,setCursor,resetSyncSpace,retireUnboundSyncState,ensureBaseline,payloadOf,heads,conflicts,applyRemote,resolveConflict,resolveConflicts,replaceFromRemote,subscribe,isSyncable,transaction,hash,dbPath:()=>dbPath};
