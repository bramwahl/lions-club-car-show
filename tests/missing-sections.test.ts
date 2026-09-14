import test from 'node:test';
import assert from 'node:assert/strict';
import { missingSections } from '../src/workflows/missing-sections';
import { MAXIMA } from '../src/domain/scoring';
import type { Registration } from '../src/workflows/types';
test('flags missing current sections only after all three judges, preserving zero scores',()=>{
 const r={id:'r',status:'Checked-in',car_number:'26',score:{...MAXIMA,id:'s',plating_brass:null,appearance:0}} as unknown as Registration;
 const visits=['Paul Lewis','Don Maw','Gary Broshar'].map(judge_name_snapshot=>({score_id:'s',judge_name_snapshot}));
 assert.deepEqual(missingSections([r],visits)[0].sections,['Body / Plating']);
 assert.equal(missingSections([r],visits.slice(0,2)).length,0);
 assert.equal(missingSections([{...r,status:'Archived'}],visits).length,0);
 assert.equal(missingSections([{...r,score:{...r.score!,plating_brass:0} as unknown as unknown as Registration['score']}],visits).length,0);
 assert.equal(missingSections([r],[...visits.slice(0,2),visits[0]]).length,0);
});

import {allMissingScores,filterMissingScores,missingScoresCsv} from '../src/workflows/missing-sections';
test('all missing includes unstarted attendees, filters by any selected category, exports matching fields',()=>{
 const base={id:'r',status:'Checked-in',car_number:'2',vehicle_year:1955,vehicle_make:'Chevrolet',vehicle_model:'Truck',vehicle_color:'Blue',score:null} as unknown as Registration;
 const rows=allMissingScores([base,{...base,id:'pre',status:'Registered'},{...base,id:'arch',status:'Archived'}]);
 assert.equal(rows.length,1);assert.equal(rows[0].missing.length,6);
 const selected=filterMissingScores(rows,['engine','appearance']);
 assert.equal(selected.length,1);assert.deepEqual(selected[0].missing.map(s=>s.section),['engine','appearance']);
 assert.equal(filterMissingScores(rows,[]).length,0);
 const csv=missingScoresCsv(selected);
 assert.ok(csv.includes('Engine: Block'));assert.ok(csv.includes('Blue'));assert.ok(!csv.includes('Coverage'));
 assert.equal(allMissingScores([{...base,score:{...MAXIMA,appearance:0} as unknown as Registration['score']}]).length,0);
});
