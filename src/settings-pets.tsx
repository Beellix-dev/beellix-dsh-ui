import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import {Button,Switch} from '@deepseek-ai/dsh-client-ui-primitives'
import {NumberControl,RangeControl} from './settings-controls'
import {playPetAction} from './settings-pet-motion.mjs'
import {petActionLimit,petLibraryLimit,petPlacement} from './settings-personalization.mjs'
import {uploadPetAction} from './settings-media'

function mediaName(file:File,fallback:string){
 return file.name.replace(/\.[^.]+$/,'').trim().slice(0,20)||fallback
}
function UploadPetMedia({label,disabled,onFile}:any){
 return <label className="bx-pet-action-import">{label}<input type="file" aria-label={label} accept="image/gif,image/webp,.gif,.webp" disabled={disabled} onChange={event=>{
  const file=event.target.files?.[0]
  event.target.value=''
  if(file)void onFile(file)
 }}/></label>
}
function PetThumbnail({pet}:any){
 const idle=pet.actions.find((action:any)=>action.id===pet.defaultActionId)
 const src=pet.thumbnail||(idle.image.startsWith('/')?idle.image+'?pet-idle=1':idle.image)
 return <span className="bx-pet-thumbnail"><img key={src} src={src} alt="" loading="lazy" onLoad={event=>event.currentTarget.dataset.ready=''} onError={event=>event.currentTarget.parentElement?.setAttribute('data-failed','')}/><span>预览</span></span>
}

export function PetSettings({runtime}:any){
 const store=runtime.decorations,state=useSyncExternalStore(useMemo(()=>(fn:()=>void)=>store.subscribe(fn),[store]),()=>store.getSnapshot())
 const [selected,setSelected]=useState<string|null>(null),[editorDirty,setEditorDirty]=useState(false)
 const [reading,setReading]=useState(false),[error,setError]=useState('')
 const upload=useRef<AbortController|null>(null)
 useEffect(()=>()=>upload.current?.abort(),[])
 const library=state.value.petLibrary
 const pet=library.entries.find((entry:any)=>entry.id===selected)
 const busy=state.busy||reading
 const update=async(change:(current:any)=>any)=>{
  try{
   setError('')
   const current=store.getSnapshot().value
   await store.save({...current,petLibrary:change(current.petLibrary)})
   return true
  }catch(cause:any){setError(cause.message);return false}
 }
 const addPet=async(action:any,thumbnail='')=>{
  const id='pet-'+crypto.randomUUID()
  const entry={id,name:action.name,...petPlacement,defaultActionId:action.id,actions:[action],thumbnail}
  if(await update(current=>({...current,entries:[...current.entries,entry],
    activeId:current.activeId??id,enabled:current.activeId===null||current.enabled,
    unassignedActions:current.unassignedActions.filter((item:any)=>item.id!==action.id)
  })))setSelected(id)
 }
 const uploadPet=async(file:File)=>{
  const controller=new AbortController()
  upload.current=controller
  setReading(true)
  try{
   const {image,durationMs,thumbnail}=await uploadPetAction(file,controller.signal,true)
   if(!controller.signal.aborted)await addPet({id:'custom-'+crypto.randomUUID(),name:mediaName(file,'我的宠物'),image,durationMs},thumbnail)
  }catch(cause:any){if(!controller.signal.aborted)setError(cause.message)}
  finally{upload.current=null;if(!controller.signal.aborted)setReading(false)}
 }
 if(!state.ready)return <p className="bx-gui-empty">{state.error||'正在读取桌宠…'}</p>
 const full=library.entries.length>=petLibraryLimit
 return <section className="bx-decoration-section">
  <header><h3>我的宠物</h3>{library.activeId&&<Switch label="显示桌面宠物" checked={library.enabled} disabled={busy} onChange={(enabled:boolean)=>void update(current=>({...current,enabled}))}/>}</header>
  <div className="bx-pet-action-heading">
   <span className="bx-skin-hint">{reading?'正在导入宠物…':full?'宠物列表已满':library.entries.length?'选择一只显示在主窗口':'上传动图添加第一只宠物'}</span>
   <UploadPetMedia label="添加宠物" disabled={busy||editorDirty||full} onFile={uploadPet}/>
  </div>
  {!!library.unassignedActions.length&&<label className="bx-pet-legacy">从已上传的动作创建宠物
   <select value="" disabled={busy||editorDirty||full} onChange={event=>{
    const action=library.unassignedActions.find((item:any)=>item.id===event.target.value)
    if(action)void addPet(action)
   }}><option value="">选择素材</option>{library.unassignedActions.map((action:any)=><option key={action.id} value={action.id}>{action.name}</option>)}</select>
  </label>}
  <div className="bx-pet-grid">
   {library.entries.map((entry:any)=>{
    const active=entry.id===library.activeId
    return <article className="bx-pet-card" key={entry.id} data-selected={entry.id===selected}>
     <PetThumbnail pet={entry}/>
     <strong title={entry.name}>{entry.name}</strong>
     <div className="bx-pet-card-controls">
      <Button variant="outline" size="sm" disabled={busy||active&&library.enabled} onClick={()=>void update(current=>({...current,activeId:entry.id,enabled:true}))}>
       {active&&library.enabled?'显示中':'设为桌宠'}
      </Button>
      <Button variant="ghost" size="sm" aria-pressed={entry.id===selected} disabled={busy||editorDirty} onClick={()=>setSelected(entry.id===selected?null:entry.id)}>编辑</Button>
     </div>
    </article>
   })}
  </div>
  {pet&&<PetEditor key={pet.id} pet={pet} busy={busy} onDirty={setEditorDirty}
   onSave={(entry:any)=>update(current=>({...current,entries:current.entries.map((item:any)=>item.id===entry.id?entry:item)}))}
   onRemove={async()=>{
    if(await update(current=>{
     const entries=current.entries.filter((item:any)=>item.id!==pet.id)
     const activeId=current.activeId===pet.id?null:current.activeId
     return {...current,entries,activeId,enabled:current.enabled&&activeId!==null}
    }))setSelected(null)
   }}/>}
  {(error||state.error)&&<p className="bx-gui-notice" role="alert">{error||state.error}</p>}
 </section>
}

