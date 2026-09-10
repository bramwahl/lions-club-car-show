import { ArrowRight } from 'lucide-react';
import { LionsLogo } from './components/lions-logo';
import Link from 'next/link';
export default function Home() {
  return <><header className="site-header"><Link href="/" className="brand"><LionsLogo/><div>Lions Club <span>Dream Car Show</span></div></Link><Link className="button secondary" href="/sign-in">Staff sign in</Link></header><main className="container hero"><p className="eyebrow">Zionsville, Indiana</p><h1>A shared love<br/>of great cars.</h1><p className="lead">Welcome to the Lions Club Dream Car Show.</p><div className="card welcome"><h2>Here for the show?</h2><p>Event details and public registration will be available here when they open.</p><p>Judges and administrators can sign in to their staff workspace.</p><Link className="button" href="/sign-in">Go to staff sign in <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true"/></Link></div></main><footer>Lions Club · Dream Car Show</footer></>;
}
