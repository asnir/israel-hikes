import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'worker-packaging-'));
try {
 for(const config of ['wrangler.preview.jsonc','wrangler.jsonc']){
  const result=spawnSync('node_modules/.bin/wrangler',['deploy','--config',config,'--dry-run','--outdir',path.join(temporary,config)],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||result.stdout);
  const bundle=fs.readFileSync(path.join(temporary,config,'index.js'),'utf8');
  if(/AdminAuth|crypto_pwhash|libsodium|__Host-admin-session|ContactGateway|TURNSTILE_SECRET|CONTACT_ADMIN_SECRET|\/api\/contact/.test(bundle))throw Error('Removed authentication code in bundle');
  console.log(`Worker packaging without admin login or contact collection passed: ${config}`);
 }
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
