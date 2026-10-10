import {passwordStrength} from './password-strength';
declare const document:{getElementById(id:string):{value:string;textContent:string;addEventListener(event:string,callback:()=>void):void;setCustomValidity(message:string):void}|null};
/** Bundled to a same-origin module. No network calls, logs, or matcher tokens. */
export function attachStrength(){
 const pw=document.getElementById('new-password');
 const feedback=document.getElementById('strength');
 if(!pw||!feedback)return;
 pw.addEventListener('input',()=>{
  const result=passwordStrength(pw.value);
  feedback.textContent=result.feedback;
  pw.setCustomValidity(result.ok?'':result.feedback);
 });
}
