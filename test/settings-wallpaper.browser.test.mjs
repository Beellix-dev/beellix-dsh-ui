import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {safeChromiumOptions} from '../scripts/browser-launch-options.mjs'
import {defaultSkin,skinBackgroundCss,skinTokens} from '../src/settings-skin.mjs'

test('wallpaper paints native rightbar mounts, respects coverage and leaves content/popups opaque',async()=>{
 const browser=await chromium.launch(safeChromiumOptions({headless:true}))
 try{
  const page=await browser.newPage()
  const skin={...defaultSkin,background:{...defaultSkin.background,pattern:'mist'}}
  const tokens=Object.entries(skinTokens(skin)).map(([name,value])=>`${name}:${value.light}`).join(';')
  await page.setContent(`<style>:root{${tokens}}body{margin:0}.frame{display:grid;grid-template-columns:200px 1fr 300px;height:100vh}.frame>div{background:var(--dsw-alias-bg-base)}.reading,.menu{background:var(--dsw-alias-bg-layer-2)}</style><div class="frame"><div><div data-slot="sidebar"><nav>Sidebar</nav></div></div><div><div data-slot="main"><section data-slot="main.conversation">Chat</section></div></div><div data-shell-bottom></div><div data-shell-overlay><div class="menu" role="dialog">Menu</div></div></div>`)
  const layer=await page.addStyleTag({content:skinBackgroundCss(skin)})
  await page.locator('[data-slot="sidebar"] nav').evaluate(node=>node.innerHTML='<div role="tree">Session list</div><div aria-hidden="true"></div><span class="native-scroll-fade"></span>')
  await page.addStyleTag({content:'.native-scroll-fade{background-image:linear-gradient(transparent,var(--dsw-specific-sidebar-fill))}'})
  assert.equal(await page.locator('.native-scroll-fade').evaluate(node=>getComputedStyle(node).backgroundImage),'none','covered sidebar must fade list content instead of painting an opaque strip')
  assert.match(await page.getByRole('tree').evaluate(node=>getComputedStyle(node).maskImage),/linear-gradient/)
  // Opening the workbench after the skin is applied must inherit the same image layer.
  await page.addStyleTag({content:'[data-dockkit-pane]{background:var(--dsw-alias-bg-base)}'})
  await page.evaluate(()=>{const column=document.createElement('div');column.innerHTML='<div data-slot="rightbar"><div data-slot="rightbar.session" style="display:contents"><div class="workbench-surface" data-sidebar-right-panel="push" data-sidebar-right-open><section data-dockkit-pane="native-pane">Workbench<div class="reading">File contents</div></section></div></div></div>';document.querySelector('.frame').append(column)})
  const paint=()=>page.locator('[data-slot="rightbar"]').evaluate(node=>({image:getComputedStyle(node.querySelector('.workbench-surface')).backgroundImage,pane:getComputedStyle(node.querySelector('[data-dockkit-pane]')).backgroundColor,content:getComputedStyle(node.querySelector('.reading')).backgroundColor,menu:getComputedStyle(document.querySelector('[role="dialog"]')).backgroundColor}))
  const whole=await paint();assert.match(whole.image,/radial-gradient/);assert.equal(whole.pane,'rgba(0, 0, 0, 0)');assert.equal(whole.content,'rgb(255, 255, 255)');assert.equal(whole.menu,'rgb(255, 255, 255)')
  await layer.evaluate((node,css)=>node.textContent=css,skinBackgroundCss({...skin,background:{...skin.background,areas:['main','sidebar']}}))
  assert.equal((await paint()).image,'none')
  await layer.evaluate((node,css)=>node.textContent=css,skinBackgroundCss({...skin,background:{...skin.background,areas:['rightbar']}}))
  assert.match(await page.locator('.native-scroll-fade').evaluate(node=>getComputedStyle(node).backgroundImage),/linear-gradient/,'uncovered sidebar retains native decoration')
  assert.equal(await page.getByRole('tree').evaluate(node=>getComputedStyle(node).maskImage),'none')
  assert.match((await paint()).image,/radial-gradient/)
  await page.locator('[data-slot="rightbar"]').evaluate(node=>{node.parentElement.style.width='0px';node.querySelector('.workbench-surface').style.cssText='position:fixed;right:0;top:0;width:300px;height:100vh'})
  assert.match((await paint()).image,/radial-gradient/)
  assert.equal(await page.locator('[data-slot="main"]').evaluate(node=>getComputedStyle(node.parentElement).backgroundImage),'none')
  await page.locator('.workbench-surface').evaluate(node=>node.removeAttribute('data-sidebar-right-open'))
  assert.equal((await paint()).image,'none','a collapsed native workbench must not paint a ghost panel')
  await page.addStyleTag({content:'.management{background:var(--dsw-alias-bg-base)}'})
  await page.locator('[data-slot="main"]').evaluate(node=>node.innerHTML='<section class="management"><div class="reading">Native plugin card</div></section>')
  await layer.evaluate((node,css)=>node.textContent=css,skinBackgroundCss({...skin,panels:{style:'frosted',opacity:72,sidebarOpacity:8,immersive:true}}))
  assert.equal(await page.locator('.management').evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)','module-page canvas must not inherit the protected content-panel opacity')
  assert.equal(await page.locator('.management').evaluate(node=>getComputedStyle(node).backdropFilter),'none')
  assert.equal(await page.locator('.management .reading').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(255, 255, 255)')
  await layer.evaluate(node=>node.remove());assert.equal((await paint()).image,'none')
 }finally{await browser.close()}
})
