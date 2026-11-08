/** Read inventory and change only Host-addressable global entries through public Remotes. */
const presentationRequired=new Set(['@beellix-ai/dsh-web-gui',...['ui-layout','ui-sidebar','ui-conversation','ui-renderer','ui-settings','ui-theme','ui-primitives'].map(name=>'@deepseek-ai/dsh-client-'+name),'@deepseek-ai/dsh-client-locale','@deepseek-ai/dsh-client-shortcuts'])
export function createPluginList(ctx){
 let state={phase:'idle',entries:[],presets:[],management:false,busy:null,error:'',notice:''},disposed=false,generation=0
 const listeners=new Set(),off=[]
 const emit=patch=>{if(disposed)return;state={...state,...patch};for(const fn of listeners)fn()}
 const answer=result=>{if(!result?.ok)throw Error(result?.error?.message??'插件接口未返回有效结果');return result.value}
 const label=value=>typeof value==='object'?ctx.locale.resolveText?.(value)??value.zh??value.en??'':value??''
 const decorate=row=>({...row,title:label(row.meta?.title)||row.moduleName.split('/').at(-1).replace(/^dsh-(?:client-|host-)?/,''),description:label(row.meta?.description)})
 const api={getSnapshot:()=>state,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),dismissNotice:()=>emit({notice:''}),
  async load(){
   if(disposed)return
   const current=++generation;emit({phase:state.entries.length?'ready':'loading',error:''})
   try{
    const inventory=answer(await ctx.remote.pluginInventory.list())
    let managed=[],management=Boolean(inventory.managementAvailable)
    if(management)managed=answer(await ctx.remote.pluginManager.listPlugins())
    if(disposed||current!==generation)return
    const entries=inventory.entries.map(row=>{const control=managed.find(item=>item.entryId===row.entryId),core=presentationRequired.has(row.moduleName);return {...decorate(row),core,canToggle:Boolean(management&&control?.patchId&&!core),reason:core?'ui-required':control?.readOnlyReason,patchId:control?.patchId}})
    emit({phase:'ready',entries,presets:(inventory.agentPresets??[]).map(preset=>({...preset,name:label(preset.name)||preset.id,rows:preset.rows.map(decorate)})),management,error:''})
   }catch(error){if(current===generation)emit({phase:'error',error:error.message})}
  },
  async toggle(entryId,enabled){
   if(disposed)throw Error('插件列表已关闭')
   if(state.busy)throw Error('正在应用插件修改')
   const row=state.entries.find(item=>item.entryId===entryId)
   if(!row?.canToggle||typeof enabled!=='boolean')throw Error('此组件由底座或模式管理，不能在这里切换')
   emit({busy:entryId,error:'',notice:''})
   try{
    const result=answer(await ctx.remote.pluginManager.setPluginEnabled(entryId,enabled))
    if(result.application==='failed'||result.error)throw Error(result.error?.diagnostic??`插件修改失败：${result.error?.code??'请重新检查'}`)
    if(result.application==='restart-required')emit({notice:'修改已保存，重启客户端后生效'})
    else if(result.application==='overridden')emit({notice:'修改被其他配置覆盖，当前运行状态已重新读取'})
    else if(result.application==='applied')emit({notice:enabled?'插件已启用':'插件已停用'})
    else throw Error('插件修改未完成，请刷新后检查')
    if(!disposed)await api.load()
   }catch(error){emit({error:error.message});throw error}finally{emit({busy:null})}
  },
  start(){if(ctx.remote.$on)off.push(ctx.remote.$on('plugin-manager/changed',()=>{if(state.phase!=='idle')void api.load()}));if(ctx.on)off.push(ctx.on('connection/reset',()=>{if(state.phase!=='idle')void api.load()}))},
  dispose(){disposed=true;++generation;for(const fn of off)fn();listeners.clear()},
 }
 return api
}
export function pluginPhase(row,session=false){
 if(row.enabled===false&&row.fiberPhase==='active')return '等待停止'
 if(row.enabled===false&&row.fiberPhase==='unloading')return '正在停用'
 if(row.fiberPhase==='failed')return '加载失败'
 if(row.fiberPhase==='loading'||row.fiberPhase==='pending')return '正在加载'
 if(row.fiberPhase==='unloading')return '正在卸载'
 if(row.enabled===false)return '已停用'
 if(row.enabled==='conditional')return '按条件加载'
 return row.fiberPhase==='active'?'运行中':session?'随会话加载':'未加载'
}