function PetEditor({pet,busy,onDirty,onSave,onRemove}:any){
 const [draft,setDraft]=useState(pet),[error,setError]=useState(''),[reading,setReading]=useState(false)
 const preview=useRef<HTMLImageElement|null>(null),stopPreview=useRef<(() => void)|null>(null),upload=useRef<AbortController|null>(null)
 const saved=JSON.stringify(pet)
 useEffect(()=>setDraft(JSON.parse(saved)),[saved])
 useEffect(()=>()=>{stopPreview.current?.();upload.current?.abort();onDirty(false)},[onDirty])
 const dirty=JSON.stringify(draft)!==saved
 useEffect(()=>onDirty(dirty||reading),[dirty,reading,onDirty])
 const disabled=busy||reading
 const idle=draft.actions.find((action:any)=>action.id===draft.defaultActionId)
 const extra=draft.actions.filter((action:any)=>action.id!==draft.defaultActionId)
 const play=(action:any)=>{
  stopPreview.current?.()
  preview.current?.parentElement?.scrollIntoView({block:'nearest'})
  stopPreview.current=playPetAction(preview.current,action,globalThis,setError)
  setError(stopPreview.current?'':'当前系统设置减少动态效果')
 }
 const addAction=async(file:File)=>{
  const controller=new AbortController()
  upload.current=controller
  setReading(true)
  try{
   const {image,durationMs}=await uploadPetAction(file,controller.signal)
   if(controller.signal.aborted)return
   const stem=mediaName(file,'我的动作')
   let name=stem
   for(let suffix=2;draft.actions.some((action:any)=>action.name.trim()===name);suffix++){
    const tag=' '+suffix
    name=stem.slice(0,20-tag.length)+tag
   }
   setDraft({...draft,actions:[...draft.actions,{id:'custom-'+crypto.randomUUID(),name,image,durationMs}]})
   setError('')
  }catch(cause:any){if(!controller.signal.aborted)setError(cause.message)}
  finally{upload.current=null;if(!controller.signal.aborted)setReading(false)}
 }
 return <form className="bx-pet-editor" onSubmit={event=>{event.preventDefault();void onSave(draft)}}>
  <div className="bx-pet-action-heading"><strong>{pet.name}</strong><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={()=>play(idle)}>预览默认动作</Button></div>
  <span className="bx-pet-preview"><img ref={preview} alt=""/><span>动作预览</span></span>
  <div className="bx-pet-action-library">
   <div className="bx-pet-action-heading"><strong>其他动作</strong><UploadPetMedia label={reading?'正在导入动作…':'添加动作'} disabled={disabled||draft.actions.length>=petActionLimit} onFile={addAction}/></div>
   {extra.map((action:any,index:number)=><div className="bx-pet-action-row" key={action.id}>
    <input aria-label={'动作 '+(index+1)+' 名称'} value={action.name} maxLength={20} disabled={disabled} onChange={event=>{
     const name=event.target.value
     setDraft({...draft,actions:draft.actions.map((item:any)=>item.id===action.id?{...item,name}:item)})
    }}/>
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={()=>play(action)}>预览</Button>
    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={()=>{stopPreview.current?.();setDraft({...draft,actions:draft.actions.filter((item:any)=>item.id!==action.id)})}}>移除</Button>
   </div>)}
  </div>
  <div className="bx-pet-options">
   <label>名称<input aria-label="宠物名称" maxLength={20} value={draft.name} disabled={disabled} required onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
   <label>大小<RangeControl label="宠物大小" min={64} max={240} unit="px" value={draft.size} disabled={disabled} onChange={value=>setDraft({...draft,size:value})}/></label>
   {[['right','距右侧'],['bottom','距底部']].map(([key,label])=><label key={key}>{label}<NumberControl label={'宠物'+label} min={0} max={10000} unit="px" value={draft[key]} disabled={disabled} onChange={value=>setDraft({...draft,[key]:value})}/></label>)}
  </div>
  <div className="bx-pet-action-heading">
   <Button type="button" variant="ghost" size="sm" disabled={disabled||dirty} onClick={()=>void onRemove()}>移除宠物</Button>
   <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={()=>setDraft({...draft,right:petPlacement.right,bottom:petPlacement.bottom})}>恢复默认位置</Button>
   {dirty&&<div className="bx-pet-card-controls"><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={()=>{setDraft(pet);setError('')}}>取消</Button><Button type="submit" size="sm" disabled={disabled}>保存修改</Button></div>}
  </div>
  {error&&<p className="bx-gui-notice" role="alert">{error}</p>}
 </form>
}

