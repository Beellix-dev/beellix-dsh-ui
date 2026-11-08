import React from 'react'
import {providerIcons} from './settings-provider-icons.mjs'

function brandId(provider:string,baseURL?:string){
 const id=provider.toLowerCase().replace(/^dshgui-/,'')
 if(/^(deepseek|qwen|openai|anthropic|minimax|openrouter)(?:[-/]|$)/.test(id))return id.match(/^(deepseek|qwen|openai|anthropic|minimax|openrouter)/)![0]
 if(/^(moonshot|kimi)/.test(id))return 'moonshot'
 if(id.startsWith('claude'))return 'anthropic'
 if(/^gpt(?:-|$)/.test(id))return 'openai'
 if(baseURL){try{const host=new URL(baseURL).hostname;if(/(^|\.)(deepseek|openai|anthropic|openrouter)\.(com|ai)$/.test(host))return host.split('.').at(-2);if(/dashscope|\.maas\.aliyuncs\.com$/.test(host))return 'qwen'}catch{}}
 return undefined
}

/** Brand artwork is local, licensed and shared across every model configuration surface. */
export function ProviderMark({provider,baseURL,size=30}:{provider:string;baseURL?:string;size?:number}){
 const asset=providerIcons[brandId(provider,baseURL)??'']
 return <span className="bx-provider-mark" style={{width:size,height:size}} aria-hidden="true">
  {asset?asset.monochrome?<span className="bx-provider-silhouette" style={{maskImage:`url("${asset.src}")`,WebkitMaskImage:`url("${asset.src}")`}}/>:<img src={asset.src} alt="" width={size} height={size}/>:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 10v4m3-7.5h3m-3 11h3"/></svg>}
 </span>
}
