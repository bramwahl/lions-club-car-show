'use client';
import { ChevronRight, Minus, Plus } from 'lucide-react';

import { useActionState,useState } from 'react';
import { SECTIONS,type Section } from '../../src/domain/scoring';
import type { HistoryDisplay,Score } from '../../src/workflows/types';
import { sectionLabels,label } from '../../src/workflows/types';
import { submitSelectedSections } from '../judge/actions';
import type { FormState } from '../actions';
import { StatusBadge } from './ui';
export function JudgingSheet({registration,score,history,requests}:{registration:string;score:Score|null;history:HistoryDisplay[];requests:Record<string,string>}){
 const [selected,setSelected]=useState<Section[]>([]);
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(Object.values(SECTIONS).flatMap(fields=>Object.keys(fields).map(field=>[field,String(score?.[field]??'')]))));
 const [touched,setTouched]=useState<Record<string,boolean>>({});
 const [state,action,pending]=useActionState(async(previous:FormState,form:FormData)=>{
  const result=await submitSelectedSections(previous,form);
  if(result.success){setSelected([]);setTouched({});}
  return result;
 },{message:''});
 function setScore(field:string,value:string){setValues(current=>({...current,[field]:value}));setTouched(current=>({...current,[field]:true}));}
 function step(field:string,max:number,amount:number){const current=Number(values[field]);setScore(field,String(Math.min(max,Math.max(0,(Number.isFinite(current)?current:0)+amount))));}
 return <form action={action} className="judging-sheet"><input type="hidden" name="registration" value={registration}/><div className="judging-sheet-heading"><h2>Judging sheet</h2><button type="button" className="secondary judging-expand-all" disabled={pending||selected.length===Object.keys(SECTIONS).length} onClick={()=>setSelected(Object.keys(SECTIONS) as Section[])}>Expand all</button></div><p>Open one or more sections to score. Use Max, then − to deduct points, or type a score. All items in an open section must be complete before saving.</p>
 {Object.entries(SECTIONS).map(([key,maxima])=>{const section=key as Section;const chosen=selected.includes(section);const complete=Object.keys(maxima).every(field=>score?.[field]!=null);const last=history.find(h=>h.section===section);return <section className="card section-card" key={section}>
  <button type="button" className="judging-section-toggle" aria-expanded={chosen} aria-controls={`section-${section}`} disabled={pending} onClick={()=>setSelected(current=>chosen?current.filter(s=>s!==section):[...current,section])}><span>{sectionLabels[section]}</span><StatusBadge value={complete?'Complete':'Pending'}/><ChevronRight aria-hidden="true" size={20} strokeWidth={1.75} className={chosen?'expanded':''}/></button>
  {last&&<p className="hint section-attribution">Last saved by {last.judge_name_snapshot??'Judge'}{last.submitted_at?` · ${new Intl.DateTimeFormat('en-US',{dateStyle:'short',timeStyle:'short',timeZone:'America/Indiana/Indianapolis'}).format(new Date(last.submitted_at))} Eastern`:''}</p>}
  <div id={`section-${section}`} hidden={!chosen}>{chosen&&<><input type="hidden" name="sections" value={section}/><input type="hidden" name={`request_${section}`} value={requests[section]}/><div className="score-fields">{Object.entries(maxima).map(([field,max])=>{
   const value=values[field];const invalid=value!==''&&(!/^\d+$/.test(value)||Number(value)>max);const missing=touched[field]&&value==='';const error=invalid?`Enter a whole number from 0 to ${max}.`:missing?'Enter a score. Zero is valid.':null;
   return <div className="score-entry" key={field}><label className="score-field-label" htmlFor={`score-${field}`}>{label(field)}<span className="score-range">0–{max} points</span></label>
    <div className={`score-control ${error?'has-error':''}`}>
     <button type="button" className="score-preset score-min" disabled={pending} aria-label={`Set ${label(field)} to minimum 0`} onClick={()=>setScore(field,'0')}>Min (0)</button>
     <button type="button" className="score-step score-min" aria-label={`Decrease ${label(field)} by 1`} disabled={pending||value!==''&&Number(value)<=0} onClick={()=>step(field,max,-1)}><Minus size={20} strokeWidth={1.75} aria-hidden="true"/></button>
     <input id={`score-${field}`} type="number" inputMode="numeric" min={0} max={max} step={1} required name={field} value={value} disabled={pending} aria-invalid={!!error} aria-describedby={error?`error-${field}`:undefined} onChange={e=>setScore(field,e.target.value)} onBlur={()=>setTouched(current=>({...current,[field]:true}))}/>
     <button type="button" className="score-step score-max" aria-label={`Increase ${label(field)} by 1`} disabled={pending||value!==''&&Number(value)>=max} onClick={()=>step(field,max,1)}><Plus size={20} strokeWidth={1.75} aria-hidden="true"/></button>
     <button type="button" className="score-preset score-max" disabled={pending} aria-label={`Set ${label(field)} to maximum ${max}`} onClick={()=>setScore(field,String(max))}>Max ({max})</button>
    </div>
    {error&&<p className="score-warning" id={`error-${field}`} role="status">{error}</p>}
   </div>;
  })}</div></>}</div>
 </section>;})}
 <div className="judging-save"><p>{selected.length?`${selected.length} section${selected.length===1?'':'s'} open`:'Open a section above'}</p><button disabled={pending||!selected.length}>{pending?'Saving scores…':`Save ${selected.length===1?'section':'open sections'}`}</button><p role="status" className="message">{state.message}</p></div>
 </form>;
}
