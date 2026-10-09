import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
test('Each checked trail photo has its own directory and reusable gallery record',()=>{
 const data=JSON.parse(readFileSync('src/data/trail-photos.json'));
 for(const [id,photo] of Object.entries(data)) {
  assert.equal(photo.src,`/photos/${id}/hero.webp`);
  assert.equal(photo.thumbSrc,`/photos/${id}/thumb.webp`);
  assert.equal(photo.gallery.length,1);
  assert.equal(photo.gallery[0].src,photo.src);
  for(const entry of photo.gallery) {
   assert.ok(statSync('public'+entry.src).size>1000);
   for(const key of ['captionHe','captionEn','author','authorEn','source','licence','licenceUrl','changes'])assert.ok(entry[key]);
  }
 }
});
