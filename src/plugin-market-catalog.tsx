import React,{useEffect,useRef,useState} from 'react'
import {marketRequest} from './plugin-market-directory.mjs'

export interface MarketDirectory {
 sourceRecordId:string
 name:string
 enabled:boolean
 builtInProviderKey?:string
 manifestUrl?:string
}
export interface DirectoryState {
 sources:MarketDirectory[]
 builtIns:{key:string;name:string}[]
}
interface CatalogItem {
 id:string
 name:string
 displayName:string
 summary:string
 publisher?:{name:string}
 package?:{name:string}
 media?:{icon:{assetRef:string}}
}
interface CatalogPage {
 items:CatalogItem[]
 categories:string[]
 nextCursor?:string
}
interface InstallPreview {
 previewId:string
 displayName:string
 packageName:string
 version?:string
}
type Translate=(zh:string,en:string)=>string

export function InlineMarketCatalog({source,locale,t,onInactive}:{source:MarketDirectory;locale:string;t:Translate;onInactive:()=>void}){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState('')
 const [page,setPage]=useState<CatalogPage|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const [refresh,setRefresh]=useState(0),[installed,setInstalled]=useState<string[]>([])
 const refreshRequested=useRef(false)
 const [itemId,setItemId]=useState(''),[preview,setPreview]=useState<InstallPreview|null>(null)
 const [installing,setInstalling]=useState(false),[installNotice,setInstallNotice]=useState('')
 const params=()=>{
  const value=new URLSearchParams({sourceRecordId:source.sourceRecordId,locale})
  if(query)value.set('q',query)
  if(category)value.set('category',category)
  return value
 }
 useEffect(()=>{
  const controller=new AbortController()
  const queryParams=params()
  if(refreshRequested.current)queryParams.set('refresh','1')
  refreshRequested.current=false
  setPage(null);setError('');setLoading(true)
  const readCatalog=async()=>{
   for(let attempt=0;;attempt++){
    try{return await marketRequest('installable',{query:queryParams,signal:controller.signal})}
    catch(error:any){
     if(controller.signal.aborted||attempt>=2||(error.status!==404&&error.status<500))throw error
     await new Promise(resolve=>setTimeout(resolve,650))
     controller.signal.throwIfAborted()
     queryParams.delete('refresh')
    }
   }
  }
  void readCatalog()
   .then(result=>{if(!controller.signal.aborted)setPage(result)})
   .catch(error=>{
    if(controller.signal.aborted)return
    setError(error.message)
    if(error.status===400)onInactive()
   })
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[source.sourceRecordId,locale,query,category,refresh])
 useEffect(()=>{
  const controller=new AbortController()
  void marketRequest('installations',{signal:controller.signal}).then(result=>{
   setInstalled(result.installations.filter((row:{installed:boolean})=>row.installed).map((row:{packageName:string})=>row.packageName))
  }).catch(()=>{})
  return()=>controller.abort()
 },[])
 const loadMore=async()=>{
  if(!page?.nextCursor||loading)return
  const query=params()
  query.set('cursor',page.nextCursor)
  setLoading(true);setError('')
  try{
   const next:CatalogPage=await marketRequest('installable',{query})
   const seen=new Set(page.items.map(item=>item.id))
   setPage({...next,items:[...page.items,...next.items.filter(item=>!seen.has(item.id))]})
  }catch(error:any){setError(error.message)}
  finally{setLoading(false)}
 }
 const check=async(item:CatalogItem)=>{
  setItemId(item.id);setPreview(null);setInstallNotice('');setInstalling(true)
  try{setPreview(await marketRequest('operations/preview',{body:{action:'install',sourceRecordId:source.sourceRecordId,itemId:item.id}}))}
  catch(error:any){setInstallNotice(error.message)}
  finally{setInstalling(false)}
 }
 const install=async()=>{
  if(!preview)return
  setInstalling(true);setInstallNotice('')
  try{
   const result=await marketRequest('operations/execute',{body:{previewId:preview.previewId}})
   setInstalled(previous=>[...previous,preview.packageName])
   setInstallNotice(result.application==='restart-required'?t('已安装，重启后生效。','Installed. Restart to apply.'):
    result.application==='overridden'?t('已安装，启用状态由当前配置控制。','Installed. Activation is managed by the current configuration.'):t('已安装','Installed'))
   setPreview(null)
  }catch(error:any){setInstallNotice(error.message);setPreview(null)}
  finally{setInstalling(false)}
 }
 const frozen=loading||installing
 return <section className="bx-inline-market" aria-label={source.name}>
  <form className="bx-market-filter" onSubmit={event=>{event.preventDefault();setQuery(search.trim())}}>
   <input type="search" aria-label={t('搜索插件','Search plugins')} placeholder={t('搜索插件','Search plugins')} value={search} disabled={frozen} onChange={event=>setSearch(event.target.value)}/>
   <button type="submit" disabled={frozen}>{t('搜索','Search')}</button>
   <select aria-label={t('分类','Category')} value={category} disabled={frozen} onChange={event=>setCategory(event.target.value)}>
    <option value="">{t('全部分类','All categories')}</option>
    {[...new Set([...(category?[category]:[]),...(page?.categories??[])])].map(name=><option key={name}>{name}</option>)}
   </select>
   <button type="button" disabled={frozen} onClick={()=>{refreshRequested.current=true;setRefresh(value=>value+1)}}>{t('刷新','Refresh')}</button>
  </form>
  {error&&<p role="alert">{t('读取目录失败','Could not load catalog')} · {error}</p>}
  {loading&&!page&&<p role="status">{t('正在加载插件目录…','Loading catalog…')}</p>}
  {!loading&&!error&&page?.items.length===0&&<p role="status">{t('没有匹配的插件','No matching plugins')}</p>}
  <ul className="bx-market-cards">
   {page?.items.map(item=>{
    const present=installed.includes(item.package?.name??item.name)
    const icon=item.media?.icon.assetRef
    return <li key={item.id} className="bx-market-card">
     <div className="bx-market-card-heading">
      {icon&&/^mktimg_[\w-]{32}$/.test(icon)&&<img src={'/api/community-market/assets?ref='+encodeURIComponent(icon)} alt="" loading="lazy"/>}
      <div><strong>{item.displayName}</strong>{item.publisher&&<small>{item.publisher.name}</small>}</div>
      <button type="button" disabled={installing||present} onClick={()=>void check(item)}>{present?t('已安装','Installed'):t('安装','Install')}</button>
     </div>
     <p>{item.summary}</p>
     {itemId===item.id&&<div className="bx-market-install">
      {preview&&<><span>{preview.packageName}{preview.version?' @ '+preview.version:''}</span>
       <button type="button" disabled={installing} onClick={()=>void install()}>{t('确认安装','Confirm install')}</button>
       <button type="button" disabled={installing} onClick={()=>{setPreview(null);setItemId('')}}>{t('取消','Cancel')}</button></>}
      {(installing||installNotice)&&<span role="status">{installing?t('正在处理…','Working…'):installNotice}</span>}
     </div>}
    </li>
   })}
  </ul>
  {page?.nextCursor&&<button type="button" disabled={frozen} onClick={()=>void loadMore()}>{loading?t('正在加载…','Loading…'):t('加载更多','Load more')}</button>}
 </section>
}
