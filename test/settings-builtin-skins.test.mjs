import test from 'node:test'
import assert from 'node:assert/strict'
import {builtinWallpapers,legacyWallpapers} from '../src/settings-skin-assets.mjs'
import {contrast,defaultSkin,normalizeSkin,selectBuiltinSkin,selectTheme,backgroundStrengthLimit,skinPresets,skinTokens} from '../src/settings-skin.mjs'

test('bundled artwork is selected as a complete scheme without changing user coverage',()=>{
 assert.equal(builtinWallpapers.length,3)
 for(const row of builtinWallpapers){
  assert.match(row.src,/^\/dsh-web-gui\/skins\/[a-z-]+\.png$/)
  const next=selectBuiltinSkin({...defaultSkin,background:{...defaultSkin.background,areas:['main']}},row)
  assert.equal(next.name,row.name)
  assert.equal(next.background.data,row.src)
  assert.deepEqual(next.background.areas,['main'])
  assert.deepEqual(next.panels,{style:'frosted',opacity:72,sidebarOpacity:8,immersive:true})
  assert.equal(next.background.strength,100)
  skinTokens(next)
  skinTokens({...next,panels:{...next.panels,opacity:64}})
  assert.equal(selectTheme(next,skinPresets[1]).background.data,row.src)
 }
})

test('wallpaper tint keeps the transcript readable in both modes, independently of surface opacity',()=>{
 const skin=selectBuiltinSkin(defaultSkin,builtinWallpapers[1]),tokens=skinTokens(skin)
 assert.match(tokens['--dshgui-wallpaper-main-mask'].dark,/,0\)$/)
 assert.match(tokens['--dshgui-wallpaper-sidebar-mask'].dark,/,0\.08\)$/)
 assert.deepEqual(tokens['--dshgui-wallpaper-sidebar-mask'],tokens['--dshgui-wallpaper-panel-mask'])
 for(const [mode,extreme] of [['dark',255],['light',0]]){
  const [r,g,b,opacity]=tokens['--dshgui-wallpaper-reading-mask'][mode].match(/[\d.]+/g).map(Number)
  assert.ok(opacity>0&&opacity<1)
  const worst='#'+[r,g,b].map(value=>Math.round(value*opacity+extreme*(1-opacity)).toString(16).padStart(2,'0')).join('')
  for(const role of ['primary','secondary'])assert.ok(contrast(tokens['--dsw-alias-label-'+role][mode],worst)>=4.5)
 }
 assert.match(tokens['--dshgui-panel-fill'].dark,/,0\.72\)$/)
 const plain=normalizeSkin({...skin,panels:{style:'solid',opacity:100,immersive:true}})
 assert.equal(skinTokens(plain)['--dshgui-panel-fill'].dark,skin.dark.surface)
 assert.deepEqual(skinTokens(plain)['--dshgui-wallpaper-sidebar-mask'],tokens['--dshgui-wallpaper-sidebar-mask'])
})

test('the full exposed strength range is readable, including after a theme change',()=>{
 const skin=selectBuiltinSkin(defaultSkin,builtinWallpapers[0]),limit=backgroundStrengthLimit(skin)
 skin.background.strength=limit
 skinTokens(skin)
 assert.throws(()=>skinTokens({...skin,background:{...skin.background,strength:limit+1}}),/背景强度/)
 const themed=selectTheme(skin,skinPresets[2]);skinTokens(themed)
 assert.equal(themed.background.data,skin.background.data)
 assert.equal(themed.background.strength,backgroundStrengthLimit(themed))
})

test('sidebars share tint and opacity independently of the composer and dialog',()=>{
 for(const art of builtinWallpapers){
  const skin=selectBuiltinSkin(defaultSkin,art),before=skinTokens(skin)
  const changed=skinTokens({...skin,panels:{...skin.panels,sidebarOpacity:80}})
  assert.deepEqual(changed['--dshgui-wallpaper-sidebar-mask'],changed['--dshgui-wallpaper-panel-mask'])
  assert.notDeepEqual(changed['--dshgui-wallpaper-sidebar-mask'],before['--dshgui-wallpaper-sidebar-mask'])
  assert.deepEqual(changed['--dshgui-panel-fill'],before['--dshgui-panel-fill'])
  assert.deepEqual(changed['--dshgui-input-fill'],before['--dshgui-input-fill'])
  for(const theme of skinPresets){const next=selectTheme({...skin,panels:{...skin.panels,sidebarOpacity:0}},theme);assert.equal(next.panels.sidebarOpacity,0);skinTokens(next)}
 }
})

test('old photo configurations survive the new builtin gallery; imported values remain data-only',()=>{
 assert.equal(legacyWallpapers.length,6)
 for(const row of legacyWallpapers)assert.equal(normalizeSkin({...defaultSkin,background:{...defaultSkin.background,data:row.src}}).background.data,row.src)
 assert.deepEqual(normalizeSkin({...defaultSkin,panels:{style:'frosted',opacity:88,css:'evil'}}).panels,{style:'frosted',opacity:88})
 assert.throws(()=>normalizeSkin({...defaultSkin,panels:{style:'frosted',opacity:0}}),/不透明度/)
 assert.throws(()=>normalizeSkin({...defaultSkin,panels:{style:'external',opacity:88}}),/面板样式/)
 assert.throws(()=>normalizeSkin({...defaultSkin,background:{...defaultSkin.background,data:'/dsh-web-gui/skins/no-such.png'}}),/内置素材/)
})
