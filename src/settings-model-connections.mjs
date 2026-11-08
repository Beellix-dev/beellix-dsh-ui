/** Own connection editor. DSH remains the owner of model execution and stored config. */
import {valueAt} from './settings-core.mjs'
export const modelPresets=[
 {id:'deepseek',name:'DeepSeek',route:'deepseek-official',baseURL:'https://api.deepseek.com/anthropic',api:'anthropic-messages'},
 {id:'qwen',name:'Qwen · 阿里云百炼',baseURL:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',api:'openai-completions'},
 {id:'openai',name:'OpenAI',baseURL:'https://api.openai.com/v1',api:'openai-responses'},
 {id:'anthropic',name:'Anthropic',baseURL:'https://api.anthropic.com',api:'anthropic-messages'},
 {id:'moonshotai-cn',name:'Kimi',api:'openai-completions'},
 {id:'minimax-cn',name:'MiniMax',api:'anthropic-messages'},
 {id:'openrouter',name:'OpenRouter',api:'openai-completions'},
]
export const modelProtocols=[{id:'openai-completions',name:'OpenAI Chat Completions'},{id:'openai-responses',name:'OpenAI Responses'},{id:'anthropic-messages',name:'Anthropic Messages'}]
const unwrap=result=>{if(!result?.ok)throw Error(result?.error?.message??'客户端没有接受操作');return result.value}
const normalizedURL=value=>{let url;try{url=new URL(value)}catch{throw Error('请输入完整的服务地址')};if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('服务地址需为不含密钥或查询参数的 HTTP / HTTPS 地址');return url.href.replace(/\/+$/,'')}

export function createConnectionEditor(ctx,describe,{row,preset}={}){
 preset={...(row?.provider?modelPresets.find(entry=>entry.route===row.provider||entry.id===row.provider):undefined),...preset}
 const view=describe.getSnapshot().view
 const ns=row?.settingsNs??view?.namespaces.find(entry=>entry.ns==='llm-pi-ai')?.ns
 if(!ns)throw Error('当前没有加载自定义模型连接适配器')
 const provider=row?.provider??'dshgui-'+(modelPresets.some(entry=>entry.id===preset.id)?preset.id:'custom')+'-'+crypto.randomUUID().slice(0,12).replaceAll('-','')
 const path=row?.settingsPath??['providers',provider],form=ctx.configForms.get(ns),opened=form.getSnapshot()
 if(opened.status!=='ready'||!opened.writable)throw Error('此连接当前不可编辑')
 const original=valueAt(opened.value,path)??{},native=path.length===0
 let revision=opened.revision,disposed=false,generation=0
 let value={provider,ns,native,removable:Boolean(row?.removable),name:original.displayName??row?.displayName??preset?.name??'',baseURL:original.baseURL??row?.defaultBaseURL??preset?.baseURL??'',api:original.api??preset?.api??'openai-completions',key:'',keyConfigured:Boolean(row?.credentialConfigured),models:structuredClone(original.models??[]),selected:(original.models??[]).map(model=>model.id),busy:false,error:'',listed:false,saved:false}
 const listeners=new Set(),publish=patch=>{if(disposed)return;value={...value,...patch};for(const listener of listeners)listener()}
 const alive=()=>{if(disposed)throw Error('模型配置已关闭')}
 const fingerprint=()=>JSON.stringify([value.baseURL,value.api,value.key])
 let acceptedFingerprint=fingerprint()
 let trustedEndpoint=value.baseURL
 const modelValue=model=>{const found=(original.models??[]).find(entry=>entry.id===model.id)??{},next={...found,id:model.id};if(model.name)next.name=model.name;for(const key of ['contextWindow','maxTokens'])if(Number.isInteger(model[key])&&model[key]>0)next[key]=model[key];const input=model.inputModalities??model.input;if(input?.length)next[native?'inputModalities':'input']=input;return next}
 return {getSnapshot:()=>value,subscribe:listener=>(listeners.add(listener),()=>listeners.delete(listener)),
  edit(field,next){alive();if(value.busy)return;if(!['name','baseURL','api','key'].includes(field))throw Error('未知模型字段');++generation;publish({[field]:next,error:'',saved:false})},
  toggle(id){alive();if(value.busy)return;publish({selected:value.selected.includes(id)?value.selected.filter(key=>key!==id):[...value.selected,id],saved:false})},
  selectAll(ids){alive();if(!value.busy)publish({selected:[...new Set(ids)],saved:false})},
  addModel(id){alive();id=id.trim();if(!id||id.length>256)throw Error('请输入有效的模型 ID');if(value.models.some(row=>row.id===id)){publish({selected:[...new Set([...value.selected,id])]});return}publish({models:[...value.models,{id}],selected:[...value.selected,id],listed:false,error:'',saved:false});acceptedFingerprint=fingerprint()},
  async discover(){
   alive();if(value.busy)return
   const baseURL=normalizedURL(value.baseURL),requestId=++generation,identity=fingerprint()
   publish({busy:true,error:'',saved:false})
   try{
    const request={baseURL,api:value.api,...(row?{provider}:{}),...(value.key.trim()?{apiKey:value.key.trim()}:{})}
    const offered=unwrap(await ctx.remote.llm.discoverModels('dsh-web-gui-model-discovery',request))
    if(disposed||requestId!==generation||fingerprint()!==identity)return
    const models=[...new Map(offered.map(model=>[model.id,model])).values()]
    acceptedFingerprint=identity
    publish({models,selected:value.selected.filter(id=>models.some(model=>model.id===id)),listed:true,error:models.length?'':'此服务没有返回模型，可手动添加'})
   }catch(error){publish({error:error.message});throw error}finally{if(requestId===generation)publish({busy:false})}
  },
  async save(){
   alive();if(value.busy)throw Error('正在处理模型配置')
   const baseURL=normalizedURL(value.baseURL)
   if(original.apiKeyEnv&&!value.key.trim()&&(!trustedEndpoint||normalizedURL(trustedEndpoint)!==baseURL))throw Error('服务地址已改变，请输入新地址对应的 API Key')
   if(!value.name.trim())throw Error('请输入连接名称')
   if(!value.selected.length)throw Error('请至少选择一个模型')
   if(acceptedFingerprint!==fingerprint())throw Error('连接信息已改变，请重新获取模型或手动添加型号')
   if(form.getSnapshot().revision!==revision)throw Error('配置已在其他位置更新，请返回重新打开；当前内容未写入')
   const models=value.models.filter(model=>value.selected.includes(model.id)).map(modelValue)
   let newRef
   publish({busy:true,error:'',saved:false})
   try{
    const ops=[{op:'set',path:[...path,'baseURL'],value:baseURL},{op:'set',path:[...path,'models'],value:models}]
    if(!native)ops.push({op:'set',path:[...path,'displayName'],value:value.name.trim()},{op:'set',path:[...path,'api'],value:value.api})
    if(value.key.trim()){
     newRef='DSH_GUI_MODEL_'+crypto.randomUUID().replaceAll('-','').toUpperCase()
     unwrap(await ctx.remote.credentials.set(newRef,value.key.trim()))
     ops.push({op:'set',path:[...path,'apiKeyEnv'],value:newRef})
    }
    if(disposed)throw Error('模型配置已关闭')
    if(!await form.mutate(ops,revision))throw Error('客户端未接受配置，输入已保留，请重新读取后重试')
    revision=form.getSnapshot().revision;trustedEndpoint=baseURL;acceptedFingerprint=JSON.stringify([value.baseURL,value.api,''])
    publish({key:'',keyConfigured:value.keyConfigured||Boolean(newRef),saved:true})
    return provider
   }catch(error){
    if(newRef){try{unwrap(await ctx.remote.credentials.unset(newRef))}catch{publish({error:'配置未保存，新增密钥的清理失败；请在凭据管理中检查'});throw Error(value.error)}}
    publish({error:error.message});throw error
   }finally{publish({busy:false})}
  },
  async remove(){alive();if(!value.removable||native)throw Error('此连接由宿主提供，不能在这里移除');if(value.busy)throw Error('正在处理模型配置');if(form.getSnapshot().revision!==revision)throw Error('配置已更新，请重新打开后操作');publish({busy:true,error:''});try{if(!await form.mutate([{op:'unset',path}],revision))throw Error('客户端未接受移除操作')}catch(error){publish({error:error.message});throw error}finally{publish({busy:false})}},
  dispose(){disposed=true;++generation;value={...value,key:''};listeners.clear()},
 }
}
