import React,{useEffect,useMemo,useState,useSyncExternalStore} from 'react'
import {Button,Modal} from '@deepseek-ai/dsh-client-ui-primitives'
import {archivedGroups} from './settings-archive.mjs'

const dateFormat=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})
const maintenance='/dsh-web-gui/archive-maintenance'
type ArchiveTarget={id:string,title:string,workspace:string}
async function maintenanceRequest(options?:RequestInit){
 const response=await fetch(maintenance,{credentials:'same-origin',cache:'no-store',...options})
 if(response.status===404)return null
 const data=await response.json()
 if(!response.ok)throw Error(data.error||'归档清理服务暂不可用')
 return data
}

function useCatalog(source:any){
 const subscribe=useMemo(()=>(listener:()=>void)=>source?.subscribe(listener)??(()=>{}),[source])
 const read=useMemo(()=>()=>source?.getSnapshot()??null,[source])
 return useSyncExternalStore(subscribe,read)
}

export function ArchivedChats({ctx,Icon}:any){
 const workspaces=ctx.get('workspaces')
 const sessions=useMemo(()=>ctx.get('sessions'),[ctx])
 const workspaceState=useCatalog(workspaces?.list),sessionState=useCatalog(sessions?.list)
 const [query,setQuery]=useState(''),[workspace,setWorkspace]=useState(''),[sort,setSort]=useState('newest')
 const [pending,setPending]=useState(''),[error,setError]=useState('')
 const [cleanup,setCleanup]=useState<any>(null),[selected,setSelected]=useState<string[]>([])
 const [confirm,setConfirm]=useState<ArchiveTarget[]>([]),[deleting,setDeleting]=useState(false)
 const [recover,setRecover]=useState(false)
 const [deleted,setDeleted]=useState<string[]>([])
 const [checkedMissing,setCheckedMissing]=useState('')
 const missingArchived=workspaceState?.phase==='ready'&&sessionState?.phase==='ready'
  ?workspaceState.archivedSessionIds.filter((id:string)=>!sessionState.byId[id]&&!deleted.includes(id)).join('\0')
  :''
 const catalog=useMemo(()=>workspaceState&&sessionState?archivedGroups(workspaceState,sessionState):[],[workspaceState,sessionState])
 const workspaceId=catalog.some(group=>group.id===workspace)?workspace:''
 const groups=useMemo(()=>workspaceState&&sessionState?archivedGroups({...workspaceState,archivedSessionIds:workspaceState.archivedSessionIds.filter((id:string)=>!deleted.includes(id))},sessionState,{query,workspaceId,sort}):[],[workspaceState,sessionState,query,workspaceId,sort,deleted])
 const desktop=Boolean((globalThis as any).desktopNext)
 useEffect(()=>{
  if(!missingArchived)return
  let cancelled=false
  const refresh=async()=>{
   // Releasing a live session emits a removal. Pull its persisted summary back into the catalog.
   await sessions.refresh()
   // A native pull already in flight may have merged the removal over its baseline.
   if(!cancelled&&missingArchived.split('\0').some(id=>!sessions.list.getSnapshot().byId[id]))await sessions.refresh()
  }
  void refresh().catch(()=>{}).finally(()=>{if(!cancelled)setCheckedMissing(missingArchived)})
  return ()=>{cancelled=true}
 },[sessions,missingArchived])
 useEffect(()=>{
  if(!desktop)return
  const controller=new AbortController()
  void maintenanceRequest({signal:controller.signal}).then(setCleanup).catch(reason=>{
   if(!controller.signal.aborted)setCleanup({error:reason.message})
  })
  return ()=>controller.abort()
 },[desktop])
 useEffect(()=>{
  if(!cleanup?.pending||cleanup.recoverable)return
  const timer=setInterval(()=>{void maintenanceRequest().then(setCleanup).catch(()=>{})},2500)
  return ()=>clearInterval(timer)
 },[cleanup?.pending,cleanup?.recoverable])
 const visibleSelected=groups.flatMap(group=>group.rows.filter(row=>selected.includes(row.id)).map(row=>({...row,workspace:group.title})))
 const confirmationOpen=confirm.length>0||recover
 const closeConfirmation=()=>{
  if(deleting)return
  setConfirm([]);setRecover(false);setError('')
 }
 const last=cleanup?.last,results=last?.results??[]
 const failures=results.filter((row:any)=>row.state==='failed')
 const deleteConfirmed=async()=>{
  setDeleting(true);setError('')
  try{
   const input=recover?{resume:true}:{ids:confirm.map(row=>row.id)}
   const updated=await maintenanceRequest({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})
   if(!updated?.last)throw Error('归档清理服务暂不可用')
   const removed=updated.last.results.filter((row:any)=>row.state==='deleted').map((row:any)=>row.id)
   setDeleted(previous=>[...previous,...removed]);setSelected(previous=>previous.filter(id=>!removed.includes(id)))
   setCleanup(updated);setConfirm([]);setRecover(false)
   void sessions?.refresh().catch(()=>{})
  }catch(reason){
   setError(reason instanceof Error?reason.message:'无法开始归档清理')
   void maintenanceRequest().then(setCleanup).catch(()=>{})
  }
  finally{setDeleting(false)}
 }
 const restore=async(id:string)=>{
  setPending(id);setError('')
  try{await ctx.uiWorkspace.unarchiveSession(id)}
  catch(reason){setError(reason instanceof Error?reason.message:'取消归档失败')}
  finally{setPending('')}
 }
 if(!workspaceState||!sessionState)return <p className="bx-gui-empty" role="status">归档记录暂不可用</p>
 if(workspaceState.state==='error')return <p className="bx-gui-notice" role="alert">{workspaceState.error?.message||'无法读取归档记录'}</p>
 if(workspaceState.phase!=='ready'||sessionState.phase!=='ready')return <p className="bx-gui-empty" role="status">正在读取归档记录…</p>
 return <section className="bx-archive" aria-label="归档聊天列表">
  <div className="bx-archive-filters">
   <label className="bx-archive-search"><Icon name="search"/><input type="search" aria-label="搜索聊天标题" placeholder="搜索已归档的聊天" value={query} onChange={event=>{setQuery(event.target.value);setSelected([])}}/></label>
   <select aria-label="排序" value={sort} onChange={event=>setSort(event.target.value)}><option value="newest">最近更新</option><option value="oldest">最早更新</option></select>
   <select aria-label="工作区" value={workspaceId} onChange={event=>{setWorkspace(event.target.value);setSelected([])}}><option value="">所有工作区</option>{catalog.map(group=><option key={group.id} value={group.id} title={group.originalDirectory}>{group.title}</option>)}</select>
  </div>
  {cleanup?.available&&visibleSelected.length>0&&<div className="bx-archive-actions"><span>已选 {visibleSelected.length} 条</span><Button variant="outline" size="sm" className="bx-archive-danger" disabled={deleting} onClick={()=>setConfirm(visibleSelected)}>删除所选</Button></div>}
  <Modal open={confirmationOpen} onClose={closeConfirmation} closeLabel="关闭确认" className="bx-gui bx-archive-dialog"
   title={recover?'恢复上次清理？':confirm.length===1?'彻底删除这条聊天？':`彻底删除 ${confirm.length} 条聊天？`}
   description={recover?'未完成的会话会恢复原记录。':'删除后无法恢复。'}
   footer={<><Button variant="outline" data-modal-autofocus disabled={deleting} onClick={closeConfirmation}>取消</Button>
    <Button variant="primary" className={recover?undefined:'bx-archive-confirm-delete'} disabled={deleting} onClick={()=>void deleteConfirmed()}>{deleting?'处理中…':recover?'确认恢复':'确认删除'}</Button></>}>
   {confirm.length>0&&<ul className="bx-archive-confirm-list" aria-label="待删除的归档聊天">{confirm.map(row=><li key={row.id}><strong>{row.title}</strong><span>{row.workspace}</span></li>)}</ul>}
   {error&&confirmationOpen&&<p className="bx-archive-confirm-error" role="alert">{error}</p>}
  </Modal>
  {cleanup?.recoverable&&!recover&&<div className="bx-archive-actions"><Button variant="outline" size="sm" onClick={()=>setRecover(true)}>恢复上次清理</Button></div>}
  {cleanup?.pending&&!cleanup.recoverable&&<p className="bx-gui-empty" role="status">正在处理归档记录…</p>}
  {cleanup?.error&&<p className="bx-gui-notice" role="alert">{cleanup.error}</p>}
  {failures.length>0&&<div className="bx-archive-result" role="alert">
   {failures.map((row:any)=><p key={row.id}>{catalog.flatMap(group=>group.rows).find(item=>item.id===row.id)?.title??'归档聊天'} · {row.message}</p>)}
  </div>}
  {error&&!confirmationOpen&&<p className="bx-gui-notice" role="alert">{error}</p>}
  {groups.length===0&&<p className="bx-gui-empty" role="status">{missingArchived&&missingArchived!==checkedMissing?'正在读取归档记录…':query.trim()||workspaceId?'没有匹配的聊天':'暂无已归档的聊天'}</p>}
  {groups.map(group=><section className="bx-archive-group" key={group.id} aria-label={group.title}>
   <header><Icon name="folder"/><h3 title={group.originalDirectory}>{group.title}</h3><span>{group.rows.length} 个聊天</span></header>
   <ul>{group.rows.map(row=><li key={row.id}>
    {cleanup?.available&&<input type="checkbox" checked={selected.includes(row.id)} aria-label={'选择 '+row.title} disabled={deleting||Boolean(confirm.length)||!selected.includes(row.id)&&selected.length>=100} onChange={event=>setSelected(current=>event.target.checked?[...current,row.id]:current.filter(id=>id!==row.id))}/>}
    <div className="bx-archive-row-copy"><strong>{row.title}</strong>{Number.isFinite(row.updatedAt)&&row.updatedAt>0&&<time dateTime={new Date(row.updatedAt).toISOString()}>{dateFormat.format(row.updatedAt)}</time>}</div>
    {cleanup?.available&&<Button variant="outline" size="sm" className="bx-archive-danger" aria-label={'彻底删除 '+row.title} disabled={Boolean(pending)||deleting} onClick={()=>setConfirm([{...row,workspace:group.title}])}>删除</Button>}
    <Button variant="outline" size="sm" disabled={Boolean(pending)||deleting||Boolean(confirm.length)||cleanup?.pending} aria-label={'取消归档 '+row.title} onClick={()=>void restore(row.id)}>{pending===row.id?'正在恢复…':'取消归档'}</Button>
   </li>)}</ul>
  </section>)}
 </section>
}
