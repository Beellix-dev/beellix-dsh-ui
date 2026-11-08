import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {ensureMarketSource,listMarketSources} from './plugin-market-source.mjs'
import {openMarketDirectory,marketRequest} from './plugin-market-directory.mjs'
import {InlineMarketCatalog,type DirectoryState} from './plugin-market-catalog'

const COMMUNITY='dsh-community-market'
const CATALOG_TAB='bx-catalog'
const nativeMarkets={'dshmarket':'dsh-market','@deepseek-ai/dsh-experimental-plugin-market-bundle':'discover'} as const
const knownDirectories=[{key:'dsh-1024store',name:'DSH 1024Store'},{key:'dshfind',name:'dshfind'}]
const tabButton=(tabs:HTMLElement,id:string)=>tabs.querySelector<HTMLButtonElement>('[role="tab"][aria-controls$="-'+id+'-panel"]')

type MarketBundle={name:string;enabled:boolean;readOnlyReason?:string;error?:unknown}
type MarketPage={root:HTMLElement;tabs:HTMLElement;mount:HTMLElement;catalog:HTMLElement|null;activeControl:string;installed:boolean;thirdParty:boolean}
type DirectoryChoice={builtInProviderKey?:string;sourceRecordId?:string;manifestUrl?:string}

export function InlineMarketMount(){return <div className="bx-market-catalog-mount"/>}

