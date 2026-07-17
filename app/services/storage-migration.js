const fs=require('fs');
const path=require('path');
const YAML=require('yaml');
const store=require('./local-store');

const MARKER='canonical_migration_v2';
function readJson(file,fallback){if(!fs.existsSync(file))return fallback;return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function migrate(){
  store.init(); if(store.getMeta(MARKER)==='done')return {migrated:false};
  const root=process.env.RAN_PAK_RUNTIME_DIR||path.resolve(__dirname,'..','..'),config=path.join(root,'config');
  const files=['tools.json','cloud-sync.json','ssh-tools.json','ssh-history.json','dns.yaml'];
  const existing=files.filter(name=>fs.existsSync(path.join(config,name)));
  const backup=path.join(config,`legacy-backup-${new Date().toISOString().replace(/[:.]/g,'-')}`);fs.mkdirSync(backup,{recursive:true});
  for(const name of existing){const target=path.join(backup,name);fs.copyFileSync(path.join(config,name),target);try{fs.chmodSync(target,0o444)}catch{}}
  try{
    const tools=readJson(path.join(config,'tools.json'),{}),ssh=readJson(path.join(config,'ssh-tools.json'),{}),history=readJson(path.join(config,'ssh-history.json'),[]),cloud=readJson(path.join(config,'cloud-sync.json'),null);
    const dnsPath=path.join(config,'dns.yaml');const dns=fs.existsSync(dnsPath)?YAML.parse(fs.readFileSync(dnsPath,'utf8'))||{}:{};
    const expected=(ssh.profiles||[]).length+(ssh.folders||[]).length+(ssh.privates||[]).length+(ssh.remoteImportSources||[]).length+(ssh.presetCommands||[]).length+(dns.dns_access||[]).length+(Array.isArray(history)?history.length:0);
    let actual=0;
    store.transaction(()=>{
      for(const id of ['ffmpeg','meme','live2d','ai','feature_visibility']){const source=id==='feature_visibility'?tools.featureVisibility:tools[id];if(source!=null)store.put('app_config',id,source,{noChangeLog:true,force:true});}
      if(cloud)store.put('cloud_config','default',cloud,{noChangeLog:true,force:true});
      for(const item of ssh.profiles||[])store.put('ssh_profile',String(item.id),item,{noChangeLog:true,force:true});
      for(const item of ssh.folders||[])store.put('ssh_folder',String(item.id),item,{noChangeLog:true,force:true});
      for(const item of ssh.privates||[])store.put('ssh_private_key',String(item.id),item,{noChangeLog:true,force:true});
      for(const item of ssh.remoteImportSources||[])store.put('ssh_import_source',String(item.id),item,{noChangeLog:true,force:true});
      for(const item of ssh.presetCommands||[])store.put('ssh_preset_command',String(item.id),item,{noChangeLog:true,force:true});
      for(const item of dns.dns_access||[])store.put('dns_account',String(item.id||item.name),item,{noChangeLog:true,force:true});
      for(const [index,item] of (Array.isArray(history)?history:[]).entries())store.put('ssh_history',String(item?.id||index),item,{noChangeLog:true,force:true});
      actual=['ssh_profile','ssh_folder','ssh_private_key','ssh_import_source','ssh_preset_command','dns_account','ssh_history'].reduce((sum,type)=>sum+store.list(type).length,0);
      if(actual!==expected)throw new Error(`迁移校验失败：预期 ${expected} 条，实际 ${actual} 条`);
      store.setMeta(MARKER,'done');store.setMeta('legacy_backup_path',backup);
    });
    const cleanupErrors=[];
    for(const name of existing){try{fs.unlinkSync(path.join(config,name));}catch(error){cleanupErrors.push(`${name}: ${error.message}`);}}
    store.setMeta('legacy_sources_retired',cleanupErrors.length?'partial':'done');
    if(cleanupErrors.length)store.setMeta('legacy_cleanup_warning',cleanupErrors.join('; '));
    return {migrated:true,backup,records:actual};
  }catch(error){store.setMeta(MARKER,'failed');store.setMeta('migration_error',error.message);throw new Error(`本地数据迁移失败，旧数据已备份到 ${backup}：${error.message}`);}
}
module.exports={migrate};
