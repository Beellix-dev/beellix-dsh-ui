/** Build this GUI only. Native DSH services are supplied by the desktop host. */
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync,existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {build} from 'tsdown'

const root=resolve(import.meta.dirname,'..'),project=resolve(root,'../../..')
const args=process.argv.slice(2)
if(args.length&&!(args.length===2&&args[0]==='--out'&&args[1]))throw Error('Usage: node scripts/build.mjs [--out <directory>]')
const monorepo=existsSync(join(project,'package.json'))&&JSON.parse(readFileSync(join(project,'package.json'),'utf8')).name==='@beellix-ai/plugin-development'
const out=args.length?resolve(args[1]):monorepo?join(project,'dev/artifacts/dsh-web-gui-build/package'):root
if(['src','test','scripts','assets','locale'].some(name=>out===join(root,name)||out.startsWith(join(root,name)+'/')||out.startsWith(join(root,name)+'\\')))throw Error('Build output cannot overwrite source directories')
const compiled=out===root?join(root,'.build'):resolve(out,'../build')
const sourceManifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
mkdirSync(join(out,'lib/assets/skins'),{recursive:true})
const styles=['settings-theme.css','settings-gui.css'].map(file=>readFileSync(join(root,'src',file),'utf8')).join('\n')
const native=['react','react-dom','react/jsx-runtime','@deepseek-ai/cordis','@deepseek-ai/dsh-client-store','@deepseek-ai/dsh-client-ui-primitives']
await build({config:false,entry:{client:join(root,'src/settings-client.ts')},outDir:compiled,format:'cjs',platform:'browser',target:'es2022',dts:false,clean:false,
 deps:{neverBundle:native,alwaysBundle:id=>!native.includes(id)},define:{'process.env.NODE_ENV':'"production"','process.env.DSH_CLIENT_VERSION':'"0.2.1-rc.4"'},
 outputOptions:{entryFileNames:'settings.cjs',codeSplitting:false}})
const code=readFileSync(join(compiled,'settings.cjs'),'utf8')
writeFileSync(join(out,'lib/client.js'),`window.__ModuleLoader__.load({id:${JSON.stringify(sourceManifest.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;try{\n${code}\nconst dshguiNativeSettingsApply=module.exports.apply;return {...module.exports,apply(ctx){ctx.effect(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(styles)};document.head.append(style);return()=>style.remove()},'DSH Web GUI：原生设置组件样式');try{return dshguiNativeSettingsApply(ctx)}catch(error){console.error('DSH Web GUI settings activation:',error.stack??error);throw error}}};}catch(error){console.error('DSH Web GUI settings factory:',error.stack??error);throw error}}});\n`)
await build({config:false,entry:{host:join(root,'src/settings-host.mjs')},outDir:join(out,'lib'),format:'esm',platform:'node',target:'node22',dts:false,clean:false,deps:{neverBundle:['@deepseek-ai/schemastery'],alwaysBundle:id=>id!=='@deepseek-ai/schemastery'},outputOptions:{entryFileNames:'host.mjs',codeSplitting:false}})
for(const file of ['archive-maintenance.mjs','archive-maintenance-runtime.mjs','archive-maintenance-worker.mjs','archive-agent-scope.mjs'])copyFileSync(join(root,'src',file),join(out,'lib',file))
// Provenance sidecars stay in source; runtime retains the images and their notices.
for(const file of readdirSync(join(root,'assets/skins'))){
 if(/\.(png|jpe?g|webp)$/i.test(file)||['NOTICE.txt','original-art.json'].includes(file))copyFileSync(join(root,'assets/skins',file),join(out,'lib/assets/skins',file))
}
copyFileSync(join(root,'src/settings-icons-NOTICE.md'),join(out,'lib/settings-icons-NOTICE.md'))
copyFileSync(join(root,'assets/pets/NOTICE.txt'),join(out,'lib/settings-artwork-NOTICE.txt'))
if(out!==root){
 const {private:privateFlag,scripts,devDependencies,packageManager,...manifest}=sourceManifest
 writeFileSync(join(out,'package.json'),JSON.stringify(manifest,null,2)+'\n')
 for(const file of ['cordis.patch.yml','LICENSE','THIRD_PARTY_NOTICES.md'])copyFileSync(join(root,file),join(out,file))
 mkdirSync(join(out,'locale'),{recursive:true})
 for(const file of readdirSync(join(root,'locale')).filter(name=>name.endsWith('.json')))copyFileSync(join(root,'locale',file),join(out,'locale',file))
 // npm renders this README without the repository's screenshot directory.
 const rawRepository=sourceManifest.repository.url.replace('git+https://github.com/','https://raw.githubusercontent.com/').replace(/\.git$/,'')
 const readme=readFileSync(join(root,'README.md'),'utf8').replaceAll('(docs/images/','('+rawRepository+'/main/docs/images/')
 writeFileSync(join(out,'README.md'),readme)
}
console.log('DSH Web GUI package: '+out)
