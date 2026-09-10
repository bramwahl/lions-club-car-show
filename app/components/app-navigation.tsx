'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
export function AppNavigation({links}:{links:string[][]}){const path=usePathname();const [open,setOpen]=useState(false);return <><button type="button" className="mobile-menu secondary" aria-expanded={open} aria-controls="staff-navigation" onClick={()=>setOpen(!open)}>{open?'Close menu':'Menu'}</button><nav id="staff-navigation" aria-label="Staff navigation" className={open?'is-open':''}>{links.map(([title,url],i)=><Link key={url} href={url} aria-current={(url==='/admin'?path===url:path.startsWith(url))?'page':undefined} onClick={()=>setOpen(false)}><span className="nav-symbol" aria-hidden="true">{['◫','◉','▱','▤','◇','▦','◎'][i]}</span>{title}</Link>)}</nav></>;}
