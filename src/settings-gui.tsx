import {OpeningSettings} from './settings-opening'
/** Independent Web GUI settings. Data and execution stay in DSH public services. */
import React,{useEffect,useId,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {Button,Switch,useModalLayer} from '@deepseek-ai/dsh-client-ui-primitives'
import {createSettingsDraft,settingsFields,valueAt} from './settings-core.mjs'
import {guiPages,guiNavigation,guiFields,namespaceTitles,namespacePage,configLabels} from './settings-definitions.mjs'
import {DesktopPreferences} from './settings-desktop'
import {ArchivedChats} from './settings-archived-chats'
import {ModelConnections} from './settings-models'
import {SkinSettings} from './settings-skins'
import {decorationKind,pluginManagerKey,decorationAvailability} from './settings-decorations.mjs'
import {BuiltinPluginList} from './settings-plugin-list'
import {PetSettings,PointerEffects} from './settings-pets'
import {FontControl,NumberControl} from './settings-controls'

function useSource(source:any){
 const subscribe=useMemo(()=>(listener:()=>void)=>source.subscribe(listener),[source])
 const read=useMemo(()=>()=>source.getSnapshot(),[source])
 return useSyncExternalStore(subscribe,read)
}
const knownNamespaces=new Set(guiFields.map(row=>row.ns))
const ignoreNamespaces=new Set(['ui-settings-general','dsh-web-gui'])
const labelFor=(ns:string)=>namespaceTitles[ns]??ns.replace(/^web-ui-/,'').replaceAll('-',' ')

export function GuiIcon({name='settings'}:{name?:string}){
 const paths:Record<string,React.ReactNode>={
 settings:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/></>,
 chat:<path d="M4 4h16v12H9l-5 4V4Z"/>,keyboard:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9h1m3 0h1m3 0h2M7 13h1m3 0h1m3 0h2M8 16h8"/></>,
 bell:<><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Z"/><path d="M10 21h4"/></>,
 palette:<><circle cx="12" cy="12" r="9"/><path d="M7 8h.01M12 6h.01M17 9h.01M8 13h.01M12 19v-5h5"/></>,
 layout:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16m8-16v16"/></>,
 image:<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m4 17 5-5 4 4 3-7 5 9"/></>,
 pet:<><path d="M6 10 4 3l6 4h4l6-4-2 7v6c0 4-12 4-12 0v-6Z"/><path d="M9 12h.01M15 12h.01m-5 3 2 2 2-2"/></>,
 models:<><path d="m12 3 8 5-8 5-8-5 8-5Zm-8 9 8 5 8-5m-16 5 8 5 8-5"/></>,
 network:<><circle cx="12" cy="5" r="2"/><rect x="2" y="17" width="6" height="4" rx="1"/><rect x="16" y="17" width="6" height="4" rx="1"/><path d="M12 7v6M5 17v-4h14v4"/></>,
 shield:<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>,
 folder:<path d="M3 6h7l2 3h9v11H3V6Z"/>,archive:<><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9m-10 4h6"/></>,layers:<><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 21h14V7"/></>,
 activity:<><path d="M2 12h5l3-8 4 16 3-8h5"/></>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,back:<path d="m14 5-7 7 7 7"/>,search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
 }
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.settings}</svg>
}

function Notice({message,onRetry}:{message:string;onRetry?:()=>void}){return <div className="bx-gui-notice" role="alert"><span>{message}</span>{onRetry&&<Button variant="outline" size="sm" onClick={onRetry}>重试</Button>}</div>}
function Empty({children}:{children:React.ReactNode}){return <p className="bx-gui-empty">{children}</p>}

export function GuiCard({title,description,status,icon='settings',onConfigure,children}:{title:string;description?:string;status?:string;icon?:string;onConfigure?:()=>void;children?:React.ReactNode}){
 return <article className="bx-gui-card"><div className="bx-gui-card-top"><span className="bx-gui-card-icon"><GuiIcon name={icon}/></span><h3>{title}</h3></div>{description&&<p>{description}</p>}<div className="bx-gui-card-bottom"><span className="bx-gui-status">{status}</span>{children}{onConfigure&&<Button className="bx-gui-configure" variant="outline" size="sm" onClick={onConfigure}>配置</Button>}</div></article>
}

