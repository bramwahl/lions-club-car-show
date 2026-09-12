import { LionsLogo } from '../components/lions-logo';
import Link from 'next/link';
import { SignInForm } from './form';
export default async function SignIn({searchParams}:{searchParams:Promise<{access?:string;next?:string}>}) {
  const {access,next}=await searchParams;
  return <main className="auth-container"><Link className="brand" href="/"><LionsLogo/><div>Zionsville Lions Club<span>American Dream Car Show</span></div></Link><section className="card"><p className="eyebrow">Staff access</p><h1>Welcome back.</h1><p>Sign in with the account provided by your administrator.</p>{access==='inactive'&&<p role="alert">Application access is unavailable. Contact an administrator.</p>}<SignInForm next={next}/></section><Link href="/">Back to the car show</Link></main>;
}
