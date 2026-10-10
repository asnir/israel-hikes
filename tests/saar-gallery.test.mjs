import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Saar gallery has three licensed historical site scenes and no upper-stream false assignment',()=>{
 const p=JSON.parse(fs.readFileSync('src/data/trail-photos.json'));assert.equal(p['ext-10'].gallery.length,3);assert.equal(p['ext-11'],undefined);
 for(const v of p['ext-10'].gallery){assert(fs.statSync('public'+v.src).size>1000);assert(v.captionHe.includes('לא'));assert(v.captionEn.includes('current'));assert(v.source.startsWith('https://commons.wikimedia.org/wiki/File:'));assert(fs.readFileSync('public/photos/ext-10/CREDITS.md','utf8').includes(v.source));}
 assert.equal(p['ext-10'].gallery[0].licence,'CC BY 2.5');assert.equal(p['ext-10'].gallery[1].licence,'Public domain');assert.equal(p['ext-10'].gallery[2].licence,'Public domain');
});
