import test from 'node:test'
import assert from 'node:assert/strict'
import {createStartupEffects,decorationKind,pluginManagerKey,decorationAvailability} from '../src/settings-decorations.mjs'
import {namespacePage} from '../src/settings-definitions.mjs'

test('entry effects play once, respect reduced motion and release active animation',async()=>{
 let listener,reduced=false,calls=0,cancelled=0
 const ctx={configForms:{get:()=>({subscribe:fn=>(listener=fn,()=>{}),getSnapshot:()=>({status:'ready',value:{startupEffect:'soft'}})}),describe:()=>({ensure:async()=>{}})}}
 const env={document:{querySelector:()=>({animate:()=>{calls++;return {cancel:()=>cancelled++}}})},matchMedia:()=>({matches:reduced})}
 const effects=createStartupEffects(ctx,env)
 await effects.start();listener();assert.equal(calls,1)
 effects.play('fade');assert.equal(calls,2);assert.equal(cancelled,1)
 reduced=true;assert.equal(effects.play('fade'),false);assert.equal(calls,2)
 effects.dispose();assert.throws(()=>effects.play('soft'),/释放/)
})
test('a late configuration response cannot play an effect after disposal',async()=>{
 let complete,calls=0
 const effects=createStartupEffects({configForms:{get:()=>({subscribe:()=>()=>{},getSnapshot:()=>({status:'ready',value:{startupEffect:'fade'}})}),describe:()=>({ensure:()=>new Promise(resolve=>complete=resolve)})}},{document:{querySelector:()=>({animate:()=>calls++})}})
 const started=effects.start();effects.dispose();complete();await started;assert.equal(calls,0)
})
test('decorations have one destination, including late-loaded startup and pet settings',()=>{
 for(const id of ['pet','web-ui-pet','ui-pet']){assert.equal(decorationKind(id),'pet');assert.equal(namespacePage(id),'mascot')}
 assert.equal(namespacePage('startup-animation'),'effects')
 assert.equal(namespacePage('wallpaper-engine'),'wallpaper')
 assert.equal(decorationKind('llm-petroleum'),null)
 assert.equal(decorationKind('agent-loop'),null)
})
test('native main panel keys drive plugin navigation and namespace-only decorations do not duplicate',()=>{
 assert.equal(pluginManagerKey([{options:{key:'conversation'}},{options:{key:'plugins',id:'unrelated'}}]),'plugins')
 assert.equal(pluginManagerKey([{options:{id:'plugins'}}]),null)
 assert.equal(decorationAvailability([],[{ns:'wallpaper-engine'}],'wallpaper'),true)
 assert.equal(decorationAvailability([{id:'web-ui-pet'}],[],'pet'),true)
 assert.equal(decorationAvailability([],[],'wallpaper'),false)
})
