/** Read-only D1 snapshot layer, disabled until a verified migration is ready. */
export interface TrailStoreEnv {
 TRAILS_DB?: D1Database;
 TRAIL_READ_SOURCE?: string;
}
export async function d1Snapshot(request:Request,env:TrailStoreEnv):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname!=="/api/catalog"&&!url.pathname.startsWith("/api/trails/"))return null;
 if(!["GET","HEAD"].includes(request.method))return null;
 if(env.TRAIL_READ_SOURCE!=="d1"||!env.TRAILS_DB)return null;
 const id=url.pathname.slice("/api/trails/".length);
 if(url.pathname!=="/api/catalog"&&!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))return null;
 try {
  const record=await env.TRAILS_DB.prepare("SELECT body FROM public_snapshots WHERE path = ?1").bind(url.pathname).first<{body:string}>();
  if(!record)return null;
  JSON.parse(record.body);
  return new Response(request.method==="HEAD"?null:record.body,{headers:{"Content-Type":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff","Cache-Control":"public, max-age=300","X-Trail-Read-Source":"d1"}});
 }catch{
  // Free-tier exhaustion and migration failures must not break the public catalog.
  return null;
 }
}
