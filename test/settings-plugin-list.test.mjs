import test from 'node:test'
import assert from 'node:assert/strict'
import {createPluginList,pluginPhase} from '../src/settings-plugin-list.mjs'

function fixture(){
 let enabled=true,outcome='applied',writes=[],finish
 const entry=()=>({entryId:'optional-tool',moduleName:'@example/optional-tool',enabled,fiberPhase:enabled?'active':null,meta:{title:{zh:'工具'},description:{zh:'说明'}}})
 const ctx={locale:{resolveText:value=>value.zh},remote:{pluginInventory:{list:async()=>({ok:true,value:{managementAvailable:true,entries:[entry(),{entryId:'ui-layout',moduleName:'@deepseek-ai/dsh-client-ui-layout',enabled:true,fiberPhase:'active'}],agentPresets:[{id:'standard',isDefault:true,rows:[{...entry(),entryId:'session-only'}]}]}})},pluginManager:{listPlugins:async()=>({ok:true,value:[{...entry(),patchId:'optional-tool'},{entryId:'ui-layout',patchId:'ui-layout'}]}),setPluginEnabled:async(id,value)=>{writes.push({id,value});if(outcome==='deferred')await new Promise(resolve=>finish=resolve);if(outcome==='failed')return {ok:true,value:{application:'failed',error:{code:'stop-profile'}}};enabled=value;return {ok:true,value:{application:outcome}}}}}}
 return {ctx,writes,setOutcome:value=>outcome=value,complete:()=>finish(),store:createPluginList(ctx)}
}
test('only addressable global optional entries have controls; mode rows and required UI are protected',async()=>{
 const f=fixture();await f.store.load()
 assert.equal(f.store.getSnapshot().entries[0].canToggle,true)
 assert.equal(f.store.getSnapshot().entries[1].canToggle,false)
 await assert.rejects(f.store.toggle('session-only',false),/不能/)
 await assert.rejects(f.store.toggle('ui-layout',false),/不能/)
 assert.equal(f.writes.length,0)
})
test('failed toggles keep observed enablement and expose failure; acknowledged changes re-read inventory',async()=>{
 const f=fixture();await f.store.load();f.setOutcome('failed')
 await assert.rejects(f.store.toggle('optional-tool',false),/失败/)
 assert.equal(f.store.getSnapshot().entries[0].enabled,true);assert.equal(f.store.getSnapshot().notice,'')
 f.setOutcome('applied');await f.store.toggle('optional-tool',false)
 assert.equal(f.store.getSnapshot().entries[0].enabled,false);assert.equal(f.store.getSnapshot().busy,null)
})
test('restart-required is distinct from applied; requested disabled but live entries remain visibly running',async()=>{
 const f=fixture();await f.store.load();f.setOutcome('restart-required');await f.store.toggle('optional-tool',false)
 assert.match(f.store.getSnapshot().notice,/重启/)
 assert.equal(pluginPhase({enabled:false,fiberPhase:'active'}),'等待停止')
 assert.equal(pluginPhase({enabled:true,fiberPhase:null}),'未加载')
 assert.equal(pluginPhase({enabled:true,fiberPhase:null},true),'随会话加载')
})
