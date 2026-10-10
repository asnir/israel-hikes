/** Fail-closed Access-token validation. No admin routes are enabled here. */
export interface AdminAuthEnv {
 ADMIN_TEAM_DOMAIN?: string;
 ADMIN_POLICY_AUD?: string;
}
type AccessClaims = {iss?:string;aud?:string|string[];exp?:number;nbf?:number;iat?:number;email?:string;sub?:string;type?:string};
type SigningKey = JsonWebKey & {kid?:string};
const cache=new Map<string,{expires:number;keys:SigningKey[]}>();
function decode(segment:string):Uint8Array{
 if(!/^[A-Za-z0-9_-]+$/.test(segment)||segment.length>16000)throw Error('Invalid token');
 return Uint8Array.from(atob(segment.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
}
function json(segment:string){return JSON.parse(new TextDecoder().decode(decode(segment)));}
export async function verifiedAdminIdentity(request:Request,env:AdminAuthEnv,options:{fetcher?:typeof fetch;now?:number}={}):Promise<{email:string;subject:string}|null>{
 try{
  const team=env.ADMIN_TEAM_DOMAIN,aud=env.ADMIN_POLICY_AUD;
  if(!team||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)||!aud||aud.length>256)return null;
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token||token.length>24000)return null;
  const parts=token.split('.');if(parts.length!==3)return null;
  const header=json(parts[0]) as {alg?:string;kid?:string};
  if(header.alg!=='RS256'||!header.kid||header.kid.length>256)return null;
  const claims=json(parts[1]) as AccessClaims,now=options.now??Date.now();
  const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==team||!audiences.includes(aud)||typeof claims.exp!=='number'||!Number.isFinite(claims.exp)||claims.exp<=now/1000||
   (claims.nbf!==undefined&&(typeof claims.nbf!=='number'||claims.nbf>now/1000))||
   (claims.iat!==undefined&&(typeof claims.iat!=='number'||claims.iat>now/1000+30))||
   claims.type!=='app'||typeof claims.email!=='string'||claims.email.length>254||!claims.email.includes('@')||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>256)return null;
  let entry=cache.get(team);
  if(!entry||entry.expires<=now){
   const response=await (options.fetcher??fetch)(team+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(5000),redirect:'error'});
   if(!response.ok)return null;
   const body=await response.text();if(body.length>100000)return null;
   const keys=JSON.parse(body).keys;if(!Array.isArray(keys)||keys.length>20)return null;
   entry={expires:now+300000,keys};cache.set(team,entry);
  }
  const jwk=entry.keys.find(key=>key.kid===header.kid&&key.kty==='RSA'&&(!key.alg||key.alg==='RS256')&&(!key.use||key.use==='sig'));
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  return valid?{email:claims.email.trim().toLowerCase(),subject:claims.sub}:null;
 }catch{return null;}
}
/** Authentication alone never grants a role: an active database membership is required. */
export async function activeAdmin(identity:{email:string;subject:string}|null,db?:D1Database):Promise<{id:string;role:'owner'|'editor'}|null>{
 if(!identity||!db)return null;
 try{return await db.prepare("SELECT id, role FROM admin_members WHERE email = ?1 COLLATE NOCASE AND status = 'active'").bind(identity.email).first<{id:string;role:'owner'|'editor'}>();}catch{return null;}
}
