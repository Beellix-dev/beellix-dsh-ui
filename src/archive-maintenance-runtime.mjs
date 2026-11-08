import {execFile,spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {lstat,mkdir,readFile,rename,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {basename,dirname,join,resolve} from 'node:path'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {checkedDirectory} from './archive-maintenance.mjs'

export const archiveApi='/dsh-web-gui/archive-maintenance'
export const windowsDesktop=exe=>basename(exe).toLowerCase()==='dsh next.exe'

export async function maintenanceDirectory(home){
 if(!home||resolve(home)!==home)throw Error('无法确认客户端数据目录')
 await checkedDirectory(home)
 let directory=home
 for(const part of ['DSHWebGui','ui','archive-maintenance']){
  directory=join(directory,part)
  try{await mkdir(directory)}catch(error){if(error.code!=='EEXIST')throw error}
  await checkedDirectory(directory)
 }
 return directory
}

export async function readRecord(file){
 let info
 try{info=await lstat(file)}catch(error){if(error.code==='ENOENT')return undefined;throw error}
 if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>262144)throw Error('归档清理记录无效')
 return JSON.parse(await readFile(file,'utf8'))
}

export async function replaceRecord(file,value){
 const temp=file+'.'+randomUUID()+'.tmp'
 await writeFile(temp,JSON.stringify(value),{flag:'wx',flush:true})
 await rename(temp,file)
}

export function pidAlive(pid){
 if(!Number.isSafeInteger(pid)||pid<1)throw Error('客户端进程编号无效')
 try{process.kill(pid,0);return true}catch(error){if(error.code==='ESRCH')return false;throw error}
}

const exec=promisify(execFile)
export async function desktopProcesses(){
 const command=`$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter "Name='DSH NEXT.exe'"; ConvertTo-Json -Compress -InputObject @($p | Select-Object ProcessId,ParentProcessId,ExecutablePath)`
 const {stdout}=await exec('pwsh.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:12000})
 return JSON.parse(stdout)
}

export function nativeAnchor(exe,entry){
 const candidates=[join(dirname(exe),'resources','app.asar','package.json'),entry].filter(Boolean)
 for(const path of candidates){
  const from=createRequire(path)
  try{if(from('@deepseek-ai/dsh/package.json').version==='0.2.1-rc.4')return path}catch(error){if(error.code!=='MODULE_NOT_FOUND'&&error.code!=='ERR_PACKAGE_PATH_NOT_EXPORTED')throw error}
 }
 throw Error('当前 DSH 版本未通过归档删除验证')
}

export async function withNativeArchiveStorage(anchor,home,run){
 const from=createRequire(anchor)
 if(from('@deepseek-ai/dsh/package.json').version!=='0.2.1-rc.4')throw Error('客户端版本在清理前发生变化')
 const load=name=>import(pathToFileURL(from.resolve('@deepseek-ai/'+name)))
 const [{Context},{Storage},json,domain,persistence,{workspaceDomainSpec},{projectionCacheDomainSpec}]=await Promise.all([
  'cordis','dsh-storage','dsh-storage-json','dsh-storage-domain','dsh-session-persistence-jsonl','dsh-workspace','dsh-session-projection-cache',
 ].map(load))
 const root=join(home,'sessions'),storageRoot=join(home,'storages')
 for(const path of [home,root,storageRoot])await checkedDirectory(path)
 const workspaceFile=await lstat(join(storageRoot,'workspace.json'))
 if(!workspaceFile.isFile()||workspaceFile.isSymbolicLink()||workspaceFile.nlink!==1)throw Error('工作区记录含有链接或类型不正确')
 const cacheRoot=join(storageRoot,'session_projcache')
 for(const path of [cacheRoot,join(cacheRoot,'sessions')]){
  try{await checkedDirectory(path)}catch(error){if(error.code!=='ENOENT')throw error}
 }
 const ctx=new Context()
 try{
  await ctx.plugin(Storage)
  await ctx.plugin(json,{root:storageRoot})
  await ctx.plugin(domain,{backend:'json'})
  await ctx.plugin(persistence,{root,compression:'zstd'})
  const storage=ctx.get('storageDomain')
  const workspace=await storage.open(workspaceDomainSpec)
  const cache=await storage.open({...projectionCacheDomainSpec,invalidRecords:undefined})
  return await run({root,sessions:ctx.get('sessionPersistence'),metadata:{archive:workspace.global,workspaces:workspace.table('workspaces'),cache:cache.table('sessions')}})
 }finally{await ctx.fiber.dispose()}
}

export function relaunchDesktop(exe){
 const env={...process.env}
 delete env.ELECTRON_RUN_AS_NODE
 delete env.DSH_HOME
 const child=spawn(exe,[],{cwd:dirname(exe),detached:true,stdio:'ignore',env})
 child.unref()
 return new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)})
}
