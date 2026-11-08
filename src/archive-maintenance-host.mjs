import {randomUUID} from 'node:crypto'
import {mkdir,unlink,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {checkedDirectory,cleanArchivedSessions,selectedArchiveIds} from './archive-maintenance.mjs'
import {archiveApi,desktopProcesses,maintenanceDirectory,nativeAnchor,pidAlive,readRecord,replaceRecord,windowsDesktop} from './archive-maintenance-runtime.mjs'

async function readTargets(request){
 const parts=[]
 let size=0
 for await(const part of request){
  size+=part.length
  if(size>65536)throw Error('选择的会话过多')
  parts.push(part)
 }
 const input=JSON.parse(Buffer.concat(parts).toString())
 return input?.resume===true?{resume:true}:{targets:selectedArchiveIds(input?.ids)}
}

export function createArchiveMaintenanceHandler({admit,state,enqueue}){
 return async(request,response)=>{
  const send=(code,value)=>{response.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value))}
  if(new URL(request.url,'http://localhost').pathname!==archiveApi){send(404,{});return}
  const access=admit(request)
  if(access!==undefined){send(access,{error:'仅允许本机客户端操作归档删除'});return}
  try{
   if(request.method==='GET'){send(200,await state());return}
   if(request.method==='POST'&&request.headers['content-type']==='application/json'){
    send(200,await enqueue(await readTargets(request)));return
   }
   send(405,{error:'请求格式不受支持'})
  }catch(error){send(409,{error:error.message})}
 }
}

export function applyArchiveMaintenance(ctx){
 if(process.platform!=='win32'||!process.versions.electron||!windowsDesktop(process.execPath)||!process.env.DSH_HOME)return
 ctx.inject(['connection','workspaceRegistry','sessions','sessionPersistence','storageDomain','profileContext','webServer'],native=>{
  if(native.profileContext.name!=='desktop')return
  const home=resolve(process.env.DSH_HOME),hostPid=process.pid,desktopPid=process.ppid
  let enqueueing=false
  const status=async directory=>{
   const job=await readRecord(join(directory,'pending.json'))
   if(!job)return {job,recoverable:false}
   if(!/^[a-f\d-]{36}$/.test(job.id??''))throw Error('清理记录无效')
   const jobRoot=await checkedDirectory(join(directory,job.id))
   const worker=await readRecord(join(jobRoot,'worker.json'))
   return {job,recoverable:!worker||!pidAlive(worker.pid)}
  }
  const availability=()=>{
   const query=native.get('sessionQuery')?.config
   if(query&&query.openAt!=='never'&&query.path!==':memory:')throw Error('当前客户端使用独立搜索索引，暂不能自动清理')
   const storage=native.get('storage.backend.json')
   if(storage?.root!==join(home,'storages')||native.sessionPersistence.root!==join(home,'sessions')||native.sessionPersistence.compression!=='zstd')throw Error('当前客户端的会话存储配置不支持自动清理')
   const anchor=nativeAnchor(process.execPath,process.argv[1])
   return anchor
  }
  const handler=createArchiveMaintenanceHandler({
   admit(request){
    const peer=native.connection.admit(request)
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket?.remoteAddress)||request.headers['sec-fetch-site']==='cross-site')return 403
    if(request.method==='POST'&&(request.headers.origin!==native.webServer.getOrigin()||request.headers['sec-fetch-site']!=='same-origin'||!/^[a-zA-Z0-9_-]{43}$/.test(request.headers['x-dsh-desktop-renderer']??'')))return 403
    return peer.rejection??(peer.peer?.principal?.kind==='owner'?undefined:403)
   },
   async state(){
    availability()
    const directory=await maintenanceDirectory(home)
    const {job,recoverable}=await status(directory)
    return {available:!job&&!enqueueing,pending:Boolean(job),recoverable:recoverable&&!enqueueing}
   },
   async enqueue({targets,resume}){
    if(enqueueing)throw Error('已有一个清理任务正在准备')
    enqueueing=true
    try{
     availability()
     const processes=await desktopProcesses()
     const owner=processes.find(row=>row.ProcessId===desktopPid)
     const host=processes.find(row=>row.ProcessId===hostPid)
     if(!owner||owner.ExecutablePath?.toLowerCase()!==process.execPath.toLowerCase()||host?.ParentProcessId!==desktopPid)throw Error('无法确认当前 DSH NEXT 进程')
     if(processes.some(row=>row.ProcessId!==desktopPid&&row.ParentProcessId!==desktopPid&&row.ParentProcessId!==hostPid))throw Error('检测到另一个 DSH NEXT 实例')
     const directory=await maintenanceDirectory(home),{job,recoverable}=await status(directory)
     if(resume&&(!job||!recoverable))throw Error('没有可恢复的清理任务')
     if(!resume&&job)throw Error('上次清理尚未结束')
     if(resume)targets=selectedArchiveIds(job.targets)
     else{
      const archive=new Set(native.workspaceRegistry.archivedSessionIds)
      if(targets.some(id=>!archive.has(id)))throw Error('所选会话已变化，请刷新后重试')
     }
     const id=resume?job.id:randomUUID(),jobRoot=join(directory,id)
     const file=join(directory,'pending.json')
     if(!resume){
      await mkdir(jobRoot)
      await writeFile(file,JSON.stringify({id,targets}),{flag:'wx',flush:true})
     }
     const results=await deleteArchivedInHost(native,{home,jobRoot,targets,resume})
     const last={id,results,finishedAt:Date.now()}
     await replaceRecord(join(directory,'latest.json'),last)
     await unlink(file)
     return {available:true,pending:false,recoverable:false,last}
    }finally{enqueueing=false}
   },
  })
  native.effect(()=>native.webServer.register({kind:'prefix',path:archiveApi,handler}),'DSH Web GUI：归档离线清理')
 })
}

export async function deleteArchivedInHost(native,{home,jobRoot,targets,resume}){
 const cache=native.storageDomain.get('session_projcache')?.table('sessions')
 const workspaceState=native.storageDomain.get('workspace')?.global
 const registry=native.workspaceRegistry,sessions=native.sessionPersistence
 const root=join(home,'sessions')
 const checkWriter=id=>{
  if(native.sessions.get(id))throw Error('此会话仍由 DSH 后台占用，尚未删除')
 }
 const metadata={
  archive:{get:()=>({archivedSessionIds:[...registry.archivedSessionIds],pendingMutation:workspaceState?.get().pendingMutation}),async set(state,id){
   if(state.archivedSessionIds.includes(id))await registry.archiveSession(id)
   else await registry.unarchiveSession(id)
  }},
  workspaces:{entries:()=>registry.list().map(workspace=>[workspace.id,{sessionIds:[...workspace.sessionIds]}]),async put(key,row,id){
   const workspace=registry.get(key)
   if(!workspace)return
   const index=row.sessionIds.indexOf(id)
   if(index<0){await workspace.detachSession(id);return}
   if(workspace.sessionIds.includes(id))return
   await workspace.attachSession(id)
   const anchor=row.sessionIds.slice(index+1).find(next=>workspace.sessionIds.includes(next))
   await workspace.insertSessionBefore(id,anchor)
  }},
  cache:cache??{get:()=>undefined,delete:()=>{}},
 }
 if(resume)for(const id of targets)checkWriter(id)
 return cleanArchivedSessions({root,jobRoot,sessions,metadata,targets,recoveryOnly:resume,async withWriter(id,run){
  await native.get?.('beellixArchiveAgentLifecycle')?.release(id)
  checkWriter(id)
  const handle=await sessions.open(id,'write')
  try{await run()}finally{await handle.close()}
 }})
}