/** Keep the native Plugins route, including its install manager and native market tabs. */
export function PluginMarketView({ctx}:any){
 const [page,setPage]=useState<MarketPage|null>(null),[group,setGroup]=useState('official')
 const [bundles,setBundles]=useState<MarketBundle[]>([]),[directories,setDirectories]=useState<DirectoryState|null>(null)
 const [directoryEpoch,setDirectoryEpoch]=useState(0)
 const [selection,setSelection]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
 const [adding,setAdding]=useState(false),[manifest,setManifest]=useState('')
 const pendingTab=useRef(''),operation=useRef(false)
 const requestedDirectory=useRef<DirectoryChoice|null>(null)
 const manager=ctx.remote.pluginManager
 useSyncExternalStore((fn)=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot().revision)
 const locale=ctx.locale.getLocale().active
 const t=(cn:string,en:string)=>locale.startsWith('zh')?cn:en

 useEffect(()=>{
  let root:HTMLElement|null=null,mount:HTMLElement|null=null,frame=0
  const reset=()=>{
   mount?.remove()
   if(root){
    delete root.dataset.bxPlugins
    delete root.dataset.bxPluginGroup
    root.querySelectorAll<HTMLElement>('[data-bx-installed-group]').forEach(node=>delete node.dataset.bxInstalledGroup)
   }
   root=mount=null
  }
  const sync=()=>{
   frame=0
   const installedTab=document.querySelector<HTMLButtonElement>('[data-plugin-panel] [role="tab"][aria-controls$="-installed-panel"]')
   const tabs=installedTab?.closest<HTMLElement>('[role="tablist"]')
   const next=tabs?.closest<HTMLElement>('[data-plugin-panel]')
   const anchor=tabs?.parentElement
   if(!installedTab||!tabs||!next||!anchor){if(root)reset();setPage(null);return}
   if(root!==next||mount?.parentElement!==anchor){
    reset()
    root=next
    root.dataset.bxPlugins=''
    mount=document.createElement('div')
    mount.className='bx-plugin-toolbar'
    anchor.append(mount)
   }
   const panel=document.getElementById(installedTab.getAttribute('aria-controls')??'')
   const sections=Array.from(panel?.querySelectorAll<HTMLElement>(':scope > section:has(> ul)')??[])
   for(const item of sections){
    const label=item.querySelector('h3')?.textContent?.trim()
    item.dataset.bxInstalledGroup=['已安装插件','Installed plugins'].includes(label??'')?'third-party':'official'
   }
   for(const columns of next.querySelectorAll<HTMLElement>('[class$="_masonry"]:has(> [class$="_masonryCol"])')){
    const count=columns.children.length
    columns.style.setProperty('--bx-market-columns',String(count))
    columns.closest<HTMLElement>('.notranslate')?.style.setProperty('--bx-market-columns',String(count))
    for(const column of Array.from(columns.children) as HTMLElement[]){
     if(column.children.length)column.style.setProperty('--bx-market-rows',String(column.children.length))
    }
   }
   if(pendingTab.current){
    const tab=tabButton(tabs,pendingTab.current)
    if(tab){pendingTab.current='';if(tab.getAttribute('aria-selected')!=='true')tab.click()}
   }
   const installed=installedTab.getAttribute('aria-selected')==='true'
   const catalog=next.querySelector<HTMLElement>('.bx-market-catalog-mount')
   const activeControl=tabs.querySelector('[role=tab][aria-selected=true]')?.getAttribute('aria-controls')??''
   const thirdParty=sections.some(item=>item.dataset.bxInstalledGroup==='third-party')
   const toolbar=mount!
   setPage(previous=>previous?.mount===toolbar&&previous.installed===installed&&previous.catalog===catalog&&previous.activeControl===activeControl&&previous.thirdParty===thirdParty
    ?previous:{root:next,tabs,mount:toolbar,catalog,activeControl,installed,thirdParty})
  }
  const schedule=()=>{if(!frame&&(root||ctx.layout.panelInfo.getSnapshot().activePanelId==='plugins'))frame=requestAnimationFrame(sync)}
  const observer=new MutationObserver(schedule)
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-selected']})
  const off=ctx.layout.panelInfo.subscribe(schedule)
  sync()
  return()=>{off();observer.disconnect();cancelAnimationFrame(frame);reset()}
 },[ctx])

 useEffect(()=>{
  if(!page||!manager)return
  let alive=true,revision=0
  const load=async()=>{
   const id=++revision
   try{const rows=await listMarketSources(manager);if(alive&&id===revision)setBundles(rows)}
   catch(error:any){if(alive&&id===revision)setStatus(error.message)}
  }
  const off=ctx.remote.$on?.('plugin-manager/changed',load)
  void load()
  return()=>{alive=false;off?.()}
 },[page?.root,manager,ctx])

 const community=bundles.find(row=>row.name===COMMUNITY)
 useEffect(()=>{
  if(!page||!community?.enabled)return
  const controller=new AbortController()
  void marketRequest('state',{signal:controller.signal}).then(result=>{
   if(!controller.signal.aborted&&!operation.current&&!requestedDirectory.current)setDirectories(result)
  }).catch(()=>{})
  return()=>controller.abort()
 },[page?.root,community?.enabled])

 useEffect(()=>{if(page)page.root.dataset.bxPluginGroup=group},[page?.root,group])
 if(!page)return null

 const builtIns=directories?.builtIns??knownDirectories
 const communityChoices=community?[
  ...builtIns.map(row=>({value:'builtin:'+row.key,label:row.name,bundle:community,directory:{builtInProviderKey:row.key}})),
  ...(directories?.sources??[]).filter(row=>!row.builtInProviderKey)
   .map(row=>({value:'source:'+row.sourceRecordId,label:row.name,bundle:community,directory:{sourceRecordId:row.sourceRecordId,manifestUrl:row.manifestUrl}})),
 ]:[]
 const choices=[
  ...Object.keys(nativeMarkets).flatMap(name=>{
   const bundle=bundles.find(row=>row.name===name)
   return bundle?[{value:name,label:name==='dshmarket'?t('DSH 插件市场','DSH Market'):t('官方索引市场','Official index'),bundle,directory:undefined}]:[]
  }),...communityChoices,
 ]
 const directory=community?.enabled?directories?.sources.find(row=>row.enabled):undefined
 const directorySelection=directory&&(directory.builtInProviderKey?'builtin:'+directory.builtInProviderKey:'source:'+directory.sourceRecordId)
 const nativeSelection=choices.find(row=>!row.directory&&row.bundle.enabled)?.value
 const visibleMarket=Object.entries(nativeMarkets).find(([,id])=>page.activeControl.endsWith('-'+id+'-panel'))?.[0]
 const current=(page.catalog?directorySelection:visibleMarket)
  ??choices.find(row=>row.value===selection&&row.bundle.enabled)?.value??nativeSelection??directorySelection??''
 const requestTab=(id:string)=>{
  const tab=page.tabs.isConnected?tabButton(page.tabs,id):null
  if(tab){pendingTab.current='';if(tab.getAttribute('aria-selected')!=='true')tab.click()}
  else pendingTab.current=id
 }
 const activate=async(name:string,value:string,choice?:DirectoryChoice)=>{
  if(operation.current)return
  operation.current=true;setBusy(true);setStatus('')
  try{
   const result=await ensureMarketSource(manager,name)
   if(result==='restart'){setStatus(t('重启客户端后即可切换市场','Restart the client to use this market'));return}
   if(result==='overridden'){setStatus(t('当前配置限制了市场切换','The current configuration limits market switching'));return}
   setBundles(await listMarketSources(manager))
   if(choice){
    requestedDirectory.current=choice
    const state:DirectoryState=await openMarketDirectory(choice,()=>marketRequest('state'),async body=>(await marketRequest('sources',{body})).sources)
    const active=state.sources.find(row=>row.enabled)
    if(!active)throw Error(t('市场未能启用','Could not activate the market'))
    setDirectories(state);setDirectoryEpoch(value=>value+1)
    setSelection(active.builtInProviderKey?'builtin:'+active.builtInProviderKey:'source:'+active.sourceRecordId)
    requestTab(CATALOG_TAB)
    setAdding(false);setManifest('')
   }else{
    requestedDirectory.current=null
    setSelection(value)
    requestTab(nativeMarkets[name as keyof typeof nativeMarkets])
   }
  }catch(error:any){
   setStatus(error.message.includes('blocked-address')
    ?t('客户端拦截了该地址，请使用公开可访问的 HTTPS 市场清单','The client blocked this address. Use a publicly accessible HTTPS market manifest.')
    :error.message)
  }
  finally{operation.current=false;setBusy(false)}
 }
 const recoverDirectory=async()=>{
  const choice=requestedDirectory.current
  if(!choice||!directory||operation.current)return
  requestedDirectory.current=null
  try{
   const state:DirectoryState=await marketRequest('state')
   if(operation.current||state.sources.some(row=>row.enabled&&row.sourceRecordId===directory.sourceRecordId))return
   // A newly enabled provider may replace its provisional source registry once profile storage opens.
   await activate(COMMUNITY,'',choice)
   requestedDirectory.current=null
  }catch{}
 }
 const choose=(value:string)=>{
  const row=choices.find(option=>option.value===value)
  if(row)void activate(row.bundle.name,value,row.directory)
 }
 const openMarket=()=>{
  setStatus('')
  const row=choices.find(option=>option.value===current)
  if(row?.directory&&directory&&current===directorySelection)requestTab(CATALOG_TAB)
  else if(row?.bundle.enabled&&!row.directory)requestTab(nativeMarkets[row.bundle.name as keyof typeof nativeMarkets])
  else if(row)choose(row.value)
  else requestTab(CATALOG_TAB)
 }
 return <>{createPortal(<>
  <div className="bx-plugin-groups bx-plugin-pages" role="group" aria-label={t('插件页面','Plugins page')}>
   <button type="button" aria-pressed={page.installed} disabled={busy} onClick={()=>{setAdding(false);setStatus('');requestTab('installed')}}>{t('已安装','Installed')}</button>
   <button type="button" aria-pressed={!page.installed} disabled={busy} onClick={openMarket}>{t('插件市场','Plugin market')}</button>
  </div>
  {page.installed?<div className="bx-plugin-groups" role="group" aria-label={t('已安装分类','Installed categories')}>
   <button type="button" aria-pressed={group==='official'} onClick={()=>setGroup('official')}>{t('官方','Official')}</button>
   <button type="button" aria-pressed={group==='third-party'} onClick={()=>setGroup('third-party')}>{t('第三方','Third-party')}</button>
  </div>:<>
   {!!choices.length&&<label className="bx-market-source">
    <span>{t('切换市场','Switch market')}</span>
    <select value={current} disabled={busy} onChange={event=>choose(event.target.value)}>
     <option value="" disabled>{t('选择市场','Choose a market')}</option>
     {choices.map(row=><option key={row.value} value={row.value} disabled={Boolean(row.bundle.error||(!row.bundle.enabled&&row.bundle.readOnlyReason))}>{row.label}</option>)}
    </select>
   </label>}
   {community&&<button className="bx-market-prefs-toggle" type="button" aria-expanded={adding} disabled={busy} onClick={()=>{setAdding(!adding);setStatus('')}}>{t('添加市场','Add market')}</button>}
  </>}
  {page.installed&&group==='third-party'&&!page.thirdParty&&<span className="bx-plugin-empty">{t('暂无第三方插件','No third-party plugins installed')}</span>}
  {!page.installed&&adding&&<form className="bx-market-add" onSubmit={event=>{
   event.preventDefault()
   const url=manifest.trim()
   if(!URL.canParse(url)||new URL(url).protocol!=='https:'){setStatus(t('请输入 HTTPS 市场清单地址','Enter an HTTPS market manifest URL'));return}
   void activate(COMMUNITY,'',{manifestUrl:url})
  }}>
   <label>{t('市场清单地址','Market manifest URL')}<input autoFocus required type="url" placeholder="https://…" value={manifest} disabled={busy} onChange={event=>setManifest(event.target.value)}/></label>
   <button type="submit" disabled={busy}>{t('添加','Add')}</button>
   <button type="button" disabled={busy} onClick={()=>{setAdding(false);setStatus('')}}>{t('取消','Cancel')}</button>
  </form>}
  {(busy||status)&&<span className="bx-market-status" role="status">{busy?t('正在连接市场…','Connecting to market…'):status}</span>}
 </>,page.mount)}
 {page.catalog&&createPortal(directory
  ?<InlineMarketCatalog key={directory.sourceRecordId+":"+directoryEpoch} source={directory} locale={locale} t={t} onInactive={()=>void recoverDirectory()}/>
  :<p role="status">{choices.length?t('选择一个插件市场','Choose a plugin market'):t('当前客户端没有可用的插件市场','No plugin market is available in this client')}</p>,page.catalog)}</>
}
