import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sessionClient } from '../../../../src/supabase/server';
import { registrationDetail,rpc } from '../../../../src/workflows/data';
import type { Score,HistoryDisplay } from '../../../../src/workflows/types';
import { sectionLabels,label } from '../../../../src/workflows/types';
import { SECTIONS } from '../../../../src/domain/scoring';
import { StaffShell } from '../../../components/staff-shell';
import { ActionForm } from '../../../components/action-form';
import { Progress,HistoryTable } from '../../../components/workflow';
import { JudgingSheet } from '../../../components/judging-sheet';
import { openJudging } from '../../../admin/workflow-actions';
import { voteLionsChoice } from '../../actions';
import type { AppRole } from '../../../../src/auth/accounts';

type PublicCar={id:string;car_number:string;vehicle_year:number;vehicle_make:string;vehicle_model:string;owner_name:string;owner_city:string|null;owner_state:string|null;event_name:string;event_year:number;historical:boolean;judging_open:boolean;progress:number;sections:Record<string,boolean>};
export default async function JudgingDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const client=await sessionClient();
 const {data:{user}}=await client.auth.getUser();
 const profile=user?(await client.from('profiles').select('display_name,app_role,is_active').eq('id',user.id).single()).data:null;
 const role:AppRole|null=profile?.is_active&&['admin','judge'].includes(profile.app_role)?profile.app_role:null;
 let car=await rpc<PublicCar|null>(client,'registration_progress',{p_registration:id});
 let score:Score|null=null;let history:HistoryDisplay[]=[];let eventId:string|undefined;let votes=0;
 if(role==='admin'){
  const data=await registrationDetail(client,id);score=data.registration.score;history=data.history;eventId=data.event.id;votes=data.registration.lions_choice_votes;
  if(!car){const r=data.registration;car={id,car_number:'',vehicle_year:r.vehicle_year,vehicle_make:r.vehicle_make,vehicle_model:r.vehicle_model,owner_name:r.participant.name,owner_city:r.participant.city,owner_state:r.participant.state,event_name:data.event.name,event_year:data.event.event_year,historical:!!data.event.legacy_source_key,judging_open:data.event.judging_open,progress:Number(score?.progress_percentage??0),sections:Object.fromEntries(Object.entries(SECTIONS).map(([section,fields])=>[section,Object.keys(fields).every(field=>score?.[field]!=null)]))};}
 }else if(role==='judge'&&car?.judging_open&&!car.historical){score=(await rpc<Score[]>(client,'judge_score',{p_registration_id:id}))[0]??null;history=await rpc<HistoryDisplay[]>(client,'judge_full_history',{p_registration:id});const detail=await rpc<{lions_choice_votes:number}>(client,'judge_registration',{p_registration:id});votes=detail.lions_choice_votes;}
 if(!car)notFound();
 const editable=!!role&&car.judging_open&&!car.historical&&!!car.car_number;
 const content=<>
  {role==='admin'&&<Link href={`/admin/registrations/${id}`}>← Registration details</Link>}
  <section className="registration-hero registration-summary"><div className="registration-title-row"><span className="car-number">{car.car_number?`#${car.car_number}`:'Pre-registered'}</span><h1>{car.vehicle_year} {car.vehicle_make} {car.vehicle_model}</h1></div><p className="qr-owner">{car.owner_name}<span>{[car.owner_city,car.owner_state].filter(Boolean).join(', ')}</span></p><p>{car.event_name} · {car.event_year}{car.historical?' · Historical snapshot':''}</p></section>
  <section className="card judging-progress"><h2>Judging progress</h2><Progress value={Number(car.progress)}/><p>{Math.round(Number(car.progress))}% judged</p><div className="section-completion">{Object.entries(sectionLabels).map(([key,title])=><div key={key}><span className={car.sections[key]?'section-done':'section-pending'} aria-hidden="true">{car.sections[key]?'✓':'○'}</span><span>{title}</span><small>{car.sections[key]?'Complete':'Pending'}</small></div>)}</div></section>
  {!role&&<p className="public-judge-signin"><Link className="button secondary" href={`/sign-in?next=${encodeURIComponent(`/judge/registrations/${id}`)}`}>Judge sign in</Link></p>}
  {role&&!editable&&<section className="card section-space"><h2>{car.historical?'Historical judging record':!car.car_number?'Check-in required':'Judging is not open yet'}</h2><p>{car.historical?'This historical event is preserved and cannot accept new scores.':!car.car_number?'Check in this car to assign its number before judging.':'An administrator needs to open this event for judging. Progress remains visible to everyone.'}</p>{role==='admin'&&!car.historical&&!!car.car_number&&eventId&&<ActionForm action={openJudging} submit="Open judging for this event"><input type="hidden" name="event" value={eventId}/><input type="hidden" name="open" value="true"/><p className="hint">This opens judging for this event and closes it for any other event.</p></ActionForm>}</section>}
  {editable&&<JudgingSheet registration={id} score={score} history={history} requests={Object.fromEntries(Object.keys(SECTIONS).map(s=>[s,crypto.randomUUID()]))}/>}
  {role&&!editable&&score&&<section className="section-space"><h2>Recorded scores</h2>{Object.entries(SECTIONS).map(([section,maxima])=><details className="card section-card" key={section}><summary>{sectionLabels[section as keyof typeof SECTIONS]}</summary><div className="score-fields">{Object.entries(maxima).map(([field,max])=><p key={field}>{label(field)}: <strong>{score?.[field]??'Incomplete'}</strong> / {max}</p>)}</div></details>)}</section>}
  {(role==='admin'||editable)&&<><section className="card section-space"><h2>Lions Choice</h2><p>{votes} votes · separate from judging scores.</p>{editable&&<ActionForm action={voteLionsChoice} submit="Add one Lions Choice vote"><input type="hidden" name="registration" value={id}/></ActionForm>}</section><section className="section-space"><h2>Submission history</h2><HistoryTable history={history}/></section></>}
 </>;
 return role?<StaffShell role={role} name={profile!.display_name} eventOverride={{name:car.event_name,event_year:car.event_year,legacy_source_key:car.historical?'historical':null,judging_open:car.judging_open}}>{content}</StaffShell>:<><header className="site-header"><Link href="/" className="brand">Lions Club <span>Dream Car Show</span></Link></header><main className="container workspace public-car-page">{content}</main></>;
}
