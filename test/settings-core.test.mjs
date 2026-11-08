import test from 'node:test'
import assert from 'node:assert/strict'
import {createSettingsRegistry,createSettingsDraft,settingsFields} from '../src/settings-core.mjs'

test('contributions grow beyond built-ins, replacement disposal cannot remove a new owner',()=>{
 const registry=createSettingsRegistry(),old=registry.register({id:'skin',page:'appearance',title:'皮肤'})
 for(let i=0;i<19;i++)registry.register({id:'extra-'+i,page:'extensions',title:'扩展'+i})
 registry.register({id:'skin',page:'appearance',title:'新皮肤'})
 old()
 assert.equal(registry.getSnapshot().length,20)
 assert.equal(registry.getSnapshot().find(x=>x.id==='skin').title,'新皮肤')
 registry.dispose();assert.equal(registry.getSnapshot().length,0)
})

function form(){let state={status:'ready',writable:true,value:{enabled:false,nested:{limit:2,other:9}},revision:4};const listeners=new Set(),writes=[];return {writes,getSnapshot:()=>state,subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),change(value){state={...state,...value};for(const f of listeners)f()},async mutate(ops,revision){writes.push({ops,revision});return true}}}
test('draft commits minimal nested operations with the opened revision; preserves pending edits on refusal',async()=>{
 const face=form(),draft=createSettingsDraft(face)
 draft.set(['nested','limit'],5)
 face.mutate=async(ops,revision)=>{face.writes.push({ops,revision});return false}
 await assert.rejects(draft.save(),/未接受/)
 assert.deepEqual(face.writes[0],{ops:[{op:'set',path:['nested','limit'],value:5}],revision:4})
 assert.equal(draft.getSnapshot().dirty,true)
 assert.equal(draft.getSnapshot().changes[0].value,5)
 draft.dispose()
})
test('draft refuses stale revision, non-writable schema and mutations after disposal',async()=>{
 const face=form(),draft=createSettingsDraft(face)
 draft.set(['enabled'],true);face.change({revision:5})
 await assert.rejects(draft.save(),/已变化/);assert.equal(face.writes.length,0)
 draft.discard();face.change({writable:false});draft.set(['enabled'],true)
 await assert.rejects(draft.save(),/只读/)
 draft.dispose();await assert.rejects(draft.save(),/释放/)
})
test('schema fields preserve real enums and bounds and mark secrets without revealing values',()=>{
 const fields=settingsFields({type:'object',dict:{mode:{type:'union',list:[{type:'const',value:'light'},{type:'const',value:'dark'}]},count:{type:'number',meta:{min:1,max:9}},key:{type:'string',meta:{role:'secret'}},hidden:{type:'string',meta:{hidden:true}}}})
 assert.deepEqual(fields[0].options,['light','dark']);assert.equal(fields[1].max,9)
 assert.equal(fields[2].secret,true);assert.equal(fields.length,3)
})
