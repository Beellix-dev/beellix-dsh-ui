import React,{useEffect,useMemo,useState,useSyncExternalStore} from 'react'
import {Button,Switch} from '@deepseek-ai/dsh-client-ui-primitives'
import {pluginPhase} from './settings-plugin-list.mjs'

export function BuiltinPluginList({runtime}:any){
 const store=runtime.plugins,state=useSyncExternalStore(useMemo(()=>(fn:()=>void)=>store.subscribe(fn),[store]),()=>store.getSnapshot()),[query,setQuery]=useState(''),[presetId,setPresetId]=useState(''),[detail,setDetail]=useState('')
 useEffect(()=>{void store.load()},[store])
 useEffect(()=>{if(!state.notice||state.notice.includes('重启'))return;const timer=setTimeout(()=>store.dismissNotice(),2500);return()=>clearTimeout(timer)},[store,state.notice])
 const preset=state.presets.find((row:any)=>row.id===presetId)??state.presets.find((row:any)=>row.isDefault)??state.presets[0]
 const matches=(row:any)=>[row.title,row.description,row.moduleName,row.entryId].some(value=>String(value??'').toLowerCase().includes(query.trim().toLowerCase()))
 const renderRows=(rows:any[],global:boolean)=><div className="bx-builtin-rows">{rows.filter(matches).map((row:any,index:number)=>{const key=(global?'global:':preset?.id+':')+(row.entryId??row.moduleName)+':'+index;return <article key={key} className="bx-builtin-row"><div><h3>{row.title}</h3>{row.description&&<p>{row.description}</p>}</div><div className="bx-builtin-controls"><span data-state={row.fiberPhase==='failed'?'error':undefined}>{pluginPhase(row,!global)}</span>{global&&row.canToggle?<Switch label={'启用'+row.title} checked={row.enabled} disabled={Boolean(state.busy)} onChange={value=>void store.toggle(row.entryId,value).catch(()=>{})}/>:<span className="bx-builtin-readonly">{global?(row.core?'核心组件':'组合管理'):'随模式'}</span>}<Button variant="ghost" size="sm" aria-expanded={detail===key} onClick={()=>setDetail(detail===key?'':key)}>详情</Button></div>{detail===key&&<div className="bx-builtin-detail"><p>{row.moduleName}</p><p>{global?row.canToggle?'此开关更改整个客户端的启用状态。':'该组件目前没有可写的独立开关，由底座或上级组合管理。':'该插件属于所选模式，不能用全局开关改变单个会话。'}</p>{row.entryId&&<code>{row.entryId}</code>}</div>}</article>})}{!rows.filter(matches).length&&<p className="bx-gui-empty">没有匹配的插件</p>}</div>
 return <div className="bx-builtin-list">
  <div className="bx-builtin-search"><input type="search" aria-label="搜索内置插件" placeholder="搜索插件" value={query} onChange={event=>setQuery(event.target.value)}/><Button variant="outline" size="sm" disabled={state.phase==='loading'||Boolean(state.busy)} onClick={()=>void store.load()}>刷新</Button></div>
  {state.error&&<p className="bx-gui-notice" role="alert">{state.error}</p>}
  {state.notice&&<div className={state.notice.includes('重启')?'bx-gui-notice':'bx-gui-saved'} role="status">{state.notice}</div>}
  {state.phase==='loading'&&<p className="bx-gui-empty">正在读取插件…</p>}
  {state.phase!=='loading'&&<><section className="bx-builtin-group"><header><div><h3>会话插件</h3><p>由所选模式组合，作用于对应会话。</p></div>{state.presets.length>0&&<select aria-label="查看模式的会话插件" value={preset?.id??''} onChange={event=>{setPresetId(event.target.value);setDetail('')}}>{state.presets.map((row:any)=><option key={row.id} value={row.id}>{row.name}{row.isDefault?'（默认）':''}</option>)}</select>}</header>{preset?.broken?<p className="bx-gui-notice" role="alert">该模式的插件列表读取失败：{preset.broken}</p>:renderRows(preset?.rows??[],false)}</section><section className="bx-builtin-group"><header><div><h3>全局插件</h3><p>作用于整个客户端，供所有会话共用；有独立开关的可直接启停。</p></div></header>{renderRows(state.entries,true)}</section></>}
 </div>
}
