import {readData,validateData} from "./trail-data.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const read = (n) =>
  JSON.parse(fs.readFileSync("src/data/" + n + ".json", "utf8"));
const rec = read("recommendations"),
  ext = read("extended"),
  segs = read("segments"),
  long = read("long-trails"),
  access = read("access"),
  cities = read("cities"),
  matrix = read("city-estimates");
validateData(readData(),long.map(t=>t.id));
assert(long.length>0);
assert.equal(new Set(ext.map((t) => t.n)).size, ext.length);
assert.equal(new Set(segs.map((t) => t.id)).size, segs.length);
const validAccess=new Set([...rec.map(t=>t.id),...ext.map(t=>String(t.n)),...segs.map(t=>t.id)]);
for(const [id,a] of Object.entries(access)){assert(validAccess.has(id),"Orphan start: "+id);assert(/^\d+\.\d+,\d+\.\d+$/.test(a.destination),"Invalid start: "+id);const [lat,lon]=a.destination.split(",").map(Number);assert(lat>=-90&&lat<=90&&lon>=-180&&lon<=180,"Out-of-range coordinates")};
for (const t of segs) assert(long.some((l) => l.id === t.trail));
for (const c of cities) {
  assert(matrix[c.id]);
  for(const id of Object.keys(matrix[c.id]))assert(access[id.replace(/^ext-|^seg-/,"")],"Orphan city estimate: "+id);
  for (const d of Object.values(matrix[c.id]))
    assert(d.km >= 0 && d.minutes >= 0);
}
const forbidden = /docs\.google\.com\/document|(?:רחוב|כתובת אישית)\s+[^"\n]+\d|עשינו|היינו|אנחנו|שיניתי|כשטיילנו|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+972|(?<![\d.])05\d{8}(?!\d)/i;
for (const file of fs.readdirSync("src/data")) {
  const text = fs.readFileSync("src/data/" + file, "utf8");
  assert(!forbidden.test(text), "Private information candidate: " + file);
}
for (const t of ext) {
  assert(Array.isArray(t.notes));
  assert(Array.isArray(t.links));
  assert(Array.isArray(t.seasons));
  assert(Array.isArray(t.landscape));
  if (t.src === "friend") assert.equal(t.infoUrl, "");
}
console.log(
  `Validated: ${rec.length} recommendations, ${ext.length} leads, ${segs.length} segments, ${long.length} long trails, ${Object.keys(access).length} starts, ${cities.length} city matrices. Privacy pattern scan passed.`,
);
