/** Retain the native lifecycle handles returned to the session controller. */
export function applyArchiveAgentLifecycle(ctx){
 ctx.inject(['agents','workspaceRegistry'],host=>{
  const native=host.agents[Symbol.for('cordis.original')]
  const owned=new Map(),releasing=new Map()
  let active=true
  const registry=Object.create(native,{ctx:{value:native.ctx,configurable:true}})
  const archived=id=>host.workspaceRegistry.archivedSessionIds.includes(id)
  const release=id=>{
   const existing=releasing.get(id)
   if(existing)return existing
   const handle=owned.get(id)
   if(!active||!handle||!archived(id))return Promise.resolve()
   const task=Promise.resolve().then(async()=>{
    await handle.agent.whenIdle()
    if(active&&archived(id)&&owned.get(id)===handle){
     await handle.dispose()
     if(owned.get(id)===handle)owned.delete(id)
    }
   }).finally(()=>{releasing.delete(id)})
   releasing.set(id,task)
   return task
  }
  const schedule=id=>{void release(id).catch(error=>host.logger.warn('归档会话释放失败：%s',error.message))}
  for(const method of ['create','resume']){
   Object.defineProperty(registry,method,{configurable:true,value:async function(options){
    const handle=await Reflect.apply(native[method],this,[options])
    if(active){
     owned.set(handle.agent.id,handle)
     if(archived(handle.agent.id))schedule(handle.agent.id)
    }
    return handle
   }})
  }
  host.on('agent/disposed',({agent})=>{
   if(owned.get(agent.id)?.agent===agent)owned.delete(agent.id)
  },{global:true})
  host.on('domain/changed',change=>{
   if(change.domain==='workspace'&&change.table===''&&change.operation==='put'){
    // The domain emits before WorkspaceRegistry updates its public snapshot.
    setImmediate(()=>{
     for(const id of change.value.archivedSessionIds??[])if(owned.has(id))schedule(id)
    })
   }
  },{global:true})
  host.effect(()=>()=>{active=false;owned.clear()},'归档会话生命周期')
  host.provide('beellixArchiveAgentLifecycle',{registry,release})
 })
}