function InputControl({field,value,onChange,disabled}:{field:any;value:any;onChange:(value:any)=>void;disabled?:boolean}){
 if(field.control==='font')return <FontControl label={field.label} value={value??''} onChange={onChange} disabled={disabled}/>
 if(field.appearance)return <div className="bx-gui-theme-options" role="group" aria-label={field.label}>{field.options.map((option:string,index:number)=><button type="button" key={option} aria-pressed={value===option} disabled={disabled} onClick={()=>onChange(option)}><span className="bx-gui-theme-preview" data-tone={option}><span/><i/></span><span>{field.optionLabels[index]}</span></button>)}</div>
 if(field.type==='boolean')return <Switch label={field.label} checked={Boolean(value)} disabled={disabled} onChange={onChange}/>
 if(field.options)return <select aria-label={field.label} value={value??''} disabled={disabled} onChange={event=>onChange(field.options.find((option:any)=>String(option)===event.target.value))}>{value===undefined&&<option value="">沿用默认值</option>}{field.options.map((option:any,index:number)=><option key={String(option)} value={String(option)}>{field.optionLabels?.[index]??String(option)}</option>)}</select>
 if(field.type==='number')return <NumberControl label={field.label} min={field.min} max={field.max} step={field.step??1} unit={field.unit} value={value??''} disabled={disabled} onChange={onChange}/>
 if(['string',undefined].includes(field.type))return <input aria-label={field.label} type={field.secret?'password':'text'} autoComplete={field.secret?'new-password':undefined} placeholder={field.secret?'留空保留已有值':undefined} value={value??''} disabled={disabled} onChange={event=>onChange(event.target.value)}/>
 return <JsonField field={field} value={value} onChange={onChange} disabled={disabled}/>
}

function JsonField({field,value,onChange,disabled}:any){
 const [text,setText]=useState(JSON.stringify(value??field.default??(field.type==='array'?[]:{}),null,2)),[error,setError]=useState('')
 return <div className="bx-gui-json"><textarea aria-label={field.label} value={text} disabled={disabled} rows={4} onChange={event=>{setText(event.target.value);try{onChange(JSON.parse(event.target.value));setError('');event.currentTarget.setCustomValidity('')}catch{setError('请输入有效的 JSON');event.currentTarget.setCustomValidity('请输入有效的 JSON')}}}/>{error&&<span role="alert">{error}</span>}</div>
}

