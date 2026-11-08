import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdir,mkdtemp} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createMediaHandler} from '../src/settings-media-host.mjs'
test('own media upload is bounded, origin checked, content addressed and supports video ranges',async()=>{
 const artifacts=resolve(import.meta.dirname,'../.artifacts');await mkdir(artifacts,{recursive:true});const root=await mkdtemp(join(artifacts,'own-media-'))
 let origin='';const handler=createMediaHandler(root,'dsh-app://app'),server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port
 try{
  const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(12)])
  const bad=await fetch(origin+'/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':'video/mp4',Origin:'https://foreign.example'},body:bytes});assert.equal(bad.status,403)
  const invalid=await fetch(origin+'/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':'video/mp4'},body:'invalid'});assert.equal(invalid.status,400)
  const upload=()=>fetch(origin+'/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':'video/mp4'},body:bytes}).then(r=>r.json())
  const result=await upload();assert.equal(result.ok,true);assert.match(result.url,/\/media\/[a-f\d]{64}\.mp4$/);assert.equal((await upload()).url,result.url)
  const ranged=await fetch(origin+result.url,{headers:{Range:'bytes=4-7'}});assert.equal(ranged.status,206);assert.equal(await ranged.text(),'ftyp')
  const unsatisfiable=await fetch(origin+result.url,{headers:{Range:'bytes=999-'}});assert.equal(unsatisfiable.status,416)
  const missing=await fetch(origin+'/dsh-web-gui/media/not-a-file.mp4');assert.equal(missing.status,404)
  const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')
  const animation=await fetch(origin+'/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':'image/gif'},body:gif}).then(r=>r.json());assert.equal(animation.ok,true);assert.match(animation.url,/\.gif$/)
  const image=await fetch(origin+animation.url);assert.equal(image.headers.get('content-type'),'image/gif');assert.deepEqual(Buffer.from(await image.arrayBuffer()),gif)
  const spoofed=await fetch(origin+'/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':'image/gif'},body:bytes});assert.equal(spoofed.status,400)
  const webp=Buffer.from('UklGRoQAAABXRUJQVlA4WAoAAAACAAAAAQAAAQAAQU5JTQYAAAAAAAAAAQBBTk1GKAAAAAAAAAAAAAEAAAEAAMgAAAJWUDhMDwAAAC8BQAAABxD9j/4HIqL/AQBBTk1GKAAAAAAAAAAAAAEAAAEAACwBAABWUDhMDwAAAC8BQAAABxDR//4HIqL/AQA=','base64')
  const actionUpload=await fetch(origin+'/dsh-web-gui/media',{method:'POST',headers:{'Content-Type':'image/webp'},body:webp})
  assert.equal(actionUpload.status,200)
  const action=await actionUpload.json()
  assert.equal(action.durationMs,500)
  const actionImage=await fetch(origin+action.url)
  assert.equal(actionImage.headers.get('content-type'),'image/webp')
  assert.deepEqual(Buffer.from(await actionImage.arrayBuffer()),webp)
  const webpIdle=Buffer.from(await (await fetch(origin+action.url+'?pet-idle=1')).arrayBuffer())
  const loopOffset=webp.indexOf('ANIM')+12
  assert.equal(webpIdle.readUInt16LE(loopOffset),0)
  assert.equal(webp.readUInt16LE(loopOffset),1)
  assert.deepEqual(Buffer.from(await (await fetch(origin+action.url)).arrayBuffer()),webp)
  const petUpload=body=>fetch(origin+'/dsh-web-gui/media?pet-action=1',{method:'POST',headers:{'Content-Type':'image/gif'},body})
  assert.equal((await petUpload(gif)).status,400)
  const gifMotion=Buffer.from('47494638396101000100800000ff000000ff0021f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b','hex')
  const gifAction=await (await petUpload(gifMotion)).json()
  assert.equal(gifAction.durationMs,200)
  const gifIdle=Buffer.from(await (await fetch(origin+gifAction.url+'?pet-idle=1')).arrayBuffer())
  assert.ok(gifIdle.includes(Buffer.from('NETSCAPE2.0')))
  assert.deepEqual(Buffer.from(await (await fetch(origin+gifAction.url)).arrayBuffer()),gifMotion)
 }finally{await new Promise(resolve=>server.close(resolve))}
})
