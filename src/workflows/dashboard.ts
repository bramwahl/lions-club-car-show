import {CLASSES,classification} from '../domain/awards';
import { SECTIONS } from '../domain/scoring';
import type { EventRow, Registration } from './types';
export type PriorRegistration={event_id:string;car_id:string};
export function earlierEvent(candidate:EventRow,current:EventRow){return candidate.event_year<current.event_year||(candidate.event_year===current.event_year&&!!candidate.event_date&&!!current.event_date&&candidate.event_date<current.event_date);}
export function canonicalMake(make:string){
 const clean=make.trim().replace(/\s+/g,' ');
 const aliases:Record<string,string>={chevy:'Chevrolet',chev:'Chevrolet',chevrolet:'Chevrolet',vw:'Volkswagen',volkswagen:'Volkswagen',mercedes:'Mercedes-Benz','mercedes benz':'Mercedes-Benz','mercedes-benz':'Mercedes-Benz'};
 return aliases[clean.toLowerCase()]??clean;
}
const validLocation=(value:string|null|undefined)=>!!value?.trim()&&!/^(unknown(?: city| state)?|n\/?a|none|null|-+)$/i.test(value.trim());
export function dashboardInsights(rows:Registration[],prior:PriorRegistration[],hasBaseline:boolean,leftIds:readonly string[]=[]){
 const registered=rows.filter(r=>r.status!==null&&r.status!=='Archived');
 const checked=registered.filter(r=>r.status==='Checked-in'||r.status==='Judged');
 const eligible=checked.filter(r=>!leftIds.includes(r.id));
 const known=new Set(prior.map(r=>r.car_id));
 function top(key:(r:Registration)=>string){const groups=new Map<string,{label:string;count:number}>();for(const r of registered){const label=key(r);if(!label)continue;const normalized=label.toLocaleLowerCase();const group=groups.get(normalized)??{label,count:0};group.count++;groups.set(normalized,group);}return [...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)).slice(0,7).map(g=>({...g,percent:registered.length?g.count/registered.length*100:0}));}
 const judgingSections=Object.entries(SECTIONS).map(([section,maxima])=>{
 const fields=Object.entries(maxima);
 const complete=eligible.reduce((count,r)=>count+fields.filter(([field,max])=>{const value=r.score?.[field];return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=max;}).length,0);
 return {section,complete,total:eligible.length*fields.length};
 });
 const judging={complete:judgingSections.reduce((n,s)=>n+s.complete,0),total:eligible.length*17,sections:judgingSections};
 const returning=registered.filter(r=>known.has(r.car_id)).length;
 return {judging,judgingEligible:eligible.length,judgingCompleted:eligible.filter(r=>r.status==='Judged').length,leftCount:checked.length-eligible.length,total:registered.length,checked:checked.length,paid:checked.filter(r=>r.payment_status==='Paid').length,judged:checked.filter(r=>r.status==='Judged').length,returning:hasBaseline?returning:null,newCars:hasBaseline?registered.length-returning:null,locations:top(r=>validLocation(r.participant.city)&&validLocation(r.participant.state)?[r.participant.city!.trim(),r.participant.state!.trim().toUpperCase()].join(', '):''),makes:top(r=>canonicalMake(r.vehicle_make)||'Unknown make'),decades:CLASSES.map(label=>{const count=registered.filter(r=>classification(r.vehicle_year)===label).length;return {label,count,percent:registered.length?count/registered.length*100:0};}).sort((a,b)=>b.count-a.count)};
}
