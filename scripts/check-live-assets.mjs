// Prove the selected Worker serves this exact build, not its blank bootstrap.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const origin=process.argv[2];
assert.ok(origin === 'https://israel-hikes-preview.amikamsnir.workers.dev/' || origin === 'https://israel-hikes.amikamsnir.workers.dev/', 'Only hiking Workers may be checked');
async function check(name){
 const response=await fetch(new URL(name,origin),{signal:AbortSignal.timeout(15000),cache:'no-store'});
 assert.equal(response.status,200,`HTTP status: ${name}`);
 const actual=Buffer.from(await response.arrayBuffer());
 const expected=await fs.readFile(path.join('dist',name));
 assert.ok(actual.equals(expected),`Deployed bytes differ: ${name}`);
}
const names=['index.html',...(await fs.readdir('dist/assets')).map(name=>`assets/${name}`)];
// Cloudflare can briefly serve the preceding version after deploy acknowledges.
// Retry the whole exact-byte check, never weaken it or approve a stale build.
for(let attempt=0;attempt<7;attempt++){
 try{for(const name of names)await check(name);break;}
 catch(error){if(attempt===6)throw error;console.log(`Waiting for deployment propagation (${attempt+1}/7): ${error.message}`);await new Promise(resolve=>setTimeout(resolve,10000));}
}
console.log('Live Worker serves the exact built index and assets');
