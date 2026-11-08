/** Early presentation only: never changes the native boot gate or execution state. */
export const defaultOpening={enabled:false,duration:3000}
export function normalizeOpening(raw){
 if(!raw||typeof raw.enabled!=='boolean'||![0,800,1600,1000,2000,3000,5000].includes(raw.duration))throw Error('启动动画设置无效')
 const result={enabled:raw.enabled,duration:({0:1000,800:1000,1600:2000})[raw.duration]??raw.duration}
 if(raw.media){const media=raw.media,extension=media.kind==='video'?'mp4':media.kind==='image'?'gif':null;if(!extension||typeof media.src!=='string'||!new RegExp('^/dsh-web-gui/media/[a-f\\d]{64}\\.'+extension+'$').test(media.src)||!['cover','contain'].includes(media.fit))throw Error('启动素材无效，请重新上传本机 MP4 或 GIF');result.media={kind:media.kind,src:media.src,name:String(media.name??'启动素材').slice(0,120),fit:media.fit}}
 return result
}
/** Self contained so the Host can contribute the same implementation before client mounting. */
export function mountOpening(env,config,preview=false){
 const doc=env.document;if(!doc?.body||!config.enabled)return
 env.__DSH_WEB_GUI_OPENING__?.stop()
 let done=false,ready=preview,timer,minimum,observer,media,presentationStarted=false
 const previousFocus=doc.activeElement,layer=doc.createElement('div'),style=doc.createElement('style'),start=Date.now()
 layer.id='dsh-gui-opening';layer.setAttribute('role','status');layer.setAttribute('aria-label','DSH 启动动画')
 layer.innerHTML='<div><strong>deepseek <small>HARNESS</small></strong><p>正在准备界面</p><button type="button">跳过</button></div>'
 style.textContent='#dsh-gui-opening{position:fixed;inset:0;z-index:2147480000;display:grid;place-items:center;background:#f8f9fc;color:#242936;font:14px/1.5 system-ui,sans-serif}#dsh-gui-opening>div{text-align:center}#dsh-gui-opening strong{font-size:32px;font-weight:650;letter-spacing:-.6px}#dsh-gui-opening small{font-size:12px;letter-spacing:1px;border:1px solid currentColor;padding:3px 5px;border-radius:3px;vertical-align:middle}#dsh-gui-opening p{margin:20px 0;color:#667085}#dsh-gui-opening button{font:inherit;border:1px solid #c7ccda;border-radius:8px;background:transparent;color:inherit;padding:6px 18px;cursor:pointer}#dsh-gui-opening button:focus-visible{outline:2px solid #6953c5;outline-offset:4px}@media(prefers-color-scheme:dark){#dsh-gui-opening{background:#202027;color:#f2eff8}#dsh-gui-opening p{color:#bbb4c9}}'
 if(config.media){media=doc.createElement(config.media.kind==='video'?'video':'img');media.setAttribute('aria-hidden','true');media.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:'+config.media.fit+';pointer-events:none';media.src=config.media.src;if(config.media.kind==='video'){media.muted=true;media.playsInline=true;media.autoplay=true;media.loop=true;media.preload='auto'}layer.prepend(media);layer.querySelector('div').style.cssText='position:relative;z-index:1';layer.querySelector('strong').hidden=true;layer.querySelector('p').hidden=true;style.textContent+='#dsh-gui-opening{background:#080d18}#dsh-gui-opening>div{position:absolute!important;inset:auto 24px 24px auto}#dsh-gui-opening button{color:white;background:rgba(8,13,24,.8);border-color:rgba(255,255,255,.6)}'}
 function stop(){if(done)return;done=true;clearTimeout(timer);clearTimeout(minimum);observer?.disconnect();doc.removeEventListener('keydown',key,true);env.removeEventListener('error',fail);env.removeEventListener('unhandledrejection',fail);media?.pause?.();media?.removeAttribute('src');if(media?.tagName==='VIDEO')media.load();layer.remove();style.remove();if(previousFocus?.isConnected)previousFocus.focus?.();if(env.__DSH_WEB_GUI_OPENING__===api)delete env.__DSH_WEB_GUI_OPENING__}
 function begin(){if(done||presentationStarted)return;presentationStarted=true;minimum=setTimeout(stop,config.duration)}
 function key(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();stop()}}
 function fail(){stop()}
 const api={stop,ready:stop}
 env.__DSH_WEB_GUI_OPENING__=api
 layer.querySelector('button').addEventListener('click',stop);doc.addEventListener('keydown',key,true);env.addEventListener('error',fail);env.addEventListener('unhandledrejection',fail)
 doc.head.append(style);doc.body.append(layer);layer.querySelector('button').focus()
 if(!env.matchMedia?.('(prefers-reduced-motion: reduce)').matches)layer.querySelector('strong').animate?.([{opacity:.6,filter:'blur(3px)'},{opacity:1,filter:'blur(0px)'}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'})
 timer=setTimeout(stop,8000)
 if(media){media.addEventListener('error',fail);if(config.media.kind==='video'){media.addEventListener('playing',begin,{once:true});void media.play().catch(fail)}else{media.addEventListener('load',begin,{once:true});if(media.complete&&media.naturalWidth)begin()}if(env.matchMedia?.('(prefers-reduced-motion: reduce)').matches)stop()}else begin()

 return api
}
export function openingInjection(config){return {kind:'script',placement:'body',text:`;(${mountOpening.toString()})(globalThis,${JSON.stringify(normalizeOpening(config))});`}}
