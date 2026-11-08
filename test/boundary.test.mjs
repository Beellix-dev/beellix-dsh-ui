import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
const root=resolve(import.meta.dirname,'..')
test('appearance merges theme and component colours into five destinations',async()=>{
 const {guiNavigation,namespacePage}=await import('../src/settings-definitions.mjs')
 assert.deepEqual(guiNavigation.find(row=>row.title==='外观').pages,['appearance','wallpaper','fonts','mascot','effects'])
 assert.equal(namespacePage('wallpaper-engine'),'wallpaper')
 assert.equal(namespacePage('web-ui-pet'),'mascot')
 assert.equal(namespacePage('startup-animation'),'effects')
})
test('DSH Web GUI has its own package identity and native configuration',async()=>{
 const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
 assert.equal(manifest.name,'@beellix-ai/dsh-web-gui')
 assert.equal(manifest.version,'0.1.1')
 const patch=await readFile(join(root,'cordis.patch.yml'),'utf8')
 assert.match(patch,/id: dsh-web-gui/)
 assert.doesNotMatch(patch,/dsh-beellix-plugin|beellix-settings-workspace/)
})
test('runtime and builds do not import a middle platform or start its services',async()=>{
 for(const area of ['src','scripts'])for(const name of await readdir(join(root,area))){
  if(!/\.(mjs|ts|tsx|css)$/.test(name))continue
  const source=await readFile(join(root,area,name),'utf8')
  assert.doesNotMatch(source,/(?:from|import\s*\()[^\n]*(?:platform\/(?:community|enterprise)|\.\.\/(?:community|enterprise))/,name)
  assert.doesNotMatch(source,/beellix-settings-workspace|beellix-preferences|\/beellix-ui\/media|beellixSettings|Beelli X|BEELLIX_MODEL_|resolve\(home,'Beellix'/,name)
 }
})
