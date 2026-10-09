// Read-only deployment diagnostics. Never log credentials, response bodies or binding values.
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(a||'')||!t)throw Error('Missing deployment credentials');
for(const n of ['israel-hikes','israel-hikes-preview']){
 const paths=[`workers/services/${n}/environments/production/bindings`,`workers/services/${n}/environments/production/routes?show_zonename=true`,`workers/domains/records?page=0&per_page=5&service=${n}&environment=production`,`workers/services/${n}/environments/production/subdomain`,`workers/services/${n}/environments/production`,`workers/scripts/${n}/schedules`];
 for(const p of paths){try{const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${a}/${p}`,{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(10000)});const j=await r.json();console.log(JSON.stringify({worker:n,path:p,http:r.status,success:j.success,codes:j.errors?.map(e=>e.code)}));}catch{console.log(JSON.stringify({worker:n,path:p,networkError:true}))}}
}
