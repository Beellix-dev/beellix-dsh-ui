import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'..')
test('publication metadata has one public identity and native bundle declaration',()=>{
 const manifest=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
 assert.notEqual(manifest.private,true,'npm publication is blocked by private:true')
 assert.equal(manifest.repository.url,'git+https://github.com/Beellix-dev/beellix-dsh-ui.git')
 assert.equal(manifest.exports['./locale/*.json'],'./locale/*.json')
 assert.ok(manifest.files.includes('locale/*.json'))
 for(const [language,title] of [['en','Beelli X UI'],['zh','Beelli X 界面增强']]){
  const {meta}=JSON.parse(readFileSync(resolve(root,'locale',language+'.json'),'utf8'))
  assert.equal(meta.title,title)
  assert.ok(meta.description)
 }
 assert.equal(manifest.publishConfig.access,'public')
 assert.equal(manifest.dsh.bundle.patch,'./cordis.patch.yml')
 assert.ok(manifest.engines.dsh)
 assert.ok(manifest.keywords.includes('dsh-plugin'))
})
