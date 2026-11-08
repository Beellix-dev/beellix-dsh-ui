/** Native Next bridge adapter. Serial, acknowledged writes preserve other preferences. */
export function createSettingsDesktopStore(bridge){
 let snapshot={phase:bridge?'loading':'unavailable',state:null,busy:false,error:''},disposed=false,tail=Promise.resolve(),reading,generation=0
 const listeners=new Set(),publish=patch=>{if(disposed)return;snapshot={...snapshot,...patch};for(const listener of listeners)listener()}
 const assertLive=()=>{if(disposed)throw Error('设置接口已释放');if(!bridge)throw Error('此环境不提供桌面设置')}
 const refresh=(fresh=false)=>{assertLive();if(reading&&!fresh)return reading;const request=++generation;reading=Promise.resolve().then(()=>bridge.state()).then(state=>{if(request===generation)publish({phase:'ready',state,error:''});return state}).catch(error=>{if(request===generation)publish({phase:'error',error:error.message});throw error}).finally(()=>{if(request===generation)reading=undefined});return reading}
 const run=action=>{const pending=tail.then(async()=>{assertLive();publish({busy:true,error:''});try{const result=await action();if(!disposed)await refresh(true);return result}catch(error){publish({error:error.message});throw error}finally{publish({busy:false})}});tail=pending.catch(()=>{});return pending}
 return {getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},refresh:()=>bridge?refresh():Promise.resolve(),
  save:(field,value)=>run(async()=>{const state=await bridge.state();assertLive();if(!Object.hasOwn(state.preferences,field))throw Error('当前客户端未提供此项设置');const accepted=await bridge.command({type:'preferences',preferences:{...state.preferences,[field]:value}});if(accepted===false)throw Error('客户端未接受修改，请检查当前运行状态')}),
  command:command=>run(async()=>{if(await bridge.command(command)===false)throw Error('操作未完成或已取消')}),
  dispose:()=>{disposed=true;listeners.clear()}}
}
