import test from 'node:test'
import assert from 'node:assert/strict'
import {fetchProviderModels} from '../src/settings-model-discovery.mjs'
import {createConnectionEditor} from '../src/settings-model-connections.mjs'

function editorFixture(){
 let state={status:'ready',writable:true,revision:2,value:{providers:{saved:{displayName:'原连接',baseURL:'https://api.example/v1',api:'openai-completions',apiKeyEnv:'OLD_KEY',headers:{'x-keep':'yes'},models:[{id:'alpha',contextWindow:8000,reasoningEfforts:{high:'high'}}]},other:{displayName:'保持'}}}}
 const listeners=new Set(),writes=[],credentials=new Map(),calls=[]
 const form={getSnapshot:()=>state,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),async mutate(ops,rev){if(rev!==state.revision)return false;writes.push(ops);const value=structuredClone(state.value);for(const op of ops){let target=value;for(const key of op.path.slice(0,-1))target=target[key]??={};target[op.path.at(-1)]=op.value}state={...state,value,revision:rev+1};return true}}
 const ctx={configForms:{get:()=>form},remote:{llm:{discoverModels:async(ns,request)=>{calls.push({ns,request});return {ok:true,value:[{id:'alpha',name:'Alpha'},{id:'beta'}]}}},credentials:{set:async(ref,key)=>(credentials.set(ref,key),{ok:true}),unset:async ref=>(credentials.delete(ref),{ok:true})}}}
 const mirror={getSnapshot:()=>({view:{namespaces:[{ns:'llm-pi-ai'}]}})}
 return {ctx,mirror,form,writes,credentials,calls,row:{provider:'saved',displayName:'原连接',settingsNs:'llm-pi-ai',settingsPath:['providers','saved']}}
}
test('connection editor fetches live models and saves only selected models without replacing siblings',async()=>{
 const fixture=editorFixture(),editor=createConnectionEditor(fixture.ctx,fixture.mirror,{row:fixture.row})
 await editor.discover();editor.toggle('beta');await editor.save()
 assert.equal(fixture.calls[0].ns,'dsh-web-gui-model-discovery');assert.equal(fixture.calls[0].request.provider,'saved')
 const value=fixture.form.getSnapshot().value
 assert.equal(value.providers.other.displayName,'保持');assert.equal(value.providers.saved.headers['x-keep'],'yes')
 assert.equal(value.providers.saved.models.length,2);assert.equal(value.providers.saved.models[0].reasoningEfforts.high,'high')
})
test('failed config write removes only the newly generated key and retains the input',async()=>{
 const fixture=editorFixture(),editor=createConnectionEditor(fixture.ctx,fixture.mirror,{row:fixture.row})
 editor.edit('key','test-only-new-key');await editor.discover();fixture.form.mutate=async()=>false
 await assert.rejects(editor.save(),/未接受/)
 assert.equal(fixture.credentials.size,0);assert.equal(editor.getSnapshot().key,'test-only-new-key')
 assert.equal(fixture.form.getSnapshot().value.providers.saved.apiKeyEnv,'OLD_KEY')
})
test('changed addresses require a new listing and stale editors never overwrite configuration',async()=>{
 const fixture=editorFixture(),editor=createConnectionEditor(fixture.ctx,fixture.mirror,{row:fixture.row})
 editor.edit('baseURL','https://new.example/v1');editor.edit('key','fixture-only-replacement');await assert.rejects(editor.save(),/重新获取/)
 await editor.discover();fixture.form.mutate=async()=>false;await assert.rejects(editor.save(),/未接受/)
 editor.dispose();await assert.rejects(editor.save(),/已关闭/)
})
test('manual model input cannot carry an old key to an edited endpoint',async()=>{
 const fixture=editorFixture(),editor=createConnectionEditor(fixture.ctx,fixture.mirror,{row:fixture.row})
 editor.edit('baseURL','https://different.example/v1');editor.addModel('manual-id')
 await assert.rejects(editor.save(),/地址.*API Key/)
 assert.equal(fixture.writes.length,0)
})
test('native DeepSeek configuration retains its own Messages default rather than pi-ai defaults',()=>{
 const fixture=editorFixture();fixture.form.getSnapshot=()=>({status:'ready',writable:true,revision:0,value:{apiKeyEnv:'DEEPSEEK_API_KEY',models:[{id:'deepseek-flash'}]}})
 const editor=createConnectionEditor(fixture.ctx,fixture.mirror,{row:{provider:'deepseek-official',displayName:'DeepSeek',settingsNs:'native',settingsPath:[]}})
 assert.equal(editor.getSnapshot().baseURL,'https://api.deepseek.com/anthropic');assert.equal(editor.getSnapshot().api,'anthropic-messages')
 editor.edit('key','fixture-only');editor.dispose();assert.equal(editor.getSnapshot().key,'')
})
test('custom connections keep a custom identity instead of inheriting a route-less preset',()=>{
 const fixture=editorFixture(),editor=createConnectionEditor(fixture.ctx,fixture.mirror,{preset:{name:'自定义',baseURL:'https://custom.example/v1',api:'openai-completions'}})
 assert.match(editor.getSnapshot().provider,/^dshgui-custom-/)
})

