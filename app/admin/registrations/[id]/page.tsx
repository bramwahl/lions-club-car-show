import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../../../components/ui';
import Link from 'next/link';
import { requireStaff } from '../../../../src/auth/session';
import { registrationDetail } from '../../../../src/workflows/data';
import { STATUSES } from '../../../../src/workflows/types';
import { StaffShell } from '../../../components/staff-shell';
import { Historical,HistoryTable,Progress } from '../../../components/workflow';
import { ActionForm } from '../../../components/action-form';
import { updateRegistration } from '../../workflow-actions';

export default async function RegistrationDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {client,profile}=await requireStaff(true);
 const {event,registration:r,history}=await registrationDetail(client,id);
 const {data:car,error}=await client.from('cars').select('notes').eq('id',r.car_id).single();
 if(error)throw new Error('Vehicle notes could not be loaded. Please try again.');
 const historical=!!event.legacy_source_key;
 const needsCheckIn=!historical&&(!r.car_number||!['Checked-in','Judged'].includes(r.status??''));
 const judgingUrl=`/judge/registrations/${id}`;
 const primary=needsCheckIn?{href:`/admin/check-in/${r.participant_id}`,label:'Check in car'}:
  {href:judgingUrl,label:historical?'View judging record':r.status==='Judged'?'Review judging':event.judging_open?'Judge car':'View judging record'};
 return <StaffShell role={profile.app_role} name={profile.display_name}>
  <Link href="/admin/registrations"><ArrowLeft className="action-icon" size={18} strokeWidth={1.75} aria-hidden="true"/> Registrations</Link>
  <section className="registration-hero registration-summary" aria-label="Vehicle summary">
   <div className="registration-title-row"><span className={`car-number ${r.car_number?'':'unnumbered'}`}>{r.car_number?`#${r.car_number}`:'Pre-registered'}</span><h1>{r.vehicle_year} {r.vehicle_make} {r.vehicle_model}</h1></div>
   <div className="badge-row"><StatusBadge value={r.payment_status}/><StatusBadge value={r.status}/></div>
   <div className="registration-notes"><h2>Vehicle notes</h2><p>{car?.notes?.trim()?car.notes:'No notes added.'}</p></div>
  </section>
  <p>{event.name} · {r.classification??'Class not set'}</p>
  <Historical event={event}/>
  <div className="actions">
   <Link className="button" href={primary.href}>{primary.label}</Link>
   {r.car_number&&<Link className="button secondary" href={`/admin/registrations/${id}/print`}>Print car sheet / PDF</Link>}
   {!historical&&r.car_number&&<Link className="button secondary" href={`/admin/scores?registration=${id}`}>Quick Edit</Link>}
  </div>
  {!historical&&!needsCheckIn&&r.status!=='Judged'&&!event.judging_open&&<p className="hint">This car is ready for judging. <Link href="/admin/events">Open judging for this event</Link> to start scoring.</p>}
  <div className="grid">
   <section className="card participant-summary">
    <h2>Participant</h2>
    <Link className="participant-name" href={`/admin/participants/${r.participant_id}`}>{r.participant.name}</Link>
    <div className="contact-grid">{[['Phone',r.participant.phone],['Email',r.participant.email],['Address',r.participant.address],['Location',[r.participant.city,r.participant.state,r.participant.zip].filter(Boolean).join(', ')]].map(([label,value])=><p key={label}><small>{label}</small>{value||'Not provided'}</p>)}</div>
    <Link href={`/admin/participants/${r.participant_id}`}>View participant & vehicles <ArrowRight className="action-icon" size={18} strokeWidth={1.75} aria-hidden="true"/></Link>
    {!historical&&<details className="section-space"><summary>Edit registration / payment</summary><ActionForm action={updateRegistration} submit="Save status / payment"><input type="hidden" name="id" value={id}/><label>Registration status<select name="status" defaultValue={r.status??'Registered'}>{STATUSES.filter(s=>r.car_number||!['Checked-in','Judged'].includes(s)).map(s=><option key={s} value={s}>{s==='Registered'?'Pre-registered':s}</option>)}</select></label><label>Payment<select name="payment" defaultValue={r.payment_status}><option>Unpaid</option><option>Paid</option></select></label></ActionForm></details>}
   </section>
   <section className="card"><h2>Scoring</h2><Progress value={Number(r.score?.progress_percentage??0)}/><p className="score-number">{r.score?.total_score??'Incomplete'}{r.score?.total_score!=null?' / 180':''}</p><p>Paint: {r.score?.overall_paint??'—'} · Interior: {r.score?.overall_interior??'—'} · Engine: {r.score?.overall_engine??'—'}</p><p>Lions Choice votes: {r.lions_choice_votes}</p></section>
  </div>
  <section className="section-space"><h2>Judging history ({history.length})</h2><HistoryTable history={history}/></section>
 </StaffShell>;
}
