import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardInsights,earlierEvent} from '../src/workflows/dashboard';
import type {Registration,EventRow} from '../src/workflows/types';
test('dashboard paid count excludes prepaid no-shows while preserving registered directory statistics',()=>{
 const row=(car_id:string,status:string|null,payment_status:string,make='Ford',city='Zionsville')=>({car_id,status,payment_status,vehicle_make:make,participant:{city,state:'IN'}} as Registration);
 const result=dashboardInsights([row('old','Judged','Paid'),row('new','Checked-in','Unpaid','FORD'),row('third','Registered','Paid','Chevrolet'),row('archived','Archived','Paid'),row('unknown',null,'Paid')],[{event_id:'2025',car_id:'old'}],true);
 assert.deepEqual([result.total,result.checked,result.paid,result.judged,result.newCars,result.returning],[3,2,1,1,2,1]);
 assert.equal(result.makes[0].count,2);assert.equal(result.locations[0].percent,100);
 assert.equal(dashboardInsights([],[],false).newCars,null);
 assert.equal(dashboardInsights([],[],true).total,0);
});
test('earlier events never use future years or arbitrary same-year ordering',()=>{
 const e=(year:number,date:string|null)=>({event_year:year,event_date:date} as EventRow);
 assert.equal(earlierEvent(e(2025,null),e(2026,null)),true);
 assert.equal(earlierEvent(e(2027,null),e(2026,null)),false);
 assert.equal(earlierEvent(e(2026,null),e(2026,null)),false);
 assert.equal(earlierEvent(e(2026,'2026-05-01'),e(2026,'2026-09-01')),true);
});
