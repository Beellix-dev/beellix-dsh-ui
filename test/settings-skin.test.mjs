import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultSkin,normalizeSkin,normalizeSkinLibrary,skinTokens,skinPresets,ink,contrast,createSkinStore,selectTheme,selectWallpaper} from '../src/settings-skin.mjs'
import {builtinSkins} from '../src/settings-skin-library.mjs'

test('themes preserve the selected wallpaper and wallpaper choices preserve theme colours',()=>{
 const current={...defaultSkin,background:{...defaultSkin.background,pattern:'aurora',name:'用户壁纸',areas:['main','rightbar']}}
 const themed=selectTheme(current,skinPresets[1])
 assert.deepEqual(themed.background,current.background)
 const target=builtinSkins.find(row=>row.skin.background.pattern).skin.background
 const wallpaper=selectWallpaper(themed,target)
 assert.deepEqual(wallpaper.light,themed.light);assert.deepEqual(wallpaper.dark,themed.dark)
 assert.deepEqual(wallpaper.background.areas,current.background.areas)
})

test('legacy wallpaper covers all three shell areas; invalid area values are rejected',()=>{
 assert.deepEqual(normalizeSkin({...defaultSkin,background:{data:'',fit:'cover',strength:18}}).background.areas,['sidebar','main','rightbar'])
 assert.throws(()=>normalizeSkin({...defaultSkin,background:{...defaultSkin.background,areas:['all-elements']}}),/范围/)
 assert.throws(()=>normalizeSkin({...defaultSkin,background:{...defaultSkin.background,areas:[]}}),/范围/)
})

