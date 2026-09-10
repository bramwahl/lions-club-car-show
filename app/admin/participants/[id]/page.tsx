import { VehicleRegistrationForm } from '../../../components/vehicle-registration-form';
import { PageHeader, RegistrationCard, StatusBadge, EmptyState } from '../../../components/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '../../../../src/auth/session';
import { directory,eventContext,registrations } from '../../../../src/workflows/data';
import { StaffShell } from '../../../components/staff-shell';
import { ActionForm } from '../../../components/action-form';
import { EventPicker, Historical } from '../../../components/workflow';
import { ParticipantFields,CarFields } from '../fields';
import { saveParticipant,saveCar } from '../../workflow-actions';

export default async function ParticipantDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {client,profile}=await requireStaff(true);
 const [[people,cars],{events,event}]=await Promise.all([directory(client),eventContext(client)]);
 const participant=people.find(p=>p.id===id);if(!participant)notFound();
 const owned=cars.filter(c=>c.participant_id===id);
 const eventRegistrations=await Promise.all(events.map(async e=>({event:e,rows:(await registrations(client,e.id)).filter(r=>r.participant_id===id)})));
 const registered=eventRegistrations.find(e=>e.event.id===event?.id)?.rows??[];
 const otherEvents=eventRegistrations.filter(e=>e.event.id!==event?.id&&e.rows.length>0);
 return <StaffShell role={profile.app_role} name={profile.display_name}>
  <Link href="/admin/participants">← Participants</Link>
  <PageHeader title={participant.name} actions={<Link className="button" href={`/admin/check-in/${id}`}>Check in cars</Link>}/>
  <section className="card">
   <h2>Contact information</h2>
   <div className="contact-grid">{[['Email',participant.email],['Phone',participant.phone],['Address',participant.address],['Location',[participant.city,participant.state,participant.zip].filter(Boolean).join(', ')]].map(([label,value])=><p key={label}><small>{label}</small>{value||'Not provided'}</p>)}</div>
   <details><summary>Edit participant</summary><ActionForm action={saveParticipant} submit="Save participant"><ParticipantFields participant={participant}/></ActionForm></details>
  </section>
  <EventPicker events={events} event={event}/>
  {event&&<Historical event={event}/>}
  <section className="section-space">
   <h2>Vehicles ({owned.length})</h2>
   <p>Register each car for the selected event, then check it in when it arrives.</p>
   <details className="card"><summary>Add car</summary><ActionForm action={saveCar} submit="Save car"><CarFields participant={id}/></ActionForm></details>
   <div className="grid">{owned.map(car=>{
    const reg=registered.find(r=>r.car_id===car.id);
    return <article className="card" key={car.id}>
     <h3>{car.year} {car.make} {car.model}</h3>
     <div className="badge-row"><StatusBadge value={reg?.status??'Not registered'}/>{reg&&<StatusBadge value={reg.payment_status}/>} {reg?.car_number&&<strong>Car #{reg.car_number}</strong>}</div>
     {event&&!event.legacy_source_key?<>
      <VehicleRegistrationForm key={`${car.id}-${reg?.payment_status??'new'}`} event={event.id} year={event.event_year} participant={id} car={car.id} payment={reg?.payment_status??'Unpaid'} registered={!!reg} numbered={!!reg?.car_number}/>
      {reg&&<Link href={`/admin/registrations/${reg.id}`}>Registration details</Link>}
     </>:reg?<div className="actions"><Link className="button secondary" href={`/admin/registrations/${reg.id}`}>View historical registration</Link></div>:<p className="hint">{event?'Not registered for this historical event.':'Select an event to register this car.'}</p>}
     <details className="section-space"><summary>Edit saved vehicle</summary>{car.notes&&<p>{car.notes}</p>}<ActionForm action={saveCar} submit="Save vehicle"><CarFields participant={id} car={car}/></ActionForm><p className="hint">Editing the saved vehicle does not change existing event snapshots.</p></details>
    </article>;
   })}</div>
   {!owned.length&&<EmptyState title="No saved vehicles" description="Use Add car above to get started."/>}
  </section>
  {otherEvents.length>0&&<details className="card section-space"><summary>Registrations in other events</summary>{otherEvents.map(({event:e,rows})=><section key={e.id} className="section-space"><h3>{e.name} · {e.event_year}</h3><div className="grid">{rows.map(r=><RegistrationCard key={r.id} registration={r}/>)}</div></section>)}</details>}
 </StaffShell>;
}
