import test from 'node:test'
import assert from 'node:assert/strict'
import {createSettingsDesktopStore} from '../src/settings-desktop-store.mjs'
test('native preference writes retain unrelated fields and are serialized',async()=>{
 let state={preferences:{notifications:true,closeToTray:true,port:0}},writes=[]
 const store=createSettingsDesktopStore({state:async()=>structuredClone(state),command:async command=>{writes.push(command);state={preferences:command.preferences};return true}})
 await Promise.all([store.save('notifications',false),store.save('port',1234)])
 assert.deepEqual(state.preferences,{notifications:false,closeToTray:true,port:1234});assert.equal(writes.length,2)
 assert.equal(store.getSnapshot().busy,false);store.dispose()
})
test('a rejected native write is shown without claiming success',async()=>{
 const store=createSettingsDesktopStore({state:async()=>({preferences:{notifications:true}}),command:async()=>false})
 await assert.rejects(store.save('notifications',false),/未接受/)
 assert.match(store.getSnapshot().error,/未接受/);assert.equal(store.getSnapshot().busy,false);store.dispose()
})
test('disposal prevents queued native operations from starting',async()=>{
 let calls=0
 const store=createSettingsDesktopStore({state:async()=>({preferences:{notifications:true}}),command:async()=>{calls++;return true}})
 store.dispose();await assert.rejects(store.save('notifications',false),/释放/);assert.equal(calls,0)
})
