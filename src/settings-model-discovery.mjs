/** Host-side listing through the public DSH discovery seam. Never returns credentials. */
export const discoveryNamespace='dsh-web-gui-model-discovery'
export const inject=['llm','settings','credentials']
const at=(value,path)=>path.reduce((node,key)=>node?.[key],value)
const cleanURL=value=>{
 const url=new URL(value)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('请填写不含密钥、查询参数的 HTTP 或 HTTPS 服务地址')
 return url.href.replace(/\/+$/,'')
}
const positive=value=>Number.isInteger(value)&&value>0?value:undefined

export async function fetchProviderModels(request,{lookup=()=>undefined,resolveKey=async()=>undefined,fetcher=fetch,signal}={}){
 if(!['openai-completions','openai-responses','anthropic-messages'].includes(request.api??'openai-completions'))throw Error('当前接口协议不支持读取型号，请手动添加')
 const base=cleanURL(request.baseURL),stored=request.provider?lookup(request.provider):undefined
 let key=request.apiKey
 if(key===undefined&&stored?.apiKeyEnv){
  if(cleanURL(stored.baseURL)!==base)throw Error('服务地址已改变，请输入该地址对应的 API Key')
  key=await resolveKey(stored.apiKeyEnv)
 }
 if(key!==undefined&&(!key.trim()||/[^\x20-\x7e]/.test(key)))throw Error('API Key 格式不正确，请粘贴原始密钥')
 const url=new URL(base),qwen=/(^|\.)dashscope(?:-intl)?\.aliyuncs\.com$|\.maas\.aliyuncs\.com$/.test(url.hostname)
 const anthropic=request.api==='anthropic-messages',deepseek=url.hostname==='api.deepseek.com'
 const headers={accept:'application/json'}
 if(key){if(anthropic&&!qwen)headers['x-api-key']=key.trim();else headers.authorization='Bearer '+key.trim()}
 if(anthropic)headers['anthropic-version']='2023-06-01'
 const target=new URL(qwen?'/api/v1/models':deepseek?'/models':anthropic?url.pathname.replace(/\/?v1\/?$/,'').replace(/\/$/,'')+'/v1/models':url.pathname.replace(/\/$/,'')+'/models',url.origin)
 if(qwen){target.searchParams.set('page_size','100');target.searchParams.append('capabilities','TG');target.searchParams.append('capabilities','Reasoning')}
 if(anthropic&&!deepseek)target.searchParams.set('limit','100')
 const models=new Map()
 for(let page=1;page<=40;page++){
  if(qwen)target.searchParams.set('page_no',String(page))
  let response
  try{response=await fetcher(target.href,{headers,redirect:'error',signal})}catch(error){if(signal?.aborted)throw Error('获取模型已取消或超时');throw Error('无法连接模型服务，请检查服务地址和网络')}
  if(!response.ok)throw Error([401,403].includes(response.status)?'认证失败，请检查 API Key 和服务权限':`获取模型失败（HTTP ${response.status}），可重试或手动添加`)
  let totalBytes=0,text='';const reader=response.body?.getReader()
  if(!reader)throw Error('模型服务返回空内容')
  const decoder=new TextDecoder()
  try{for(;;){const part=await reader.read();if(part.done)break;totalBytes+=part.value.byteLength;if(totalBytes>4*1024*1024){await reader.cancel();throw Error('模型列表过大，请缩小服务端列表后重试')}text+=decoder.decode(part.value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}
  let body;try{body=JSON.parse(text)}catch{throw Error('模型服务未返回有效的 JSON 列表')}
  const rows=qwen?body.output?.models:body.data??body.models
  if(!Array.isArray(rows))throw Error('模型服务返回的格式不受支持，可手动添加模型')
  for(const row of rows){
   const id=row.id??row.model;if(typeof id!=='string'||!id.trim()||models.has(id))continue
   const model={id};if(typeof row.name==='string')model.name=row.name
   const context=positive(row.contextWindow??row.context_window??row.model_info?.context_window),max=positive(row.maxTokens??row.max_output_tokens??row.model_info?.max_output_tokens)
   if(context)model.contextWindow=context;if(max)model.maxTokens=max
   const modalities=row.inputModalities??row.input_modalities??row.inference_metadata?.request_modality?.map(x=>String(x).toLowerCase())
   if(Array.isArray(modalities)){const supported=modalities.filter(x=>['text','image'].includes(x));if(supported.length)model.inputModalities=supported}
   models.set(id,model)
  }
  if(models.size>5000)throw Error('模型数量超过上限，请缩小列表后重试')
  const more=qwen?Number(body.output?.total)>page*Number(body.output?.page_size??100):body.has_more===true
  if(!more)return [...models.values()]
  if(!rows.length)throw Error('服务端分页未返回完整列表，请重试')
  if(!qwen){const after=body.last_id??rows.at(-1)?.id;if(typeof after!=='string'||target.searchParams.get('after_id')===after)throw Error('模型列表分页异常，请重试');target.searchParams.set('after_id',after)}
 }
 throw Error('模型列表分页过多，请缩小列表后重试')
}

export function apply(ctx){
 const pending=new Set()
 ctx.effect(()=>()=>{for(const controller of pending)controller.abort();pending.clear()},'DSH Web GUI：取消模型目录请求')
 ctx.llm.registerModelDiscovery(discoveryNamespace,async(request,callerSignal)=>{
  const controller=new AbortController();pending.add(controller)
  try{return await fetchProviderModels(request,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000),...(callerSignal?[callerSignal]:[])]),
   lookup(provider){const entry=ctx.llm.listConfigurableProviders().find(row=>row.provider===provider);if(!entry)return;const section=ctx.settings.describe({redactSecrets:true}).find(row=>row.ns===entry.settingsNs),profile=at(section?.value,entry.settingsPath);return profile?{...profile,baseURL:profile.baseURL??entry.defaultBaseURL??(provider==='deepseek-official'?'https://api.deepseek.com/anthropic':undefined)}:undefined},
   resolveKey:async ref=>(await ctx.credentials.resolve(ref))?.value,
  })}finally{pending.delete(controller)}
 })
}
