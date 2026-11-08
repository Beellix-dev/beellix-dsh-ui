import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {safeChromiumOptions} from '../scripts/browser-launch-options.mjs'
import {defaultSkin,skinBackgroundCss,skinTokens} from '../src/settings-skin.mjs'

test('wallpaper chat uses one canvas tint, transparent transcript and local control surfaces',async()=>{
 const browser=await chromium.launch(safeChromiumOptions({headless:true}))
 try{
  const page=await browser.newPage({viewport:{width:1100,height:760}})
  const skin={...defaultSkin,background:{...defaultSkin.background,pattern:'mist'},panels:{...defaultSkin.panels,immersive:true,style:'frosted',opacity:80}}
  const tokens=Object.entries(skinTokens(skin)).map(([name,value])=>`${name}:${value.dark}`).join(';')
  await page.setContent(`<style>:root{${tokens}}*{box-sizing:border-box}body{margin:0;color:var(--dsw-alias-label-primary);font:16px/1.7 system-ui}.frame{display:grid;grid-template-columns:180px minmax(0,1fr) 0;height:100vh}.main{min-width:0;display:flex;flex-direction:column}[data-slot]{display:contents}[data-phase]{height:100%;display:flex;flex-direction:column}[data-conversation-content]{min-height:0;flex:1;display:flex;flex-direction:column}[data-conversation-scroll]{overflow-y:auto;min-height:0;flex:1}[data-chat-viewport]{padding:16px;container-type:inline-size}[data-chat-flow]{max-width:680px;width:100%;margin:0 auto;display:flex;flex-direction:column}[data-chat-flow-key]{min-width:0;margin-block-start:12px}.bubble{width:fit-content;max-width:80%;margin-left:auto;padding:10px 16px;border-radius:14px;background:var(--dsw-alias-bg-layer-2)}.code{overflow:auto;white-space:pre;max-width:100%;background:var(--dsw-alias-bg-layer-2)}[data-step-process-content]{display:block}[data-composer-seat]{position:sticky;bottom:0;background-image:linear-gradient(transparent,var(--dsw-alias-bg-base) 36px)}[data-composer-card]{padding:16px;margin:16px;background:var(--dsw-alias-bg-layer-2)}[data-dockkit-strip]{height:38px}.web,.page-content{background:var(--dsw-alias-bg-base);height:100px}</style>
  <div class="frame"><div><div data-slot="sidebar">Navigation</div></div><div class="main"><div data-slot="main"><div data-slot="main.conversation"><div data-phase="active"><div data-slot="conversation.header"><header>Conversation</header></div><div data-conversation-content data-content-phase="active"><div data-conversation-scroll><div data-chat-viewport><div id="reading" data-chat-flow><div data-slot="conversation.chat.flow"><div data-chat-flow-key="user" data-chat-flow-kind="user"><div class="bubble">你好</div></div><div data-chat-flow-key="status">已完成</div><div data-chat-flow-key="answer">这是用于检查阅读布局的示例回答。<pre class="code">${'long_code_identifier_'.repeat(60)}</pre></div><div data-chat-flow-key="group" data-chat-group-key="group"><div data-step-process-content data-chat-flow><div data-chat-flow-key="nested">工具状态</div></div></div><div data-chat-flow-key="actions"><button>复制</button></div></div></div><div data-chat-turn-spacer></div></div><div data-composer-seat><div data-composer-card><input aria-label="消息"/></div></div></div></div></div></div></div></div><div><div data-slot="rightbar"><div data-slot="rightbar.session"><div data-sidebar-right-panel data-sidebar-right-open><div data-dockkit-host="dock"><section data-dockkit-pane><header data-dockkit-strip>Browser</header><div class="web"><form><input placeholder="Enter an HTTP(S) address"></form><div aria-busy="false"><div class="page-content">Web content</div></div></div></section></div></div></div></div></div><div data-shell-overlay></div><div data-shell-bottom></div></div>`)
  const nativeWebFill=await page.locator('.page-content').evaluate(n=>getComputedStyle(n).backgroundColor)
  await page.addStyleTag({content:skinBackgroundCss(skin)})
  const panel=await page.locator('#reading').evaluate(n=>({fill:getComputedStyle(n).backgroundColor,padding:parseFloat(getComputedStyle(n).paddingLeft),width:n.getBoundingClientRect().width}))
  assert.equal(panel.fill,'rgba(0, 0, 0, 0)','the wallpaper canvas supplies the reading tint')
  assert.equal(panel.padding,0,'the native transcript keeps its original width')
  assert.equal(await page.locator('[data-composer-seat]').evaluate(n=>getComputedStyle(n).backgroundImage),'none')
  assert.notEqual(await page.locator('[data-composer-card]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)')
  assert.match(await page.locator('.frame').evaluate(n=>getComputedStyle(n).getPropertyValue('--dshgui-canvas-tint')),/^rgba\(/)
  const inputFill=await page.locator('[data-composer-card]').evaluate(n=>getComputedStyle(n).backgroundColor)
  assert.ok(Number(inputFill.match(/, ([\d.]+)\)$/)[1])<.8,'the input tint accounts for the tint already on the canvas')
  for(const row of await page.locator('[data-chat-flow-key]').evaluateAll(ns=>ns.map(n=>({fill:getComputedStyle(n).backgroundColor,blur:getComputedStyle(n).backdropFilter})))){assert.equal(row.fill,'rgba(0, 0, 0, 0)');assert.equal(row.blur,'none')}
  assert.equal(await page.locator('[data-step-process-content]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)')
  assert.ok(await page.locator('.bubble').evaluate(n=>n.getBoundingClientRect().width<n.closest('#reading').getBoundingClientRect().width/2))
  const glass = await page.evaluate(()=>[
   document.querySelector('[data-slot="sidebar"]').parentElement,
   document.querySelector('[data-dockkit-host="dock"]'),
  ].map(node=>{
   const host=getComputedStyle(node),layer=getComputedStyle(node,'::before')
   return {blur:layer.backdropFilter,hostBlur:host.backdropFilter,radius:layer.borderRadius,fill:layer.backgroundColor,hostImage:host.backgroundImage}
  }))
  const roundedGlass={blur:'blur(18px)',hostBlur:'none',radius:'16px',fill:'rgba(35, 33, 44, 0.08)',hostImage:'none'}
  assert.deepEqual(glass,[roundedGlass,roundedGlass])
  assert.equal(await page.locator('[data-dockkit-strip]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)')
  assert.equal(await page.locator('.web').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)')
  assert.equal(await page.locator('.page-content').evaluate(n=>getComputedStyle(n).backgroundColor),nativeWebFill,'web content keeps its own display surface')
  const caption = await page.evaluate(()=>{
   document.documentElement.setAttribute('data-windows-titlebar','')
   document.querySelector('.frame').style.paddingTop='40px'
   const left=document.querySelector('[data-slot="sidebar"]').parentElement
   const right=document.querySelector('[data-sidebar-right-panel]')
   const dock=right.querySelector('[data-dockkit-host="dock"]')
   const glassTop=node=>node.getBoundingClientRect().top+parseFloat(getComputedStyle(node,'::before').top)
   return {leftGlassTop:glassTop(left),rightGlassTop:glassTop(dock),
    leftGlassRadius:getComputedStyle(left,'::before').borderRadius,
    rightGlassRadius:getComputedStyle(dock,'::before').borderRadius}
  })
  assert.deepEqual(caption,{leftGlassTop:40,rightGlassTop:40,leftGlassRadius:'16px',rightGlassRadius:'16px'})
  const workbench=page.locator('[data-sidebar-right-panel]')
  await workbench.evaluate(n=>n.setAttribute('data-sidebar-right-panel','fullscreen'))
  assert.equal(await page.locator('#reading').evaluate(n=>getComputedStyle(n).visibility),'hidden')
  assert.equal(await workbench.evaluate(n=>getComputedStyle(n).visibility),'visible')
  await workbench.evaluate(n=>n.removeAttribute('data-sidebar-right-open'))
  assert.equal(await page.locator('#reading').evaluate(n=>getComputedStyle(n).visibility),'visible')
  for(const width of [390,760]){
   await page.setViewportSize({width,height:760})
   assert.ok(await page.locator('#reading').evaluate(n=>n.getBoundingClientRect().right<=innerWidth))
   assert.ok(await page.locator('.code').evaluate(n=>n.scrollWidth>n.clientWidth),'wide code scrolls inside its block')
  }
 }finally{await browser.close()}
})
