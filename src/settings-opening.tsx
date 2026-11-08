import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import {Button,Switch} from '@deepseek-ai/dsh-client-ui-primitives'
import {defaultOpening,normalizeOpening,mountOpening} from './opening.mjs'
import {uploadOpeningMedia} from './settings-media'
export function OpeningSettings({runtime}:any){
 const form=useMemo(()=>runtime.ctx.configForms.get('dsh-web-gui'),[runtime]),view=useSyncExternalStore(useMemo(()=>(fn:()=>void)=>form.subscribe(fn),[form]),()=>form.getSnapshot()),[busy,setBusy]=useState(false),[error,setError]=useState(''),upload=useRef<AbortController|null>(null),generation=useRef(0)
 useEffect(()=>()=>{++generation.current;upload.current?.abort();globalThis.__DSH_WEB_GUI_OPENING__?.stop()},[])
 let config=defaultOpening;try{config=normalizeOpening(JSON.parse(view.value?.opening??JSON.stringify(defaultOpening)))}catch{}
 const save=async(patch:any)=>{if(busy||view.status!=='ready'||!view.writable)return;setBusy(true);setError('');try{const value=normalizeOpening({...config,...patch});if(!await form.mutate([{op:'set',path:['opening'],value:JSON.stringify(value)}],view.revision))throw Error('启动动画未保存，请重试')}catch(cause:any){setError(cause.message)}finally{setBusy(false)}}
 const read=async(file:File|undefined)=>{if(!file||busy)return;const token=++generation.current,before=form.getSnapshot(),controller=new AbortController();upload.current=controller;setBusy(true);setError('');const timeout=setTimeout(()=>controller.abort(),60000)
  try{const media=await uploadOpeningMedia(file,controller.signal);if(token!==generation.current)return;const current=form.getSnapshot();if(current.value?.opening!==before.value?.opening)throw Error('启动配置已在其他位置变化，请重新上传');const value=normalizeOpening({...config,media});if(!await form.mutate([{op:'set',path:['opening'],value:JSON.stringify(value)}],current.revision))throw Error('素材未保存，请重试')}
  catch(cause:any){if(token===generation.current)setError(cause.name==='AbortError'?'素材上传已取消，请重试':cause.message)}finally{clearTimeout(timeout);if(token===generation.current){upload.current=null;setBusy(false)}}
 }
 const unavailable=busy||view.status!=='ready'||!view.writable
 return <section className="bx-opening-settings">
  <div className="bx-gui-field-row"><div><label>启动动画</label><p>下次启动生效，可随时跳过。</p></div><Switch label="启动动画" checked={config.enabled} disabled={unavailable} onChange={(enabled:boolean)=>void save({enabled})}/></div>
  <div className="bx-gui-field-row"><div><label>启动素材</label><p>{config.media?.name||'当前使用内置开场'} · MP4 / GIF</p></div><div className="bx-opening-actions"><label className="bx-skin-file">{busy?'正在处理…':'上传素材'}<input type="file" aria-label="上传启动素材" accept="video/mp4,image/gif,.mp4,.gif" disabled={unavailable} onChange={event=>{void read(event.target.files?.[0]);event.target.value=''}}/></label>{config.media&&<Button variant="ghost" size="sm" disabled={unavailable} onClick={()=>void save({media:null})}>移除</Button>}</div></div>
  <div className="bx-gui-field-row"><div><label htmlFor="gui-opening-duration">播放时长</label></div><select id="gui-opening-duration" aria-label="播放时长" value={config.duration} disabled={unavailable} onChange={event=>void save({duration:Number(event.target.value)})}><option value="1000">1 秒</option><option value="2000">2 秒</option><option value="3000">3 秒</option><option value="5000">5 秒</option></select></div>
  <div className={'bx-opening-preview'+(config.media?' bx-opening-custom':'')}>
   {config.media?(config.media.kind==='video'?<video src={config.media.src} muted playsInline preload="metadata" aria-label="启动视频缩略预览"/>:<img src={config.media.src} alt="启动动图预览"/>):<strong>deepseek <small>HARNESS</small></strong>}
   <Button variant="outline" size="sm" disabled={busy} onClick={()=>mountOpening(globalThis,{...config,enabled:true},true)}>预览启动动画</Button>
  </div>{error&&<p role="alert" className="bx-gui-notice">{error}</p>}
 </section>
}
