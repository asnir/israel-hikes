export interface ContactEnv {CONTACT_ENABLED?:string; TURNSTILE_SITE_KEY?:string; TURNSTILE_SECRET_KEY?:string; CONTACT_ADMIN_SECRET?:string;CONTACT_HOSTNAME?:string}
export interface Storage {get<T>(key:string):Promise<T|undefined>;put(key:string,value:unknown):Promise<unknown>;delete(key:string|string[]):Promise<unknown>;list<T>():Promise<Map<string,T>>;getAlarm():Promise<number|null>;setAlarm(time:number):Promise<unknown>}
export type Submission={kind:'new-trail'|'correction'|'general';title:string;message:string;source:string;trailId:string;name:string;email:string;language:'he'|'en';requestId:string;token:string;consent:true;website:string};
export function validateSubmission(v:any):Submission|null {
 if(!v||!['new-trail','correction','general'].includes(v.kind)||!['he','en'].includes(v.language)||v.consent!==true||typeof v.website!=='string'||v.website)return null;
 for(const [key,min,max]of [['title',5,100],['message',20,3000],['source',0,500],['trailId',0,80],['name',0,80],['email',0,254],['token',1,2048],['requestId',36,36]] as const)if(typeof v[key]!=='string'||v[key].trim().length<min||v[key].length>max)return null;
 if(!/^[a-f0-9-]{36}$/i.test(v.requestId))return null;
 if(v.source){try{const u=new URL(v.source);if(u.protocol!=='https:'||u.username||u.password)return null}catch{return null}}
 if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return null;
 const allowed=['name','email','kind','title','message','source','trailId','language','requestId','token','consent','website'];if(Object.keys(v).some(k=>!allowed.includes(k)))return null;return Object.fromEntries(allowed.map(k=>[k,v[k]])) as Submission;
}
export function enabled(e:ContactEnv){return e.CONTACT_ENABLED==='true'&&!!e.TURNSTILE_SITE_KEY&&!!e.TURNSTILE_SECRET_KEY&&(e.CONTACT_ADMIN_SECRET?.length??0)>=32&&!!e.CONTACT_HOSTNAME}
const reply=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export class ContactHandler {
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private storage:Storage,private env:ContactEnv,private upstream:typeof fetch=fetch,private now:()=>number=Date.now){}
 async fetch(request:Request){const before=this.queue;let unlock!:()=>void;this.queue=new Promise(r=>unlock=r);await before;try{return await this.handle(request)}finally{unlock()}}
 private async handle(request:Request){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/contact-inbox'))return this.inbox(request,url);
  if(!enabled(this.env))return reply('unavailable',503);
  if(request.method!=='POST')return reply('method',405);
  if(request.headers.get('Origin')!==url.origin||url.hostname!==this.env.CONTACT_HOSTNAME)return reply('origin',403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply('format',415);
  let raw='';try{const reader=request.body?.getReader();if(!reader)return reply('invalid',400);const chunks:Uint8Array[]=[];let bytes=0;while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>12000){await reader.cancel();return reply('too-large',413)}chunks.push(value)}const joined=new Uint8Array(bytes);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.length}raw=new TextDecoder().decode(joined)}catch{return reply('invalid',400)}
  let s:Submission|null;try{s=validateSubmission(JSON.parse(raw))}catch{return reply('invalid',400)}if(!s)return reply('invalid',400);
  const timestamp=this.now(),day=new Date(timestamp).toISOString().slice(0,10),ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply('unavailable',503);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(this.env.TURNSTILE_SECRET_KEY!),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(day+':'+ip));const hash=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const limitKey='contact-rate:'+day+':'+hash;const receiptKey='contact-receipt:'+s.requestId;const previous=await this.storage.get<any>(receiptKey);
  if(previous){if(previous.hash!==hash)return reply('duplicate',409);return Response.json({receipt:s.requestId},{headers:{'Cache-Control':'no-store'}})}
  const rate=await this.storage.get<any>(limitKey)||{count:0,last:0};const globalKey='contact-global:'+day;const global=await this.storage.get<any>(globalKey)||{count:0};
  if(rate.count>=3||timestamp-rate.last<60000||global.count>=25)return reply('rate-limit',429);
  // Bound all attempts, including invalid CAPTCHA. Never store raw IP or CAPTCHA tokens.
  await this.storage.put(limitKey,{count:rate.count+1,last:timestamp,expires:timestamp+2*86400000});await this.storage.put(globalKey,{count:global.count+1,expires:timestamp+2*86400000});if(!await this.storage.getAlarm())await this.storage.setAlarm(timestamp+86400000);
  let check:any;try{const res=await this.upstream('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:this.env.TURNSTILE_SECRET_KEY!,response:s.token}),signal:AbortSignal.timeout(10000)});check=await res.json();if(!res.ok)throw Error()}catch{return reply('verification-unavailable',503)}
  if(check.success!==true||check.hostname!==this.env.CONTACT_HOSTNAME||check.action!=='contact')return reply('verification-failed',400);
  const rows=await this.storage.list<any>();const active=[...rows].filter(([k,v])=>k.startsWith('contact-submission:')&&v.expires>timestamp);if(active.length>=750)return reply('inbox-full',503);
  // Store only allowlisted text. CAPTCHA token, honeypot and IP never enter the inbox.
  const {token,website,consent,...content}=s;
  await this.storage.put('contact-submission:'+s.requestId,{...content,receivedAt:timestamp,reviewed:false,expires:timestamp+30*86400000});
  await this.storage.put(receiptKey,{hash,expires:timestamp+2*86400000});
  return Response.json({receipt:s.requestId},{status:201,headers:{'Cache-Control':'no-store'}});

 }
 private async inbox(request:Request,url:URL){
  const secret=this.env.CONTACT_ADMIN_SECRET,provided=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!secret||!provided||secret.length<32)return reply('not-found',404);
  // Compare fixed-size SHA-256 digests without early-exit string equality.
  const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([digest(secret),digest(provided)]);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];if(mismatch)return reply('not-found',404);
  if(url.hostname!==this.env.CONTACT_HOSTNAME)return reply('not-found',404);
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
  const rows=await this.storage.list<any>();const submissions=[...rows].filter(([k,v])=>k.startsWith('contact-submission:')&&v.expires>this.now()).map(([,v])=>v).sort((a,b)=>b.receivedAt-a.receivedAt);
  if(request.method==='GET'&&url.pathname==='/api/contact-inbox/summary')return Response.json({pending:submissions.filter(v=>!v.reviewed).length,total:submissions.length}, {headers});
  if(request.method==='GET'&&url.pathname==='/api/contact-inbox')return Response.json({submissions},{headers});
  if(request.method==='POST'&&url.pathname==='/api/contact-inbox/reviewed'){
   if(request.headers.get('Origin')!==url.origin)return reply('origin',403);if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply('format',415);
   const text=await request.text();if(text.length>200)return reply('too-large',413);let id;try{id=JSON.parse(text).requestId}catch{return reply('invalid',400)}if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))return reply('invalid',400);
   const key='contact-submission:'+id,entry=await this.storage.get<any>(key);if(!entry)return reply('not-found',404);await this.storage.put(key,{...entry,reviewed:true});return Response.json({reviewed:true},{headers});
  }
  return reply('method',405);
 }
 async alarm(){const rows=await this.storage.list<any>();const stale=[...rows].filter(([,v])=>v.expires<this.now()).map(([k])=>k);if(stale.length)await this.storage.delete(stale);if(rows.size>stale.length)await this.storage.setAlarm(this.now()+86400000)}
}
