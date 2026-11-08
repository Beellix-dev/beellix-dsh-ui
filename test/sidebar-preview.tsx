import React from 'react'
import {createRoot} from 'react-dom/client'
import {SidebarGui} from '../src/sidebar-gui'
import {createSidebarModules} from '../src/sidebar-modules.mjs'
function source(value:any){const listeners=new Set<()=>void>();return {getSnapshot:()=>value,subscribe:(fn:()=>void)=>(listeners.add(fn),()=>listeners.delete(fn)),set(next:any){value=next;for(const fn of listeners)fn()}}}
const form=source({status:'ready',writable:true,revision:0,value:{sidebar:'{"hidden":[],"order":[],"environments":["workspace"]}'}})
;(form as any).mutate=async(ops:any[],revision:number)=>{if(revision!==form.getSnapshot().revision)return false;form.set({...form.getSnapshot(),revision:revision+1,value:{sidebar:ops[0].value}});return true}
const panels=source([{options:{id:'plugins',label:'插件',order:0}},{options:{id:'tasks',label:'自动化任务',order:1}}]),layout=source({activePanelId:null}),collapsed=source(false),calls:any[]=[]
const ctx:any={configForms:{get:()=>form,describe:()=>({ensure:async()=>{}})},locale:source({revision:0}),layout:{panelInfo:layout,selectPanel:(id:any)=>layout.set({activePanelId:id}),toggleSidebar:()=>collapsed.set(!collapsed.getSnapshot())},uiWorkspace:{startSession:()=>calls.push('workspace')},slots:{subscribe:(_key:any,fn:any)=>panels.subscribe(fn),getVersion:()=>panels.getSnapshot(),entriesOfSlot:(key:string)=>key==='sidebar.panellist'?panels.getSnapshot():key==='main'?panels.getSnapshot().map((row:any)=>({options:{key:row.options.id}})):[]}}
const sidebar=createSidebarModules(ctx);await sidebar.start();const runtime={sidebar,ctx},disposers=new Map()
Object.assign(globalThis,{__sidebarFixture:{calls,sidebar,form,add(id:string){disposers.set(id,sidebar.registerEnvironment({id,title:({scene:'场景',lab:'实验',remote:'远程'} as any)[id],environmentId:'fixture/'+id,render:()=> <div>{id} 列表</div>,startSession:()=>calls.push(id)}))},remove(id:string){disposers.get(id)?.()},removePanel(){panels.set(panels.getSnapshot().filter((row:any)=>row.options.id!=='tasks'))}}})
function Preview(){const closed=React.useSyncExternalStore(collapsed.subscribe,collapsed.getSnapshot);return <div style={{width:closed?56:280,height:'100vh',background:'var(--dsw-alias-bg-base)'}}><SidebarGui runtime={runtime} collapsed={closed} renderSlot={(name:string)=>name==='sidebar.workspaces'?<div>工作区列表</div>:name==='sidebar.settings'?<button>更多</button>:null}/></div>}
createRoot(document.getElementById('root')!).render(<Preview/>);
