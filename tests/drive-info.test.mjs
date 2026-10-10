import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const card=fs.readFileSync('src/components/TrailCard.tsx','utf8');
const detail=fs.readFileSync('src/pages/TrailDetail.tsx','utf8');
test('Driving figures cannot be rendered as trail-card facts',()=>{
 assert.ok(!card.includes('driveText'));assert.ok(!card.includes('drive.minutes'));assert.ok(card.includes('distance(t.km)'));
 for(const page of ['Home','LongDetail'])assert.ok(!fs.readFileSync('src/pages/'+page+'.tsx','utf8').includes('drive={'));
});
test('Arrival panel keeps origin and driving context separate from walking facts',()=>{
 assert.ok(detail.includes('access-section'));assert.ok(detail.includes('aria-labelledby="arrival-heading"'));assert.ok(detail.includes('Car size={23}'));assert.ok(detail.includes('drivingDistance(drive.km)'));assert.ok(detail.includes('city && drive'));assert.ok(detail.includes('loadPreferences'));assert.ok(!detail.includes('drive.minutes'));assert.ok(!detail.includes('legacy'));assert.ok(detail.includes('NavigationMenu'));
 for(const lang of ['he','en']){const j=JSON.parse(fs.readFileSync('src/locales/'+lang+'.json'));assert.ok(j.drivingDistance.includes('{{km}}'));assert.ok(!j.drivingDistance.includes('{{minutes}}'));assert.ok(j.drivingDistance.includes(lang==='he'?'מרחק נסיעה':'Driving distance'))}
});
