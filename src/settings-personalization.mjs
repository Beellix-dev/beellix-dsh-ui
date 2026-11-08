/** Our data-only decoration contract; shared by Host validation and the independent GUI. */
const petActionFileLimit=512*1024
export const petActionLimit=12
export const petLibraryLimit=12
const legacyActionId='custom-legacy'
export const petPlacement={size:120,right:24,bottom:24}
export const defaultDecorations={petLibrary:{enabled:false,activeId:null,entries:[],unassignedActions:[]},effects:{click:false,trail:false,color:'#9273dd'}}
export const activePet=library=>library.entries.find(({id})=>id===library.activeId)
function legacyPetImage(value){
 if(value==='')return value
 if(typeof value!=='string'||value.length>Math.ceil(petActionFileLimit/3)*4+32||
   !/^data:image\/(?:gif|webp);base64,[a-z\d+/]+={0,2}$/i.test(value))throw Error('请选择 512 KB 以内的本地 GIF 或 WebP')
 const signature=atob(value.split(',')[1].slice(0,16))
 const valid=value.startsWith('data:image/gif;')
  ?signature.startsWith('GIF87a')||signature.startsWith('GIF89a')
  :signature.startsWith('RIFF')&&signature.slice(8)==='WEBP'
 if(!valid)throw Error('动作素材内容与格式不符')
 return value
}
function normalizePetActions(pet){
 const legacyImage=legacyPetImage(pet.actionImage??'')
 const entries=pet.actions??(legacyImage?[{id:legacyActionId,name:'我的动作',image:legacyImage}]:[])
 if(!Array.isArray(entries)||entries.length>petActionLimit)throw Error('最多保存 '+petActionLimit+' 个自定义动作')
 const ids=new Set(),names=new Set()
 return entries.map(entry=>{
  if(typeof entry?.id!=='string'||!/^custom-[a-z0-9-]{1,48}$/.test(entry.id)||ids.has(entry.id))throw Error('宠物动作编号无效或重复')
  const name=typeof entry.name==='string'?entry.name.trim():''
  if(!name||name.length>20)throw Error('请输入 1–20 字的动作名称')
  if(names.has(name))throw Error('动作名称已存在，请换一个名称')
  const stored=typeof entry.image==='string'&&/^\/dsh-web-gui\/media\/[a-f\d]{64}\.(gif|webp)$/.test(entry.image)
  const image=stored?entry.image:legacyPetImage(entry.image)
  if(!image)throw Error('请先导入动作素材')
  if(entry.durationMs!==undefined&&(!Number.isInteger(entry.durationMs)||entry.durationMs<10||entry.durationMs>60000))
   throw Error('动作时长无效')
  ids.add(entry.id)
  names.add(name)
  return {id:entry.id,name,image,...(entry.durationMs===undefined?{}:{durationMs:entry.durationMs})}
 })
}
function normalizePet(pet){
 for(const [key,label,min,max] of [['size','大小',64,240],['right','横向位置',0,10000],['bottom','纵向位置',0,10000]])if(!Number.isInteger(pet[key])||pet[key]<min||pet[key]>max)throw Error('宠物'+label+'超出范围')
 const name=typeof pet.name==='string'?pet.name.trim():''
 if(name.length>20)throw Error('宠物名称最多 20 字')
 const actions=normalizePetActions(pet)
 const defaultActionId=pet.defaultActionId??null
 const idle=actions.find(({id})=>id===defaultActionId)
 if(!idle)throw Error('请选择已上传的默认动作')
 const thumbnail=pet.thumbnail??''
 if(typeof thumbnail!=='string'||thumbnail.length>64000||thumbnail&&!/^data:image\/webp;base64,[a-z\d+/]+={0,2}$/i.test(thumbnail))throw Error('宠物缩略图无效')
 return {id:pet.id,name:name||idle.name,size:pet.size,right:pet.right,bottom:pet.bottom,defaultActionId,actions,thumbnail}
}
function normalizePetLibrary(input){
 const legacy=input?.pet
 const library=input?.petLibrary??(legacy?(legacy.defaultActionId?{
  enabled:legacy.enabled,activeId:'pet-legacy',entries:[{...legacy,id:'pet-legacy'}],unassignedActions:[]
 }:{...defaultDecorations.petLibrary,unassignedActions:normalizePetActions(legacy)}):defaultDecorations.petLibrary)
 if(typeof library.enabled!=='boolean'||!Array.isArray(library.entries)||library.entries.length>petLibraryLimit)throw Error('宠物列表无效')
 const ids=new Set()
 const entries=library.entries.map(pet=>{
  if(typeof pet?.id!=='string'||!/^pet-[a-z0-9-]{1,48}$/.test(pet.id)||ids.has(pet.id))throw Error('宠物编号无效或重复')
  ids.add(pet.id)
  return normalizePet(pet)
 })
 const activeId=library.activeId??null
 if(activeId!==null&&!ids.has(activeId))throw Error('请选择列表中的宠物')
 return {enabled:library.enabled&&activeId!==null,activeId,entries,unassignedActions:normalizePetActions({actions:library.unassignedActions??[]})}
}
export function normalizeDecorations(input){
 const effects=input?.effects??defaultDecorations.effects
 if(typeof effects.click!=='boolean'||typeof effects.trail!=='boolean')throw Error('装饰开关无效')
 if(typeof effects.color!=='string'||!/^#[\da-f]{6}$/i.test(effects.color))throw Error('动效颜色无效')
 return {petLibrary:normalizePetLibrary(input),effects:{click:effects.click,trail:effects.trail,color:effects.color.toLowerCase()}}
}
export function createDecorationStore(ctx){
 const form=ctx.configForms.get('dsh-web-gui'),listeners=new Set();let off,disposed=false,revision,snapshot={ready:false,value:defaultDecorations,busy:false,error:''}
 const publish=patch=>{if(disposed)return;snapshot={...snapshot,...patch};for(const fn of listeners)fn()}
 const adopt=()=>{if(disposed||snapshot.busy)return;const view=form.getSnapshot();if(view.status!=='ready')return;try{const value=normalizeDecorations(JSON.parse(view.value.decorations??JSON.stringify(defaultDecorations)));revision=view.revision;publish({ready:true,value,error:''})}catch(error){publish({error:error.message})}}
 return {getSnapshot:()=>snapshot,subscribe:fn=>(listeners.add(fn),()=>listeners.delete(fn)),
  async start(){off=form.subscribe(adopt);await ctx.configForms.describe().ensure();adopt()},
  async save(raw){if(disposed||snapshot.busy||!snapshot.ready)throw Error('装饰设置暂时不可修改');const value=normalizeDecorations(raw),view=form.getSnapshot();if(!view.writable||view.revision!==revision)throw Error('设置已变化，请刷新后重试');publish({busy:true,error:''});try{if(!await form.mutate([{op:'set',path:['decorations'],value:JSON.stringify(value)}],revision))throw Error('装饰设置未保存，请重试');revision=form.getSnapshot().revision;publish({value})}catch(error){publish({error:error.message});throw error}finally{publish({busy:false});adopt()}},
  dispose(){disposed=true;off?.();listeners.clear()},
 }
}
