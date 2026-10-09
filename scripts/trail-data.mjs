import fs from 'node:fs';
export const dataDir='src/data';
export const groups={verified:'recommendations',extended:'extended',segment:'segments'};
export const idFor=(category,t)=>category==='extended'?'ext-'+t.n:category==='segment'?'seg-'+t.id:t.id;
const text=(v)=>typeof v==='string';
export function validateEntry(category,t){
 const need=(ok,msg)=>{if(!ok)throw new Error(msg)};
 need(t&&typeof t==='object'&&!Array.isArray(t),'Trail must be an object');need(text(t.name)&&t.name.trim(),'name is required');need(t.km===null||(typeof t.km==='number'&&Number.isFinite(t.km)&&t.km>0),'km must be positive or null');
 const strings=category==='verified'?['id','area','level','theme','climb','drive','duration','intro','shade','water','season','entry','hours','registration','start','caution','weather']:category==='extended'?['src','region','kind','grp','level','seasonNote','water','waterNote','shade','infoSource','infoUrl','effort']:['id','trail','n','from_','to','level','note','url','src','kind','region'];
 for(const field of strings)need(text(t[field]),`${field} must be a string`);if(category!=='extended')need(/^[a-z0-9][a-z0-9-]*$/.test(t.id),'id must be a stable lowercase slug');
 if(category==='extended'){need(Number.isInteger(t.n)&&t.n>0,'n must be a positive integer');need(['friend','web'].includes(t.src),'src must be friend or web');for(const k of ['notes','seasons','landscape'])need(Array.isArray(t[k])&&t[k].every(text),`${k} must be a string array`);if(t.src==='friend')need(t.infoUrl==='','Private source URLs are forbidden')}
 if(category==='verified')need(Array.isArray(t.steps)&&t.steps.every(text),'steps must be a string array');
 const refs=category==='verified'?t.refs:category==='extended'?t.links:[[t.src,t.url]];
 need(Array.isArray(refs)&&refs.length>0,'At least one public source is required');for(const ref of refs)need(Array.isArray(ref)&&ref.length===2&&ref.every(text)&&/^https:\/\//.test(ref[1]),'Source must be [label, https URL]');
 const forbidden=/docs\.google\.com\/document|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+972|(?<![\d.])05\d{8}(?!\d)/i;need(!forbidden.test(JSON.stringify(t)),'Private information candidate');for(const ref of refs){const u=new URL(ref[1]);need(!u.username&&!u.password,'Credentials in source URL are forbidden')} 
}
export function readData(root=dataDir){return Object.fromEntries(Object.entries(groups).map(([c,f])=>[c,JSON.parse(fs.readFileSync(`${root}/${f}.json`))]));}
export function validateData(data,longIds){const ids=[];for(const [c,rows]of Object.entries(data)){if(!groups[c])throw Error('Unknown category');for(const t of rows){validateEntry(c,t);ids.push(idFor(c,t));if(c==='segment'&&!longIds.includes(t.trail))throw Error('Unknown long trail')}}if(new Set(ids).size!==ids.length)throw Error('Duplicate route ID');return ids;}
export function applyChange(data,action,category,id,entry){const copy=structuredClone(data);if(!groups[category])throw Error('Unknown category');const rows=copy[category];const index=rows.findIndex(t=>idFor(category,t)===id);if(action==='add'){validateEntry(category,entry);if(index>=0||rows.some(t=>idFor(category,t)===idFor(category,entry)))throw Error('Duplicate route ID');rows.push(entry)}else{if(index<0)throw Error('Unknown route ID');if(action==='delete')rows.splice(index,1);else if(action==='update'){validateEntry(category,entry);if(idFor(category,entry)!==id)throw Error('Route IDs cannot change');rows[index]=entry}else throw Error('Use add, update or delete')}return copy;}
