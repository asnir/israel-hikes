import {test} from 'node:test';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {generateReadData} from '../scripts/agent-read-data.mjs';import assert from 'node:assert/strict';import {build} from 'esbuild';import {spawnSync} from 'node:child_process';import {generateSeed,sqlText} from '../scripts/d1-seed.mjs';
await build({entryPoints:['worker/trail-store.ts'],outfile:'/tmp/hikes-d1-store.mjs',bundle:true,platform:'node',format:'esm'});const {d1Snapshot}=await import('/tmp/hikes-d1-store.mjs');
const request=(path='/api/catalog',method='GET')=>new Request('https://example.invalid'+path,{method});
test('D1 read source remains off by default and never handles public mutations or unsafe IDs',async()=>{const db={prepare(){throw Error('must not query')}};for(const req of [request(),request('/api/catalog','POST'),request('/api/trails/bad!'),request('/api/unknown')])assert.equal(await d1Snapshot(req,{TRAILS_DB:db}),null);assert.equal(await d1Snapshot(request(),{TRAIL_READ_SOURCE:'d1'}),null);});
test('D1 exact snapshots use a bound indexed key, GET/HEAD and static fallback',async()=>{let bound;const body='{"trails":[]}\n';const db={prepare(sql){assert.equal(sql,'SELECT body FROM public_snapshots WHERE path = ?1');return{bind(path){bound=path;return{first:async()=>({body})}}}}};const env={TRAILS_DB:db,TRAIL_READ_SOURCE:'d1'};const r=await d1Snapshot(request(),env);assert.equal(await r.text(),body);assert.equal(r.headers.get('X-Trail-Read-Source'),'d1');assert.equal(bound,'/api/catalog');assert.equal(r.headers.get('Content-Type'),'application/json; charset=utf-8');const head=await d1Snapshot(request('/api/trails/ofer','HEAD'),env);assert.equal(await head.text(),'');assert.equal(bound,'/api/trails/ofer');for(const value of [null,{body:'not json'}]){db.prepare=()=>({bind:()=>({first:async()=>value})});assert.equal(await d1Snapshot(request(),env),null);}db.prepare=()=>{throw Error('quota')};assert.equal(await d1Snapshot(request(),env),null);});
test('Migration imports every source record and public bytes without any admin grants',async()=>{const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'hikes-d1-test-'));try{await generateReadData(fixture);const seed=await generateSeed(fixture);const result=spawnSync('python3',['-c',`import sqlite3,sys,pathlib,json
c=sqlite3.connect(':memory:')
c.executescript(pathlib.Path('migrations/0001_trail_store.sql').read_text())
c.executescript(sys.stdin.read())
assert c.execute('select count(*) from trails').fetchone()[0]==233
assert c.execute('select count(*) from long_trails').fetchone()[0]==4
assert c.execute('select count(*) from admin_members').fetchone()[0]==0
assert c.execute('select count(*) from admin_audit').fetchone()[0]==0
assert c.execute('select count(*) from photos').fetchone()[0]==15
for path,body in c.execute('select path,body from public_snapshots'):
 f=sys.argv[1]+'/data/catalog.json' if path=='/api/catalog' else sys.argv[1]+'/data/trails/'+path.rsplit('/',1)[1]+'.json'
 assert pathlib.Path(f).read_text()==body
assert c.execute('pragma foreign_key_check').fetchall()==[]
print('233 trail snapshots plus catalog exactly match; 4 long trails, 15 photo records; no admins')`,fixture],{input:seed,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert(result.stdout.includes('exactly match'));assert.equal(sqlText("a'b"),"'a''b'");assert.throws(()=>sqlText('\0'));}finally{await fs.rm(fixture,{recursive:true,force:true});}});