export function PointerEffects({runtime}:any){
 const store=runtime.decorations,state=useSyncExternalStore(useMemo(()=>(fn:()=>void)=>store.subscribe(fn),[store]),()=>store.getSnapshot()),[error,setError]=useState('')
 if(!state.ready)return null
 const change=async(patch:any)=>{try{setError('');await store.save({...state.value,effects:{...state.value.effects,...patch}})}catch(cause:any){setError(cause.message)}}
 return <section className="bx-decoration-section"><header><h3>指针动效</h3></header><div className="bx-gui-field-row"><label>点击涟漪</label><Switch label="点击涟漪" checked={state.value.effects.click} disabled={state.busy} onChange={(value:boolean)=>void change({click:value})}/></div><div className="bx-gui-field-row"><label>移动拖尾</label><Switch label="移动拖尾" checked={state.value.effects.trail} disabled={state.busy} onChange={(value:boolean)=>void change({trail:value})}/></div><div className="bx-gui-field-row"><label htmlFor="bx-effect-color">动效颜色</label><input id="bx-effect-color" aria-label="动效颜色" type="color" value={state.value.effects.color} disabled={state.busy} onChange={event=>void change({color:event.target.value})}/></div>{error&&<p className="bx-gui-notice" role="alert">{error}</p>}</section>
}
