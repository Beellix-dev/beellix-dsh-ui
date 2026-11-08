/** Test-only substitutes for native DSH controls. Never included in a candidate. */
import React,{useEffect} from 'react'
export function Button({variant,size,children,...props}:any){return <button className={'preview-button '+(variant??'primary')} {...props}>{children}</button>}
export function Input(props:any){return <input {...props}/>}
export function Switch({label,checked,onChange,disabled}:any){return <button className="preview-switch" type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={()=>onChange(!checked)}><span/></button>}
export function useModalLayer(ref:any,open:boolean,onClose:()=>void){useEffect(()=>{if(!open)return;const callback=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};document.addEventListener('keydown',callback);return()=>document.removeEventListener('keydown',callback)},[open,onClose])}
export function FishLogo({size=25}:any){return <svg width={size} height={size} aria-hidden="true"><circle cx={size/2} cy={size/2} r={size/3} fill="currentColor"/></svg>}
export function Menu({anchor,children,open}:any){return <div>{anchor}{open&&<div role="menu">{children}</div>}</div>}
