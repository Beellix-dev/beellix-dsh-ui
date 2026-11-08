import {lstat,mkdir,readFile,readdir,realpath,rename,unlink,writeFile} from 'node:fs/promises'
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path'

export const archiveLimit=100
const logFile=/^session(?:\.v[1-9]\d*)?\.jsonl(?:\.zstd)?$/
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b

export function selectedArchiveIds(value){
 if(!Array.isArray(value)||value.length<1||value.length>archiveLimit||value.some(id=>typeof id!=='string'||!id.trim()||id.length>512))throw Error('请选择 1 至 100 条已归档会话')
 return [...new Set(value)]
}

async function statIfPresent(path){
 try{return await lstat(path)}catch(error){if(error.code==='ENOENT')return undefined;throw error}
}

export async function checkedDirectory(path){
 const info=await lstat(path)
 if(!info.isDirectory()||info.isSymbolicLink()||!samePath(await realpath(path),resolve(path)))throw Error('会话存储路径含有链接或不是目录')
 return path
}

async function checkedFile(path){
 const info=await statIfPresent(path)
 if(info&&(!info.isFile()||info.isSymbolicLink()||info.nlink!==1))throw Error('文件类型或链接状态不允许清理')
 return info
}

function transcriptPath(root,path){
 const parts=relative(root,path).split(sep)
 if(!isAbsolute(path)||parts.length!==3||parts.some(part=>!part||part==='..'||part==='.')||!logFile.test(parts[2]))throw Error('会话日志不在受支持的数据目录内')
 return join(root,...parts)
}

async function listTranscripts(root,sessions,header){
 const location=sessions.locate(header)
 if(location?.kind!=='jsonl')throw Error('当前会话存储格式不支持删除')
 const directory=dirname(transcriptPath(root,location.path))
 for(const parent of [root,dirname(directory),directory])await checkedDirectory(parent)
 const files=(await readdir(directory)).filter(name=>logFile.test(name)).map(name=>join(directory,name))
 if(!files.length)throw Error('未找到可验证的会话日志')
 for(const file of files)if(!await checkedFile(file))throw Error('会话日志已变化')
 return files
}

async function savePlan(directory,plan){
 const temporary=join(directory,'plan.tmp')
 await writeFile(temporary,JSON.stringify(plan),{flag:'wx',flush:true})
 await rename(temporary,join(directory,'plan.json'))
}

async function finishPlan(directory,root,metadata,plan){
 const committed=Boolean(await checkedFile(join(directory,'committed')))
 if(!committed){
  for(const source of plan.files){
   const file=transcriptPath(root,source),staged=join(directory,basename(file))
   await checkedDirectory(dirname(file))
   if(!await checkedFile(staged))continue
   if(await checkedFile(file))throw Error('原日志位置已出现文件，无法自动恢复')
   await rename(staged,file)
  }
  if(await checkedFile(join(directory,'metadata-started'))){
   for(const [key,row] of plan.workspaces)await metadata.workspaces.put(key,row,plan.id)
   if(plan.cache!==undefined)await metadata.cache.put(plan.id,plan.cache)
   await metadata.archive.set(plan.archive,plan.id)
  }
 }else{
  for(const source of plan.files){
   const staged=join(directory,basename(transcriptPath(root,source)))
   if(await checkedFile(staged))await unlink(staged)
  }
 }
 await unlink(join(directory,'plan.json'))
 return committed
}

export async function cleanArchivedSessions({root,jobRoot,sessions,metadata,targets,recoveryOnly=false,assertStopped=()=>{},checkpoint=()=>{},withWriter=async(_id,run)=>run()}){
 await checkedDirectory(root)
 await checkedDirectory(jobRoot)
 const ids=selectedArchiveIds(targets)
 const results=[]
 for(const [index,id] of ids.entries()){
  await assertStopped()
  const directory=join(jobRoot,`item-${index}`)
  const existing=await statIfPresent(directory)
  if(existing){
   await checkedDirectory(directory)
   const file=join(directory,'plan.json')
   if(await checkedFile(file)){
    const plan=JSON.parse(await readFile(file,'utf8'))
    if(plan.id!==id)throw Error('清理记录与会话不匹配')
    const committed=await finishPlan(directory,root,metadata,plan)
    results.push({id,state:committed?'deleted':'failed',message:committed?undefined:'上次清理中断，已恢复原记录'})
    continue
   }
   if(await checkedFile(join(directory,'committed'))){results.push({id,state:'deleted'});continue}
   results.push({id,state:'failed',message:'上次清理中断，原记录保留'});continue
  }
  if(recoveryOnly){results.push({id,state:'skipped',message:'原记录保留，可重新选择'});continue}
  if(!metadata.archive.get().archivedSessionIds.includes(id)){results.push({id,state:'skipped',message:'会话已不在归档中'});continue}
  let writing=false
  try{
   const snapshot=await sessions.stat(id)
   if(!snapshot?.sizeBytes||snapshot.header.id!==id)throw Error('未找到可验证的会话日志')
   await listTranscripts(root,sessions,snapshot.header)
   await withWriter(id,async()=>{
    const files=await listTranscripts(root,sessions,snapshot.header)
    const archive=metadata.archive.get()
    if(archive.pendingMutation)throw Error('工作区有未完成的变更，暂不能清理')
    if(!archive.archivedSessionIds.includes(id)){results.push({id,state:'skipped',message:'会话已不在归档中'});return}
    const plan={id,files,archive,workspaces:[...metadata.workspaces.entries()].filter(([,row])=>row.sessionIds.includes(id)),cache:metadata.cache.get(id)}
    await mkdir(directory)
    await savePlan(directory,plan)
    writing=true
    let failure
    try{
     await assertStopped()
     for(const file of plan.files)await rename(file,join(directory,basename(file)))
     await writeFile(join(directory,'metadata-started'),'',{flag:'wx',flush:true})
     for(const [key,row] of plan.workspaces)await metadata.workspaces.put(key,{...row,sessionIds:row.sessionIds.filter(value=>value!==id)},id)
     await metadata.cache.delete(id)
     await metadata.archive.set({...plan.archive,archivedSessionIds:plan.archive.archivedSessionIds.filter(value=>value!==id)},id)
     if(await sessions.stat(id))throw Error('仍存在其他版本的会话日志')
     await checkpoint(id)
     await writeFile(join(directory,'committed'),'',{flag:'wx',flush:true})
    }catch(error){failure=error}
    // Keep the journal and stop the batch if recovery cannot finish.
    await assertStopped()
    const committed=await finishPlan(directory,root,metadata,plan)
    results.push({id,state:committed?'deleted':'failed',message:failure?.message})
   })
  }catch(error){
   if(writing)throw error
   results.push({id,state:'failed',message:error.message})
  }
 }
 return results
}