test('model discovery calls the selected endpoint, follows pages and preserves real metadata',async()=>{
 const calls=[]
 const models=await fetchProviderModels({baseURL:'https://vendor.example/v1',api:'anthropic-messages',apiKey:'test-key'},{fetcher:async(url,options)=>{calls.push({url,options});return Response.json(calls.length===1?{data:[{id:'alpha',context_window:10000}],has_more:true,last_id:'alpha'}:{data:[{id:'beta'},{id:'alpha'}],has_more:false})}})
 assert.deepEqual(models,[{id:'alpha',contextWindow:10000},{id:'beta'}])
 assert.match(calls[1].url,/after_id=alpha/);assert.equal(calls[0].options.headers['x-api-key'],'test-key');assert.equal(calls[0].options.redirect,'error')
})
test('Qwen uses its real listing API and consumes output pagination',async()=>{
 const calls=[]
 const result=await fetchProviderModels({baseURL:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',api:'openai-completions'},{fetcher:async url=>{calls.push(url);return Response.json({output:{total:2,page_size:1,models:[{model:'qwen-'+calls.length,model_info:{context_window:8000}}]}})}})
 assert.equal(result.length,2);assert.match(calls[0],/\/api\/v1\/models\?/);assert.match(calls[1],/page_no=2/)
})
test('saved credentials never follow an edited endpoint and errors do not accept partial pages',async()=>{
 let resolved=false,called=false
 await assert.rejects(fetchProviderModels({provider:'saved',baseURL:'https://new.example/v1'},{lookup:()=>({apiKeyEnv:'SAVED',baseURL:'https://old.example/v1'}),resolveKey:async()=>{resolved=true;return 'secret'},fetcher:async()=>{called=true}}),/地址已改变/)
 assert.equal(resolved,false);assert.equal(called,false)
 let pages=0
 await assert.rejects(fetchProviderModels({baseURL:'https://api.example/v1'},{fetcher:async()=>++pages===1?Response.json({data:[{id:'first'}],has_more:true}):new Response('',{status:403})}),/认证失败/)
})
test('listing rejects credential URLs, unsupported formats and oversized payloads',async()=>{
 await assert.rejects(fetchProviderModels({baseURL:'https://key:secret@api.example/v1'}),/不含密钥/)
 await assert.rejects(fetchProviderModels({baseURL:'https://api.example/v1'},{fetcher:async()=>Response.json({message:'bad'})}),/格式不受支持/)
 await assert.rejects(fetchProviderModels({baseURL:'https://api.example/v1'},{fetcher:async()=>new Response(' '.repeat(4*1024*1024+1))}),/列表过大/)
})
