import { SECTIONS } from '../domain/scoring';
import { sectionLabels, type Registration } from './types';
export type JudgeVisit={score_id:string;judge_name_snapshot:string|null};
const judges=['Paul Lewis','Don Maw','Gary Broshar'];
export function missingSections(rows:Registration[],history:JudgeVisit[]){
 return rows.filter(r=>['Checked-in','Judged'].includes(r.status??'')&&r.score).flatMap(r=>{
 const names=new Set(history.filter(h=>h.score_id===r.score!.id).map(h=>h.judge_name_snapshot?.trim().toLowerCase()));
 if(!judges.every(name=>names.has(name.toLowerCase())))return [];
 const sections=Object.entries(SECTIONS).filter(([,fields])=>Object.entries(fields).some(([field,max])=>{
 const value=r.score?.[field as keyof typeof r.score];
 return typeof value!=='number'||!Number.isInteger(value)||value<0||value>max;
 })).map(([section])=>sectionLabels[section as keyof typeof sectionLabels]);
 return sections.length?[{registration:r,sections}]:[];
 }).sort((a,b)=>Number(a.registration.car_number)-Number(b.registration.car_number));
}

export function allMissingScores(rows:Registration[]){
 return rows.filter(r=>['Checked-in','Judged'].includes(r.status??'')).map(r=>({
 id:r.id,number:r.car_number,year:r.vehicle_year,make:r.vehicle_make,model:r.vehicle_model,color:r.vehicle_color||'Not recorded',
 missing:Object.entries(SECTIONS).flatMap(([section,fields])=>{
 const missing=Object.entries(fields).filter(([field,max])=>{
 const value=r.score?.[field];
 return typeof value!=='number'||!Number.isInteger(value)||value<0||value>max;
 }).map(([field])=>field.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()));
 return missing.length?[{section:section as keyof typeof SECTIONS,fields:missing}]:[];
 })
 })).filter(r=>r.missing.length).sort((a,b)=>Number(a.number)-Number(b.number));
}
export type MissingCar=ReturnType<typeof allMissingScores>[number];
export function filterMissingScores(rows:MissingCar[],sections:string[]){
 return rows.map(r=>({...r,missing:r.missing.filter(s=>sections.includes(s.section))})).filter(r=>r.missing.length);
}
export function missingScoresCsv(rows:MissingCar[]){
 const cell=(v:unknown)=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[['Car Number','Year','Make','Model','Color','Scores Missing'],...rows.map(r=>[r.number,r.year,r.make,r.model,r.color,r.missing.map(s=>sectionLabels[s.section]+': '+s.fields.join(', ')).join('; ')])].map(r=>r.map(cell).join(',')).join('\r\n');
}
