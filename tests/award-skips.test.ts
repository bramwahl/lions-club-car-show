import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAwards,type AwardInput} from '../src/domain/awards';
test('class skip keeps car eligible for engine and moves displaced engine winner to Top 40',()=>{
 const car=(id:string,total:number,paint:number,interior:number,engine:number)=>({car_id:id,car_number:id,vehicle_year:1960,total_score:total,overall_paint:paint,overall_interior:interior,overall_engine:engine} as AwardInput);
 const rows=[car('1',180,60,40,40),car('2',170,50,30,40),car('3',160,40,25,30),car('4',150,60,20,20),car('5',140,30,40,20),car('6',130,20,20,35)];
 const before=calculateAwards(rows);
 const after=calculateAwards(rows,[{car_id:'2',award:'Best in Class: 1960s'}]);
 assert.equal(before.find(a=>a.award==='Best in Class: 1960s')?.car_id,'2');
 assert.equal(after.find(a=>a.award==='Best in Class: 1960s')?.car_id,'3');
 assert.equal(after.find(a=>a.award==='Best in Category: Engine')?.car_id,'2');
 assert.equal(after.find(a=>a.car_id==='6')?.award,'Top 40: 1');
 assert.equal(calculateAwards(rows).find(a=>a.award==='Best in Class: 1960s')?.car_id,'2');
});
