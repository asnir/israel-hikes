// One-time dashboard bootstrap: retain the two-Worker token and owner environment gate.
import {appendFile,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const DEFAULT_WORKER='israel-hikes';
const ALLOWED_WORKERS=new Set(['israel-hikes','israel-hikes-preview']);
export function selectWrangler(metadata){
 const source=metadata?.default_environment?.script?.last_deployed_from;
 if(!['dash','wrangler','api'].includes(source))throw Error('Unrecognized Worker deployment origin; stop for inspection');
 return '4.30.0';
}
export async function productionVersion({accountId,token,fetcher=fetch,worker=DEFAULT_WORKER}={}){
 if(!/^[a-f0-9]{32}$/i.test(accountId||'')||!token)throw Error('Missing deployment credentials');
 if(!ALLOWED_WORKERS.has(worker))throw Error('Unrecognized Worker name; stop for inspection');
 const r=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/services/${worker}`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Cannot verify Worker metadata; no upload attempted');
 const j=await r.json();if(j.success!==true)throw Error('Worker metadata read unsuccessful');
 return selectWrangler(j.result);
}
export function patchScopedSubdomain(source){
 const marker='async function getWorkersDevSubdomain(complianceConfig, accountId, configPath) {';
 if(source.split(marker).length!==2)throw Error('Unexpected uploader source; stop');
 // Only URL reporting uses this account-level lookup. Worker-scoped trigger updates remain unchanged.
 return source.replace(marker, marker+"\n  return \"amikamsnir.workers.dev\";");
}
if(process.argv.includes('--patch-scoped-subdomain')){
 const pkg=JSON.parse(await readFile('node_modules/wrangler/package.json','utf8'));
 if(pkg.version!=='4.30.0')throw Error('Unexpected uploader version; stop');
 const file='node_modules/wrangler/wrangler-dist/cli.js';
 await writeFile(file,patchScopedSubdomain(await readFile(file,'utf8')));
 console.log('Applied scoped-token URL reporting compatibility patch; upload and Worker trigger failures remain fatal.');
}else if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const worker=process.argv[2]||DEFAULT_WORKER;
 const version=await productionVersion({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN,worker});
 if(!process.env.GITHUB_OUTPUT)throw Error('Missing CI output destination');
 await appendFile(process.env.GITHUB_OUTPUT,`version=${version}\n`);
 console.log(`Selected Wrangler ${version} for ${worker}. No permission changes.`);
}