function FormEditor({runtime,ns,fields,path=[],hiddenKeys=[],onBack,title}:{runtime:any;ns:string;fields?:any[];path?:string[];hiddenKeys?:string[];onBack?:()=>void;title?:string}){
 const scope=fields?.map(field=>field.path.join('.')).join('|')??path.join('.')
 const draft=useMemo(()=>runtime.draft(ns,scope),[runtime,ns,scope]),view=useSource(draft)
 const [error,setError]=useState(''),[saved,setSaved]=useState(false),[invalid,setInvalid]=useState(false)
 const descriptor=runtime.describe.getSnapshot().view?.namespaces.find((row:any)=>row.ns===ns)
 const root=descriptor?.schema?runtime.ctx.settingsSchema.rehydrate(descriptor.schema):undefined
 const node=root&&path.length?runtime.ctx.settingsSchema.nodeAtPath(root,path):root
 const list=fields??settingsFields(node,path).filter((field:any)=>!hiddenKeys.includes(field.path.at(-1))).map((field:any)=>({...field,label:configLabels[field.path.at(-1)]??field.label}))
 const write=(field:any,value:any)=>{draft.set(field.path,value);setSaved(false);setInvalid(false);setError('')}
 useEffect(()=>{if(!saved)return;const timeout=setTimeout(()=>setSaved(false),1800);return()=>clearTimeout(timeout)},[saved])
 if(view.accepted.status==='loading')return <Empty>正在读取配置…</Empty>
 if(view.accepted.status!=='ready')return <Empty>当前模块未提供可编辑的配置。</Empty>
 if(!list.length)return null
 return <section className="bx-gui-editor">{title&&<header>{onBack&&<button className="bx-gui-icon-button" aria-label="返回配置列表" onClick={onBack}><GuiIcon name="back"/></button>}<h3>{title}</h3></header>}
  {view.conflicted&&<Notice message="配置已在其他位置更新，草稿已保留。请取消草稿并重新读取。"/>}
  <form onInvalid={()=>setInvalid(true)} onSubmit={async event=>{event.preventDefault();try{setError('');await draft.save();setSaved(true)}catch(cause:any){setError(cause.message)}}}>
   {list.filter((field:any)=>!(ns==='ui-theme'&&list.some((row:any)=>row.control==='font')&&['fontSize','codeFontSize','terminalFontSize'].includes(field.path.at(-1)))).map((field:any)=>{
    const read=(item:any)=>{const changed=view.changes.find((row:any)=>JSON.stringify(row.path)===JSON.stringify(item.path));return changed?changed.op==='unset'?undefined:changed.value:item.secret?'':valueAt(view.accepted.value,item.path)}
    const sizeKey=({textFontFamily:'fontSize',codeFontFamily:'codeFontSize',terminalFontFamily:'terminalFontSize'} as any)[field.path.at(-1)],sizeField=field.control==='font'?list.find((row:any)=>row.path.at(-1)===sizeKey):undefined,disabled=view.busy||!view.accepted.writable
    return <div key={field.path.join('.')} className={'bx-gui-field-row'+(field.appearance?' bx-gui-theme-row':'')}><div><label>{field.label}</label>{field.hint&&<p>{field.hint}</p>}</div>{sizeField?<div className="bx-font-controls"><InputControl field={field} value={read(field)} disabled={disabled} onChange={value=>write(field,value)}/><InputControl field={sizeField} value={read(sizeField)} disabled={disabled} onChange={value=>write(sizeField,value)}/></div>:<InputControl field={field} value={read(field)} disabled={disabled} onChange={value=>write(field,value)}/>}</div>
   })}
   {(error||view.error)&&<Notice message={error||view.error}/>}
   {saved&&<div className="bx-gui-saved" role="status">已保存</div>}
   {list.length>0&&(view.dirty||view.busy||!view.accepted.writable)&&<footer><span>{!view.accepted.writable?'当前配置只读':invalid?'请检查输入内容':''}</span>{view.accepted.writable&&<><Button variant="outline" disabled={view.busy} onClick={()=>{draft.discard();setError('');setSaved(false)}}>取消</Button><Button type="submit" disabled={view.busy||view.conflicted}>{view.busy?'正在保存…':'保存'}</Button></>}</footer>}
  </form>
 </section>
}

function Preferences({runtime,page}:{runtime:any;page:string}){
 const mirror=useSource(runtime.describe),view=mirror.view
 const languages=useSource(runtime.ctx.locale).locales
 if(!view)return <Empty>{mirror.error??'正在读取设置…'}</Empty>
 const namespaces=view.namespaces.filter((row:any)=>guiFields.some(field=>!field.permission&&field.page===page&&field.ns===row.ns))
 return <>{namespaces.map((row:any)=><FormEditor key={row.ns} runtime={runtime} ns={row.ns} fields={guiFields.filter(field=>!field.permission&&field.page===page&&field.ns===row.ns&&Object.hasOwn(row.value??{},field.path[0])).map(field=>field.ns==='locale'&&languages?.length?{...field,options:languages.map((language:any)=>language.id),optionLabels:languages.map((language:any)=>language.label)}:field)}/>)}{mirror.error&&<Notice message={mirror.error}/>}</>
}

function NamespaceCards({runtime,page,hiddenKinds=[]}:{runtime:any;page:string;hiddenKinds?:string[]}){
 const mirror=useSource(runtime.describe),[selected,setSelected]=useState<string|null>(null),contributions=useSource(runtime.registry)
 const rows=(mirror.view?.namespaces??[]).filter((row:any)=>row.schema&&settingsFields(runtime.ctx.settingsSchema.rehydrate(row.schema)).length>0).filter((row:any)=>!knownNamespaces.has(row.ns)&&!ignoreNamespaces.has(row.ns)&&namespacePage(row.ns)===page&&!hiddenKinds.includes(decorationKind(row.ns)??'')&&!(page==='models'&&row.ns.startsWith('llm-')))
 if(selected){const row=rows.find((entry:any)=>entry.ns===selected);return row?<FormEditor runtime={runtime} ns={selected} title={labelFor(selected)} onBack={()=>setSelected(null)}/>:<Notice message="此模块已卸载或不可用。" onRetry={()=>setSelected(null)}/>}
 return <div className="bx-gui-cards">{rows.map((row:any)=><GuiCard key={row.ns} title={labelFor(row.ns)} icon={page==='appearance'?'palette':'settings'} status={mirror.view.writable?'可配置':'只读'} onConfigure={()=>setSelected(row.ns)}/>)}{contributions.filter((row:any)=>row.page===page).map((row:any)=><GuiCard key={row.id} title={row.title} description={row.description} status={row.status} onConfigure={typeof row.render==='function'?()=>runtime.open('contribution:'+row.id):undefined}/>)}</div>
}

