// One-time dashboard bootstrap: retain the two-Worker token and owner environment gate.
import {appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function selectWrangler(metadata){
 const source=metadata?.default_environment?.script?.last_deployed_from;
 if(!['dash','wrangler','api'].includes(source))throw Error('Unrecognized Worker deployment origin; stop for inspection');
 return source==='dash'?'4.30.0':'4.149.0';
}
export async function productionVersion({accountId,token,fetcher=fetch}={}){
 if(!/^[a-f0-9]{32}$/i.test(accountId||'')||!token)throw Error('Missing deployment credentials');
 const r=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/services/israel-hikes`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Cannot verify production Worker metadata; no upload attempted');
 const j=await r.json();if(j.success!==true)throw Error('Production metadata read unsuccessful');
 return selectWrangler(j.result);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const version=await productionVersion({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN});
 if(!process.env.GITHUB_OUTPUT)throw Error('Missing CI output destination');
 await appendFile(process.env.GITHUB_OUTPUT,`version=${version}\n`);
 console.log(`Selected Wrangler ${version} for the owner-approved hiking production job. No permission changes.`);
}
