import test from 'node:test'
import assert from 'node:assert/strict'
import * as directory from '../src/plugin-market-directory.mjs'

test('adding a custom market selects the Host-issued record and retries without creating a duplicate',async()=>{
 const calls=[]
 let sources=[]
 let rejectSelection=true
 const request=async(action)=>{
  calls.push(action)
  if(action.action==='add-standard')sources=[{sourceRecordId:'host-id',manifestUrl:action.manifestUrl,enabled:false}]
  if(action.action==='select'){
   if(rejectSelection)throw Error('offline')
   sources=sources.map(row=>({...row,enabled:row.sourceRecordId===action.sourceRecordId}))
  }
  return sources
 }
 const manifestUrl='https://catalog.example/manifest.json'
 await assert.rejects(async()=>directory.activateMarketDirectory({manifestUrl},sources,request),/offline/)
 rejectSelection=false
 const selected=await directory.activateMarketDirectory({manifestUrl},sources,request)
 assert.equal(selected[0].enabled,true)
 assert.deepEqual(calls,[
  {action:'add-standard',manifestUrl},
  {action:'select',sourceRecordId:'host-id'},
  {action:'select',sourceRecordId:'host-id'},
 ])
})

test('a built-in market is picked by its provider key and an active record is reused',async()=>{
 const saved=[{sourceRecordId:'host-id',builtInProviderKey:'known',enabled:true}]
 const selected=await directory.activateMarketDirectory({builtInProviderKey:'known'},saved,()=>assert.fail('no mutation needed'))
 assert.equal(selected,saved)
})

test('re-reads Host state if the profile replaces a provisional directory during selection',async()=>{
 let reads=0
 const picked=[]
 const actual={sourceRecordId:'persisted',builtInProviderKey:'known',enabled:false}
 const selected=await directory.openMarketDirectory(
  {builtInProviderKey:'known'},
  async()=>({sources:[reads++?actual:{...actual,sourceRecordId:'temporary'}]}),
  async action=>{
   picked.push(action.sourceRecordId)
   if(action.sourceRecordId==='temporary')throw Error('source not found')
   return [{...actual,enabled:true}]
  },
 )
 assert.deepEqual(picked,['temporary','persisted'])
 assert.equal(selected.sources[0].enabled,true)
})
