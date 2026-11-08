import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import {Button} from '@deepseek-ai/dsh-client-ui-primitives'
import {RangeControl} from './settings-controls'
import {skinFields,skinPresets,wallpaperAreas,selectTheme,selectWallpaper,selectBuiltinSkin,backgroundStrengthLimit,defaultSkin,normalizeSkin} from './settings-skin.mjs'
import {builtinWallpapers} from './settings-skin-assets.mjs'
const useSource=(source:any)=>useSyncExternalStore(useMemo(()=>(fn:()=>void)=>source.subscribe(fn),[source]),useMemo(()=>()=>source.getSnapshot(),[source]))

async function importVideo(file:File,controllerRef:any){
 if(file.type!=='video/mp4'||!file.name.toLowerCase().endsWith('.mp4')||file.size>100*1024*1024)throw Error('请选择 100 MB 以内的 MP4 视频')
 const url=URL.createObjectURL(file),video=document.createElement('video')
 try{await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('视频读取超时，请换一个文件')),10000);video.onloadeddata=()=>{clearTimeout(timer);resolve()};video.onerror=()=>{clearTimeout(timer);reject(Error('视频无法解码，请使用 H.264 编码的 MP4'))};video.muted=true;video.preload='auto';video.src=url})}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url)}
 controllerRef.current?.abort();const controller=new AbortController();controllerRef.current=controller;const timer=setTimeout(()=>controller.abort(),60000)
 try{const response=await fetch('/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':'video/mp4'},body:file,credentials:'same-origin',signal:controller.signal});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error??'视频导入失败');if(!/^\/dsh-web-gui\/media\/[a-f\d]{64}\.mp4$/.test(result.url))throw Error('素材接口返回无效位置');return result.url}finally{clearTimeout(timer);if(controllerRef.current===controller)controllerRef.current=null}
}

export async function readBackground(file:File){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('请选择 8 MB 以内的 PNG、JPG 或 WebP 图片')
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer()),signature=String.fromCharCode(...bytes)
 if(!(signature.startsWith('\x89PNG\r\n\x1a\n')||bytes[0]===255&&bytes[1]===216&&bytes[2]===255||signature.startsWith('RIFF')&&signature.slice(8)==='WEBP'))throw Error('图片内容与支持格式不符')
 const bitmap=await createImageBitmap(file)
 try{if(bitmap.width*bitmap.height>40000000)throw Error('图片尺寸过大，请缩小后重试');const scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/webp',.82);if(data.length>2.8*1024*1024)throw Error('处理后图片仍过大，请使用较小图片');return data}finally{bitmap.close()}
}

