/** Versioned, data-only skin format. No imported HTML, CSS, scripts or fonts execute. */
import {skinPatterns,patternPaint} from './settings-skin-patterns.mjs'
import {createBackgroundPlayer} from './settings-background-player.mjs'
import {createWallpaperContrast} from './settings-wallpaper-contrast.mjs'
import {skinMedia} from './settings-skin-assets.mjs'
export const skinNamespace='dsh-web-gui'
export const wallpaperAreas=[['sidebar','左侧栏'],['main','聊天区'],['rightbar','右侧工作台']]
export const skinFields=[['accent','强调色'],['sidebar','侧栏'],['surface','主面板'],['card','卡片'],['button','按钮'],['input','输入框']]
const light={accent:'#6953c5',sidebar:'#f5f2f9',surface:'#fcfbfa',card:'#f2eef8',button:'#7059ce',input:'#ffffff'}
const dark={accent:'#c1b1ff',sidebar:'#23212c',surface:'#202027',card:'#2c2836',button:'#b7a4f5',input:'#25232d'}
export const skinPresets=[
 {id:'lavender',name:'柔和紫',light,dark},
 {id:'blue',name:'清爽蓝',light:{accent:'#3563b9',sidebar:'#f0f4fa',surface:'#fafbfd',card:'#eaf0f9',button:'#3563b9',input:'#ffffff'},dark:{accent:'#a8c6ff',sidebar:'#1c2532',surface:'#1b2029',card:'#263344',button:'#a8c6ff',input:'#222d3c'}},
 {id:'sage',name:'自然绿',light:{accent:'#3a7058',sidebar:'#eff5f0',surface:'#fafcf9',card:'#e9f1e9',button:'#3a7058',input:'#ffffff'},dark:{accent:'#afd1b7',sidebar:'#202923',surface:'#1c241f',card:'#29382e',button:'#afd1b7',input:'#233027'}},
]
export const defaultSkin={type:'dsh-web-gui-skin',version:1,name:'柔和紫',preset:'lavender',light,dark,background:{data:'',name:'',fit:'cover',strength:18,areas:wallpaperAreas.map(([id])=>id)}}
/** Theme choices never replace a user's image, video, or coverage selection. */
export function selectTheme(skin,preset){const next=normalizeSkin({...skin,name:preset.name,preset:preset.id,light:preset.light,dark:preset.dark});next.background.strength=Math.min(next.background.strength,backgroundStrengthLimit(next));return next}
/** Media choices keep the active theme and the user's coverage selection. */
export function selectWallpaper(skin,background){return normalizeSkin({...skin,background:{...background,areas:skin.background.areas??defaultSkin.background.areas}})}
/** A bundled skin includes art and its coordinated panels. Native light/dark preference stays unchanged. */
export function selectBuiltinSkin(skin,row){return normalizeSkin({...skin,name:row.name,preset:'custom',light:row.palette.light,dark:row.palette.dark,panels:{style:'frosted',opacity:72,sidebarOpacity:8,immersive:true},background:{...defaultSkin.background,data:row.src,name:row.name,strength:100,areas:skin.background.areas}})}
export function normalizeSkin(input){
 if(!input||input.type!=='dsh-web-gui-skin'||input.version!==1)throw Error('请选择 DSH Web GUI 皮肤 JSON（版本 1）')
 const result={type:'dsh-web-gui-skin',version:1,name:String(input.name??'自定义皮肤').slice(0,60),preset:skinPresets.some(row=>row.id===input.preset)?input.preset:'custom'}
 for(const mode of ['light','dark']){result[mode]={};for(const [key,label] of skinFields){const color=input[mode]?.[key];if(typeof color!=='string'||!/^#[\da-f]{6}$/i.test(color))throw Error(`${mode==='light'?'浅色':'深色'}${label}需为 #RRGGBB 色值`);result[mode][key]=color.toLowerCase()}}
 const bg=input.background??defaultSkin.background,data=bg.data??''
 const video=bg.kind==='video'
 if(video){if(typeof data!=='string'||!/^\/dsh-web-gui\/media\/[a-f\d]{64}\.mp4$/.test(data))throw Error('请选择本机导入的视频')}
 else if(typeof data!=='string'||data.length>3*1024*1024||data&&!skinMedia.some(row=>row.src===data)&&!/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(data))throw Error('背景只支持内置素材或本地 PNG、JPG、WebP 图片，处理后不得超过 2 MB')
 if(data&&!video&&!skinMedia.some(row=>row.src===data)){let prefix;try{prefix=atob(data.split(',')[1].slice(0,32))}catch{throw Error('背景图片数据损坏')};if(!(data.startsWith('data:image/png;')&&prefix.startsWith('\x89PNG\r\n\x1a\n')||data.startsWith('data:image/jpeg;')&&prefix.startsWith('\xff\xd8\xff')||data.startsWith('data:image/webp;')&&prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP'))throw Error('背景图片内容与格式不符')}
 if(bg.pattern&&!Object.hasOwn(skinPatterns,bg.pattern))throw Error('内置背景不存在')
 if(!['cover','contain'].includes(bg.fit??'cover'))throw Error('背景缩放方式无效')
 const maxStrength=input.panels?.immersive===true?100:50
 if(!Number.isInteger(bg.strength??18)||(bg.strength??18)<0||(bg.strength??18)>maxStrength)throw Error(`背景强度应在 0–${maxStrength} 之间`)
 const areas=bg.areas??defaultSkin.background.areas
 if(!Array.isArray(areas)||areas.length<1||areas.length>3||new Set(areas).size!==areas.length||areas.some(id=>!wallpaperAreas.some(([key])=>key===id)))throw Error('皮肤覆盖范围无效，请至少选择一个区域')
 result.background={data,name:String(bg.name??'').slice(0,120),fit:bg.fit??'cover',strength:bg.strength??18,areas:[...areas]}
 if(video){result.background.kind='video';result.background.paused=Boolean(bg.paused);result.background.pauseOnBlur=Boolean(bg.pauseOnBlur)}
 else if(bg.pattern)result.background.pattern=bg.pattern
 if(data&&bg.attribution){const credit=bg.attribution;if(typeof credit.author!=='string'||credit.author.length>300||typeof credit.source!=='string'||!/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(credit.source)||credit.source.length>1500||credit.license!=='CC BY 4.0')throw Error('背景图片来源信息无效');result.background.attribution={author:credit.author,source:credit.source,license:credit.license}}
 if(input.panels){
  const {style,opacity,immersive,sidebarOpacity,blur}=input.panels
  if(!['solid','frosted'].includes(style))throw Error('面板样式无效')
  if(!Number.isInteger(opacity)||opacity<64||opacity>100)throw Error('面板不透明度应在 64–100 之间')
  if(immersive!==undefined&&typeof immersive!=='boolean')throw Error('背景分层方式无效')
  if(sidebarOpacity!==undefined&&(!Number.isInteger(sidebarOpacity)||sidebarOpacity<0||sidebarOpacity>100))throw Error('侧栏不透明度应在 0–100 之间')
  if(blur!==undefined&&(!Number.isInteger(blur)||blur<0||blur>24))throw Error('磨砂模糊应在 0–24 像素之间')
  result.panels={style,opacity,...(immersive!==undefined?{immersive}:{}),...(immersive?{sidebarOpacity:sidebarOpacity??8}:{}),...(blur!==undefined?{blur}:{})}
 }
 return result
}
export function normalizeSkinLibrary(input){
 if(!Array.isArray(input)||input.length>12||JSON.stringify(input).length>8*1024*1024)throw Error('最多保存 12 套皮肤，总大小不得超过 8 MB')
 const ids=new Set()
 return input.map(row=>{if(!row||typeof row.id!=='string'||!/^user-[a-z\d-]{8,64}$/.test(row.id)||ids.has(row.id))throw Error('自定义皮肤标识无效或重复');ids.add(row.id);const skin=normalizeSkin(row.skin);skinTokens(skin);return {id:row.id,skin}})
}
const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16))
const hex=values=>'#'+values.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('')
const blend=(a,b,weight)=>hex(rgb(a).map((value,index)=>value*weight+rgb(b)[index]*(1-weight)))
function luminance(color){return rgb(color).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)}
export const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)
export const ink=background=>contrast('#211e29',background)>contrast('#ffffff',background)?'#211e29':'#ffffff'
const tint=(color,opacity)=>`rgba(${rgb(color).join(',')},${opacity})`

// Apply a readability floor to the wallpaper, leaving the native transcript geometry alone.
function readingTint(surface,text,worst,requestedOpacity){
 const target=Math.min(5.2,contrast(text,surface))
 let percent=Math.round(requestedOpacity*100)
 while(percent<100&&contrast(text,blend(surface,worst,percent/100))<target)percent++
 return percent/100
}
/** Expose only strengths that keep both native light/dark modes readable over arbitrary imagery. */
export function backgroundStrengthLimit(skin){if(skin.panels?.immersive)return 100;for(let strength=50;strength>=0;strength--){if(['light','dark'].every(mode=>{const palette=skin[mode],text=ink(palette.surface);return ['surface','sidebar'].every(key=>contrast(text,blend(palette[key],luminance(text)>.5?'#ffffff':'#000000',1-strength/100))>=4.5)}))return strength}return 0}
export function skinTokens(input){
 const skin=normalizeSkin(input),tokens={}
 for(const mode of ['light','dark']){
  const palette=skin[mode],text=ink(palette.surface),line=blend(text,palette.surface,.15)
  const labelProtection=luminance(text)>.5?'#080b12':'#ffffff'
  let muted=blend(text,palette.surface,.75),accent=palette.accent
  if(contrast(palette.accent,palette.surface)<4.5||contrast(palette.accent,blend(palette.accent,palette.surface,.14))<4.5)throw Error('强调色与面板对比不足，请选择更清晰的颜色')
  if(['sidebar','card','input'].some(key=>contrast(text,palette[key])<4.5))throw Error('主面板、侧栏、卡片和输入框的明暗差异过大，请使用同一明暗风格')
  const readableSurfaces=['surface','sidebar','card','input'].map(key=>palette[key])
  const worst=luminance(text)>.5?'#ffffff':'#000000'
  const wallpaperOpacity=(100-skin.background.strength)/100
  const readingOpacity=skin.panels?.immersive?readingTint(palette.surface,text,worst,wallpaperOpacity):wallpaperOpacity
  const sidebarOpacity=skin.panels?.immersive?skin.panels.sidebarOpacity/100:wallpaperOpacity
  const frosted=skin.panels?.style==='frosted'
  const contentGlass=frosted&&skin.panels?.immersive&&skin.background.areas.includes('main')&&Boolean(skin.background.data||skin.background.pattern)
  const sidebarFill=tint(palette.sidebar,sidebarOpacity)
  const panelBlur=skin.panels?.blur??18
  const panelOpacity=frosted?skin.panels.opacity/100:1
  // The chat backdrop already contributes tint. Keep the combined opacity at the selected level.
  let inputOpacity=panelOpacity
  if(panelOpacity<1){
   const untinted=1-readingOpacity
   inputOpacity=untinted>0?Math.max(.12,1-(1-panelOpacity)/untinted):.12
  }
  if(skin.background.data||skin.background.pattern){
   const opacity=skin.panels?.immersive?(skin.panels.style==='solid'?1:skin.panels.opacity/100):1-skin.background.strength/100
   const surfaces=(skin.panels?.immersive?['surface','sidebar','card','input']:['surface','sidebar']).map(key=>blend(palette[key],worst,opacity))
   if(surfaces.some(color=>contrast(text,color)<4.5))throw Error('当前背景强度影响文字阅读，请降低背景强度或调整配色')
   readableSurfaces.push(...surfaces)
   if(skin.background.areas.includes('main'))readableSurfaces.push(blend(palette.surface,worst,readingOpacity))
  }
  for(let weight=.8;weight<=1.01&&readableSurfaces.some(color=>contrast(muted,color)<4.5);weight+=.05)muted=blend(text,palette.surface,Math.min(weight,1))
  for(let weight=.05;weight<=1.01&&readableSurfaces.some(color=>contrast(accent,color)<4.5);weight+=.05)accent=blend(text,palette.accent,Math.min(weight,1))
  const values={
   '--dsw-alias-bg-base':palette.surface,'--dsw-alias-bg-layer-1':palette.card,'--dsw-alias-bg-layer-2':palette.input,'--dsw-alias-bg-overlay':palette.surface,
   '--dsw-alias-brand-primary':accent,'--dsw-alias-label-primary':text,'--dsw-alias-label-secondary':muted,
   '--dsw-alias-label-tertiary':muted,'--dshgui-label-protection':labelProtection,
   '--dsw-alias-border-l1':line,'--dsw-alias-border-l2':line,'--dsw-alias-border-l3':line,'--dsw-specific-sidebar-fill':palette.sidebar,
   '--dshgui-wallpaper-main-mask':tint(palette.surface,wallpaperOpacity),
   '--dshgui-wallpaper-reading-mask':tint(palette.surface,readingOpacity),
   '--dshgui-wallpaper-sidebar-mask':sidebarFill,
   '--dshgui-wallpaper-panel-mask':tint(skin.panels?.immersive?palette.sidebar:palette.surface,sidebarOpacity),
   '--dshgui-panel-fill':skin.panels?.style==='frosted'?`rgba(${rgb(palette.surface).join(',')},${skin.panels.opacity/100})`:palette.surface,
   '--dshgui-panel-blur':frosted?`${panelBlur}px`:'0px',
   '--dshgui-content-glass-fill':contentGlass?sidebarFill:palette.surface,
   '--dshgui-content-glass-filter':contentGlass?`blur(${panelBlur}px)`:'none',
   '--dshgui-content-glass-edge':contentGlass?labelProtection:'transparent',
   '--dshgui-input-fill':skin.panels?.style==='frosted'?`rgba(${rgb(palette.input).join(',')},${skin.panels.opacity/100})`:palette.input,
   '--dshgui-chat-input-fill':tint(palette.input,Math.round(inputOpacity*100)/100),
   '--dsw-alias-button-primary-fill':palette.button,'--dsw-alias-label-primary-foreground':ink(palette.button),
   '--dsh-web-gui-skin-bg':palette.surface,'--dsh-web-gui-skin-sidebar':palette.sidebar,'--dsh-web-gui-skin-card':palette.card,'--dsh-web-gui-skin-input':palette.input,'--dsh-web-gui-skin-accent':accent,'--dsh-web-gui-skin-selected':blend(accent,palette.surface,.14),'--dsh-web-gui-skin-text':text,'--dsh-web-gui-skin-muted':muted,'--dsh-web-gui-skin-line':line,'--dsh-web-gui-skin-button':palette.button,'--dsh-web-gui-skin-button-text':ink(palette.button),
  }
  for(const [name,value] of Object.entries(values)){tokens[name]??={};tokens[name][mode]=value}
 }
 return tokens
}

/** One mask per visible shell surface. Nested content stays clear; popups retain opaque tokens. */
export function skinBackgroundCss(input){
 const skin=normalizeSkin(input)
 if(!skin.background.data&&!skin.background.pattern)return ''
 const frame='body :has(> [data-shell-overlay]):has(> [data-shell-bottom])'
 const main=`${frame} > :has(> [data-slot="main"])`,sidebar=`${frame} > :has(> [data-slot="sidebar"])`,rightbar=`${frame} > :has(> [data-slot="rightbar"])`,rightSurface=`${frame} [data-slot="rightbar.session"] > [data-sidebar-right-panel][data-sidebar-right-open]`
 const video=skin.background.kind==='video',art=skin.background.pattern?patternPaint(skin.background.pattern):`url("${skin.background.data}")`
 const immersive=skin.panels?.immersive===true
 const sideGlass=immersive&&skin.panels.style==='frosted'
 const paint=(selector,mask,base)=>`${selector}{background-color:${video||immersive?'transparent':`var(${base})`};background-image:linear-gradient(var(${mask}),var(${mask}))${video||immersive?'':','+art};background-size:100% 100%,${skin.background.fit};background-position:center;background-repeat:no-repeat;background-attachment:scroll,fixed;}`
 const areas=new Set(skin.background.areas)
 const conversationFrame=`${frame}:has(> * > [data-slot="main"] [data-slot="main.conversation"])`
 const conversation=`${main}:has([data-slot="main.conversation"])`
 const activeChat=`${main} [data-conversation-content][data-content-phase="active"]:not(:has([data-conversation-composer-overlay]))`
 const dock=`${rightSurface} [data-dockkit-host="dock"]:not([hidden])`
 // The native browser toolbar and viewport sit next to one another inside the shell.
 const browserShell=`${dock} div:has(> form input[placeholder*="HTTP(S)"]):has(> [aria-busy])`
 const sideRadius='var(--dsh-windows-content-radius,16px)'
 const windows='html[data-windows-titlebar]'
 const glassSurface=(selector,mask)=>`${selector}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background-color:var(${mask});backdrop-filter:blur(var(--dshgui-panel-blur));}`
 return (immersive?`${frame}{background-color:${video?'transparent':'var(--dsw-alias-bg-base)'};background-image:linear-gradient(var(--dshgui-canvas-tint,transparent),var(--dshgui-canvas-tint,transparent))${video?'':','+art};background-size:100% 100%,${skin.background.fit};background-position:center;background-repeat:no-repeat;background-attachment:scroll,fixed;}
${windows} ${frame}::before{background-color:transparent;background-image:${sideGlass?'none':'linear-gradient(var(--dshgui-wallpaper-sidebar-mask),var(--dshgui-wallpaper-sidebar-mask))'};}`:'')+
  (video?`${frame}{position:relative;z-index:1;background-color:transparent;}`:'')+
  [[main,'main','--dshgui-wallpaper-main-mask','--dsw-alias-bg-base'],[sidebar,'sidebar','--dshgui-wallpaper-sidebar-mask','--dsw-specific-sidebar-fill'],[rightSurface,'rightbar','--dshgui-wallpaper-panel-mask','--dsw-alias-bg-base']].map(([selector,id,mask,base])=>areas.has(id)?paint(selector,mask,base):`${selector}{background-color:var(${base});}`).join('')+
  (areas.has('rightbar')?`${rightbar}{background-color:transparent;}`:'')+
  (areas.has('main')?`${main} > [data-slot="main"] > *,${main} [data-slot="main.conversation"] > *{background-color:transparent;}`:'')+
  (areas.has('sidebar')?`${sidebar} > [data-slot="sidebar"] > *{background-color:transparent;}
${sidebar} [role="tree"] ~ span:empty:last-child{background-image:none;}
${sidebar} [role="tree"]:has(~ span:empty:last-child){mask-image:linear-gradient(to bottom,#000 calc(100% - 24px),transparent);-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 24px),transparent);}`:'')+
  (areas.has('rightbar')?`${rightbar} [data-slot="rightbar"] [data-dockkit-pane]{background-color:transparent;}`:'')+
  (sideGlass&&areas.has('sidebar')?`${sidebar}{position:relative;isolation:isolate;border-radius:${sideRadius};border-inline-end-color:transparent;background-image:none;}`+glassSurface(sidebar,'--dshgui-wallpaper-sidebar-mask'):'')+
  (sideGlass&&areas.has('rightbar')?`
${rightSurface}{background-image:none;}
${dock}{position:relative;border-radius:${sideRadius};}
${dock} > [data-dockkit-pane]{border-radius:inherit;border-inline-start-color:transparent;}
${dock}[data-dockkit-column="0"]:has(~ [data-dockkit-host="dock"][data-dockkit-column="1"]:not([hidden])){border-start-end-radius:0;border-end-end-radius:0;}
${dock}[data-dockkit-column="1"]{border-start-start-radius:0;border-end-start-radius:0;}
`+glassSurface(dock,'--dshgui-wallpaper-panel-mask')+`
${browserShell}{background-color:transparent;}
${browserShell} > form{border-block-end-color:transparent;}
${browserShell} > form input[placeholder*="HTTP(S)"]::placeholder{color:var(--dsw-alias-label-secondary);opacity:1;}
`:'')+
  (immersive&&areas.has('rightbar')?`${frame}:has([data-sidebar-right-panel="fullscreen"][data-sidebar-right-open]) [data-slot="main.conversation"]{visibility:hidden;}`:'')+
  `${main} [data-composer-card]{background-color:var(--dshgui-input-fill);backdrop-filter:blur(var(--dshgui-panel-blur));-webkit-backdrop-filter:blur(var(--dshgui-panel-blur));}`+
  (immersive&&areas.has('main')?`${conversationFrame}{--dshgui-canvas-tint:var(--dshgui-wallpaper-reading-mask);}
${conversation}{background-image:none;}
${main} [data-phase="active"] [data-slot="conversation.header"] > header{background-color:transparent;}
${activeChat} [data-composer-seat]{background-image:none;}
${conversation} [data-composer-card]{background-color:var(--dshgui-chat-input-fill);}
`:'')+
  (immersive?`${rightSurface} :is([data-dockkit-strip],[data-dockkit-float-grip]){background-color:var(--dsw-alias-bg-base);}
${sideGlass&&areas.has('rightbar')?`${dock} [data-dockkit-strip]{background-color:transparent;}`:''}
${main} [data-composer-placeholder],${main} [data-composer-input]::placeholder{color:var(--dsw-alias-label-secondary);opacity:1;}
${main} [data-composer-seat] div:has(> span > [data-slot="conversation.hero.brand.mark"]){text-shadow:1px 0 1px var(--dshgui-label-protection),-1px 0 1px var(--dshgui-label-protection),0 1px 1px var(--dshgui-label-protection),0 -1px 1px var(--dshgui-label-protection);}
${main} div:has(> [data-slot="conversation.hero.workspace"]) > button,${main} [data-slot="conversation.hero.agentPreset"] button{color:var(--dsw-alias-label-primary);background-color:var(--dshgui-panel-fill);backdrop-filter:blur(var(--dshgui-panel-blur));-webkit-backdrop-filter:blur(var(--dshgui-panel-blur));border-radius:6px;}
${main} [data-slot="main"] > :not([data-slot="main.conversation"]){background-color:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;}
${sidebar} > [data-slot="sidebar"] > *,${rightSurface} [data-dockkit-host="dock"] [data-dockkit-pane]{backdrop-filter:none;-webkit-backdrop-filter:none;text-shadow:1px 0 0 var(--dshgui-label-protection),-1px 0 0 var(--dshgui-label-protection),0 1px 0 var(--dshgui-label-protection),0 -1px 0 var(--dshgui-label-protection);}
${sidebar} svg,${rightSurface} [data-dockkit-host="dock"] svg{filter:drop-shadow(1px 1px 1px var(--dshgui-label-protection));}`:'')
}

export function createSkinStore(ctx){
 const form=ctx.configForms.get(skinNamespace),listeners=new Set()
 let accepted=structuredClone(defaultSkin),revision,layer,style,media,contrastLayer,off,disposed=false,snapshot={ready:false,skin:accepted,library:[],dirty:false,busy:false,error:'',conflicted:false}
 const publish=patch=>{if(disposed)return;snapshot={...snapshot,...patch};for(const listener of listeners)listener()}
 const apply=skin=>{
  if(disposed)return
  const tokens=skinTokens(skin),next=ctx.theme.overrideTokens('@beellix-ai/dsh-web-gui-skin',tokens);layer?.();layer=next
  if(typeof document==='undefined')return
  media??=createBackgroundPlayer();media.render(skin.background,error=>publish({error}))
  style??=document.createElement('style');if(!style.isConnected)document.head.append(style)
  style.textContent=skinBackgroundCss(skin)
  contrastLayer??=createWallpaperContrast();contrastLayer.render(skin)
 }
 const adopt=()=>{if(disposed)return;const current=form.getSnapshot();if(current.status!=='ready')return;if(snapshot.dirty||snapshot.busy){if(revision!==current.revision)publish({conflicted:true});return}try{accepted=normalizeSkin(JSON.parse(current.value.appearance));const library=normalizeSkinLibrary(JSON.parse(current.value.skinLibrary??'[]'));revision=current.revision;apply(accepted);publish({ready:true,skin:accepted,library,error:'',conflicted:false})}catch(error){publish({error:error.message})}}
 const writeLibrary=async(library,skin)=>{
  if(disposed||snapshot.busy)throw Error('皮肤配置暂时不可修改')
  const current=form.getSnapshot();if(current.status!=='ready'||!current.writable||revision!==current.revision)throw Error('配置已更新或不可写，请取消预览后重试')
  library=normalizeSkinLibrary(library);const changes=[{op:'set',path:['skinLibrary'],value:JSON.stringify(library)}]
  if(skin){skin=normalizeSkin(skin);skinTokens(skin);changes.push({op:'set',path:['appearance'],value:JSON.stringify(skin)})}
  publish({busy:true,error:''})
  try{if(!await form.mutate(changes,revision))throw Error('皮肤未保存，当前内容已保留');revision=form.getSnapshot().revision;if(skin){accepted=skin;apply(skin)}publish({library,...(skin?{skin,dirty:false}:{}),conflicted:false})}catch(error){publish({error:error.message});throw error}finally{publish({busy:false})}
 }
 return {getSnapshot:()=>snapshot,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),
  async start(){if(disposed)return;off=form.subscribe(adopt);await ctx.configForms.describe().ensure();if(!disposed)adopt()},
  update(skin){if(disposed||snapshot.busy)return;try{skin=normalizeSkin(skin);apply(skin);publish({skin,dirty:JSON.stringify(skin)!==JSON.stringify(accepted),error:''})}catch(error){publish({error:error.message});throw error}},
  async save(){if(disposed)throw Error('皮肤配置已关闭');if(snapshot.busy)throw Error('正在保存皮肤');const current=form.getSnapshot();if(current.status!=='ready'||!current.writable)throw Error('皮肤配置目前不可写');if(revision!==current.revision)throw Error('配置已更新，请取消预览后重新修改');const skin=normalizeSkin(snapshot.skin);skinTokens(skin);publish({busy:true,error:''});try{if(!await form.mutate([{op:'set',path:['appearance'],value:JSON.stringify(skin)}],revision))throw Error('客户端未接受皮肤配置，预览已保留');accepted=skin;revision=form.getSnapshot().revision;apply(skin);publish({skin,dirty:false,conflicted:false})}catch(error){publish({error:error.message});throw error}finally{publish({busy:false})}},
  async saveAs(name){name=String(name??'').trim();if(!name||name.length>40)throw Error('请输入 1–40 字的皮肤名称');const skin={...snapshot.skin,name};await writeLibrary([...snapshot.library,{id:'user-'+crypto.randomUUID(),skin}],skin)},
  async importSaved(skin){skin=normalizeSkin(skin);await writeLibrary([...snapshot.library,{id:'user-'+crypto.randomUUID(),skin}])},
  async removeSaved(id){if(!snapshot.library.some(row=>row.id===id))throw Error('皮肤已不存在');await writeLibrary(snapshot.library.filter(row=>row.id!==id))},
  discard(){if(snapshot.busy)return;publish({dirty:false});adopt()},
  stopPreview(){if(!snapshot.dirty)return;apply(accepted);publish({skin:accepted,dirty:false,error:''})},
  dispose(){disposed=true;off?.();media?.dispose();contrastLayer?.dispose();layer?.();style?.remove();listeners.clear()},
 }
}