test('bundled skins are original offline recipes, readable in both modes',()=>{
 assert.equal(builtinSkins.length,9)
 for(const row of builtinSkins){skinTokens(row.skin);assert.equal(row.skin.background.data,'');assert.equal(row.art,undefined)}
})
test('video skins accept only content-addressed own local media, never arbitrary URLs',()=>{
 const video={...defaultSkin,background:{...defaultSkin.background,kind:'video',data:'/dsh-web-gui/media/'+'a'.repeat(64)+'.mp4',paused:true}}
 assert.equal(normalizeSkin(video).background.paused,true);skinTokens(video)
 assert.throws(()=>normalizeSkin({...video,background:{...video.background,data:'https://remote.example/video.mp4'}}),/本机/)
})
test('saved skin libraries reject duplicate identifiers and excess storage',()=>{
 const row={id:'user-12345678',skin:defaultSkin}
 assert.throws(()=>normalizeSkinLibrary([row,row]),/重复/)
 assert.throws(()=>normalizeSkinLibrary(Array(13).fill(row)),/12/)
})
test('skin imports reject executable or remote data and keep only supported fields',()=>{
 const skin=normalizeSkin({...defaultSkin,script:'evil',light:{...defaultSkin.light,other:'url(evil)'}})
 assert.equal(skin.script,undefined);assert.equal(skin.light.other,undefined)
 assert.throws(()=>normalizeSkin({...defaultSkin,background:{data:'https://remote.example/bg.png'}}),/本地/)
 assert.throws(()=>normalizeSkin({...defaultSkin,light:{...defaultSkin.light,accent:'red; color:evil'}}),/色值/)
 assert.throws(()=>normalizeSkin({...defaultSkin,background:{data:'data:image/svg+xml;base64,AAAA'}}),/本地/)
})
test('every preset supplies two schemes and readable component colours',()=>{
 for(const preset of skinPresets){const tokens=skinTokens({...defaultSkin,...preset});assert.ok(tokens['--dsw-alias-bg-base'].light);assert.ok(tokens['--dsw-alias-bg-base'].dark);for(const mode of ['light','dark'])assert.ok(contrast(ink(preset[mode].button),preset[mode].button)>=4.5)}
 assert.throws(()=>skinTokens({...defaultSkin,light:{...defaultSkin.light,sidebar:'#000000'}}),/明暗差异/)
})
test('wallpaper does not make base tokens translucent across nested panels or popups',()=>{
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
 const tokens=skinTokens({...defaultSkin,background:{...defaultSkin.background,data:image}})
 assert.equal(tokens['--dsw-alias-bg-base'].light,defaultSkin.light.surface)
 assert.equal(tokens['--dsw-specific-sidebar-fill'].light,defaultSkin.light.sidebar)
 assert.match(tokens['--dshgui-wallpaper-main-mask'].light,/rgba\(/)
 const glass=skinTokens({...defaultSkin,panels:{style:'frosted',immersive:true,opacity:90,sidebarOpacity:8,blur:18},background:{...defaultSkin.background,data:image}})
 for(const mode of ['light','dark']){
  assert.equal(glass['--dshgui-content-glass-fill'][mode],glass['--dshgui-wallpaper-sidebar-mask'][mode])
  assert.equal(glass['--dshgui-content-glass-filter'][mode],'blur(18px)')
  assert.equal(glass['--dshgui-content-glass-edge'][mode],glass['--dshgui-label-protection'][mode])
  assert.equal(tokens['--dshgui-content-glass-fill'][mode],defaultSkin[mode].surface)
  assert.equal(tokens['--dshgui-content-glass-edge'][mode],'transparent')
 }
})
test('preview cancellation restores saved colours and rejected writes retain the draft',async()=>{
 let state={status:'ready',writable:true,revision:0,value:{appearance:JSON.stringify(defaultSkin)}},last
 const listeners=new Set(),form={getSnapshot:()=>state,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),mutate:async()=>false}
 const store=createSkinStore({theme:{overrideTokens:(_source,tokens)=>{last=tokens;return()=>{}}},configForms:{get:()=>form,describe:()=>({ensure:async()=>{}})}})
 await store.start();store.update({...defaultSkin,...skinPresets[1]});await assert.rejects(store.save(),/未接受/);assert.equal(store.getSnapshot().dirty,true)
 store.stopPreview();assert.equal(last['--dsw-alias-brand-primary'].light,defaultSkin.light.accent);assert.equal(store.getSnapshot().dirty,false);store.dispose()
})
test('custom accents and image strength cannot make text unreadable',()=>{
 assert.throws(()=>skinTokens({...defaultSkin,light:{...defaultSkin.light,accent:'#ffffff'}}),/强调色/)
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
 assert.throws(()=>skinTokens({...defaultSkin,background:{...defaultSkin.background,data:image,strength:50}}),/背景强度/)
 const tokens=skinTokens({...defaultSkin,light:{...defaultSkin.light,sidebar:'#888888'}})
 assert.ok(contrast(tokens['--dsw-alias-label-secondary'].light,'#888888')>=4.5)
 assert.ok(contrast(tokens['--dsw-alias-brand-primary'].light,'#888888')>=4.5)
})
test('late startup cannot recreate a disposed theme layer',async()=>{
 let complete,applications=0
 const form={getSnapshot:()=>({status:'ready',writable:true,revision:0,value:{appearance:JSON.stringify(defaultSkin)}}),subscribe:()=>()=>{}}
 const store=createSkinStore({theme:{overrideTokens:()=>{applications++;return()=>{}}},configForms:{get:()=>form,describe:()=>({ensure:()=>new Promise(resolve=>complete=resolve)})}})
 const start=store.start();store.dispose();complete();await start;assert.equal(applications,0)
})
test('save completing after page exit adopts exactly the committed skin',async()=>{
 let complete,last,state={status:'ready',writable:true,revision:0,value:{appearance:JSON.stringify(defaultSkin)}}
 const form={getSnapshot:()=>state,subscribe:()=>()=>{},mutate:async ops=>{await new Promise(resolve=>complete=resolve);state={...state,revision:1,value:{appearance:ops[0].value}};return true}}
 const store=createSkinStore({theme:{overrideTokens:(_id,tokens)=>{last=tokens;return()=>{}}},configForms:{get:()=>form,describe:()=>({ensure:async()=>{}})}})
 await store.start();store.update({...defaultSkin,...skinPresets[1]});const saving=store.save();store.stopPreview();complete();await saving
 assert.equal(last['--dsw-alias-brand-primary'].light,skinPresets[1].light.accent);assert.equal(store.getSnapshot().skin.name,'清爽蓝');assert.equal(store.getSnapshot().dirty,false)
})
test('named custom skins save atomically with the appearance and remain after a new store starts',async()=>{
 let state={status:'ready',writable:true,revision:0,value:{appearance:JSON.stringify(defaultSkin),skinLibrary:'[]'}},ops
 const form={getSnapshot:()=>state,subscribe:()=>()=>{},mutate:async changes=>{ops=changes;const value={...state.value};for(const change of changes)value[change.path[0]]=change.value;state={...state,value,revision:state.revision+1};return true}}
 const ctx={theme:{overrideTokens:()=>()=>{}},configForms:{get:()=>form,describe:()=>({ensure:async()=>{}})}}
 const store=createSkinStore(ctx);await store.start();store.update({...defaultSkin,...skinPresets[1]});await store.saveAs('我的蓝色')
 assert.equal(ops.length,2);assert.equal(store.getSnapshot().library[0].skin.name,'我的蓝色');assert.equal(store.getSnapshot().dirty,false)
 const second=createSkinStore(ctx);await second.start();assert.equal(second.getSnapshot().library.length,1)
 await second.removeSaved(second.getSnapshot().library[0].id);assert.equal(second.getSnapshot().library.length,0);assert.equal(JSON.parse(state.value.appearance).name,'我的蓝色')
 store.dispose();second.dispose()
})

test('importing into My Skins never enables or applies the imported wallpaper',async()=>{
 let state={status:'ready',writable:true,revision:0,value:{appearance:JSON.stringify(defaultSkin),skinLibrary:'[]'}}
 const form={getSnapshot:()=>state,subscribe:()=>()=>{},mutate:async changes=>{const value={...state.value};for(const change of changes)value[change.path[0]]=change.value;state={...state,value,revision:state.revision+1};return true}}
 const store=createSkinStore({theme:{overrideTokens:()=>()=>{}},configForms:{get:()=>form,describe:()=>({ensure:async()=>{}})}});await store.start()
 await store.importSaved({...defaultSkin,name:'我的导入',background:{...defaultSkin.background,pattern:'mist'}})
 assert.equal(state.value.appearance,JSON.stringify(defaultSkin));assert.equal(store.getSnapshot().dirty,false);assert.equal(store.getSnapshot().library.length,1);assert.equal(store.getSnapshot().skin.background.data,'');store.dispose()
})
