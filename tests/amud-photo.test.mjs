import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('Upper Amud shares an honest public-domain scene without implying exact pools or current access',()=>{
 const photos=JSON.parse(fs.readFileSync('src/data/trail-photos.json'));for(const id of ['ext-64','ext-44']){const p=photos[id];assert.equal(p.author,'Pacman');assert.equal(p.licence,'Public domain');assert.equal(p.source,'https://commons.wikimedia.org/wiki/File:Amud_stream_2.JPG');assert.match(p.captionEn,/January 2006/);assert.match(p.captionEn,/Not an identification/);assert.match(p.captionEn,/current flow/);assert.equal(p.gallery.length,1);assert.equal(p.src,'/photos/ext-64/hero.webp');}
 for(const id of ['ext-51','ext-52'])assert(!photos[id]);
 const manifest=JSON.parse(fs.readFileSync('public/photos/encoded-assets.json'));for(const name of ['hero','thumb'])assert(manifest.some(a=>a.path==='photos/ext-64/'+name+'.webp'));
 assert(JSON.parse(fs.readFileSync('package.json')).scripts['test:e2e'].includes('amud-photo-ui-test.mjs'));
});
