import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--port','4181','--host','127.0.0.1'],{stdio:'ignore'});
try{
 const b=await chromium.launch();const p=await b.newPage();let deleted=0;
 const entry={requestId:'12345678-1234-1234-1234-123456789abc',title:'Synthetic UI test',message:'Synthetic UI data only',kind:'general',receivedAt:Date.now(),reviewed:false};
 await p.route('**/api/contact-inbox',r=>r.fulfill({json:{submissions:deleted?[]:[entry]}}));
 await p.route('**/api/contact-inbox/delete',r=>{deleted++;return r.fulfill({json:{deleted:true}})});
 for(let i=0;i<40;i++){try{await p.goto('http://127.0.0.1:4181/contact-inbox');break}catch{await new Promise(r=>setTimeout(r,100))}}
 await p.getByLabel('Inbox access key').fill('synthetic-key');await p.getByRole('button',{name:'Open inbox',exact:true}).click();
 await p.getByRole('button',{name:'Delete submission',exact:true}).click();assert.equal(deleted,0);
 await p.getByRole('button',{name:'Cancel deletion',exact:true}).click();assert.equal(deleted,0);
 await p.getByRole('button',{name:'Delete submission',exact:true}).click();
 await p.getByRole('button',{name:'Confirm delete',exact:true}).click();await p.getByText('0 pending submissions.',{exact:false}).waitFor();assert.equal(deleted,1);
 await b.close();console.log('Inbox inline confirmation, cancel and confirmed cleanup passed');
}finally{server.kill()}
