import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSidebar,orderedPanels,createSidebarModules} from '../src/sidebar-modules.mjs'

test('sidebar visibility and order apply only to registered panels',()=>{
 const preferences=normalizeSidebar({hidden:['tasks'],order:['knowledge','plugins'],environments:['workspace']})
 assert.deepEqual(orderedPanels([{id:'tasks'},{id:'plugins'},{id:'knowledge'}],preferences).map(row=>row.id),['knowledge','plugins'])
 assert.deepEqual(orderedPanels([{id:'plugins'}],preferences).map(row=>row.id),['plugins'])
 assert.throws(()=>normalizeSidebar({...preferences,environments:['a','b','c','d']}),/三个/)
 assert.throws(()=>normalizeSidebar({hidden:[{}]}),/标识/)
})
test('environment contributions require their own binding and session operation; unload removes the provider',async()=>{
 let value={sidebar:'{"hidden":[],"order":[],"environments":["workspace"]}'},revision=0
 const listeners=new Set(),form={getSnapshot:()=>({status:'ready',writable:true,value,revision}),subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),async mutate(ops,expected){if(expected!==revision)return false;value={...value,[ops[0].path[0]]:ops[0].value};revision++;for(const fn of listeners)fn();return true}}
 const store=createSidebarModules({configForms:{get:()=>form,describe:()=>({ensure:async()=>{}})}})
 await store.start()
 assert.throws(()=>store.registerEnvironment({id:'scene',title:'场景',render(){}}),/独立环境/)
 const entry={id:'scene',title:'场景',environmentId:'scene/one',render(){},startSession(){}}
 const unload=store.registerEnvironment(entry)
 assert.equal(store.getSnapshot().providers[0].environmentId,'scene/one')
 assert.throws(()=>store.registerEnvironment(entry),/重复/)
 await store.save({hidden:['tasks'],order:[],environments:['workspace','scene']})
 assert.deepEqual(JSON.parse(value.sidebar).environments,['workspace','scene'])
 unload();assert.equal(store.getSnapshot().providers.length,0)
 store.dispose();assert.equal(listeners.size,0)
 assert.throws(()=>store.registerEnvironment(entry),/释放/)
})
