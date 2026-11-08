/** Play an uploaded action, then reveal the default animation again. */
export function playPetAction(image,action,env=globalThis,onError){
 if(!image||!action||env.matchMedia('(prefers-reduced-motion: reduce)').matches)return null
 const clip=image.ownerDocument.createElement('img')
 let timer
 const reset=()=>{
  env.clearTimeout(timer)
  clip.onload=clip.onerror=null
  clip.remove()
  clip.removeAttribute('src')
  delete image.dataset.petActionLoading
  delete image.dataset.petActionHidden
 }
 const fail=()=>{reset();onError?.('动作素材无法播放，请重新上传')}
 clip.alt=''
 clip.draggable=false
 clip.dataset.petActionClip=''
 clip.onload=()=>{
  if(!image.isConnected){reset();return}
  env.clearTimeout(timer)
  delete image.dataset.petActionLoading
  image.dataset.petActionHidden=''
  image.after(clip)
  timer=env.setTimeout(reset,action.durationMs??2000)
 }
 clip.onerror=fail
 image.dataset.petActionLoading=''
 timer=env.setTimeout(fail,45000)
 clip.src=action.image
 return reset
}
