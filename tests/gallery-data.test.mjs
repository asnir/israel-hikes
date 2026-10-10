import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
test('Each checked trail photo has its own directory and reusable gallery record',()=>{
 const data=JSON.parse(readFileSync('src/data/trail-photos.json'));
 for(const [id,photo] of Object.entries(data)) {
  const assetId=id === "ext-89" ? "ext-96" : id === "ext-112" ? "ext-137" : id === "ext-44" ? "ext-64" : id;
  assert.equal(photo.src,`/photos/${assetId}/hero.webp`);
  assert.equal(photo.thumbSrc,`/photos/${assetId}/thumb.webp`);
  assert.equal(photo.gallery.length, ["ext-64","ext-44","hanadiv","shofet"].includes(id) ? 3 : 1);
  assert.equal(photo.gallery[0].src,photo.src);
  for(const entry of photo.gallery) {
   assert.ok(statSync('public'+entry.src).size>1000);
   for(const key of ['captionHe','captionEn','author','authorEn','source','licence','licenceUrl','changes'])assert.ok(entry[key]);
  }
 }
});
