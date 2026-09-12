import { PageHeader } from '../../components/ui';
import { requireStaff } from '../../../src/auth/session';
import { StaffShell } from '../../components/staff-shell';
import { AccountsTable, type Account } from './forms';
export default async function Accounts() {
  const {client,profile}=await requireStaff(true);
  const {data,error}=await client.rpc('admin_accounts');
  return <StaffShell role={profile.app_role} name={profile.display_name}><PageHeader title={`Staff accounts.`}/><p>Manage who can judge and administer the show. Deactivation blocks application access, including existing sessions.</p>{error?<p role="alert">Accounts could not be loaded. Please try again.</p>:<AccountsTable accounts={data as Account[]??[]}/>}</StaffShell>;
}
