import { FIELDS, SECTIONS } from '../domain/scoring';
import type {Registration} from './types';
export function csvCell(value:unknown){
 let text=value==null?'':String(value);
 if(typeof value==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function seasonCsv(rows:Registration[]){
 const headings=['Car #','Vehicle Year','Vehicle Make','Vehicle Model','Car Color','Participant','City','State','Status','Paid Status',...FIELDS,'Paint Total','Interior Total','Engine Total','Final Score','Registration ID','Car ID'];
 const sorted=rows.filter(r=>r.status!=='Archived').sort((a,b)=>a.car_number===null?(b.car_number===null?0:1):b.car_number===null?-1:BigInt(a.car_number)<BigInt(b.car_number)?-1:BigInt(a.car_number)>BigInt(b.car_number)?1:0);
 const lines=sorted.map(r=>{
 const sum=(fields:string[])=>fields.some(f=>r.score?.[f]==null)?null:fields.reduce((n,f)=>n+Number(r.score![f]),0);
 return [r.car_number,r.vehicle_year,r.vehicle_make,r.vehicle_model,r.vehicle_color,r.participant.name,r.participant.city,r.participant.state,r.status,r.payment_status,...FIELDS.map(f=>r.score?.[f]),...[SECTIONS.body_paint,SECTIONS.interior,SECTIONS.engine].map(section=>sum(Object.keys(section))),r.score?.total_score,r.id,r.car_id];
 });
 return '\uFEFF'+[headings,...lines].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