export function OwnPreferences({runtime,renderSlot,close}:any){
 const shell=useSource(runtime.shell),page=shell.page
 const version=useSyncExternalStore((fn)=>runtime.ctx.slots.subscribe('settings.general.item',fn),()=>runtime.ctx.slots.getVersion('settings.general.item'))
 const ids=runtime.ctx.slots.entries('settings.general.item').map((row:any)=>row.options.id)
 if(['appearance','wallpaper','surfaces'].includes(page)&&runtime.skin)return <SkinSettings runtime={runtime} section={page}/>
 if(page==='mascot')return <PetSettings runtime={runtime}/>
 if(page==='effects')return <OpeningSettings runtime={runtime}/>
 const delegated=page==='privacy'?ids.filter((id:string)=>id==='permission'):page==='shortcuts'?ids.filter((id:string)=>id==='shortcuts'):page==='general'?ids.filter((id:string)=>!['language','appearance','font-size','permission','composer-enter','transcript-view','performance-usage','link-opening','shortcuts','developer-tools','current-version'].includes(id)&&!id.startsWith('session-log-')):[]
 return <><Preferences runtime={runtime} page={page}/>{['appearance','decorations','extensions'].includes(page)&&<NamespaceCards runtime={runtime} page={page}/>}{delegated.map((id:string)=><React.Fragment key={id}>{renderSlot('settings.general.item',{}, {only:id})}</React.Fragment>)}{['general','layout','notifications','network','storage','environment','diagnostics','privacy','about'].includes(page)&&<DesktopPreferences page={page==='privacy'?'permissions':page} store={runtime.desktop}/>}</>
}

