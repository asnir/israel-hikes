import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('Side thumbnail is a compact96px square with full-width walking facts',()=>{const s=fs.readFileSync('src/style.css','utf8');assert.ok(s.includes('/* Compact96px side thumbnails'));assert.match(s,/\.card-photo img \{height:96px;/);assert.match(s,/\.card-facts \{clear:both;/)});
