import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, FIELDS, MAXIMA, SECTIONS, statusAfterSave, validateInputs } from '../src/domain/scoring';
import { calculateAwards, classification, phpNumericCompare, type AwardInput } from '../src/domain/awards';
import { legacyId, entityId } from '../scripts/phase1a/mapping';
test('17 inputs, maxima, NULL propagation and exact progress',()=>{
  assert.equal(FIELDS.length,17);assert.equal(Object.keys(SECTIONS).length,6);
  assert.deepEqual(calculate(MAXIMA),{overall_paint:60,overall_interior:40,overall_engine:40,total_score:180,progress_percentage:'100.00'});
  assert.equal(calculate({coverage:0}).progress_percentage,'5.88');
  assert.equal(calculate({coverage:0}).total_score,null);
  assert.equal(calculate(Object.fromEntries(FIELDS.map(k=>[k,0]))).total_score,0);
  for(const [section,pct] of [['wheels_tires','11.76'],['body_paint','23.53'],['engine','29.41']] as const) assert.equal(calculate(SECTIONS[section]).progress_percentage,pct);
  assert.equal(calculate({...MAXIMA,appearance:null}).progress_percentage,'94.12');
});
test('strict input contract distinguishes blank, zero, invalid and out of scope',()=>{
  assert.equal(validateInputs({coverage:'0'}).coverage,0);
  for(const blank of ['', '  ', null, undefined]) assert.equal(validateInputs({coverage:blank}).coverage,null);
  for(const invalid of [true,false,NaN,Infinity,1.5,-1,16,'3abc','3.5','1e1','-1',' 1 ']) assert.throws(()=>validateInputs({coverage:invalid}));
  assert.throws(()=>validateInputs({total_score:0}));
  assert.throws(()=>validateInputs({coverage:1},'engine'));
  assert.deepEqual(Object.keys(validateInputs({},'appearance')),['appearance']);
  assert.equal(statusAfterSave('Archived','100.00'),'Judged');
  assert.equal(statusAfterSave('Judged','0.00'),'Judged');
});
const car=(id:string,year:number,total:number|null=100):AwardInput=>({car_id:id,legacy_car_id:id,legacy_score_id:id,car_number:id,vehicle_year:year,vehicle_make:'Test',vehicle_model:'Test',participant_name:'Same owner',participant_city:null,total_score:total,overall_paint:10,overall_interior:10,overall_engine:10});
test('year boundaries and empty/fewer-than-40 awards',()=>{
  for(const [year,label] of [[1949,'Pre-1950'],[1950,'1950s'],[1959,'1950s'],[1960,'1960s'],[1999,'1990s'],[2000,'Post-2000']] as const) assert.equal(classification(year),label);
  assert.deepEqual(calculateAwards([]),[]);
  assert.equal(calculateAwards([car('1',1950)]).length,1);
});
test('sequential exclusions by car, category ties and inherited order without ID key',()=>{
  const input=[car('99',1940,180),car('9',1950,170),...['8','7','6','5','4','3','2','1'].map(id=>car(id,1950,100))];
  const before=JSON.stringify(input);const awards=calculateAwards(input);
  assert.equal(awards[0].car_id,'99');assert.equal(awards[1].car_id,'9');
  assert.equal(awards[2].car_number_display,'8*');
  assert.equal(awards[3].car_number_display,'7*');
  assert.equal(awards[4].car_number_display,'6*');
  assert.equal(awards[5].car_id,'5');assert.equal(JSON.stringify(input),before);
  assert.equal(new Set(awards.map(a=>a.car_id)).size,awards.length);
  assert.equal(phpNumericCompare(null,0),-1); // native PHP NULL <=> mysqli string '0'
  assert.throws(()=>calculateAwards([car('1',1950),car('1',1960)]));
});
test('large identities remain canonical decimal strings and deterministic UUIDs',()=>{
  assert.equal(legacyId('9007199254740993'),'9007199254740993');
  assert.notEqual(entityId('car','9007199254740993'),entityId('car','9007199254740992'));
  assert.equal(entityId('car','244'),entityId('car','244'));
  assert.notEqual(entityId('car','244'),entityId('registration:2025','244'));
  for(const invalid of [244,'0244',9007199254740992,'2.0']) assert.throws(()=>legacyId(invalid));
});
test('Top 40 cutoff preserves supplied equal-score order, with no artificial tie resolution',()=>{
  const rows=Array.from({length:60},(_,i)=>car(String(100-i),1950,100));
  const awards=calculateAwards(rows);
  assert.equal(awards.length,45); // Show + one class + three categories + forty
  assert.equal(awards.filter(r=>r.award.startsWith('Top 40:')).length,40);
  assert.equal(awards.at(-1)!.car_id,'56');
  const swapped=[rows[1],rows[0],...rows.slice(2)];
  assert.equal(calculateAwards(swapped)[0].car_id,'99');
  assert.equal(entityId('car','244'),'f8b7c5b6-118f-57dc-b8ac-ffd5ac978d1b'); // independently checked with Python uuid.uuid5
});
test('excluded winner does not create a category marker; partial/zero scores remain eligible',()=>{
  const rows=[car('1',1950,180),car('2',1950,170),car('3',1950,100),car('4',1950,0),car('5',1950,null)];
  rows[0].overall_paint=50;rows[2].overall_paint=50;rows[3].overall_paint=1;rows[4].overall_paint=null;
  const awards=calculateAwards(rows);
  assert.equal(awards.find(r=>r.award==='Best in Category: Paint')!.car_number_display,'3');
  assert.equal(awards.length,5);
});
