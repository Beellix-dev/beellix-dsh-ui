/** Independently authored settings composition over public DSH contracts. */
import {SettingsGui,OwnPreferences} from './settings-gui'
import {createGuiRuntime} from './settings-runtime.mjs'
import {createDecorationLayer} from './settings-decoration-layer.mjs'
import {SidebarGui,SidebarLeading} from './sidebar-gui'
import {PluginMarketView,InlineMarketMount} from './plugin-market-view'

export const inject=['slots','locale','remote','remote.llm','remote.credentials','remote.session','remote.pluginInventory','remote.pluginManager','configForms','settingsSchema','shortcuts','layout','theme','uiWorkspace']

function keepWorkbenchBesideChat(){
 const openPanel='[data-sidebar-right-panel][data-sidebar-right-open]'
 let cancelPending=()=>{}
 const onExpand=(event:MouseEvent)=>{
  if(!(event.target instanceof Element)||!event.target.closest('[data-sidebar-right-expand]'))return
  // DSH uses fullscreen as its narrow-window fallback.
  if(window.innerWidth<768||document.querySelector(openPanel))return
  cancelPending()
  const observer=new MutationObserver(()=>{
   const panel=document.querySelector(openPanel)
   if(!panel)return
   const restore=panel.querySelector<HTMLButtonElement>('[data-sidebar-right-mode="push"]')
   if(panel.getAttribute('data-sidebar-right-panel')==='fullscreen'&&!restore)return
   cancelPending()
   restore?.click()
  })
  const timeout=window.setTimeout(()=>cancelPending(),1000)
  cancelPending=()=>{observer.disconnect();window.clearTimeout(timeout)}
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-sidebar-right-open']})
 }
 document.addEventListener('click',onExpand,true)
 return ()=>{cancelPending();document.removeEventListener('click',onExpand,true)}
}

export function apply(ctx:any){
 const runtime=createGuiRuntime(ctx)
 ctx.effect(()=>{void runtime.sidebar.start().catch(error=>console.error('DSH Web GUI sidebar:',error.message))},'DSH Web GUI：恢复侧栏控件')
 ctx.slots.inject('sidebar',()=>ctx.slots.register({name:'sidebar',children:{'sidebar.brand.mark':{kind:'single',scope:'root'},'sidebar.brand.name':{kind:'single',scope:'root'},'sidebar.toggle.badge':{kind:'single',scope:'root'},'sidebar.panellist':{kind:'list',scope:'root'},'sidebar.panellist.actions':{kind:'list',scope:'root'},'sidebar.workspaces':{kind:'single',scope:'root'},'sidebar.settings':{kind:'single',scope:'root'},'sidebar.footer.action':{kind:'list',scope:'root'}},inject:()=>({runtime})},SidebarGui))
 ctx.slots.inject('shell.leading',()=>ctx.slots.register({name:'shell.leading',inject:()=>({runtime})},SidebarLeading))
 ctx.slots.inject('plugins.tab',()=>ctx.slots.register({name:'plugins.tab',id:'bx-catalog',label:()=>ctx.locale.getLocale().active.startsWith('zh')?'插件市场':'Plugin market'},InlineMarketMount))
 ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'dsh-web-gui-plugin-market',inject:()=>({ctx})},PluginMarketView))
 ctx.effect(()=>()=>globalThis.__DSH_WEB_GUI_OPENING__?.stop(),'DSH Web GUI：释放启动画面')
 ctx.effect(()=>{void runtime.skin?.start().catch(error=>console.error('DSH Web GUI skin settings:',error.message))},'DSH Web GUI：恢复已保存皮肤')
 ctx.effect(keepWorkbenchBesideChat,'DSH Web GUI：工作台普通展开')
 ctx.effect(()=>{if(!runtime.decorations)return;void runtime.decorations.start().catch(error=>console.error('DSH Web GUI decoration settings:',error.message));const layer=createDecorationLayer(runtime.decorations);return()=>layer.dispose()},'DSH Web GUI：自有桌面装饰')
 ctx.effect(()=>()=>runtime.dispose(),'DSH Web GUI：释放配置与请求')
 ctx.effect(()=>ctx.reflect.provide('dshWebGui',{register:(entry:any)=>runtime.registry.register(entry),registerEnvironment:(entry:any)=>runtime.sidebar.registerEnvironment(entry),open:(id:string)=>runtime.open(id)}),'DSH Web GUI：开放配置与环境模块贡献')
 ctx.slots.inject('sidebar.settings',()=>ctx.slots.register({
  name:'sidebar.settings',
  children:{'settings.launcher':{kind:'single',scope:'root'},'settings.trigger':{kind:'single',scope:'root'},'settings.header':{kind:'single',scope:'root'},'settings.action':{kind:'list',scope:'root'},'settings.close':{kind:'single',scope:'root'},'settings.section':{kind:'list',scope:'root'},'settings.onboarding':{kind:'list',scope:'root'}},
  inject:()=>({runtime}),
 },SettingsGui))
 ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'dsh-web-gui-preferences',label:()=> '设置',children:{'settings.general.item':{kind:'list',scope:'root'}},inject:()=>({runtime})},OwnPreferences))
 ctx.effect(()=>ctx.shortcuts.register({id:'settings.open',label:()=> '设置',aliases:['settings','preferences'],defaults:{'desktop:windows':{code:'Comma',modifiers:['primary']},'desktop:macos':{code:'Comma',modifiers:['primary']},'desktop:linux':{code:'Comma',modifiers:['primary']},'web:windows':{code:'Comma',modifiers:['primary','alt']},'web:macos':{code:'Comma',modifiers:['primary','alt']}},regions:['page','editable','terminal'],modals:['settings'],resolve:({modal}:any)=>modal&&modal!=='settings'?{status:'blocked',reason:'modal'}:{status:'handled',run:()=>runtime.shell.getSnapshot().open?runtime.close():runtime.open()}}),'DSH Web GUI：设置快捷键')
 const bridge=globalThis.desktopNext
 if(bridge?.onOpenSettings)ctx.effect(()=>bridge.onOpenSettings((page:string)=>runtime.open(page==='permissions'?'privacy':'general')),'DSH Web GUI：系统设置入口')
}