export function SkinSettings({runtime,section='appearance'}:{runtime:any;section?:string}){
 const store=runtime.skin,state=useSource(store),skin=state.skin,themeForm=runtime.ctx.configForms.get('ui-theme'),modeView=useSource(themeForm)
 const [editingMode,setEditingMode]=useState('light'),[error,setError]=useState(''),[message,setMessage]=useState(''),[reading,setReading]=useState(false),[libraryTab,setLibraryTab]=useState('builtins'),[savingCopy,setSavingCopy]=useState(false),[copyName,setCopyName]=useState('')
 const generation=useRef(0),uploadController=useRef<AbortController|null>(null)
 useEffect(()=>()=>{++generation.current;uploadController.current?.abort()},[store])
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),1800);return()=>clearTimeout(timer)},[message])
 const update=(next:any)=>{try{setError('');store.update(next)}catch(cause:any){setError(cause.message)}}
 const changeMode=async(value:string)=>{try{const current=themeForm.getSnapshot();if(current.status!=='ready'||!current.writable)throw Error('显示模式当前不可修改');if(!await themeForm.mutate([{op:'set',path:['preference'],value}],current.revision))throw Error('显示模式未保存，请重试')}catch(cause:any){setError(cause.message)}}
 const read=async(file:File|undefined,kind:string)=>{if(!file)return;const token=++generation.current;setReading(true);setError('')
  try{
   let next
   if(kind==='skin'){
    if(file.size>4*1024*1024)throw Error('方案不得超过 4 MB')
    next=normalizeSkin(JSON.parse(await file.text()))
   }else{
    const background={...defaultSkin.background,name:file.name,fit:skin.background.fit,areas:skin.background.areas,
     strength:skin.background.data||skin.background.pattern?skin.background.strength:100}
    const media=kind==='video'
     ?{kind:'video',data:await importVideo(file,uploadController),paused:false}
     :{data:await readBackground(file)}
    next={...skin,name:file.name.replace(/\.[^.]+$/,''),panels:{...(skin.panels??{style:'frosted',opacity:72}),immersive:true},background:{...background,...media}}
   }
   if(token!==generation.current)return
   await store.importSaved(next);setLibraryTab('mine');setMessage('已添加到我的皮肤')
  }
  catch(cause:any){if(token===generation.current)setError(cause.message)}finally{if(token===generation.current)setReading(false)}
 }
 const exportSkin=()=>{const blob=new Blob([JSON.stringify(normalizeSkin(skin),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='dsh-web-gui-skin.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 if(!state.ready)return <p className="bx-gui-empty">{state.error||'正在读取外观配置…'}</p>
 const themePage=section==='appearance'||section==='surfaces'
 const rows=libraryTab==='builtins'?builtinWallpapers.map(row=>({...row,skin:selectBuiltinSkin(skin,row)})):state.library.map((row:any)=>({...row,name:row.skin.name}))
 const selectedId=rows.find((row:any)=>JSON.stringify(normalizeSkin({...row.skin,background:{...row.skin.background,areas:skin.background.areas}}))===JSON.stringify(normalizeSkin(skin)))?.id
 const panels=skin.panels??{style:'solid',opacity:100}
 const previewColor=(theme:any,key:string)=>`light-dark(${theme.light[key]}, ${theme.dark[key]})`
 return <section className="bx-skin-settings">
 {themePage&&<>
  <div className="bx-skin-display"><span>显示模式</span><div className="bx-gui-tabs" role="group" aria-label="显示模式">{[['light','浅色'],['dark','深色'],['system','跟随系统']].map(([value,label])=><button key={value} aria-pressed={modeView.value?.preference===value} onClick={()=>void changeMode(value)}>{label}</button>)}</div></div>
  <div className="bx-skin-library">{skinPresets.map(theme=><article key={theme.id} className="bx-skin-choice" data-selected={skin.preset===theme.id||undefined}><button type="button" aria-label={theme.name} aria-pressed={skin.preset===theme.id} disabled={state.busy||reading} onClick={()=>update(selectTheme(skin,theme))}><span className="bx-skin-thumbnail" style={{background:previewColor(theme,'surface')}}><i style={{background:previewColor(theme,'sidebar')}}/><span><b style={{background:previewColor(theme,'card')}}/><em style={{background:previewColor(theme,'button')}}/></span></span><strong>{theme.name}</strong></button></article>)}</div>
  <details className="bx-skin-detail"><summary>自定义配色</summary>
  <div className="bx-gui-tabs" role="group" aria-label="编辑配色模式">{[['light','浅色配色'],['dark','深色配色']].map(([value,label])=><button key={value} aria-pressed={editingMode===value} onClick={()=>setEditingMode(value)}>{label}</button>)}</div>
  <div className="bx-skin-colors">{skinFields.map(([key,label]:string[])=><label key={key}><span>{label}</span><input type="color" aria-label={label+'色彩'} value={skin[editingMode][key]} onChange={event=>update({...skin,preset:'custom',[editingMode]:{...skin[editingMode],[key]:event.target.value}})}/><code>{skin[editingMode][key]}</code></label>)}</div>
  <Button variant="ghost" size="sm" onClick={()=>update(selectTheme(skin,skinPresets[0]))}>恢复默认配色</Button>
  </details>
  <details className="bx-skin-detail"><summary>界面材质</summary>
  <div className="bx-skin-panel-controls">
   <div><span>表面样式</span><div className="bx-gui-tabs" role="group" aria-label="面板样式">{[['solid','纯色'],['frosted','磨砂']].map(([value,label])=><button key={value} aria-pressed={panels.style===value} disabled={state.busy||reading} onClick={()=>update({...skin,panels:{...panels,style:value,opacity:skin.panels?.opacity??72}})}>{label}</button>)}</div></div>
   {panels.immersive&&<label><span>左右侧栏透明度</span><RangeControl label="左右侧栏透明度" value={100-panels.sidebarOpacity} disabled={state.busy||reading} onChange={value=>update({...skin,panels:{...panels,sidebarOpacity:100-value}})}/></label>}
   {panels.style==='frosted'&&<>
    <label><span>输入框和设置窗透明度</span><RangeControl label="输入框和设置窗透明度" max={36} value={100-panels.opacity} disabled={state.busy||reading} onChange={value=>update({...skin,panels:{...panels,opacity:100-value}})}/></label>
    <label><span>磨砂模糊</span><RangeControl label="磨砂模糊" max={24} unit="px" value={panels.blur??18} disabled={state.busy||reading} onChange={value=>update({...skin,panels:{...panels,blur:value}})}/></label>
   </>}
  </div>
  </details>
 </>}
 {section==='wallpaper'&&<>
  <div className="bx-skin-heading"><div className="bx-gui-tabs" role="group" aria-label="皮肤来源"><button aria-pressed={libraryTab==='builtins'} onClick={()=>setLibraryTab('builtins')}>内置皮肤</button><button aria-pressed={libraryTab==='mine'} onClick={()=>setLibraryTab('mine')}>我的皮肤</button></div><Button variant="ghost" size="sm" onClick={()=>update(selectWallpaper(skin,defaultSkin.background))}>不使用背景</Button></div>
  {libraryTab==='mine'&&<><div className="bx-skin-library-actions">{[['image','导入图片','image/png,image/jpeg,image/webp'],['video','导入视频','video/mp4,.mp4'],['skin','导入方案','.json,application/json']].map(([kind,label,accept])=><label key={kind} className="bx-skin-file">{label}<input type="file" aria-label={label==='导入图片'?'导入背景图片':label==='导入视频'?'导入背景视频':'导入皮肤方案'} accept={accept} disabled={reading||state.busy} onChange={event=>{void read(event.target.files?.[0],kind);event.target.value=''}}/></label>)}<Button variant="ghost" size="sm" disabled={reading||state.busy} onClick={()=>{setCopyName(skin.background.name||skin.name);setSavingCopy(value=>!value)}}>保存当前方案</Button><Button variant="ghost" size="sm" onClick={exportSkin}>导出</Button></div>{savingCopy&&<form className="bx-skin-name" onSubmit={async event=>{event.preventDefault();const name=copyName.trim();if(!name||name.length>40){setError('请输入 1–40 字的皮肤名称');return}try{await store.importSaved({...skin,name});setSavingCopy(false);setMessage('已保存到我的皮肤')}catch(cause:any){setError(cause.message)}}}><input aria-label="皮肤名称" value={copyName} maxLength={40} onChange={event=>setCopyName(event.target.value)} autoFocus/><Button type="submit" size="sm" disabled={reading||state.busy}>保存副本</Button></form>}<p className="bx-skin-hint">导入后选中预览，再应用。图片 ≤8 MB，MP4 ≤100 MB。</p></>}
  {reading&&<p className="bx-skin-hint" role="status">正在导入素材…</p>}
  <div className="bx-skin-library bx-wallpaper-library">{rows.map((row:any)=>{const target=normalizeSkin({...row.skin,background:{...row.skin.background,areas:skin.background.areas}}),chosen=row.id===selectedId,credit=target.background.attribution;return <article key={row.id} className="bx-skin-choice" data-selected={chosen||undefined}><button type="button" aria-label={row.name} aria-pressed={chosen} disabled={state.busy||reading} onClick={()=>update(target)}><span className="bx-skin-thumbnail">{target.background.kind==='video'?<video src={target.background.data} muted preload="metadata"/>:<img src={row.preview||target.background.data} alt="" loading="lazy"/>}<span className="bx-skin-palette" aria-hidden="true">{['sidebar','card','button'].map(key=><i key={key} style={{background:target.light[key]}}/>)}</span></span><span className="bx-skin-caption"><strong>{row.name}</strong><small>{chosen?(state.dirty?'预览中':'使用中'):row.category|| (target.background.kind==='video'?'视频':'自定义')}</small></span></button>{libraryTab==='mine'&&<Button variant="ghost" size="sm" aria-label={'删除'+row.name} disabled={state.busy||reading} onClick={async()=>{try{await store.removeSaved(row.id)}catch(cause:any){setError(cause.message)}}}>删除</Button>}{credit&&<details className="bx-skin-credit"><summary>来源与许可</summary><a href={credit.source} target="_blank" rel="noreferrer">{credit.author} · {credit.license}</a></details>}</article>})}</div>
  {!rows.length&&<p className="bx-gui-empty">你导入的图片、视频和方案会显示在这里。</p>}
  <fieldset className="bx-wallpaper-areas"><legend>覆盖范围</legend>{wallpaperAreas.map(([id,label])=><label key={id}><input type="checkbox" aria-label={label} checked={skin.background.areas.includes(id)} disabled={state.busy||reading||skin.background.areas.length===1&&skin.background.areas.includes(id)} onChange={event=>update({...skin,background:{...skin.background,areas:event.target.checked?[...skin.background.areas,id]:skin.background.areas.filter((area:string)=>area!==id)}})}/>{label}</label>)}</fieldset>
 <div className="bx-skin-background-options"><label>显示方式<select aria-label="背景显示方式" value={skin.background.fit} disabled={state.busy||reading} onChange={event=>update({...skin,background:{...skin.background,fit:event.target.value}})}><option value="cover">填满</option><option value="contain">完整显示</option></select></label><label>背景强度<RangeControl label="背景强度" max={backgroundStrengthLimit(skin)} value={skin.background.strength} disabled={state.busy||reading} onChange={value=>update({...skin,background:{...skin.background,strength:value}})}/></label></div>
 {panels.immersive&&skin.background.areas.includes('main')&&(skin.background.data||skin.background.pattern)&&<p className="bx-skin-hint">对话页会自动为壁纸加底色，保持文字清晰。</p>}
 </>}
 {(error||state.error)&&<p className="bx-gui-notice" role="alert">{error||state.error}</p>}
 {state.conflicted&&<p className="bx-gui-notice" role="alert">配置已在其他位置变化，请取消预览后重试。</p>}
 {state.dirty&&<footer className="bx-model-footer"><span className="bx-skin-hint">预览尚未应用</span><Button variant="outline" disabled={state.busy||reading} onClick={()=>{store.discard();setError('')}}>取消预览</Button><Button disabled={state.busy||state.conflicted||reading} onClick={async()=>{try{await store.save();setMessage('已应用')}catch(cause:any){setError(cause.message)}}}>{state.busy?'正在保存…':'应用修改'}</Button></footer>}
 {message&&<div className="bx-gui-saved" role="status">{message}</div>}
 </section>
}
