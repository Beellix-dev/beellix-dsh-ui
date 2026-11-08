import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'

// Chromium's Windows blank-password probe can lock out the desktop account.
// Keep the pinned Playwright defaults when adding the upstream workaround:
// https://github.com/MicrosoftEdge/WebView2Feedback/issues/5722
const require=createRequire(import.meta.url)
const packagePath=require.resolve('playwright-core/package.json')
const runtime=JSON.parse(readFileSync(packagePath,'utf8'))
const bundle=readFileSync(join(dirname(packagePath),'lib/coreBundle.js'))
const expectedHash='6be5c2ea035554e9b184b1dbc7aa5e7f1fb428dd1b5c202022858dcfae9bee27'
if(runtime.version!=='1.61.1'||createHash('sha256').update(bundle).digest('hex')!==expectedHash){
 throw Error('浏览器防锁定默认参数核验失败：Playwright 已变化，请重新核对默认参数后再启动浏览器。')
}
const defaultFeatures=[
 'AvoidUnnecessaryBeforeUnloadCheckSync','BoundaryEventDispatchTracksNodeRemoval',
 'DestroyProfileOnBrowserClose','DialMediaRouteProvider','GlobalMediaControls',
 'HttpsUpgrades','LensOverlay','MediaRouter','PaintHolding',
 'ThirdPartyStoragePartitioning','Translate','AutoDeElevate','RenderDocument',
 'OptimizationHints','msForceBrowserSignIn','msEdgeUpdateLaunchServicesPreferredVersion',
]
const defaultFeatureSwitch='--disable-features='+defaultFeatures.join(',')
const blockedFeature='AutofillAiWalletPrivatePasses'

export function safeChromiumOptions(options={}){
 if(options.ignoreDefaultArgs===true)throw Error('防锁定启动必须保留 Playwright 默认参数。')
 const args=options.args??[],ignored=options.ignoreDefaultArgs||[]
 if(!Array.isArray(args)||!Array.isArray(ignored))throw TypeError('浏览器启动参数必须是数组。')
 const features=new Set([...defaultFeatures,blockedFeature]),kept=[]
 for(const arg of args){
  if(typeof arg!=='string')throw TypeError('浏览器启动参数必须是字符串。')
  if(arg.startsWith('--enable-features=')&&arg.slice('--enable-features='.length).split(',').some(f=>f.split(/[<:]/)[0]===blockedFeature)){
   throw Error('不能重新开启会触发账户锁定的 AutofillAiWalletPrivatePasses。')
  }
  if(arg.startsWith('--disable-features=')){
   for(const feature of arg.slice('--disable-features='.length).split(',').filter(Boolean))features.add(feature)
  }else kept.push(arg)
 }
 return{...options,ignoreDefaultArgs:[...new Set([...ignored,defaultFeatureSwitch])],args:[...kept,'--disable-features='+[...features].join(',')]}
}
