import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {chromium} from 'playwright'
import {safeChromiumOptions} from '../scripts/browser-launch-options.mjs'
import {wallpaperInk} from '../src/settings-wallpaper-contrast.mjs'

test('exposed text chooses contrast from the wallpaper rather than the UI mode',async()=>{
 assert.equal(wallpaperInk([[0,0,0],[20,20,20]]).ink,'#ffffff')
 assert.equal(wallpaperInk([[255,255,255],[240,240,240]]).ink,'#17191d')
 const browser=await chromium.launch(safeChromiumOptions({headless:true}))
 try{
  const page=await browser.newPage({viewport:{width:1000,height:600}})
  await page.setContent('<style>html{color-scheme:light}body{margin:0}.frame{display:grid;grid-template-columns:200px 600px 200px;height:600px}.frame>div{background:transparent}button{background:#fff;color:#17191d}</style><div class="frame"><div><div data-slot="sidebar"><span id="left">Left label</span><svg id="icon" width="16" height="16"><path fill="currentColor" d="M0 0h16v16H0z"/></svg><button id="solid">Opaque button</button></div></div><div data-slot="main"></div><div data-sidebar-right-panel data-sidebar-right-open><span id="right">Right label</span></div><i data-shell-overlay></i><i data-shell-bottom></i></div>')
  const source=Buffer.from(readFileSync(new URL('../src/settings-wallpaper-contrast.mjs',import.meta.url))).toString('base64')
  await page.evaluate(async source=>{
   const {createWallpaperContrast}=await import('data:text/javascript;base64,'+source)
   const canvas=document.createElement('canvas');canvas.width=200;canvas.height=120;const ctx=canvas.getContext('2d');ctx.fillStyle='black';ctx.fillRect(0,0,100,120);ctx.fillStyle='white';ctx.fillRect(100,0,100,120)
   const skin={light:{surface:'#ffffff',sidebar:'#ffffff'},dark:{surface:'#111111',sidebar:'#111111'},background:{data:canvas.toDataURL(),fit:'cover',areas:['sidebar','rightbar']},panels:{immersive:true,style:'frosted',sidebarOpacity:0}}
   const menu=document.createElement('div');menu.dataset.windowsMenu='';menu.style.cssText='position:fixed;left:0;top:0;width:200px;height:40px';const shadow=menu.attachShadow({mode:'open'});shadow.innerHTML='<style>button{color:var(--dsw-alias-label-secondary,#17191d)}</style><button>Application</button>';document.body.append(menu)
   globalThis.fixtureContrast=createWallpaperContrast();globalThis.fixtureContrast.render(skin)
  },source)
  await page.waitForFunction(()=>document.querySelector('#left').style.getPropertyValue('--dshgui-auto-ink')==='#ffffff')
  assert.equal(await page.locator('#right').evaluate(n=>n.style.getPropertyValue('--dshgui-auto-ink')),'#17191d')
  assert.equal(await page.locator('#icon').evaluate(n=>n.style.getPropertyValue('--dshgui-auto-ink')),'#ffffff')
  assert.equal(await page.locator('[data-windows-menu]').evaluate(n=>getComputedStyle(n.shadowRoot.querySelector('button')).color),'rgb(255, 255, 255)')
  assert.equal(await page.locator('#solid').evaluate(n=>getComputedStyle(n).color),'rgb(23, 25, 29)')
  assert.equal(await page.locator('#solid').evaluate(n=>n.style.getPropertyValue('--dshgui-auto-edge')),'transparent')
  await page.evaluate(()=>document.documentElement.style.colorScheme='dark')
  await page.waitForFunction(()=>document.querySelector('#left').style.getPropertyValue('--dshgui-auto-ink')==='#ffffff'&&document.querySelector('#right').style.getPropertyValue('--dshgui-auto-ink')==='#17191d')
  await page.evaluate(()=>globalThis.fixtureContrast.dispose())
  assert.equal(await page.locator('[data-dshgui-wallpaper-text]').count(),0)
  assert.equal(await page.locator('style[data-dshgui-contrast]').count(),0)
  await page.evaluate(()=>document.querySelector('#left').textContent='After disposal')
  assert.equal(await page.locator('[data-dshgui-wallpaper-text]').count(),0)
 }finally{await browser.close()}
})
