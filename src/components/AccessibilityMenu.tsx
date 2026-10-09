import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Accessibility } from "lucide-react";
import { language } from "../i18n";
const initial={large:false,contrast:false,motion:false,links:false};
export default function AccessibilityMenu(){
 const toggle=useRef<HTMLButtonElement>(null);
 const close=()=>{O(false);toggle.current?.focus()};
 const [open,O]=useState(false),[settings,S]=useState(()=>{try{return {...initial,...JSON.parse(localStorage.getItem('shvil-accessibility')||'{}')}}catch{return initial}});const he=language()==='he';
 useEffect(()=>{document.documentElement.classList.toggle('large-text',settings.large);document.documentElement.classList.toggle('high-contrast',settings.contrast);document.documentElement.classList.toggle('reduce-motion',settings.motion);document.documentElement.classList.toggle('underline-links',settings.links);try{localStorage.setItem('shvil-accessibility',JSON.stringify(settings))}catch{}},[settings]);
 return <div className="accessibility-widget">
 <button ref={toggle} className="accessibility-toggle" aria-expanded={open} aria-controls="accessibility-panel" onClick={()=>O(!open)}><Accessibility size={23}/><span>{he?'נגישות':'Accessibility'}</span></button>
 {open&&<section id="accessibility-panel" className="accessibility-panel" onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();close()}}} aria-label={he?'אפשרויות נגישות':'Accessibility options'}>
 <h2>{he?'אפשרויות נגישות':'Accessibility options'}</h2>
 {([['large',he?'טקסט מוגדל':'Larger text'],['contrast',he?'ניגודיות גבוהה':'High contrast'],['motion',he?'צמצום תנועה':'Reduce motion'],['links',he?'הדגשת קישורים':'Underline links']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={settings[key]} onChange={e=>S({...settings,[key]:e.target.checked})}/>{label}</label>)}
 <button className="button" onClick={()=>S(initial)}>{he?'איפוס':'Reset'}</button>
 <Link to="/accessibility" onClick={()=>O(false)}>{he?'הצהרת נגישות':'Accessibility statement'}</Link>
 <button className="button" onClick={close}>{he?'סגירה':'Close'}</button>
 </section>}
 </div>
}
