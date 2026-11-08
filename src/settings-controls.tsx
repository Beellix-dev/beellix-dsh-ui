/** Shared settings presentation. Callers keep state, validation and persistence. */
import React,{useEffect,useId,useState,type ReactNode} from 'react'
import {Button,Input,Switch} from '@deepseek-ai/dsh-client-ui-primitives'

export function SettingsGroup({title,children}:{title:string;children:ReactNode}){
 const id=useId()
 return <section className="bx-settings__group" aria-labelledby={id}><h3 id={id}>{title}</h3>{children}</section>
}
export function SettingRow({label,hint,children}:{label:string;hint?:string;children:ReactNode}){
 return <div className="bx-settings__row"><div className="bx-settings__copy"><div className="bx-settings__label">{label}</div>{hint&&<p className="bx-settings__hint">{hint}</p>}</div><div className="bx-settings__control">{children}</div></div>
}
export function SettingSwitch({label,hint,checked,onChange,disabled=false}:{label:string;hint?:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){
 return <SettingRow label={label} hint={hint}><Switch label={label} checked={checked} disabled={disabled} onChange={onChange}/></SettingRow>
}
export function SettingChoice({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;disabled?:boolean}){
 return <div className="bx-settings__choice" role="group" aria-label={label}>{options.map(option=><button key={option.value} type="button" disabled={disabled} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>
}
export function SettingField({label,value,onChange,hint,error,type='text',readOnly=false}:{label:string;value:string;onChange?:(value:string)=>void;hint?:string;error?:string;type?:string;readOnly?:boolean}){
 const id=useId(),help=hint||error?id+'-help':undefined
 return <div className="bx-settings__field"><label htmlFor={id}>{label}</label><Input id={id} type={type} value={value} readOnly={readOnly} aria-invalid={error?true:undefined} aria-describedby={help} onChange={event=>onChange?.(event.target.value)}/>{error?<p id={help} className="bx-settings__field-error" role="alert">{error}</p>:hint?<p id={help} className="bx-settings__field-help">{hint}</p>:null}</div>
}
export function SettingsMark({kind='neutral'}:{kind?:string}){
 return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='success'?<path d="m5 12 4 4L19 6"/>:kind==='error'?<><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></>:kind==='progress'?<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>:<><path d="M7 8V5h10v3M5 8h14v11H5z"/><path d="M9 13h6"/></>}</svg>
}
export function SettingsStatus({tone='neutral',children}:{tone?:'neutral'|'success'|'error'|'progress';children:ReactNode}){
 return <span className="bx-settings__status" data-tone={tone}><SettingsMark kind={tone}/>{children}</span>
}
export function SettingsObject({title,description,status,actions}:{title:string;description?:string;status:ReactNode;actions?:ReactNode}){
 return <li className="bx-settings__object"><span className="bx-settings__icon"><SettingsMark/></span><div className="bx-settings__object-copy"><div className="bx-settings__label">{title}</div>{description&&<p className="bx-settings__hint">{description}</p>}</div><div className="bx-settings__object-actions">{status}{actions}</div></li>
}
export function SettingsFeedback({tone='error',message,detail,action,onAction}:{tone?:'error'|'success';message:string;detail?:string;action?:string;onAction?:()=>void}){
 return <div className="bx-settings__feedback" data-tone={tone} role={tone==='error'?'alert':'status'}><SettingsMark kind={tone}/><div className="bx-settings__object-copy"><p>{message}</p>{detail&&<p>{detail}</p>}</div>{action&&onAction&&<Button variant="outline" size="sm" onClick={onAction}>{action}</Button>}</div>
}

export function NumberControl({label,value,onChange,min,max,step=1,unit='',disabled=false}:{label:string;value:number|string;onChange:(value:number|'')=>void;min?:number;max?:number;step?:number;unit?:string;disabled?:boolean}){
 const move=(direction:number)=>onChange(Math.max(min??-Infinity,Math.min(max??Infinity,Number((Number(value||min||0)+step*direction).toFixed(6)))))
 return <div className="bx-control-number" role="group" aria-label={label+'调整'}><button type="button" aria-label={'减小'+label} disabled={disabled||min!==undefined&&value!==''&&Number(value)<=min} onClick={()=>move(-1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg></button><input type="number" aria-label={label} min={min} max={max} step={step} disabled={disabled} value={value??''} onChange={event=>onChange(event.target.value===''?'':Number(event.target.value))}/>{unit&&<span className="bx-control-unit">{unit}</span>}<button type="button" aria-label={'增大'+label} disabled={disabled||max!==undefined&&value!==''&&Number(value)>=max} onClick={()=>move(1)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"/></svg></button></div>
}

export function RangeControl({label,value,onChange,min=0,max=100,step=1,unit='%',disabled=false}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;step?:number;unit?:string;disabled?:boolean}){
 const [draft,setDraft]=useState(String(value));useEffect(()=>setDraft(String(value)),[value])
 return <div className="bx-control-range"><input type="range" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={event=>onChange(Number(event.target.value))}/><span><input type="number" aria-label={label+'数值'} min={min} max={max} step={step} value={draft} disabled={disabled} onBlur={event=>{if(draft===''||!event.currentTarget.validity.valid)setDraft(String(value))}} onChange={event=>{setDraft(event.target.value);if(event.target.value!==''&&event.currentTarget.validity.valid)onChange(Number(event.target.value))}}/>{unit&&<span className="bx-control-unit">{unit}</span>}</span></div>
}

const fontChoices=[['','系统默认'],['Microsoft YaHei','微软雅黑'],['DengXian','等线'],['SimSun','宋体'],['Noto Sans SC','思源黑体'],['Consolas','Consolas'],['Cascadia Code','Cascadia Code'],['monospace','系统等宽']]
export function FontControl({label,value='',onChange,disabled=false}:{label:string;value?:string;onChange:(value:string)=>void;disabled?:boolean}){
 const known=fontChoices.some(([id])=>id===value),[custom,setCustom]=useState(!known)
 useEffect(()=>setCustom(!fontChoices.some(([id])=>id===value)),[value])
 return <div className="bx-control-font"><select aria-label={label} value={custom?'custom':value} style={{fontFamily:value||undefined}} disabled={disabled} onChange={event=>{if(event.target.value==='custom'){setCustom(true);return}setCustom(false);onChange(event.target.value)}}>{fontChoices.map(([id,name])=><option key={id} value={id}>{name}</option>)}<option value="custom">自定义…</option></select>{custom&&<input aria-label={label+'名称'} value={value} maxLength={200} placeholder="输入已安装的字体名称" disabled={disabled} onChange={event=>onChange(event.target.value)}/>}</div>
}
