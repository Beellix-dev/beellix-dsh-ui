import React,{useEffect,useMemo,useState,useSyncExternalStore} from 'react'
import {Button} from '@deepseek-ai/dsh-client-ui-primitives'
import {modelPresets,modelProtocols} from './settings-model-connections.mjs'
import {ProviderMark} from './settings-brand'

const useSource=(source:any)=>useSyncExternalStore(useMemo(()=>(fn:()=>void)=>source.subscribe(fn),[source]),useMemo(()=>()=>source.getSnapshot(),[source]))
function Back({onClick,disabled,label='返回'}:any){return <button className="bx-model-back" type="button" disabled={disabled} onClick={onClick}><span aria-hidden="true">‹</span>{label}</button>}

function ConnectionForm({editor,onClose,onSaved}:any){
 const state=useSource(editor),[search,setSearch]=useState(''),[manual,setManual]=useState(''),[error,setError]=useState('')
 const models=state.models.filter((row:any)=>(row.name??'').toLowerCase().includes(search.toLowerCase())||row.id.toLowerCase().includes(search.toLowerCase()))
 const attempt=async(action:()=>Promise<unknown>)=>{setError('');try{await action()}catch(cause:any){setError(cause.message)}}
 return <section className="bx-model-editor">
  <div className="bx-model-editor-title"><Back onClick={onClose} disabled={state.busy}/><ProviderMark provider={state.provider} baseURL={state.baseURL}/><h3>{state.name||'自定义连接'}</h3></div>
  <form onSubmit={event=>{event.preventDefault();void attempt(async()=>{await editor.save();await onSaved('连接已保存')})}}>
   <fieldset disabled={state.busy} className="bx-model-fields">
    <label>连接名称<input aria-label="连接名称" required maxLength={100} value={state.name} readOnly={state.native} onChange={event=>editor.edit('name',event.target.value)}/></label>
    <label>API Key<input aria-label="API Key" type="password" autoComplete="new-password" placeholder={state.keyConfigured?'已保存，留空保留':'输入 API Key；本地服务可留空'} value={state.key} onChange={event=>editor.edit('key',event.target.value)}/></label>
    <label className="bx-model-address">服务地址<input aria-label="服务地址" type="url" required placeholder="https://…/v1" value={state.baseURL} onChange={event=>editor.edit('baseURL',event.target.value)}/></label>
    {!state.native&&<label>接口协议<select aria-label="接口协议" value={state.api} onChange={event=>editor.edit('api',event.target.value)}>{modelProtocols.map(row=><option value={row.id} key={row.id}>{row.name}</option>)}</select></label>}
   </fieldset>
   <div className="bx-model-list-header"><h4>模型</h4><Button variant="outline" type="button" disabled={state.busy} onClick={()=>void attempt(()=>editor.discover())}>{state.busy?'正在处理…':'获取模型'}</Button></div>
   {(error||state.error)&&<p role="alert" className="bx-gui-notice">{error||state.error}</p>}
   {state.models.length>0&&<>
    <div className="bx-model-search"><input type="search" aria-label="搜索型号" placeholder="搜索型号" value={search} onChange={event=>setSearch(event.target.value)}/><button type="button" disabled={state.busy} onClick={()=>editor.selectAll(state.selected.length===state.models.length?[]:state.models.map((row:any)=>row.id))}>{state.selected.length===state.models.length?'取消全选':'全选'}</button><span>{state.selected.length} / {state.models.length}</span></div>
    <div className="bx-model-list">{models.map((row:any)=><label key={row.id}><input type="checkbox" aria-label={row.id} checked={state.selected.includes(row.id)} disabled={state.busy} onChange={()=>editor.toggle(row.id)}/><ProviderMark provider={row.id.includes('/')?row.id:state.provider} baseURL={state.baseURL} size={20}/><span className="bx-model-label"><strong>{row.name??row.id}</strong>{row.name&&row.name!==row.id&&<small>{row.id}</small>}</span>{row.contextWindow&&<small>{new Intl.NumberFormat('zh').format(row.contextWindow)} 上下文</small>}</label>)}{!models.length&&<p className="bx-gui-empty">没有匹配的型号</p>}</div>
   </>}
   {!state.models.length&&!state.error&&<p className="bx-gui-empty">获取厂商型号后，勾选需要使用的模型。</p>}
   <div className="bx-model-manual"><input aria-label="手动模型 ID" placeholder="手动输入模型 ID" value={manual} disabled={state.busy} onChange={event=>setManual(event.target.value)}/><Button type="button" variant="outline" disabled={state.busy||!manual.trim()} onClick={()=>{try{editor.addModel(manual);setManual('');setError('')}catch(cause:any){setError(cause.message)}}}>添加</Button></div>
   <footer className="bx-model-footer">{state.removable&&<button className="bx-model-remove" type="button" disabled={state.busy} onClick={()=>void attempt(async()=>{await editor.remove();await onSaved('连接已移除')})}>移除连接</button>}<Button type="button" variant="outline" disabled={state.busy} onClick={onClose}>取消</Button><Button type="submit" disabled={state.busy||!state.selected.length}>{state.busy?'正在处理…':'保存连接'}</Button></footer>
  </form>
 </section>
}

