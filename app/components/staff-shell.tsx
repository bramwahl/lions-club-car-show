import { LionsLogo } from './lions-logo';
import Link from 'next/link';
import { signOut } from '../actions';
import type { AppRole } from '../../src/auth/accounts';
import { requireStaff } from '../../src/auth/session';
import { eventContext } from '../../src/workflows/data';
import { AppNavigation } from './app-navigation';
import { StatusBadge } from './ui';
export async function StaffShell({role,name,children,eventOverride}:{role:AppRole;name:string;children:React.ReactNode;eventOverride?:{name:string;event_year:number;legacy_source_key:string|null;judging_open:boolean}}) {
 const links=role==='admin'?[['Dashboard','/admin'],['Participants','/admin/participants'],['Registrations','/admin/registrations'],['Scores','/admin/scores'],['Awards','/admin/awards'],['Events','/admin/events'],['Users','/admin/users']]:[['Judging','/judge']];
 const event=eventOverride??(role==='admin'?(await eventContext((await requireStaff(true)).client)).event:null);
 return <div className={`app-shell ${role==='judge'?'judge-shell':''}`}><aside className="app-sidebar"><Link href={role==='admin'?'/admin':'/judge'} className="brand"><LionsLogo/><div>Lions Club <span>Dream Car Show</span></div></Link><AppNavigation links={links}/><div className="sidebar-account"><span className="avatar">{name.slice(0,1).toUpperCase()}</span><div><strong>{name}</strong><small>{role==='admin'?'Administrator':'Judge'}</small></div><form action={signOut}><button className="text-button">Sign out</button></form></div></aside><div className="app-body"><header className="app-topbar"><span>{role==='admin'?'Event workspace':'Judging workspace'}</span>{event&&<Link href="/admin/events" className="current-event"><strong>{event.name} · {event.event_year}</strong><StatusBadge value={event.legacy_source_key?'Historical/completed':event.judging_open?'Active/current':'Judging closed'}/></Link>}</header><main className="container workspace">{children}</main></div></div>;
}
