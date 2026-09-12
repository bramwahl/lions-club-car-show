import test from 'node:test';
import assert from 'node:assert/strict';
import {seasonCsv,csvCell} from '../src/workflows/season-export';
import {FIELDS} from '../src/domain/scoring';
import type {Registration} from '../src/workflows/types';
test('season CSV excludes archived and retains unscored rows, zeros, partial totals and numeric number order',()=>{
 const row=(number:string|null,score:unknown)=>({id:'id',car_id:'car',car_number:number,vehicle_year:1959,vehicle_make:'Ford, Inc.',vehicle_model:'A "model"',participant:{name:'Test'},status:'Registered',payment_status:'Unpaid',score} as Registration);
 const csv=seasonCsv([row(null,null),row('10',null),{...row('99',null),status:'Archived'},row('2',{...Object.fromEntries(FIELDS.map(f=>[f,0])),total_score:0})]);
 assert.equal(csv.split('\r\n').length,5);assert.ok(csv.split('\r\n')[1].startsWith('"2",'));assert.ok(csv.includes('"Ford, Inc."'));assert.ok(csv.includes('"A ""model"""'));assert.ok(!csv.includes('"Archived"'));assert.ok(csv.split('\r\n')[1].includes(',"0","0","0"'));assert.equal(csvCell(null),'""');assert.equal(csvCell('=1+1'),'"\'=1+1"');
});
