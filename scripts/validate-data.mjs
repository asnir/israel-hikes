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
assert(rec.length>=5);
assert(ext.length>=169);
assert(segs.length>=59);
assert(long.length>=4);
assert.equal(new Set(ext.map((t) => t.n)).size, ext.length);
assert.equal(new Set(segs.map((t) => t.id)).size, segs.length);
assert.equal(Object.keys(access).length, 187);
for (const t of segs) assert(long.some((l) => l.id === t.trail));
for (const c of cities) {
  assert(Object.keys(matrix[c.id]).length>=187);
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
  "Validated: 5 recommendations, 169 leads, 59 segments, 4 long trails, 187 starts, 8 city matrices. Privacy pattern scan passed.",
);
