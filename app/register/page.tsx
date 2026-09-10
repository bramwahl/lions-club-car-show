import Link from 'next/link';
import { LionsLogo } from '../components/lions-logo';
import { ReportFooter } from '../components/report-footer';
import { portal } from '../../src/workflows/public-registration';
import { RegistrationForm } from './registration-form';
export const dynamic='force-dynamic';
export default async function Register(){const event=await portal('event');return <div className="home-page"><header className="site-header"><Link href="/" className="brand"><LionsLogo/><div>Zionsville Lions Club<span>American Dream Car Show</span></div></Link><Link href="/sign-in">Staff sign in</Link></header><main className="container public-registration"><h1>Register your car</h1>{event.error?<p>{event.error}</p>:<><h2>{event.name}</h2><p>Pre-register here, then visit the check-in table when you arrive. Staff will collect payment if needed and assign your car number at check-in.</p><RegistrationForm eventId={event.id}/></>}</main><div className="home-footer"><p><a href="https://www.zionsvillelions.com/">Zionsville Lions Club</a> · American Dream Car Show</p><ReportFooter/></div></div>}
