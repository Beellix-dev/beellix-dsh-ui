/** Text over wallpaper follows its local image, independently of the native UI mode. */
const brightness=rgb=>rgb.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0)
export function wallpaperInk(samples){
 const light=samples.reduce((sum,pixel)=>sum+brightness(pixel),0)/Math.max(1,samples.length)
 return (light+.05)/.05>1.05/(light+.05)?{ink:'#17191d',edge:'#ffffff'}:{ink:'#ffffff',edge:'#080b12'}
}
export function createWallpaperContrast(env=globalThis){
 const doc=env.document,owned=new Map(),canvas=doc.createElement('canvas'),paint=canvas.getContext('2d',{willReadFrequently:true})
 const sheet=doc.createElement('style');sheet.dataset.dshguiContrast=''
 sheet.textContent='[data-dshgui-wallpaper-text]{color:var(--dshgui-auto-ink)!important;text-shadow:1px 0 0 var(--dshgui-auto-edge),-1px 0 0 var(--dshgui-auto-edge),0 1px 0 var(--dshgui-auto-edge),0 -1px 0 var(--dshgui-auto-edge)}[data-dshgui-wallpaper-text]::placeholder{color:var(--dshgui-auto-ink)!important;opacity:1;text-shadow:inherit}svg[data-dshgui-wallpaper-text]{filter:drop-shadow(0 1px 1px var(--dshgui-auto-edge))}'
 let skin,image,source='',generation=0,disposed=false,timer,videoTimer
 const clear=()=>{for(const [node,old] of owned){node.removeAttribute('data-dshgui-wallpaper-text');for(const [key,value] of old)if(value)node.style.setProperty(key,value);else node.style.removeProperty(key)}owned.clear()}
 const schedule=()=>{if(disposed||timer)return;timer=env.setTimeout(()=>{timer=undefined;sample()},100)}
 const sample=()=>{
  if(disposed||!skin||!paint)return
  const frame=doc.querySelector('body :has(> [data-shell-overlay]):has(> [data-shell-bottom])')
  const media=skin.background.kind==='video'?doc.querySelector('video[data-dshgui-video]'):image
  const width=media?.naturalWidth||media?.videoWidth,height=media?.naturalHeight||media?.videoHeight
  if(!frame||!width||!height)return
  clear()
  const area=frame.getBoundingClientRect();if(!area.width||!area.height)return
  canvas.width=320;canvas.height=Math.max(1,Math.round(320*area.height/area.width))
  const mode=env.getComputedStyle(doc.documentElement).colorScheme==='dark'?'dark':'light',palette=skin[mode]
  paint.fillStyle=palette.surface;paint.fillRect(0,0,canvas.width,canvas.height)
  const scale=skin.background.fit==='contain'?Math.min(canvas.width/width,canvas.height/height):Math.max(canvas.width/width,canvas.height/height)
  try{paint.drawImage(media,(canvas.width-width*scale)/2,(canvas.height-height*scale)/2,width*scale,height*scale)}catch{return}
  const frameStyle=env.getComputedStyle(frame)
  const canvasTint=frameStyle.getPropertyValue('--dshgui-canvas-tint').match(/[\d.]+/g)?.map(Number)
  const blend=(pixel,tint)=>tint?.length===4?tint.slice(0,3).map((channel,index)=>channel*tint[3]+pixel[index]*(1-tint[3])):pixel
  for(const [id,selector] of [['sidebar','[data-slot="sidebar"]'],['rightbar','[data-sidebar-right-panel][data-sidebar-right-open]'],['main','[data-composer-seat]'],['main','[data-slot="main"] > :not([data-slot="main.conversation"])'],['main','[data-sidebar-right-expand]'],['caption','[data-windows-menu]']]){
   if(id!=='caption'&&!skin.background.areas.includes(id))continue
   const root=(id==='caption'?doc:frame).querySelector(selector);if(!root)continue
   if(id==='main'&&canvasTint)continue // The chat canvas already guarantees theme text contrast.
   if(canvasTint&&skin.panels.style==='frosted'&&(id==='sidebar'||id==='rightbar'))continue
   const mask=id==='main'?'main':id==='rightbar'?'panel':'sidebar'
   const zoneTint=frameStyle.getPropertyValue(`--dshgui-wallpaper-${mask}-mask`).match(/[\d.]+/g)?.map(Number)
   const walker=doc.createTreeWalker(root,4),nodes=new Set();let text
   if(id==='caption')nodes.add(root)
   for(const input of root.querySelectorAll('input[placeholder],textarea[placeholder]'))if(!input.closest('[data-composer-card]'))nodes.add(input)
   while(text=walker.nextNode()){const node=text.parentElement;if(text.textContent.trim()&&node&&!node.closest('svg,pre,code,textarea,script,style,[contenteditable],[data-composer-card]'))nodes.add(node)}
   for(const svg of root.querySelectorAll('svg')){const rgb=env.getComputedStyle(svg).color.match(/[\d.]+/g)?.slice(0,3).map(Number),fills=new Set([...svg.querySelectorAll('path,rect,circle,text')].map(n=>env.getComputedStyle(n).fill).filter(fill=>fill!=='none'));if(rgb&&fills.size<=1&&Math.max(...rgb)-Math.min(...rgb)<28&&!svg.closest('[data-composer-card]'))nodes.add(svg)}
   const nativeInks=new Map([...nodes].map(node=>[node,env.getComputedStyle(node).color]))
   for(const node of nodes){
    const box=node.getBoundingClientRect();if(box.width<1||box.height<1)continue
    // Buttons, cards, menus and document panes with a protective fill keep native theme text.
    let opaque=false
    for(let parent=node;parent&&parent!==root.parentElement;parent=parent.parentElement){const bg=env.getComputedStyle(parent).backgroundColor.match(/[\d.]+/g);if(bg&&bg.length>=3&&(bg.length===3||Number(bg[3])>=.3)){opaque=true;break}}
    const pixels=[]
    if(!opaque)try{for(const fraction of [.2,.5,.8]){const x=Math.max(0,Math.min(canvas.width-1,Math.round((box.left+box.width*fraction-area.left)/area.width*canvas.width))),y=Math.max(0,Math.min(canvas.height-1,Math.round((box.top+box.height/2-area.top)/area.height*canvas.height)));const [red,green,blue]=paint.getImageData(x,y,1,1).data;pixels.push(blend(blend([red,green,blue],canvasTint),zoneTint))}}catch{continue}
    const choice=opaque?{ink:nativeInks.get(node),edge:'transparent'}:wallpaperInk(pixels),keys=['--dshgui-auto-ink','--dshgui-auto-edge',...(id==='caption'?['--dsw-alias-label-primary','--dsw-alias-label-secondary']:[])]
    owned.set(node,keys.map(key=>[key,node.style.getPropertyValue(key)]))
    node.style.setProperty(keys[0],choice.ink);node.style.setProperty(keys[1],choice.edge);node.setAttribute('data-dshgui-wallpaper-text','')
    if(id==='caption')for(const key of keys.slice(2))node.style.setProperty(key,choice.ink)
   }
  }
 }
 const changes=new env.MutationObserver(records=>{if(!owned.size||records.some(record=>{const node=record.target.nodeType===1?record.target:record.target.parentElement;return node?.closest('[data-slot="sidebar"],[data-sidebar-right-panel],[data-composer-seat]')||node?.closest('[data-slot="main"]')&&!node?.closest('[data-slot="main.conversation"]')}))schedule()});changes.observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-sidebar-right-open']})
 const modeChanges=new env.MutationObserver(schedule);modeChanges.observe(doc.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']})
 env.addEventListener('resize',schedule)
 doc.addEventListener('loadeddata',schedule,true)
 return {
  render(next){
   skin=next;const token=++generation;clear();env.clearInterval(videoTimer);videoTimer=undefined
   if(!next.panels?.immersive||!next.background.data){source='';image=undefined;sheet.remove();return}
   if(!sheet.isConnected)doc.head.append(sheet)
   if(next.background.kind==='video'){source='';image=undefined;videoTimer=env.setInterval(()=>{const video=doc.querySelector('video[data-dshgui-video]');if(!doc.hidden&&video&&!video.paused)schedule()},1000);schedule();return}
   if(source===next.background.data&&image?.complete){schedule();return}
   source=next.background.data;image=new env.Image();image.onload=()=>{if(!disposed&&token===generation)schedule()};image.src=source
  },
  dispose(){disposed=true;++generation;env.clearTimeout(timer);env.clearInterval(videoTimer);changes.disconnect();modeChanges.disconnect();env.removeEventListener('resize',schedule);doc.removeEventListener('loadeddata',schedule,true);clear();sheet.remove();image=undefined},
 }
}
