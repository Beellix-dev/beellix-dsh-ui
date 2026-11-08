import {createSettingsRegistry,createSettingsDraft,groupModelProviders} from './settings-core.mjs'
import {createSettingsDesktopStore} from './settings-desktop-store.mjs'
import {createConnectionEditor} from './settings-model-connections.mjs'
import {createSkinStore} from './settings-skin.mjs'
import {createStartupEffects} from './settings-decorations.mjs'
import {createPluginList} from './settings-plugin-list.mjs'
import {createDecorationStore} from './settings-personalization.mjs'
import {createSidebarModules} from './sidebar-modules.mjs'

function signal(initial) {
 let value=initial
 const listeners=new Set()
 return {getSnapshot:()=>value,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),set(next){value=next;for(const fn of listeners)fn()},dispose(){listeners.clear()}}
}

export function createGuiRuntime(ctx,bridge=globalThis.desktopNext) {
 const shell=signal({open:false,page:'general'}),registry=createSettingsRegistry(),desktop=createSettingsDesktopStore(bridge)
 const models=signal({phase:'idle',items:[],error:''}),describe=ctx.configForms.describe()
 let disposed=false,modelGeneration=0
 const drafts=new Map(),modelEditors=new Set()
 const unwrap=result=>{if(!result?.ok)throw Error(result?.error?.message??'客户端接口未返回有效结果');return result.value}
 const skin=ctx.theme&&ctx.configForms.get?createSkinStore(ctx):undefined
 const startup=ctx.configForms.get?createStartupEffects(ctx):undefined
 const plugins=createPluginList(ctx);plugins.start()
 const decorations=ctx.configForms.get?createDecorationStore(ctx):undefined
 const sidebar=createSidebarModules(ctx)
 const runtime={ctx,shell,registry,desktop,models,describe,skin,startup,plugins,decorations,sidebar,
  draft(ns,scope='all'){const key=JSON.stringify([ns,scope]);if(!drafts.has(key))drafts.set(key,createSettingsDraft(ctx.configForms.get(ns)));return drafts.get(key)},
  modelEditor(options){const editor=createConnectionEditor(ctx,describe,options),dispose=editor.dispose;editor.dispose=()=>{dispose();modelEditors.delete(editor)};modelEditors.add(editor);return editor},
  open(page='general'){page=({layout:'fonts',surfaces:'appearance',decorations:'effects'})[page]??page;shell.set({open:true,page})},close(){skin?.stopPreview();shell.set({...shell.getSnapshot(),open:false})},
  async loadModels(){
   const generation=++modelGeneration;models.set({...models.getSnapshot(),phase:'loading',error:''})
   try {
    const [known,declared,catalog]=await Promise.all([ctx.remote.llm.listProviders(),ctx.remote.llm.listConfigurableProviders(),ctx.remote.session.modelCatalog(),describe.ensure()])
    const view=describe.getSnapshot().view
    const items=groupModelProviders(unwrap(known),unwrap(declared),catalog.ok?catalog.value.groups:[]).map(row=>{
     const section=view?.namespaces.find(entry=>entry.ns===row.settingsNs),profile=(row.settingsPath??[]).reduce((value,key)=>value?.[key],section?.value)
     return {...row,profile,configured:row.settingsPath?.length?profile!==undefined:row.models.length>0||Object.keys(section?.user??{}).length>0,removable:Boolean(row.settingsPath?.length&&row.settingsPath.reduce((value,key)=>value?.[key],section?.user)!==undefined)}
    })
    const refs=[...new Set(items.filter(row=>row.provider!=='deepseek-account').map(row=>row.profile?.apiKeyEnv).filter(Boolean))]
    if(refs.length&&ctx.remote.credentials.describe){for(let offset=0;offset<refs.length;offset+=64){const result=await ctx.remote.credentials.describe(refs.slice(offset,offset+64));if(result.ok)for(const row of items)if(result.value[row.profile?.apiKeyEnv]?.configured){row.configured=true;row.credentialConfigured=true}}}
    if(!disposed&&generation===modelGeneration)models.set({phase:'ready',items,error:catalog.ok?'':catalog.error?.message??'模型目录暂时不可用'})
   } catch(error){if(!disposed&&generation===modelGeneration)models.set({...models.getSnapshot(),phase:'error',error:error.message})}
  },
  async storeKey(ref,key){
   if(disposed)throw Error('模型接口已释放')
   if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref))throw Error('凭据引用无效')
   unwrap(await ctx.remote.credentials.set(ref,key))
  },
  dispose(){disposed=true;++modelGeneration;sidebar.dispose();decorations?.dispose();plugins.dispose();startup?.dispose();skin?.dispose();for(const editor of modelEditors)editor.dispose();modelEditors.clear();for(const draft of drafts.values())draft.dispose();drafts.clear();registry.dispose();desktop.dispose();shell.dispose();models.dispose()},
 }
 return runtime
}
