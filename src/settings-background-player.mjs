/** Owned video layer. It only paints a background; DSH sessions and layouts stay native. */
export function createBackgroundPlayer(env=globalThis){
 let video,config,disposed=false,onError
 const sync=()=>{if(!video)return;const active=video;if(config.paused||env.document.hidden||config.pauseOnBlur&&!env.document.hasFocus()||env.matchMedia?.('(prefers-reduced-motion: reduce)').matches)video.pause();else void video.play().catch(error=>{if(!disposed&&video===active&&!config.paused&&error.name!=='AbortError')onError?.('视频暂时无法播放，请重新选择该视频；仍然失败时请导入 H.264 编码的 MP4')})}
 env.document.addEventListener('visibilitychange',sync);env.addEventListener?.('blur',sync);env.addEventListener?.('focus',sync)
 const reduced=env.matchMedia?.('(prefers-reduced-motion: reduce)');reduced?.addEventListener?.('change',sync)
 return {
  render(background,error){if(disposed)return;onError=error;config=background;if(background.kind!=='video'){video?.pause();video?.removeAttribute('src');video?.load();video?.remove();video=undefined;return}
   if(!video){video=env.document.createElement('video');video.dataset.dshguiVideo='';video.setAttribute('aria-hidden','true');video.loop=true;video.muted=true;video.playsInline=true;video.preload='auto';Object.assign(video.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'0'});video.addEventListener('error',()=>onError?.('此视频无法解码，请导入 H.264 编码的 MP4'));env.document.body.prepend(video)}
   if(video.getAttribute('src')!==background.data)video.setAttribute('src',background.data);video.style.objectFit=background.fit;sync()
  },
  dispose(){disposed=true;video?.pause();video?.removeAttribute('src');video?.load();video?.remove();video=undefined;env.document.removeEventListener('visibilitychange',sync);env.removeEventListener?.('blur',sync);env.removeEventListener?.('focus',sync);reduced?.removeEventListener?.('change',sync)},
 }
}
