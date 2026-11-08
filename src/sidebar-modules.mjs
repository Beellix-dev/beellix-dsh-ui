/** Sidebar presentation preferences. Environment providers own execution and storage. */
export const defaultSidebar={hidden:[],order:[],environments:['workspace']}
const identifier=value=>typeof value==='string'&&/^[\w.:/-]{1,160}$/.test(value)
export function normalizeSidebar(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('侧栏配置无效')
 const list=(key,fallback)=>{const values=value[key]??fallback;if(!Array.isArray(values)||values.length>200||values.some(id=>!identifier(id)))throw Error('侧栏模块标识无效');return [...new Set(values)]}
 const environments=list('environments',['workspace']);if(environments.length>3)throw Error('最多显示三个环境模块')
 return {hidden:list('hidden',[]),order:list('order',[]),environments}
}
export function orderedPanels(panels,preferences){
 const rank=new Map(preferences.order.map((id,index)=>[id,index]))
 return panels.filter(row=>!preferences.hidden.includes(row.id)).sort((a,b)=>(rank.get(a.id)??1000)-(rank.get(b.id)??1000)||(a.order??0)-(b.order??0))
}
export function createSidebarModules(ctx){
 const form=ctx.configForms.get('dsh-web-gui'),listeners=new Set(),providers=new Map()
 let off,disposed=false,snapshot={ready:false,busy:false,error:'',preferences:defaultSidebar,providers:[]}
 const publish=patch=>{if(disposed)return;snapshot={...snapshot,...patch};for(const fn of listeners)fn()}
 const adopt=()=>{if(disposed||snapshot.busy)return;const view=form.getSnapshot();if(view.status!=='ready')return;try{publish({ready:true,preferences:normalizeSidebar(JSON.parse(view.value.sidebar??JSON.stringify(defaultSidebar))),error:''})}catch(error){publish({error:error.message})}}
 return {getSnapshot:()=>snapshot,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),
  async start(){off=form.subscribe(adopt);await ctx.configForms.describe().ensure();adopt()},
  registerEnvironment(provider){
   if(disposed)throw Error('侧栏已释放')
   if(!identifier(provider?.id)||provider.id==='workspace'||!provider.title||!identifier(provider.environmentId)||typeof provider.render!=='function'||typeof provider.startSession!=='function')throw Error('环境模块需要独立环境标识、列表和新会话操作')
   if(providers.has(provider.id))throw Error('环境模块标识重复')
   const entry=Object.freeze({...provider});providers.set(entry.id,entry);publish({providers:[...providers.values()]})
   return()=>{if(providers.get(entry.id)!==entry)return;providers.delete(entry.id);publish({providers:[...providers.values()]})}
  },
  async save(input,expected){
   if(disposed||snapshot.busy||!snapshot.ready)throw Error('侧栏暂时不可修改')
   const preferences=normalizeSidebar(input),view=form.getSnapshot();if(!view.writable)throw Error('当前侧栏配置只读')
   if(expected&&JSON.stringify(normalizeSidebar(JSON.parse(view.value.sidebar??JSON.stringify(defaultSidebar))))!==JSON.stringify(expected))throw Error('侧栏配置已更新，请关闭后重新打开')
   publish({busy:true,error:''})
   try{if(!await form.mutate([{op:'set',path:['sidebar'],value:JSON.stringify(preferences)}],view.revision))throw Error('配置已变化，请重试');publish({preferences})}catch(error){publish({error:error.message});throw error}finally{publish({busy:false});adopt()}
  },
  dispose(){disposed=true;off?.();providers.clear();listeners.clear()},
 }
}
