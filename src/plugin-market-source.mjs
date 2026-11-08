const marketNames=new Set(['dshmarket','dsh-community-market','@deepseek-ai/dsh-experimental-plugin-market-bundle'])

function unwrap(result){
 if(!result?.ok)throw Error(result?.error?.message??'无法读取插件市场状态')
 return result.value
}
export async function listMarketSources(manager){
 return unwrap(await manager.listBundles()).filter(row=>marketNames.has(row.name))
}
export async function ensureMarketSource(manager,name){
 const target=(await listMarketSources(manager)).find(row=>row.name===name)
 if(!target||target.error||(!target.enabled&&target.readOnlyReason))throw Error('此插件市场当前不可切换')
 if(target.enabled)return 'applied'
 const result=unwrap(await manager.setBundleEnabled(name,true))
 if(result.application==='restart-required')return 'restart'
 if(result.application==='overridden')return 'overridden'
 if(result.application!=='applied')throw Error(result.error?.diagnostic??'切换插件市场失败')
 return 'applied'
}
