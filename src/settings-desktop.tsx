import React,{useEffect,useState,useSyncExternalStore} from 'react'
import {Button} from '@deepseek-ai/dsh-client-ui-primitives'
import {SettingsGroup,SettingRow,SettingSwitch,SettingChoice,SettingsStatus,SettingsFeedback,NumberControl} from './settings-controls'

export function DesktopPreferences({page,store}:{page:string;store:any}){
 const view=useSyncExternalStore(store.subscribe,store.getSnapshot),[port,setPort]=useState('')
 useEffect(()=>{void store.refresh().catch(()=>{})},[store,page])
 const state=view.state,p=state?.preferences
 useEffect(()=>{if(p)setPort(String(p.port))},[p?.port])
 const run=(command:any)=>void store.command(command).catch(()=>{}),save=(key:string,value:any)=>void store.save(key,value).catch(()=>{})
 if(view.phase==='unavailable')return null
 if(!state)return view.error?<SettingsFeedback message={view.error} action="重试" onAction={()=>void store.refresh().catch(()=>{})}/>:<SettingsStatus tone="progress">正在读取客户端设置</SettingsStatus>
 const switchRow=(label:string,key:string,hint?:string)=>Object.hasOwn(p,key)?<SettingSwitch key={key} label={label} hint={hint} checked={Boolean(p[key])} disabled={view.busy||state.busy} onChange={value=>save(key,value)}/>:null
 return <>
  {view.error&&<SettingsFeedback message={view.error} action="重新读取" onAction={()=>void store.refresh().catch(()=>{})}/>}
  {view.busy&&<div role="status" className="bx-settings__hint">正在应用修改…</div>}
  {page==='general'&&<SettingsGroup title="桌面行为">{switchRow('关闭窗口后保留在托盘','closeToTray','关闭窗口后继续运行；退出应用仍会停止客户端。')}</SettingsGroup>}
  {page==='layout'&&<SettingsGroup title="侧栏布局">{switchRow('兼容侧栏布局','sidebarFooterCompat')}{switchRow('均衡侧栏底部空间','sidebarFooterBalanced')}</SettingsGroup>}
  {page==='notifications'&&<SettingsGroup title="桌面通知">{switchRow('允许消息通知','notifications')}{switchRow('对话完成','turnCompleted')}{switchRow('对话失败','turnFailed')}{switchRow('自动化任务完成','scheduleCompleted')}{switchRow('自动化任务失败','scheduleFailed')}</SettingsGroup>}
  {page==='network'&&<><SettingsGroup title="访问范围">{switchRow('允许浏览器访问','browserAccess','开启后可通过浏览器访问当前环境。')}<SettingRow label="网络范围" hint="局域网访问会扩大可访问范围，仍沿用客户端的授权与确认。"><SettingChoice label="网络范围" disabled={view.busy} value={p.networkExposure} options={[{value:'loopback',label:'仅本机'},{value:'lan',label:'局域网'}]} onChange={value=>save('networkExposure',value)}/></SettingRow><SettingRow label="访问端口" hint="0 表示自动分配；更改后按客户端提示生效。"><form onSubmit={e=>{e.preventDefault();const value=Number(port);if(Number.isInteger(value)&&value>=0&&value<=65535)save('port',value)}} className="bx-settings__actions"><NumberControl label="访问端口" min={0} max={65535} value={port} disabled={view.busy} onChange={value=>setPort(String(value))}/><Button variant="outline" size="sm" disabled={view.busy||String(p.port)===port} type="submit">应用</Button></form></SettingRow></SettingsGroup>{p.browserAccess&&<SettingRow label="访问地址"><Button variant="outline" onClick={()=>run({type:'open-browser'})}>在浏览器打开</Button></SettingRow>}</>}
  {page==='diagnostics'&&<SettingsGroup title="本机日志">{switchRow('记录详细开发日志','developerLogging','日志保存在本机；导出或上传是独立操作。')}<SettingRow label="日志级别"><select aria-label="日志级别" value={p.logLevel} disabled={view.busy} onChange={e=>save('logLevel',e.target.value)}>{[['error','错误'],['warn','警告'],['info','信息'],['debug','调试']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></SettingRow></SettingsGroup>}
  {page==='storage'&&<SettingsGroup title="客户端数据"><SettingRow label="数据目录" hint={state.home}><Button variant="outline" onClick={()=>run({type:'open-home'})}>打开目录</Button></SettingRow><SettingRow label="更换数据目录" hint="由客户端选择目录并说明重启要求，不自动迁移工作区或知识库资料。"><Button variant="outline" disabled={view.busy} onClick={()=>run({type:'change-data-directory'})}>选择目录</Button></SettingRow><SettingRow label="备份客户端数据" hint="备份范围沿原生客户端；各业务插件的资料由对应插件管理。"><Button variant="outline" disabled={view.busy} onClick={()=>run({type:'backup-data-directory'})}>创建备份</Button></SettingRow></SettingsGroup>}
  {page==='environment'&&<SettingsGroup title="独立运行环境">
   <p className="bx-settings__hint">每个环境有各自的插件和配置。</p>
   {state.profiles.map((name:string)=>{
    const current=name===state.selected
    const unavailable=state.unavailableProfiles.includes(name)
    const busy=view.busy||state.busy
    const hint=current&&name!=='desktop'?'切换到其他环境后可移除':unavailable?'此环境不支持桌面运行':undefined
    return <SettingRow key={name} label={name} hint={hint}>
     {current?<SettingsStatus tone="success">当前环境</SettingsStatus>:<div className="bx-settings__actions">
      <Button variant="outline" size="sm" disabled={busy||unavailable} onClick={()=>run({type:'switch',name})}>切换</Button>
      {name!=='desktop'&&<Button variant="outline" size="sm" aria-label={'移除环境 '+name} disabled={busy} onClick={()=>run({type:'delete',name})}>移除</Button>}
     </div>}
    </SettingRow>
   })}
   <div className="bx-settings__actions"><Button variant="outline" disabled={view.busy||state.busy} onClick={()=>run({type:'controls',page:'create-profile'})}>新建环境</Button></div>
  </SettingsGroup>}
  {page==='diagnostics'&&<SettingsGroup title="运行检查"><SettingRow label="运行状态"><SettingsStatus tone={state.phase==='ready'?'success':'neutral'}>{state.phase==='ready'?'运行正常':state.phase}</SettingsStatus></SettingRow><SettingRow label="诊断信息" hint="导出前由客户端处理诊断内容。"><Button variant="outline" onClick={()=>run({type:'diagnostics'})}>导出诊断</Button></SettingRow><SettingRow label="运行日志"><Button variant="outline" onClick={()=>run({type:'open-logs'})}>打开日志</Button></SettingRow><SettingRow label="配置恢复" hint="查看配置检查点、修复和回退选项；恢复不等于恢复全部业务资料。"><Button variant="outline" onClick={()=>run({type:'controls',page:'recovery'})}>打开恢复助手</Button></SettingRow><SettingRow label="安全模式" hint="使用原生临时环境排查问题，操作会重启客户端。"><Button variant="outline" disabled={view.busy} onClick={()=>run({type:state.safeMode?'normal-mode':'safe-mode'})}>{state.safeMode?'退出安全模式并重启':'进入安全模式'}</Button></SettingRow></SettingsGroup>}
  {page==='permissions'&&<SettingRow label="桌面设备权限" hint="屏幕、辅助控制等权限由客户端和系统管理。"><Button variant="outline" onClick={()=>run({type:'controls',page:'permissions'})}>管理设备权限</Button></SettingRow>}
  {page==='about'&&<SettingsGroup title="版本与更新"><SettingRow label="DSH Next" hint={state.version}><Button variant="outline" disabled={view.busy} onClick={()=>run({type:'check-updates'})}>检查客户端更新</Button></SettingRow><SettingRow label="DSH Web GUI UI" hint="0.1.1 · 开发候选"><SettingsStatus>默认主题</SettingsStatus></SettingRow></SettingsGroup>}
 </>
}
