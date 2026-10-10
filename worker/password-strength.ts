/** One local policy shared by setup UI and server. Never return matcher tokens. */
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as english from '@zxcvbn-ts/language-en';
const estimator = new ZxcvbnFactory({
 dictionary:{...common.dictionary,...english.dictionary},
 graphs:common.adjacencyGraphs,
 translations:english.translations,
});
const blocked = new Set(common.dictionary['passwords-common'].map(v=>v.toLowerCase()));
export function passwordStrength(value: unknown, context: string[] = []):{ok:boolean;score:number;feedback:string} {
 if(typeof value!=='string'||[...value].length<15||new TextEncoder().encode(value).length>256)
  return {ok:false,score:0,feedback:'Use at least 15 characters, no more than 256 UTF-8 bytes. A password manager or several unrelated words works well.'};
 const inputs=['israel','hikes','israel-hikes','IsraelHikes','טיולים',...context];
 const letters=(v:string)=>v.toLowerCase().replace(/[^\p{L}]/gu,'');
 if(blocked.has(value.toLowerCase())||inputs.some(v=>letters(v).length>=5&&letters(v)===letters(value)))
  return {ok:false,score:0,feedback:'This password is commonly used or easy to guess. Choose a different password.'};
 const result=estimator.check(value,inputs);
 return {ok:result.score>=3,score:result.score,feedback:result.score>=3?'Strong enough. Do not reuse it on another site.': 'This password is too predictable. Use more unrelated words or a password manager-generated password.'};
}