export function SettingsGui({runtime,renderSlot,wide}:any){
 const shell=useSource(runtime.shell),mirror=useSource(runtime.describe),registry=useSource(runtime.registry),[search,setSearch]=useState(''),[onboarding,setOnboarding]=useState(0)
 const panel=useRef<HTMLDivElement>(null),title=useId()
 const slotVersion=useSyncExternalStore((fn)=>runtime.ctx.slots.subscribe('settings.section',fn),()=>runtime.ctx.slots.getVersion('settings.section'))
 const sections=runtime.ctx.slots.entries('settings.section').map((entry:any)=>({id:entry.options.id,title:typeof entry.options.label==='function'?entry.options.label():entry.options.label??entry.options.id}))
 const extras=sections.filter((entry:any)=>!['general','models','desktop','dsh-web-gui-preferences'].includes(entry.id))
 const localeRevision=useSyncExternalStore((fn)=>runtime.ctx.locale.subscribe(fn),()=>runtime.ctx.locale.getSnapshot().revision)
 useModalLayer(panel,shell.open,()=>runtime.close())
 useEffect(()=>{void runtime.describe.ensure()},[runtime])
 const completedSteps=useRef(new Set<string>()),[explicitStep,setExplicitStep]=useState<string|null>(null)
 const onboardingVersion=useSyncExternalStore((fn)=>runtime.ctx.slots.subscribe('settings.onboarding',fn),()=>runtime.ctx.slots.getVersion('settings.onboarding'))
 const steps=runtime.ctx.slots.entries('settings.onboarding').sort((a:any,b:any)=>(a.options.order??0)-(b.options.order??0)).map((entry:any)=>entry.options.id).filter((id:string)=>!completedSteps.current.has(id))
 const step=explicitStep??steps[0]
 const active=guiPages.find(row=>row.id===shell.page),external=shell.page.startsWith('native:')?shell.page.slice(7):null,contribution=shell.page.startsWith('contribution:')?registry.find((row:any)=>'contribution:'+row.id===shell.page):null
 const activeNavigation=guiNavigation.find(row=>row.pages.includes(shell.page))??(external?guiNavigation.find(row=>row.pages.includes('extensions')):undefined)
 const navigation=guiNavigation.filter(row=>[row.title,...guiPages.filter(page=>row.pages.includes(page.id)).map(page=>page.title),...guiFields.filter(field=>row.pages.includes(field.page)).map(field=>field.label)].some(value=>value.includes(search)))
 const select=(page:string)=>runtime.open(page)
 return <>
  {renderSlot('settings.launcher',{wide,settingsOpen:shell.open,openSettings:()=>runtime.open(),openOnboarding:(id:string)=>{setExplicitStep(id);setOnboarding(value=>value+1)}})}
  {step&&renderSlot('settings.onboarding',{stepId:step,explicit:!!explicitStep,complete:()=>{completedSteps.current.add(step);setExplicitStep(null);setOnboarding(value=>value+1)},openSection:(id:string)=>runtime.open('native:'+id)},{only:step})}
  {shell.open&&createPortal(<div className="bx-settings-overlay"><div className="bx-settings-mask" aria-hidden="true" onClick={()=>runtime.close()}/><div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title} data-shortcut-modal="settings" data-settings-page={shell.page} data-dshgui-settings-theme="default" className="bx-settings-dialog bx-gui">
   <nav aria-label="设置分类"><h1 id={title}>设置</h1><label className="bx-gui-nav-search"><GuiIcon name="search"/><input type="search" aria-label="查找设置" placeholder="查找设置" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="bx-settings-navigation">{navigation.map(row=><button key={row.title} aria-current={activeNavigation===row?'page':undefined} onClick={()=>select(row.pages[0])}><GuiIcon name={row.icon}/><span>{row.title}</span></button>)}{!navigation.length&&<p className="bx-gui-empty">没有匹配的分类</p>}</div></nav>
   <div className="bx-settings-body bx-settings"><header className="bx-settings-page-header"><div className="bx-settings-header-main"><select className="bx-mobile-settings" aria-label="选择设置分类" value={activeNavigation?.pages[0]??'general'} onChange={event=>select(event.target.value)}>{guiNavigation.map(row=><option key={row.title} value={row.pages[0]}>{row.title}</option>)}</select>
    {activeNavigation&&activeNavigation.pages.length>1?<div className="bx-gui-tabs bx-settings-subpages" role="group" aria-label={activeNavigation.title+'选项'}>{activeNavigation.pages.map(id=><button key={id} aria-pressed={shell.page===id} onClick={()=>select(id)}>{guiPages.find(row=>row.id===id)?.title}</button>)}</div>:activeNavigation?.pages.includes('extensions')&&extras.length>0?<div className="bx-gui-tabs bx-settings-subpages" role="group" aria-label="插件配置"><button aria-pressed={!external} onClick={()=>select('extensions')}>已加载配置</button>{extras.map((row:any)=><button key={row.id} aria-pressed={external===row.id} onClick={()=>select('native:'+row.id)}>{row.title}</button>)}</div>:<h2>{contribution?.title??activeNavigation?.title??active?.title??'配置'}</h2>}
   </div><button className="bx-gui-icon-button" aria-label="关闭设置" onClick={()=>runtime.close()}><GuiIcon name="close"/></button></header><div className="bx-settings-page-content" key={shell.page}>
    {external==='plugins'?<BuiltinPluginList runtime={runtime}/>:external?<div className="bx-native-settings" data-dshgui-native-section={external}>{renderSlot('settings.section',{close:()=>runtime.close()},{only:external})}</div>:shell.page==='archive'?<ArchivedChats ctx={runtime.ctx} Icon={GuiIcon}/>:shell.page==='models'?<ModelConnections runtime={runtime} openNative={()=>select('native:models')} pluginModels={registry.some((row:any)=>row.page==='models')?<NamespaceCards runtime={runtime} page="models"/>:undefined}/>:contribution&&typeof contribution.render==='function'?contribution.render({close:()=>runtime.close()}):renderSlot('settings.section',{close:()=>runtime.close()},{only:'dsh-web-gui-preferences'})}
    {['about','diagnostics'].includes(shell.page)&&<div className="bx-settings-native-actions">{renderSlot('settings.action',{})}</div>}
   </div></div>
  </div></div>,document.body)}
 </>
}
