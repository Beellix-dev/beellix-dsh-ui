import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {defaultOpening,normalizeOpening,openingInjection} from '../src/opening.mjs'
test('early opening uses the structured public injection table and has bounded configuration',()=>{
 assert.deepEqual(normalizeOpening(defaultOpening),defaultOpening)
 assert.throws(()=>normalizeOpening({enabled:true,duration:999999}),/无效/)
 const row=openingInjection({enabled:false,duration:800})
 assert.equal(row.kind,'script');assert.equal(row.placement,'body')
 vm.runInNewContext(row.text,{document:{body:{}}})
 assert.doesNotMatch(row.text,/__DSH_BOOT_READY__|desktopNext|beellix|Beelli/)
})

test('custom startup media stays local and data-only with a bounded handoff',()=>{
 const media={kind:'video',src:'/dsh-web-gui/media/'+'a'.repeat(64)+'.mp4',name:'开场.mp4',fit:'cover'}
 assert.deepEqual(normalizeOpening({enabled:true,duration:3000,media}).media,media)
 assert.throws(()=>normalizeOpening({enabled:true,duration:800,media:{...media,src:'https://example.com/intro.mp4'}}),/素材/)
 const gif={...media,kind:'image',src:'/dsh-web-gui/media/'+'b'.repeat(64)+'.gif'}
 assert.equal(normalizeOpening({enabled:true,duration:800,media:gif}).media.kind,'image')
 assert.throws(()=>normalizeOpening({enabled:true,duration:800,media:{...gif,src:media.src}}),/素材/)
})
