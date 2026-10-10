// Generate read-only public snapshots from the same normalized catalog as the UI.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
function publicText(value){return value.replace('(הדף נבדק 9.10.2026, לא ברור אם נפתח מחדש)','(לא ברור אם נפתח מחדש)').replace(' (הדף נבדק 9.10.2026)','');}
function cleanPublicText(value){
 if(typeof value==='string')return publicText(value);
 if(Array.isArray(value))return value.map(cleanPublicText);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cleanPublicText(item)]));
 return value;
}
const origin='https://israel-hikes.amikamsnir.workers.dev';
export function publicTrail(trail){
 const value={...trail};delete value.provenance;
 value.category=trail.category==='segment'?'segment':'walking';
 if(value.access){value.access={...value.access};delete value.access.ramatGan;delete value.access.jerusalem;}
 const detail={...value.detail};
 if(detail.src==='friend'||detail.src==='public')delete detail.src;
 delete detail.drive;delete detail.driveMin;delete detail.driveTo;
 value.detail=detail;
 return cleanPublicText(value);
}
export async function generateReadData(out='dist'){
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'hikes-read-'));
 try{
  const modulePath=path.join(temporary,'catalog.mjs');
  await build({entryPoints:['src/lib/catalog.ts'],outfile:modulePath,bundle:true,platform:'node',format:'esm'});
  const {catalog,coordinates,longTrails}=await import(pathToFileURL(modulePath).href);
  const metadata={schemaVersion:1,safetyNotice:'Trail leads, not a live safety service. Recheck closures, access, water and weather before every outing. Unknown values are not guarantees. Coordinates are start points, not route tracks or parking guarantees.',licensingNotice:'Code is MIT. Third-party trail facts, sources, maps and photos retain their own licences. See /about and the repository DATA_SOURCES.md; this endpoint does not grant new reuse rights.'};
  await fs.mkdir(path.join(out,'data/trails'),{recursive:true});
  const write=(file,value)=>fs.writeFile(path.join(out,file),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
  await write('data/catalog.json',{...metadata,trails:catalog.map(publicTrail).map(t=>({id:t.id,name:t.name,category:t.category,region:t.region,km:t.km,level:t.level,summary:t.summary,notes:t.notes,refs:t.refs,pageUrl:`/trail/${t.id}`,jsonUrl:`/api/trails/${t.id}`}))});
  for(const trail of catalog)await write(`data/trails/${trail.id}.json`,{...metadata,id:trail.id,pageUrl:`/trail/${trail.id}`,coordinates:coordinates(trail),trail:publicTrail(trail)});
  const pages=['/','/about','/accessibility','/contact','/long',...longTrails.map(t=>`/long/${t.id}`),...catalog.map(t=>`/trail/${t.id}`)];
  await write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(p=>`  <url><loc>${origin}${p}</loc></url>`).join('\n')+'\n</urlset>\n');
  await write('llms.txt',`# Shvil | Israel Hikes\n\nPublic trail planning leads in Israel. Read-only structured data; no MCP or account needed.\n\n- [Catalog](${origin}/api/catalog): all trail IDs, summaries, cautions and source links.\n- Per-trail JSON: ${origin}/api/trails/{id}, using a catalog ID. Includes route facts, cautions and public source links. Categories are walking routes or trail sections. Internal review metadata and fixed-origin driving estimates are omitted.\n- [Sitemap](${origin}/sitemap.xml): public pages, including long-trail hubs.\n- [Sources, privacy and licensing](${origin}/about)\n\n${metadata.safetyNotice}\n\n${metadata.licensingNotice}\n\nHebrew source facts are preserved without guessing translations. Lengths are walking kilometres. Unknown starts are null; no personal origins, saved trails or contact submissions are included. These routes accept GET and HEAD only.\n`);
 }finally{await fs.rm(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await generateReadData();
