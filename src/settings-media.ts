/** Validate in the client before uploading data-only media to the owned Host store. */
export async function uploadOpeningMedia(file:File,signal:AbortSignal){
 const kind=file.type==='video/mp4'&&/\.mp4$/i.test(file.name)?'video':file.type==='image/gif'&&/\.gif$/i.test(file.name)?'image':null
 if(!kind||file.size>(kind==='video'?100:20)*1024*1024)throw Error('请选择 100 MB 以内的 MP4 或 20 MB 以内的 GIF')
 const local=URL.createObjectURL(file),element=kind==='video'?document.createElement('video'):new Image()
 try{await new Promise<void>((resolve,reject)=>{const finish=(error?:Error)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);element.onload=null;element.onerror=null;if(element instanceof HTMLVideoElement)element.onloadeddata=null;error?reject(error):resolve()},abort=()=>finish(Error('素材上传已取消')),timer=setTimeout(()=>finish(Error('素材读取超时，请换一个文件')),10000);signal.addEventListener('abort',abort,{once:true});element.onerror=()=>finish(Error('素材无法播放，请使用 H.264 MP4 或有效的 GIF'));if(element instanceof HTMLVideoElement){element.muted=true;element.onloadeddata=()=>finish()}else element.onload=()=>element.naturalWidth*element.naturalHeight>16000000?finish(Error('GIF 尺寸过大，请缩小后重试')):finish();element.src=local;if(signal.aborted)abort()})}finally{element.removeAttribute('src');if(element instanceof HTMLVideoElement)element.load();URL.revokeObjectURL(local)}
 const response=await fetch('/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':file.type},body:file,credentials:'same-origin',signal}),result=await response.json()
 if(!response.ok||!result.ok)throw Error(result.error??'素材上传失败，请重试')
 const extension=kind==='video'?'mp4':'gif'
 if(!new RegExp('^/dsh-web-gui/media/[a-f\\d]{64}\\.'+extension+'$').test(result.url))throw Error('素材保存位置无效')
 return {kind,src:result.url,name:file.name,fit:'cover'}
}

export async function uploadPetAction(file:File,signal:AbortSignal,withThumbnail=false){
 const extension=/\.(gif|webp)$/i.exec(file.name)?.[1].toLowerCase()
 if(!extension||file.size>(extension==='gif'?20:100)*1024*1024)throw Error('请选择 100 MB 以内的动态 WebP 或 20 MB 以内的 GIF')
 const source=URL.createObjectURL(file),image=new Image()
 let thumbnail=''
 try{
  image.src=source
  await image.decode()
  if(image.naturalWidth*image.naturalHeight>16000000)throw Error('动作素材尺寸过大')
  if(withThumbnail){
   const canvas=document.createElement('canvas'),scale=144/Math.max(image.naturalWidth,image.naturalHeight)
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale))
   canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
   canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height)
   thumbnail=canvas.toDataURL('image/webp',.82)
   if(!thumbnail.startsWith('data:image/webp;'))thumbnail=''
  }
 }catch(error){
  if(error instanceof DOMException)throw Error('无法读取这张动图，请检查文件格式')
  throw error
 }finally{
  image.removeAttribute('src')
  URL.revokeObjectURL(source)
 }
 const response=await fetch('/dsh-web-gui/media?pet-action=1',{method:'POST',headers:{'Content-Type':'image/'+extension},body:file,credentials:'same-origin',signal})
 const result=await response.json()
 if(!response.ok||!result.ok)throw Error(result.error??'动作上传失败，请重试')
 if(!new RegExp('^/dsh-web-gui/media/[a-f\\d]{64}\\.'+extension+'$').test(result.url))throw Error('动作保存位置无效')
 return {image:result.url,durationMs:result.durationMs,thumbnail}
}
