'use client';
import Link from 'next/link';
import { LayoutDashboard, Users, CarFront, ClipboardList, Trophy, CalendarDays, UserCog, type LucideIcon } from 'lucide-react';
const icons:Record<string,LucideIcon>={'/admin':LayoutDashboard,'/admin/participants':Users,'/admin/registrations':CarFront,'/admin/scores':ClipboardList,'/admin/awards':Trophy,'/admin/events':CalendarDays,'/admin/users':UserCog,'/judge':ClipboardList};
import { usePathname } from 'next/navigation';
import { useState } from 'react';
export function AppNavigation({links}:{links:string[][]}){const path=usePathname();const [open,setOpen]=useState(false);return <><button type="button" className="mobile-menu secondary" aria-expanded={open} aria-controls="staff-navigation" onClick={()=>setOpen(!open)}>{open?'Close menu':'Menu'}</button><nav id="staff-navigation" aria-label="Staff navigation" className={open?'is-open':''}>{links.map(([title,url])=>{const Icon=icons[url]??ClipboardList;return <Link key={url} href={url} aria-current={(url==='/admin'?path===url:path.startsWith(url))?'page':undefined} onClick={()=>setOpen(false)}><Icon className="nav-icon" size={22} strokeWidth={1.75} aria-hidden="true"/>{title}</Link>;})}</nav></>;}
