import {unlink} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {pathToFileURL} from 'node:url'
import {checkedDirectory,cleanArchivedSessions,selectedArchiveIds} from './archive-maintenance.mjs'
import {desktopProcesses,maintenanceDirectory,pidAlive,readRecord,relaunchDesktop,replaceRecord,windowsDesktop,withNativeArchiveStorage} from './archive-maintenance-runtime.mjs'

export async function runArchiveMaintenanceJob({home,id,executable,alive=pidAlive,peers=desktopProcesses,relaunch=relaunchDesktop,wait=delay,now=Date.now}){
 if(!/^[a-f\d-]{36}$/.test(id??'')||!windowsDesktop(executable))throw Error('归档维护只能由 Windows DSH NEXT 启动')
 const directory=await maintenanceDirectory(home)
 const pending=join(directory,'pending.json'),latest=join(directory,'latest.json')
 const job=await readRecord(pending)
 if(job?.id!==id||job.executable!==executable||!job.anchor||resolve(job.anchor)!==job.anchor)throw Error('清理任务来源无法验证')
 const jobRoot=await checkedDirectory(join(directory,id))
 const targets=selectedArchiveIds(job.targets)

 let stopped=false,results
 try{
  const deadline=now()+60000
  while(alive(job.desktopPid)||alive(job.hostPid)){
   if(now()>=deadline)throw Error('客户端仍在运行，未开始清理')
   await wait(250)
  }
  const assertStopped=async()=>{
   if((await peers()).some(row=>row.ProcessId!==process.pid))throw Error('另一个 DSH NEXT 进程已启动，未继续清理')
  }
  await assertStopped()
  stopped=true
  results=await withNativeArchiveStorage(job.anchor,home,state=>cleanArchivedSessions({...state,jobRoot,targets,assertStopped,recoveryOnly:job.recoveryOnly===true}))
  await replaceRecord(latest,{id,results,finishedAt:now()})
  await unlink(pending)
  await assertStopped()
  await relaunch(executable)
  return true
 }catch(error){
  // If a write may have started, keep the journal for recovery and do not open DSH over it.
  await replaceRecord(latest,{id,results,error:error.message,recoveryRequired:stopped&&!results,finishedAt:now()})
  if(!stopped)await unlink(pending)
  return false
 }
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 if(process.platform!=='win32')throw Error('归档维护仅适用于 Windows')
 const complete=await runArchiveMaintenanceJob({home:process.env.DSH_HOME,id:process.argv[2],executable:process.execPath})
 if(!complete)process.exitCode=1
}
