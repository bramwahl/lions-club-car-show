import { PageHeader } from '../../components/ui';
import { requireStaff } from '../../../src/auth/session';
import { eventContext,awardsFor,registrations } from '../../../src/workflows/data';
import { statistics } from '../../../src/workflows/types';
import { StaffShell } from '../../components/staff-shell';
import { EventPicker,Historical } from '../../components/workflow';
import Link from 'next/link';
import { LiveResults } from './live-results';
export default async function Awards(){const {client,profile}=await requireStaff(true);const {events,event}=await eventContext(client);const rows=event?await registrations(client,event.id):[];const awards=event?await awardsFor(client,event.id):[];return <StaffShell role={profile.app_role} name={profile.display_name}><div className="awards-page"><PageHeader title={`Awards / Results`}/><EventPicker events={events} event={event}/>{event&&<><h2>{event.name} · {event.event_year}</h2><Historical event={event}/><Link className="button" href={`/admin/awards/print?event=${event.id}`}>Announcer table / PDF</Link><LiveResults key={event.id} event={event.id} historical={Boolean(event.legacy_source_key)} initial={{awards,stats:statistics(rows),lions:rows.filter(r=>r.lions_choice_votes>0).sort((a,b)=>b.lions_choice_votes-a.lions_choice_votes).map(r=>({number:r.car_number,vehicle:`${r.vehicle_year} ${r.vehicle_make} ${r.vehicle_model}`,votes:r.lions_choice_votes})),updated:new Date().toISOString()}}/></>}</div></StaffShell>;}
