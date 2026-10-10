// Generate a deterministic D1 import from checked source and exact public snapshots.
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';
export function sqlText(value){if(typeof value!=='string'||value.includes('\0'))throw Error('Invalid SQL text');return "'"+value.replaceAll("'","''")+"'";}
export async function generateSeed(root='dist'){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'hikes-d1-'));
 try{const module=path.join(temp,'catalog.mjs');await build({entryPoints:['src/lib/catalog.ts'],outfile:module,bundle:true,platform:'node',format:'esm'});const {catalog,longTrails}=await import(pathToFileURL(module).href);const photos=JSON.parse(await fs.readFile('src/data/trail-photos.json','utf8'));const sql=['BEGIN TRANSACTION;'];
 for(const trail of catalog){const body=await fs.readFile(path.join(root,'data/trails',trail.id+'.json'),'utf8');sql.push(`INSERT INTO trails(id,kind,document,public_document) VALUES(${sqlText(trail.id)},${sqlText(trail.category==='segment'?'segment':'walking')},${sqlText(JSON.stringify(JSON.parse(body).trail))},${sqlText(body)});`);sql.push(`INSERT INTO public_snapshots(path,body) VALUES(${sqlText('/api/trails/'+trail.id)},${sqlText(body)});`);for(const [i,photo] of (photos[trail.id]?.gallery||[]).entries())sql.push(`INSERT INTO photos(id,trail_id,position,document) VALUES(${sqlText(trail.id+':'+i)},${sqlText(trail.id)},${i},${sqlText(JSON.stringify(photo))});`);}
 for(const trail of longTrails)sql.push(`INSERT INTO long_trails(id,document) VALUES(${sqlText(trail.id)},${sqlText(JSON.stringify(trail))});`);
 sql.push(`INSERT INTO public_snapshots(path,body) VALUES('/api/catalog',${sqlText(await fs.readFile(path.join(root,'data/catalog.json'),'utf8'))});`,'COMMIT;');return sql.join('\n')+'\n';
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const file=process.argv[2];if(!file)throw Error('Provide output SQL path');await fs.writeFile(file,await generateSeed());}
