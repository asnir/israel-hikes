import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,rm} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
test('Gallery renders honest caption/rights and only shows controls for multiple photos',async()=>{
 const folder=resolve('node_modules/.cache/gallery-test');await mkdir(folder,{recursive:true});
 const output=folder+'/component.mjs';
 try {
  await build({entryPoints:['src/components/TrailGallery.tsx'],bundle:true,platform:'node',format:'esm',outfile:output,packages:'external'});
  const {default:Gallery}=await import(pathToFileURL(output).href);
  const photo={src:'/test.webp',captionHe:'Archive photo, not current conditions',captionEn:'Archive photo, not current conditions',title:'Original photo',author:'Creator',authorEn:'Creator',source:'https://example.org/photo',licence:'CC BY 4.0',licenceUrl:'https://creativecommons.org/licenses/by/4.0/',changes:'Resized'};
  const one=renderToStaticMarkup(createElement(Gallery,{photos:[photo]}));
  assert.ok(one.includes('Archive photo, not current conditions'));assert.ok(one.includes('Creator'));assert.ok(one.includes(photo.licenceUrl));assert.ok(!one.includes('gallery-controls'));
  const many=renderToStaticMarkup(createElement(Gallery,{photos:[photo,{...photo,src:'/other.webp'}]}));
  assert.ok(many.includes('gallery-controls'));assert.ok(many.includes('1 / 2'));assert.ok(many.includes('aria-live="polite"'));
  assert.equal(renderToStaticMarkup(createElement(Gallery,{photos:[]})), '');
 }finally{await rm(folder,{recursive:true,force:true})}
});
