import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {setImmediate as nextTurn} from 'node:timers/promises'
import {applyArchiveAgentLifecycle} from '../src/archive-agent-lifecycle.mjs'
import {selectedArchiveIds} from '../src/archive-maintenance.mjs'
import {createArchiveMaintenanceHandler} from '../src/archive-maintenance-host.mjs'
import {archiveApi} from '../src/archive-maintenance-runtime.mjs'

function request(method,input,{allowed=true,contentType='application/json'}={}){
 return Object.assign(Readable.from(input===undefined?[]:[Buffer.from(JSON.stringify(input))]),{
  method,url:archiveApi,allowed,headers:{'content-type':contentType},
 })
}

async function submit(handler,request){
 const response={writeHead(code){this.code=code},end(value){this.body=JSON.parse(value)}}
 await handler(request,response)
 return [response.code,response.body]
}

test('archive deletion accepts a fixed, bounded set of session identities',()=>{
 assert.deepEqual(selectedArchiveIds(['a','b','a']),['a','b'])
 for(const value of [[],[''],[null],Array(101).fill('x')])assert.throws(()=>selectedArchiveIds(value))
})

test('only authorized confirmation requests return completed deletion or recovery results',async()=>{
 const calls=[]
 const result={available:true,last:{results:[{id:'a',state:'deleted'}]}}
 const handler=createArchiveMaintenanceHandler({
  admit:req=>req.allowed?undefined:403,state:async()=>({available:true}),enqueue:async job=>{calls.push(job);return result},
 })
 assert.deepEqual(await submit(handler,request('GET')), [200,{available:true}])
 assert.equal((await submit(handler,request('POST',{ids:['a']},{allowed:false})))[0],403)
 assert.equal((await submit(handler,request('POST',{ids:['a']},{contentType:'text/plain'})))[0],405)
 assert.equal((await submit(handler,request('POST',{ids:[]})))[0],409)
 assert.deepEqual(calls,[])
 assert.deepEqual(await submit(handler,request('POST',{ids:['a','b','a']})),[200,result])
 assert.deepEqual(await submit(handler,request('POST',{resume:true})),[200,result])
 assert.deepEqual(calls,[{targets:['a','b']},{resume:true}])
})

test('archiving releases only the owned session after the registry publishes its new state',async()=>{
 const events=new Map(),disposals=[]
 const workspaceRegistry={archivedSessionIds:[]}
 const native={ctx:{},async create({id}){
  return {agent:{id,whenIdle:async()=>{}},dispose:async()=>{disposals.push(id)}}
 }}
 let lifecycle
 const host={
  agents:{[Symbol.for('cordis.original')]:native},workspaceRegistry,
  on:(event,listener)=>events.set(event,listener),effect:()=>{},
  provide:(_name,service)=>{lifecycle=service},
 }
 applyArchiveAgentLifecycle({inject:(_keys,apply)=>apply(host)})
 await lifecycle.registry.create({id:'archived'})
 await lifecycle.registry.create({id:'active'})
 events.get('domain/changed')({domain:'workspace',table:'',operation:'put',value:{archivedSessionIds:['archived','other-owner']}})
 workspaceRegistry.archivedSessionIds=['archived','other-owner']
 await nextTurn()
 assert.deepEqual(disposals,['archived'])
 await lifecycle.release('archived')
 assert.deepEqual(disposals,['archived'])
})
