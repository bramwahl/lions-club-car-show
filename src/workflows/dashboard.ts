import type { EventRow, Registration } from './types';
export type PriorRegistration={event_id:string;car_id:string};
export function earlierEvent(candidate:EventRow,current:EventRow){return candidate.event_year<current.event_year||(candidate.event_year===current.event_year&&!!candidate.event_date&&!!current.event_date&&candidate.event_date<current.event_date);}
export function dashboardInsights(rows:Registration[],prior:PriorRegistration[],hasBaseline:boolean){
 const registered=rows.filter(r=>r.status!==null&&r.status!=='Archived');
 const checked=registered.filter(r=>r.status==='Checked-in'||r.status==='Judged');
 const known=new Set(prior.map(r=>r.car_id));
 function top(key:(r:Registration)=>string){const groups=new Map<string,{label:string;count:number}>();for(const r of registered){const label=key(r),normalized=label.toLocaleLowerCase();const group=groups.get(normalized)??{label,count:0};group.count++;groups.set(normalized,group);}return [...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,5).map(g=>({...g,percent:registered.length?g.count/registered.length*100:0}));}
 const returning=registered.filter(r=>known.has(r.car_id)).length;
 return {total:registered.length,checked:checked.length,paid:registered.filter(r=>r.payment_status==='Paid').length,judged:checked.filter(r=>r.status==='Judged').length,returning:hasBaseline?returning:null,newCars:hasBaseline?registered.length-returning:null,locations:top(r=>[r.participant.city?.trim()||'Unknown city',r.participant.state?.trim()||'Unknown state'].join(', ')),makes:top(r=>r.vehicle_make.trim()||'Unknown make')};
}
