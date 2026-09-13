import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { LionsLogo } from './components/lions-logo';
import { ReportFooter } from './components/report-footer';
import Link from 'next/link';
export default function Home() {
 return <div className="home-page"><header className="site-header"><Link href="/" className="brand"><LionsLogo/><div>Zionsville Lions Club <span>American Dream Car Show</span></div></Link><Link className="button secondary" href="/sign-in">Staff sign in</Link></header>
 <main className="home-hero"><Image src="/images/2025-best-in-show.jpeg" alt="White classic Corvette on display at the 2025 Dream Car Show" fill preload sizes="100vw" className="home-hero-photo"/><div className="home-hero-shade"/><div className="home-hero-content"><p className="eyebrow">Zionsville Lions Club · Zionsville, Indiana</p><h1>A shared love<br/>of great cars.</h1><p className="home-hero-lead">American Dream Car Show</p><p className="home-hero-description">A Fall Festival tradition at Lion&apos;s Park.</p><div className="home-hero-actions"><Link className="button home-hero-action" href="/register">Register Your Car <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true"/></Link><a className="button home-hero-action home-festival-action" href="https://www.zionsvillelions.com/fallfestival">Fall Festival information <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true"/></a></div><p className="home-hero-help">Here with your car? Scan your car sheet’s QR code to see judging progress.</p></div><aside className="home-winner-caption"><span>2025 Best in Show</span><strong>Warren Mockler</strong><p>1959 Chevy Corvette</p></aside></main>
 <div className="home-footer"><p><a href="https://www.zionsvillelions.com/">Zionsville Lions Club</a> · American Dream Car Show</p><ReportFooter/></div></div>;
}
