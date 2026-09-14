import {localLeftIds} from '../../../src/workflows/local-exclusions';
import { RegistrationTable } from './registration-table';
import { PageHeader } from '../../components/ui';
import Link from 'next/link';
import { requireStaff } from '../../../src/auth/session';
import { eventContext,registrations,rpc } from '../../../src/workflows/data';
import { StaffShell } from '../../components/staff-shell';
import { EventPicker,Historical } from '../../components/workflow';
export default async function Registrations({searchParams}:{searchParams:Promise<{q?:string;status?:string;paid?:string}>}){const {client,profile}=await requireStaff(true);const {events,event}=await eventContext(client);const p=await searchParams;const [rows,inbox]=await Promise.all([event?registrations(client,event.id):Promise.resolve([]),rpc<{requests:unknown[]}>(client,'admin_registration_requests')]);const pendingCount=inbox.requests.length;
 return <StaffShell role={profile.app_role} name={profile.display_name}><PageHeader title={`Registrations / Cars`} actions={<Link className="button secondary registration-requests-link" href="/admin/registration-requests">Registration Requests{pendingCount>0&&<span className="request-count" aria-label={`${pendingCount} pending requests`}>{pendingCount}</span>}</Link>}/><EventPicker events={events} event={event}/>{event&&<Historical event={event}/>}<div className="actions"><Link className="button" href="/admin/participants">Find participant / walk-in</Link><Link className="button secondary" href="/admin/import">Import CSV</Link></div><RegistrationTable key={event?.id??'none'} historical={!!event?.legacy_source_key} initial={p} localPreview={process.env.NODE_ENV==='development'} leftIds={await localLeftIds()} rows={rows.map(r=>({id:r.id,car_id:r.car_id,participant_id:r.participant_id,car_number:r.car_number,vehicle_year:r.vehicle_year,vehicle_make:r.vehicle_make,vehicle_model:r.vehicle_model,vehicle_color:r.vehicle_color,status:r.status,payment_status:r.payment_status,score:r.score,participant:{name:r.participant.name}}))}/></StaffShell>;
}
