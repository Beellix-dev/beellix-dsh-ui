/** Our client-entry presentation. No Electron splash, OS boot or task state is replaced. */
export const startupEffects=['none','fade','soft']
export function createStartupEffects(ctx,env=globalThis){
 let disposed=false,played=false,animation,off,observer,timer
 const frame=()=>env.document?.querySelector('body :has(> [data-shell-overlay]):has(> [data-shell-bottom])')
 const stop=()=>{animation?.cancel();animation=undefined;observer?.disconnect();if(timer)env.clearTimeout(timer)}
 const play=effect=>{
  if(disposed)throw Error('启动特效已释放')
  if(!startupEffects.includes(effect))throw Error('不支持的启动特效')
  stop()
  if(effect==='none'||env.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return false
  const target=frame();if(!target?.animate)return false
  const keyframes=effect==='soft'?[{opacity:.78,filter:'blur(2px)',transform:'scale(.996)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}]:[{opacity:.7},{opacity:1}]
  animation=target.animate(keyframes,{duration:effect==='soft'?360:240,easing:'cubic-bezier(.16,1,.3,1)'})
  return true
 }
 const form=ctx.configForms.get('dsh-web-gui')
 const ready=()=>{
  if(disposed||played||form.getSnapshot().status!=='ready')return
  if(!frame())return
  played=true;off?.();play(form.getSnapshot().value.startupEffect??'none')
 }
 return {play,
  async start(){off=form.subscribe(ready);await ctx.configForms.describe().ensure();if(disposed)return;ready();if(!played&&env.MutationObserver&&env.document){observer=new env.MutationObserver(ready);observer.observe(env.document.body,{childList:true,subtree:true});timer=env.setTimeout(()=>observer?.disconnect(),3000)}},
  dispose(){disposed=true;off?.();stop()},
 }
}

/** Classification is based on live namespace/section identifiers; missing services stay unavailable. */
export function decorationKind(id){
 if(/(?:^|[-_.])(pet|pets)(?:$|[-_.])/.test(id))return 'pet'
 if(/wallpaper/.test(id))return 'wallpaper'
 if(/(?:splash|startup[-_.]?(?:animation|effect)|boot[-_.]?(?:animation|effect))/.test(id))return 'startup'
 return null
}

export function pluginManagerKey(entries){
 return entries.find(row=>row.options.key==='plugins')?.options.key??null
}
export function decorationAvailability(sections,namespaces,kind){
 return sections.some(row=>decorationKind(row.id)===kind)||namespaces.some(row=>decorationKind(row.ns)===kind)
}
