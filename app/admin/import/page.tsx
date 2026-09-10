import { PageHeader } from '../../components/ui';
import { requireStaff } from '../../../src/auth/session';
import { eventContext } from '../../../src/workflows/data';
import { StaffShell } from '../../components/staff-shell';
import { EventPicker,Historical } from '../../components/workflow';
import { ImportForm } from './import-form';
export default async function Import(){const {client,profile}=await requireStaff(true);const {events,event}=await eventContext(client);return <StaffShell role={profile.app_role} name={profile.display_name}><PageHeader title={`Import participants / cars`}/><EventPicker events={events} event={event}/>{event&&<Historical event={event}/>}<section className="card">{event&&!event.legacy_source_key?<ImportForm key={event.id} event={event.id}/>:<p>Select or create a new event before importing. The 2025 snapshot cannot be changed.</p>}</section></StaffShell>;}
