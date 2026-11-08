import test from 'node:test'
import assert from 'node:assert/strict'
import {listMarketSources,ensureMarketSource} from '../src/plugin-market-source.mjs'

test('market switching keeps other providers enabled and only activates an inactive target',async()=>{
 const rows=[{name:'dshmarket',enabled:true},{name:'dsh-community-market',enabled:false},{name:'other',enabled:true}]
 const calls=[]
 let application='failed'
 const manager={
  listBundles:async()=>({ok:true,value:rows.map(row=>({...row}))}),
  setBundleEnabled:async(name,enabled)=>{
   calls.push([name,enabled])
   if(application==='applied')rows.find(row=>row.name===name).enabled=enabled
   return {ok:true,value:{application}}
  }
 }
 assert.equal((await listMarketSources(manager)).length,2)
 await assert.rejects(ensureMarketSource(manager,'dsh-community-market'),/切换/)
 assert.deepEqual(calls,[['dsh-community-market',true]])
 assert.equal(rows[0].enabled,true)
 application='restart-required'
 assert.equal(await ensureMarketSource(manager,'dsh-community-market'),'restart')
 assert.equal(rows[0].enabled,true)
 application='applied'
 assert.equal(await ensureMarketSource(manager,'dsh-community-market'),'applied')
 assert.equal(await ensureMarketSource(manager,'dshmarket'),'applied')
 assert.equal(calls.length,3)
 assert.equal(rows[0].enabled,true)
 assert.equal(rows[2].enabled,true)
})
