import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultDecorations,normalizeDecorations,createDecorationStore,petPlacement,activePet} from '../src/settings-personalization.mjs'
test('own decoration settings reject remote assets and invalid display values',()=>{
 assert.deepEqual(normalizeDecorations(defaultDecorations),defaultDecorations)
 const migrated=normalizeDecorations({pet:{...petPlacement,enabled:true,name:'小贝',image:'old portrait',motion:'greet'}}).petLibrary
 assert.equal(migrated.enabled,false)
 assert.equal(migrated.activeId,null)
 assert.deepEqual(migrated.entries,[])
 assert.throws(()=>normalizeDecorations({pet:{...petPlacement,actionImage:'data:image/gif;base64,PHN2Zz4='}}),/格式/)
})
test('pet library migrates existing pets and keeps actions and placement independent',()=>{
 const gif='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
 const idle={id:'custom-idle',name:'待机',image:gif},wave={id:'custom-wave',name:'挥手',image:gif}
 const {petLibrary:unassigned}=normalizeDecorations({pet:{...petPlacement,motion:'custom',actionImage:gif}})
 assert.deepEqual(unassigned.unassignedActions,[{id:'custom-legacy',name:'我的动作',image:gif}])
 const {petLibrary}=normalizeDecorations({pet:{...petPlacement,enabled:true,right:300,name:'旧宠物',defaultActionId:idle.id,actions:[idle,wave]}})
 const first=activePet(petLibrary)
 assert.equal(first.name,'旧宠物')
 assert.equal(first.right,300)
 assert.deepEqual(first.actions,[idle,wave])
 const second={...first,id:'pet-second',name:'新宠物',right:60,actions:[idle]}
 const configured={...petLibrary,activeId:second.id,entries:[first,second]}
 const normalized=normalizeDecorations({petLibrary:configured}).petLibrary
 assert.deepEqual(normalized.entries,[first,second])
 assert.deepEqual(activePet(normalized),second)
 assert.throws(()=>normalizeDecorations({petLibrary:{...configured,entries:[first,first]}}),/宠物编号/)
 assert.throws(()=>normalizeDecorations({petLibrary:{...configured,activeId:'pet-missing'}}),/列表中的宠物/)
 assert.throws(()=>normalizeDecorations({petLibrary:{...configured,entries:[first,{...second,actions:[idle,idle]}]}}),/动作编号/)
 assert.throws(()=>normalizeDecorations({petLibrary:{...configured,entries:[first,{...second,actions:[]}]}}),/默认动作/)
 assert.throws(()=>normalizeDecorations({petLibrary:{...configured,entries:[first,{...second,size:9999}]}}),/大小/)
})
test('own decoration saves use acknowledged native configuration and recover on reopening',async()=>{
 let state={status:'ready',writable:true,revision:0,value:{decorations:JSON.stringify(defaultDecorations)}}
 const listeners=new Set(),form={getSnapshot:()=>state,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),mutate:async ops=>{state={...state,revision:state.revision+1,value:{...state.value,decorations:ops[0].value}};for(const fn of listeners)fn();return true}}
 const ctx={configForms:{get:()=>form,describe:()=>({ensure:async()=>{}})}}
 const action={id:'custom-idle',name:'待机',image:'/dsh-web-gui/media/'+'a'.repeat(64)+'.webp',durationMs:4000}
 const entry={...petPlacement,id:'pet-first',name:'桌宠',size:144,defaultActionId:action.id,actions:[action]}
 const store=createDecorationStore(ctx);await store.start();await store.save({...defaultDecorations,petLibrary:{enabled:true,activeId:entry.id,entries:[entry]}})
 const reopened=createDecorationStore(ctx);await reopened.start()
 const library=reopened.getSnapshot().value.petLibrary
 assert.equal(library.enabled,true)
 assert.equal(activePet(library).size,144)
 assert.equal(activePet(library).defaultActionId,action.id)
 store.dispose();reopened.dispose()
})
