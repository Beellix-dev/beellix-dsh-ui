/** Independent configuration registry and revision-fenced drafts over DSH's public forms. */
export function createSettingsRegistry() {
  const entries = new Map(), listeners = new Set()
  let snapshot = [], disposed = false
  const publish = () => { snapshot = [...entries.values()].map(x => x.value).sort((a,b) => (a.order??0)-(b.order??0)); for (const fn of listeners) fn() }
  return {
    getSnapshot: () => snapshot,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) },
    register(value) {
      if (disposed) throw Error('配置目录已释放')
      if (!value?.id || !value.page || !value.title) throw Error('配置贡献缺少标识、页面或名称')
      const entry = {value: Object.freeze({...value})}
      entries.set(value.id, entry); publish()
      return () => { if(entries.get(value.id) === entry) { entries.delete(value.id); publish() } }
    },
    dispose() { disposed = true; entries.clear(); publish(); listeners.clear() },
  }
}

export function valueAt(root, path) { return path.reduce((value,key) => value?.[key], root) }
const safePath = path => Array.isArray(path) && path.length > 0 && path.every(key => typeof key === 'string' && !['__proto__','constructor','prototype'].includes(key))

export function createSettingsDraft(form) {
  let accepted = form.getSnapshot(), revision = accepted.revision, changes = new Map(), busy = false, error = '', disposed = false, snapshot
  const listeners = new Set()
  function publish() {
    if(disposed) return
    snapshot = {accepted,changes:[...changes.values()],dirty:changes.size>0,busy,error,conflicted:changes.size>0 && revision!==accepted.revision}
    for(const fn of listeners) fn()
  }
  const off = form.subscribe(() => { accepted = form.getSnapshot(); if(!changes.size) revision=accepted.revision; publish() })
  publish()
  const live = () => { if(disposed) throw Error('配置编辑器已释放') }
  return {
    getSnapshot: () => snapshot,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) },
    set(path,value) {
      live(); if(busy) throw Error('正在保存配置')
      if(!safePath(path)) throw Error('配置路径无效')
      const key=JSON.stringify(path)
      if(JSON.stringify(value) === JSON.stringify(valueAt(accepted.value,path))) changes.delete(key)
      else changes.set(key,{op:'set',path:[...path],value:structuredClone(value)})
      error=''; publish()
    },
    clear(path) {
      live(); if(busy) throw Error('正在保存配置')
      if(!safePath(path)) throw Error('配置路径无效')
      changes.set(JSON.stringify(path),{op:'unset',path:[...path]}); error=''; publish()
    },
    discard() { live(); if(busy) return; changes.clear(); accepted=form.getSnapshot(); revision=accepted.revision; error=''; publish() },
    async save() {
      live(); if(busy) throw Error('正在保存配置')
      if(accepted.status!=='ready' || !accepted.writable) throw Error('此配置只读或尚未就绪')
      if(revision!==accepted.revision) throw Error('配置已变化，请重新读取后修改')
      if(!changes.size) return
      busy=true; error=''; publish()
      try {
        const ok=await form.mutate([...changes.values()],revision)
        if(!ok) throw Error('客户端未接受修改，草稿已保留')
        if(!disposed) { changes.clear(); accepted=form.getSnapshot(); revision=accepted.revision }
      } catch(cause) { error=cause.message; throw cause }
      finally { busy=false; publish() }
    },
    dispose() { disposed=true; off(); changes.clear(); listeners.clear() },
  }
}

/** Describe only declared fields. Unknown compound values are never silently coerced. */
export function settingsFields(schema, prefix=[], depth=0) {
  if(!schema || depth>6) return []
  if(schema.type==='intersect') return (schema.list??[]).flatMap(node=>settingsFields(node,prefix,depth+1))
  if(schema.type!=='object') return []
  return Object.entries(schema.dict??{}).flatMap(([key,node]) => {
    if(['__proto__','constructor','prototype'].includes(key) || node.meta?.hidden) return []
    const path=[...prefix,key]
    if(node.type==='object') return settingsFields(node,path,depth+1)
    const meta=node.meta??{}, options=node.type==='union' && node.list?.every(x=>x.type==='const') ? node.list.map(x=>x.value) : undefined
    return [{path,key:path.join('.'),label:typeof meta.description==='string'?meta.description:key,type:options?'enum':node.type,options,min:meta.min,max:meta.max,step:meta.step,secret:meta.role==='secret',default:meta.default}]
  })
}

export function groupModelProviders(registered=[], declared=[], groups=[]) {
  const records=new Map(declared.map(row=>[row.provider,{...row}]))
  for(const row of registered) if(!records.has(row.id)) records.set(row.id,{provider:row.id,displayName:row.name,settingsNs:'',settingsPath:[]})
  return [...records.values()].map(row=>({...row,active:registered.some(x=>x.id===row.provider),models:groups.find(x=>x.id===row.provider)?.models??[]}))
}
