import { PageHeader } from '../../components/ui';
import { requireStaff } from '../../../src/auth/session';
import { StaffShell } from '../../components/staff-shell';
import { AccountForm, CreateAccountForm, type Account } from './forms';
export default async function Accounts() {
  const {client,profile}=await requireStaff(true);
  const {data,error}=await client.rpc('admin_accounts');
  return <StaffShell role={profile.app_role} name={profile.display_name}><PageHeader title={`Staff accounts.`}/><p>Manage who can judge and administer the show. Deactivation blocks application access, including existing sessions.</p><div className="accounts-grid"><section className="card"><h2>Create an account</h2><CreateAccountForm/></section><section className="card"><h2>Current accounts</h2>{error?<p role="alert">Accounts could not be loaded. Please try again.</p>:(data as Account[]??[]).map(account=><AccountForm key={account.id+account.app_role+account.is_active+account.display_name} account={account}/>)}</section></div></StaffShell>;
}
