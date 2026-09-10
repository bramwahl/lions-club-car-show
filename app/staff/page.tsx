import Link from 'next/link';
import { requireStaff } from '../../src/auth/session';
import { StaffShell } from '../components/staff-shell';
export default async function Staff() {
  const {user,profile}=await requireStaff();
  return <StaffShell role={profile.app_role} name={profile.display_name}><h1>Your workspace.</h1><p>Signed in as {user.email}</p><div className="grid"><Link className="card nav-card" href="/judge"><h2>Judging</h2><p>View the active event and your judging access.</p></Link>{profile.app_role==='admin'&&<Link className="card nav-card" href="/admin/users"><h2>Staff accounts</h2><p>Create accounts and manage Judge and Admin access.</p></Link>}</div></StaffShell>;
}
