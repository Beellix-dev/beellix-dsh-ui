import {playPetAction} from './settings-pet-motion.mjs'
import {activePet} from './settings-personalization.mjs'
/** Owned, disposable presentation layers. No external plugin or engine runtime. */
export function createDecorationLayer(store,env=globalThis){
 let pet,menu,menuEvents,canvas,paint,frame,points=[],off,drag,dragMoved=false,positionPending=false,stopAction,disposed=false,value
 const reduced=env.matchMedia('(prefers-reduced-motion: reduce)')
 const doc=env.document,style=doc.createElement('style')
 style.textContent=`
 [data-dshgui-pet]{position:fixed;z-index:50;display:grid;place-items:center;border:0;padding:0;background:none;cursor:grab;touch-action:none;border-radius:16px}
 [data-dshgui-pet][data-dragging]{cursor:grabbing}
 [data-dshgui-pet]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:4px}
 [data-dshgui-pet] img{width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;transform-origin:50% 82%}
 [data-dshgui-pet] img[data-pet-action-clip]{position:absolute;inset:0}
 [data-dshgui-pet] img[data-pet-action-hidden]{visibility:hidden}
 [data-dshgui-pet]:has(img[data-pet-action-loading])::after{content:'正在加载动作…';position:absolute;top:0;left:50%;transform:translateX(-50%);padding:4px 7px;border-radius:6px;white-space:nowrap;font-size:11px;background:var(--dsw-alias-bg-base,Canvas);color:var(--dsw-alias-label-primary,CanvasText)}
 [data-dshgui-pet-menu]{position:fixed;z-index:80;min-width:164px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;display:grid;gap:2px;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base,Canvas);color:var(--dsw-alias-label-primary,CanvasText);box-shadow:0 8px 28px #0003;-webkit-app-region:no-drag}
 [data-dshgui-pet-menu] button{display:block;width:100%;border:0;border-radius:6px;padding:7px 10px;text-align:left;overflow-wrap:anywhere;font:inherit;background:transparent;color:inherit;cursor:pointer}
 [data-dshgui-pet-menu] button:is(:hover,:focus-visible){background:color-mix(in srgb,currentColor 9%,transparent)}
 [data-dshgui-pet-menu] button[aria-disabled=true]{opacity:.5;cursor:default}
 [data-dshgui-pet]:not([data-pet-ready]){visibility:hidden}`
 doc.head.append(style)
 const stop=()=>{if(frame)env.cancelAnimationFrame(frame);frame=undefined;points=[];paint?.clearRect(0,0,canvas.width,canvas.height)}
 const draw=now=>{frame=undefined;if(disposed||reduced.matches||doc.hidden){stop();return}const ratio=Math.min(env.devicePixelRatio||1,2);paint.setTransform(ratio,0,0,ratio,0,0);paint.clearRect(0,0,env.innerWidth,env.innerHeight);points=points.filter(point=>now-point.at<point.life);for(const point of points){const progress=(now-point.at)/point.life;paint.globalAlpha=(1-progress)*.55;paint.strokeStyle=value.effects.color;paint.fillStyle=value.effects.color;if(point.ring){paint.lineWidth=1.4;paint.beginPath();paint.arc(point.x,point.y,4+progress*22,0,Math.PI*2);paint.stroke()}else{paint.beginPath();paint.arc(point.x,point.y,Math.max(.4,3*(1-progress)),0,Math.PI*2);paint.fill()}}paint.globalAlpha=1;if(points.length)frame=env.requestAnimationFrame(draw)}
 const add=(event,ring)=>{if(!value||reduced.matches||doc.hidden||(ring?!value.effects.click:!value.effects.trail)||event.pointerType==='touch')return;if(!canvas){canvas=doc.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.dataset.dshguiEffects='';Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1400'});doc.body.append(canvas);paint=canvas.getContext('2d');resize()}points.push({x:event.clientX,y:event.clientY,at:env.performance.now(),ring,life:ring?550:300});if(points.length>45)points.shift();if(!frame)frame=env.requestAnimationFrame(draw)}
 const resize=()=>{if(!canvas)return;const ratio=Math.min(env.devicePixelRatio||1,2);canvas.width=Math.round(env.innerWidth*ratio);canvas.height=Math.round(env.innerHeight*ratio)}
 const position=(right,bottom)=>{
  const size=activePet(value.petLibrary).size
  pet.style.right=Math.max(0,Math.min(right,env.innerWidth-size))+'px'
  pet.style.bottom=Math.max(0,Math.min(bottom,env.innerHeight-size))+'px'
 }
 const cancelAction=()=>{stopAction?.();stopAction=undefined}
 const closeMenu=(focus=false)=>{
  if(!menu)return
  menuEvents.abort()
  menu.remove()
  menu=menuEvents=undefined
  pet?.setAttribute('aria-expanded','false')
  if(focus)pet?.focus({preventScroll:true})
 }
 const runAction=action=>{
  cancelAction()
  stopAction=playPetAction(pet.firstElementChild,action,env,error=>{pet.title=error})
 }
 const openMenu=(x,y)=>{
  closeMenu()
  const config=activePet(value.petLibrary)
  const actions=config.actions.filter(({id})=>id!==config.defaultActionId)
  if(!actions.length)return
  menu=doc.createElement('div')
  menu.dataset.dshguiPetMenu=''
  menu.setAttribute('role','menu')
  menu.setAttribute('aria-label','宠物动作')
  const buttons=actions.map(action=>{
   const button=doc.createElement('button')
   button.type='button'
   button.tabIndex=-1
   button.setAttribute('role','menuitem')
   button.textContent=action.name
   if(reduced.matches){button.setAttribute('aria-disabled','true');button.title='系统已开启减少动态效果'}
   button.onclick=()=>{if(!reduced.matches){closeMenu(true);runAction(action)}}
   return button
  })
  menu.append(...buttons)
  doc.body.append(menu)
  menu.style.left=Math.max(8,Math.min(x,env.innerWidth-menu.offsetWidth-8))+'px'
  menu.style.top=Math.max(8,Math.min(y,env.innerHeight-menu.offsetHeight-8))+'px'
  pet.setAttribute('aria-expanded','true')
  buttons[0].focus({preventScroll:true})
  menuEvents=new AbortController()
  const signal=menuEvents.signal
  doc.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))closeMenu()},{capture:true,signal})
  doc.addEventListener('keydown',event=>{
   if(event.key==='Escape'||event.key==='Tab'){
    event.preventDefault()
    event.stopImmediatePropagation()
    closeMenu(true)
    return
   }
   const index=buttons.indexOf(doc.activeElement)
   const next={ArrowDown:(index+1)%buttons.length,ArrowUp:(index+buttons.length-1)%buttons.length,Home:0,End:buttons.length-1}[event.key]
   if(!Number.isInteger(next))return
   event.preventDefault()
   event.stopImmediatePropagation()
   buttons[next].focus()
  },{capture:true,signal})
 }
 const removePet=()=>{closeMenu();cancelAction();drag=undefined;dragMoved=false;pet?.remove();pet=undefined}
 const savePosition=async()=>{
  const latest=store.getSnapshot().value
  const right=Math.round(parseFloat(pet.style.right)),bottom=Math.round(parseFloat(pet.style.bottom))
  positionPending=true
  const library=latest.petLibrary
  const entries=library.entries.map(entry=>entry.id===library.activeId?{...entry,right,bottom}:entry)
  try{await store.save({...latest,petLibrary:{...library,entries}})}
  catch{/* Keep the last saved placement if the write is rejected. */}
  finally{positionPending=false;sync()}
 }
 const mountPet=()=>{
  pet=doc.createElement('button')
  pet.type='button'
  pet.dataset.dshguiPet=''
  pet.setAttribute('aria-expanded','false')
  const image=doc.createElement('img')
  image.alt=''
  image.draggable=false
  image.addEventListener('load',()=>image.parentElement?.setAttribute('data-pet-ready',''))
  pet.append(image)
  doc.body.append(pet)
  pet.addEventListener('pointerdown',event=>{
   if(event.button!==0||drag||positionPending)return
   dragMoved=false
   drag={id:event.pointerId,x:event.clientX,y:event.clientY,right:parseFloat(pet.style.right),bottom:parseFloat(pet.style.bottom)}
   pet.setPointerCapture(event.pointerId)
  })
  pet.addEventListener('pointermove',event=>{
   if(drag?.id!==event.pointerId)return
   const dx=event.clientX-drag.x,dy=event.clientY-drag.y
   if(!dragMoved){
    if(Math.abs(dx)+Math.abs(dy)<=4)return
    dragMoved=true
    cancelAction()
    pet.dataset.dragging=''
   }
   position(drag.right-dx,drag.bottom-dy)
  })
  pet.addEventListener('pointerup',event=>{
   if(drag?.id!==event.pointerId)return
   drag=undefined
   pet.removeAttribute('data-dragging')
   if(dragMoved)void savePosition()
  })
  const cancelDrag=event=>{
   if(drag?.id!==event.pointerId)return
   drag=undefined
   pet.removeAttribute('data-dragging')
   sync()
  }
  pet.addEventListener('pointercancel',cancelDrag)
  pet.addEventListener('lostpointercapture',cancelDrag)
  pet.addEventListener('contextmenu',event=>{
   event.preventDefault()
   event.stopPropagation()
   if(drag)return
   const rect=pet.getBoundingClientRect()
   openMenu(event.button===2?event.clientX:rect.left,event.button===2?event.clientY:rect.bottom)
  })
  pet.addEventListener('keydown',event=>{
   if(event.key!=='ContextMenu'&&!(event.shiftKey&&event.key==='F10'))return
   event.preventDefault()
   event.stopPropagation()
   const rect=pet.getBoundingClientRect()
   openMenu(rect.left,rect.bottom)
  })
 }
 const sync=()=>{
  if(disposed)return
  const state=store.getSnapshot()
  if(!state.ready)return
  const previous=value&&activePet(value.petLibrary)
  value=state.value
  if(!value.effects.click&&!value.effects.trail){stop();canvas?.remove();canvas=undefined;paint=undefined}
  const config=activePet(value.petLibrary)
  const idle=config?.actions.find(({id})=>id===config.defaultActionId)
  if(!value.petLibrary.enabled||!idle){removePet();return}
  if(previous?.id!==config.id)removePet()
  if(!pet||idle.image!==previous?.actions.find(({id})=>id===previous.defaultActionId)?.image){
   if(!pet)mountPet()
   closeMenu()
   cancelAction()
   pet.removeAttribute('data-pet-ready')
   pet.firstElementChild.src=idle.image.startsWith('/')?idle.image+'?pet-idle=1':idle.image
  }
  const hasActions=config.actions.length>1
  if(hasActions)pet.setAttribute('aria-haspopup','menu')
  else{closeMenu();pet.removeAttribute('aria-haspopup')}
  const hint=hasActions?'右键选择动作，可拖动':'可拖动'
  pet.setAttribute('aria-label',(config.name||'桌面宠物')+'，'+hint)
  pet.title=(config.name||'桌面宠物')+' · '+hint
  Object.assign(pet.style,{width:config.size+'px',height:config.size+'px'})
  if(!drag&&!positionPending)position(config.right,config.bottom)
 }
 const move=event=>add(event,false),click=event=>add(event,true)
 const resizeLayers=()=>{closeMenu();resize();if(pet&&!drag&&!positionPending){const {right,bottom}=activePet(value.petLibrary);position(right,bottom)}}
 const visibility=()=>{if(doc.hidden){closeMenu();stop();cancelAction()}}
 const media=()=>{closeMenu();if(reduced.matches){stop();cancelAction()}}
 off=store.subscribe(sync);sync();doc.addEventListener('pointermove',move,{passive:true});doc.addEventListener('pointerdown',click,{passive:true});doc.addEventListener('visibilitychange',visibility);env.addEventListener('resize',resizeLayers);reduced.addEventListener('change',media)
 return {dispose(){disposed=true;off();stop();removePet();canvas?.remove();style.remove();doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerdown',click);doc.removeEventListener('visibilitychange',visibility);env.removeEventListener('resize',resizeLayers);reduced.removeEventListener('change',media)}}
}
