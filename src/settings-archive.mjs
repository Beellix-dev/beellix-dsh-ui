function workspaceTitle(title){
 return title==='default-workspace'?'默认工作区':title
}

function directoryKey(path){
 if(!path)return ''
 if(/^(?:[A-Za-z]:[\\/]|\\\\|\/\/)/.test(path))return path.replaceAll('\\','/').replace(/\/+$/,'').toLowerCase()
 return path.replace(/\/+$/,'')||path
}

/** Project the native archive and session catalogs without opening any conversations. */
export function archivedGroups(workspaces,sessions,{query='',workspaceId='',sort='newest'}={}){
 const membership=new Map(),directories=new Map()
 for(const workspace of workspaces.items){
  if(workspace.path)directories.set(directoryKey(workspace.path),workspace)
  for(const id of workspace.sessionIds){if(!membership.has(id))membership.set(id,workspace)}
 }
 const groups=new Map(),needle=query.trim().toLocaleLowerCase()
 const direction=sort==='oldest'?1:-1
 for(const id of new Set(workspaces.archivedSessionIds)){
  const session=sessions.byId[id]
  if(!session)continue
  const directory=directoryKey(session.cwd)
  const workspace=membership.get(id)??directories.get(directory)
  const key=workspace?.workspaceId??(directory?'directory:'+directory:'ungrouped')
  if(workspaceId&&key!==workspaceId)continue
  const title=session.title?.trim()||session.displayTitle?.trim()||'未命名聊天'
  if(needle&&!title.toLocaleLowerCase().includes(needle))continue
  if(!groups.has(key)){
   const originalDirectory=workspace?undefined:session.cwd
   const directoryName=originalDirectory?.replace(/[\\/]+$/,'').split(/[\\/]/).at(-1)||originalDirectory
   groups.set(key,{id:key,title:workspaceTitle(workspace?.title||directoryName||'归属未知'),originalDirectory,rows:[]})
  }
  groups.get(key).rows.push({id,title,updatedAt:session.updatedAt})
 }
 const compare=(a,b)=>direction*((a.updatedAt||0)-(b.updatedAt||0))
 const result=[...groups.values()]
 for(const group of result)group.rows.sort(compare)
 return result.sort((a,b)=>compare(a.rows[0],b.rows[0]))
}