export function ModelConnections({runtime,openNative,pluginModels}:{runtime:any;openNative:()=>void;pluginModels?:React.ReactNode}){
 const state=useSource(runtime.models),[screen,setScreen]=useState('connections'),[search,setSearch]=useState(''),[editor,setEditor]=useState<any>(null),[error,setError]=useState(''),[tab,setTab]=useState('main'),[saved,setSaved]=useState('')
 useEffect(()=>{void runtime.loadModels()},[runtime])
 useEffect(()=>()=>editor?.dispose(),[editor])
 useEffect(()=>{if(!saved)return;const timer=setTimeout(()=>setSaved(''),1800);return()=>clearTimeout(timer)},[saved])
 const close=()=>{editor?.dispose();setEditor(null);setScreen('connections');setError('')}
 const choose=(preset:any,row?:any)=>{
  try{const native=row??(preset.route?state.items.find((entry:any)=>entry.provider===preset.route):undefined)
   if(native?.provider==='deepseek-account'){openNative();return}
   const configured=runtime.modelEditor({row:native,preset});setEditor(configured);setError('')
  }catch(cause:any){setError(cause.message)}
 }
 const presets=modelPresets.map(preset=>({...preset,baseURL:preset.route?preset.baseURL:state.items.find((row:any)=>row.provider===preset.id)?.defaultBaseURL??preset.baseURL})).filter(preset=>preset.baseURL)
 const configured=state.items.filter((row:any)=>row.configured&&(row.displayName??row.provider).toLowerCase().includes(search.toLowerCase()))
 if(editor)return <ConnectionForm editor={editor} onClose={close} onSaved={async(message:string)=>{close();setSaved(message);await runtime.loadModels()}}/>
 return <>
  {pluginModels&&<div className="bx-gui-tabs bx-model-tabs"><button aria-pressed={tab==='main'} onClick={()=>setTab('main')}>模型连接</button><button aria-pressed={tab==='plugin'} onClick={()=>setTab('plugin')}>插件模型</button></div>}
  {tab==='plugin'?pluginModels:<>
   {screen==='add'?<>
    <div className="bx-model-editor-title"><Back onClick={()=>{setScreen('connections');setSearch('')}}/><h3>选择厂商</h3></div>
    <input className="bx-model-preset-search" type="search" aria-label="搜索厂商" placeholder="搜索厂商" value={search} onChange={event=>setSearch(event.target.value)}/>
    <div className="bx-model-presets">{presets.filter(preset=>preset.name.toLowerCase().includes(search.toLowerCase())).map(preset=><button key={preset.id} onClick={()=>choose(preset)}><ProviderMark provider={preset.id}/><strong>{preset.name}</strong><span aria-hidden="true">›</span></button>)}</div>
    <button className="bx-model-custom" onClick={()=>choose({name:'',api:'openai-completions',baseURL:''})}><ProviderMark provider="custom" size={26}/><span>自定义连接</span><small>填写服务地址和接口协议</small></button>
   </>:<>
    <div className="bx-gui-toolbar"><input className="bx-model-connection-search" type="search" aria-label="搜索已添加连接" placeholder="搜索已添加连接" value={search} onChange={event=>setSearch(event.target.value)}/><Button className="bx-gui-primary" variant="outline" onClick={()=>{setScreen('add');setSearch('')}}>添加连接</Button></div>
    <div className="bx-gui-cards">{configured.map((row:any)=><article key={row.provider} className="bx-gui-card"><div className="bx-gui-card-top"><ProviderMark provider={row.provider} baseURL={row.profile?.baseURL}/><h3>{row.displayName??row.provider}</h3></div><div className="bx-gui-card-bottom"><span>{(row.profile?.models??row.models).length} 个模型</span><Button className="bx-gui-configure" variant="outline" size="sm" onClick={()=>choose({},row)}>配置</Button></div></article>)}</div>
    {state.phase==='loading'&&<p className="bx-gui-empty">正在读取连接…</p>}
    {state.phase==='ready'&&!configured.length&&<p className="bx-gui-empty">{search?'没有匹配的连接':'还没有添加模型连接'}</p>}
   </>}
  </>}
  {(error||state.error)&&<p className="bx-gui-notice" role="alert">{error||state.error}</p>}
  {saved&&<div className="bx-gui-saved" role="status">{saved}</div>}
 </>
}
