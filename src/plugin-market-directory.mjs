export async function marketRequest(path,{body,signal,query}={}){
 const suffix=query?'?'+query.toString():''
 const response=await fetch('/api/community-market/'+path+suffix,{
  cache:'no-store',signal,
  ...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),
 })
 const payload=await response.json().catch(()=>null)
 if(!response.ok||!payload)throw Object.assign(Error(payload?.error??'HTTP '+response.status),{status:response.status})
 return payload
}

export async function activateMarketDirectory(choice,sources,mutate){
 const {sourceRecordId,builtInProviderKey,manifestUrl}=choice
 const find=rows=>rows.find(row=>
  (sourceRecordId&&row.sourceRecordId===sourceRecordId)||
  (builtInProviderKey&&row.builtInProviderKey===builtInProviderKey)||
  (manifestUrl&&row.manifestUrl===manifestUrl))
 let source=find(sources)
 if(!source&&(builtInProviderKey||manifestUrl)){
  sources=await mutate(builtInProviderKey?{action:'add-builtin',key:builtInProviderKey}:{action:'add-standard',manifestUrl})
  source=find(sources)
 }
 if(!source)throw Error('找不到此插件市场')
 if(source.enabled)return sources
 return mutate({action:'select',sourceRecordId:source.sourceRecordId})
}

export async function openMarketDirectory(choice,readState,mutate){
 const apply=async()=>{
  const state=await readState()
  const sources=await activateMarketDirectory(choice,state.sources,mutate)
  return {...state,sources}
 }
 try{return await apply()}
 catch(error){
  if(error.message!=='source not found'&&error.status!==404)throw error
  await new Promise(resolve=>setTimeout(resolve,350))
  return apply()
 }
}
