// Prove the selected Worker serves this exact build, not its blank bootstrap.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
export async function checkDeployment(origin,{fetcher=fetch,readFile=fs.readFile,readdir=fs.readdir,sleep=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}={}){
 assert.ok(origin === 'https://israel-hikes-preview.amikamsnir.workers.dev/' || origin === 'https://israel-hikes.amikamsnir.workers.dev/', 'Only hiking Workers may be checked');
 async function check(name){
  const response=await fetcher(new URL(name,origin),{signal:AbortSignal.timeout(15000),cache:'no-store'});
  assert.equal(response.status,200,`HTTP status: ${name}`);
  const actual=Buffer.from(await response.arrayBuffer());
  const expected=await readFile(path.join('dist',name));
  assert.ok(actual.equals(expected),`Deployed bytes differ: ${name}`);
 }
 const names=['index.html',...(await readdir('dist/assets')).map(name=>`assets/${name}`)];
 // Retry exact-byte checks during propagation, never approve stale assets.
 for(let attempt=0;attempt<7;attempt++){
  try{for(const name of names)await check(name);break;}
  catch(error){if(attempt===6)throw error;log(`Waiting for deployment propagation (${attempt+1}/7): ${error.message}`);await sleep(10000);}
 }
 log('Live Worker serves the exact built index and assets');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await checkDeployment(process.argv[2]);
