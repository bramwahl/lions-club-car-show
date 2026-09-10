import { PageHeader } from '../../components/ui';
import { requireStaff } from '../../../src/auth/session';
import { eventContext } from '../../../src/workflows/data';
import { awardResults } from '../../../src/workflows/award-results';
import { StaffShell } from '../../components/staff-shell';
import { EventPicker,Historical } from '../../components/workflow';
import Link from 'next/link';
import { LiveResults } from './live-results';
export default async function Awards(){const {client,profile}=await requireStaff(true);const {events,event}=await eventContext(client);const results=event?await awardResults(client,event.id):null;return <StaffShell role={profile.app_role} name={profile.display_name}><div className="awards-page"><PageHeader title={`Awards / Results`}/><EventPicker events={events} event={event}/>{event&&<><h2>{event.name} · {event.event_year}</h2><Historical event={event}/><Link className="button" href={`/admin/awards/print?event=${event.id}`}>PDF Summary</Link> <Link className="button secondary" href={`/admin/scores/print?event=${event.id}`}>Full Score PDF</Link><LiveResults key={event.id} event={event.id} historical={Boolean(event.legacy_source_key)} initial={results!}/></>}</div></StaffShell>;}
