/** Deterministic configuration fixture; not a replacement Host or product data. */
import React from 'react'
import {createRoot} from 'react-dom/client'
import {SettingsGui,OwnPreferences} from '../src/settings-gui'
import {createGuiRuntime} from '../src/settings-runtime.mjs'
import {defaultSkin} from '../src/settings-skin.mjs'

function source(value:any){const listeners=new Set<()=>void>();return {value,getSnapshot(){return this.value},subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn)},set(next:any){this.value=next;for(const fn of listeners)fn()}}}
const values:any={
 locale:{preference:'zh'},'ui-theme':{preference:'system',fontSize:14,codeFontSize:11,terminalFontSize:13,textFontFamily:'',codeFontFamily:'',terminalFontFamily:''},
 'ui-conversation':{busyEnter:'queue'},'ui-chat':{transcriptView:'standard',collapseTiming:'completion',linkOpening:'sidebar',performanceUsage:'compact'},'ui-settings':{enabled:false},
 'llm-deepseek':{apiKeyEnv:'DEEPSEEK_API_KEY',baseURL:'https://api.deepseek.com',models:[{id:'deepseek-chat'}]},'llm-pi-ai':{providers:{}},'web-ui-usage':{enabled:true,pollIntervalSec:60,retainDays:180,spendCurrency:'CNY'},
 'dsh-web-gui':{appearance:JSON.stringify(defaultSkin),startupEffect:'none'},
}
const forms=new Map(),schemas=Object.fromEntries(Object.entries(values).map(([ns,value])=>[ns,{type:'object',dict:Object.fromEntries(Object.entries(value as any).map(([key,v])=>[key,{type:typeof v,meta:{}}]))}]))
const mirror=source({status:'ready',view:{writable:true,namespaces:[]},error:null})
const update=()=>mirror.set({...mirror.getSnapshot(),view:{writable:true,namespaces:[...forms].map(([ns,form])=>({ns,...form.getSnapshot(),user:form.getSnapshot().value,schema:schemas[ns]}))}})
for(const [ns,value] of Object.entries(values)){
 const state=source({status:'ready',writable:true,value,revision:0})
 forms.set(ns,{getSnapshot:()=>state.getSnapshot(),subscribe:(fn:()=>void)=>state.subscribe(fn),async mutate(ops:any[],revision:number){if(revision!==state.getSnapshot().revision)return false;const value=structuredClone(state.getSnapshot().value);for(const op of ops){let target=value;for(const key of op.path.slice(0,-1))target=target[key]??={};if(op.op==='unset')delete target[op.path.at(-1)];else target[op.path.at(-1)]=op.value}state.set({...state.getSnapshot(),value,revision:revision+1});update();return true}})
}
update()
const providers=['deepseek','qwen','openai','anthropic'].map(provider=>({provider,displayName:({deepseek:'DeepSeek',qwen:'Qwen',openai:'OpenAI',anthropic:'Anthropic'} as any)[provider],settingsNs:provider==='deepseek'?'llm-deepseek':'llm-pi-ai',settingsPath:provider==='deepseek'?[]:['providers',provider]}))
const discoveries:any[]=[]
const locale=source({revision:0,locales:[{id:'zh',label:'中文'},{id:'en',label:'English'}]})
;(mirror as any).ensure=async()=>{}
const ctx:any={configForms:{get(ns:string){if(!forms.has(ns))return {getSnapshot:()=>({status:'unavailable',value:undefined}),subscribe:()=>()=>{},mutate:async()=>false};return forms.get(ns)},describe:()=>mirror},
 theme:{overrideTokens(_id:string,tokens:any){for(const [key,pair] of Object.entries(tokens) as any)document.body.style.setProperty(key,`light-dark(${pair.light},${pair.dark})`);return()=>{}}},
 remote:{llm:{listProviders:async()=>({ok:true,value:[{id:'deepseek',name:'DeepSeek'}]}),listConfigurableProviders:async()=>({ok:true,value:[...providers,...Object.entries(forms.get('llm-pi-ai').getSnapshot().value.providers).map(([provider,value]:any)=>({provider,displayName:value.displayName,settingsNs:'llm-pi-ai',settingsPath:['providers',provider]}))]}),discoverModels:async(ns:string,request:any)=>{discoveries.push({ns,...request});return request.apiKey==='reject-test'?{ok:false,error:{message:'认证失败，请检查 API Key'}}:{ok:true,value:[{id:'vendor-alpha',name:'Alpha',contextWindow:128000},{id:'vendor-beta',name:'Beta'}]}}},session:{modelCatalog:async()=>({ok:true,value:{groups:[{id:'deepseek',models:[{id:'deepseek-chat',name:'DeepSeek Chat'}]}]}})},credentials:{set:async()=>({ok:true}),unset:async()=>({ok:true})}},
 slots:{subscribe:()=>()=>{},getVersion:()=>1,entries:(name:string)=>name==='settings.section'?[{options:{id:'plugins',label:'内置插件'}}]:[]},locale,settingsSchema:{rehydrate:(schema:any)=>schema,nodeAtPath:(schema:any,path:string[])=>path.reduce((node,key)=>node?.dict?.[key]??node?.inner,schema)},
}
let fixturePluginEnabled=true
ctx.remote.pluginInventory={list:async()=>({ok:true,value:{managementAvailable:true,entries:[{entryId:'fixture-optional',moduleName:'@fixture/optional',meta:{title:'任务提示',description:'可选的任务完成提示。'},enabled:fixturePluginEnabled,fiberPhase:fixturePluginEnabled?'active':null},{entryId:'ui-layout',moduleName:'@deepseek-ai/dsh-client-ui-layout',meta:{title:'界面布局'},enabled:true,fiberPhase:'active'}],agentPresets:[{id:'standard',name:'标准模式',isDefault:true,rows:[{entryId:'file-tool',moduleName:'@fixture/files',meta:{title:'文件工具'},enabled:true,fiberPhase:null}]}]}})}
ctx.remote.pluginManager={listPlugins:async()=>({ok:true,value:[{entryId:'fixture-optional',patchId:'fixture-optional'},{entryId:'ui-layout',patchId:'ui-layout'}]}),setPluginEnabled:async(_id:string,enabled:boolean)=>{fixturePluginEnabled=enabled;return {ok:true,value:{application:'applied'}}}}
let preferences={closeToTray:true,sidebarFooterCompat:true,sidebarFooterBalanced:true,notifications:true,turnCompleted:true,turnFailed:true,scheduleCompleted:true,scheduleFailed:true,browserAccess:false,networkExposure:'loopback',port:0,logLevel:'info',developerLogging:false}
const bridge:any={state:async()=>({preferences,profiles:['默认环境','测试环境'],selected:'默认环境',unavailableProfiles:[],version:'2.0.21-next',home:'开发界面示例目录',phase:'ready',busy:false}),command:async(command:any)=>{if(command.type==='preferences')preferences=command.preferences;return true}}
const runtime=createGuiRuntime(ctx,bridge)
void runtime.skin?.start()
void runtime.decorations?.start()
const editors:any[]=[],createEditor=runtime.modelEditor
runtime.modelEditor=(options:any)=>{const editor=createEditor(options);editors.push(editor);return editor}
runtime.open('models')
const renderSlot=(key:string,props:any,options:any)=>key==='settings.section'&&options.only==='dsh-web-gui-preferences'?<OwnPreferences runtime={runtime} renderSlot={renderSlot} {...props}/>:null
createRoot(document.getElementById('root')!).render(<SettingsGui runtime={runtime} renderSlot={renderSlot} wide/>)
;(globalThis as any).__settingsFixture={runtime,forms,discoveries,editors}
