'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {Award} from '../../../src/domain/awards';
type Skip={event:string;car_id:string;award:string};
export function LocalSkips({event,awards}:{event:string;awards:Award[]}){
 const router=useRouter();const [selected,setSelected]=useState('');
 const [skips,setSkips]=useState<Skip[]>([]);
 function read():Skip[]{try{return JSON.parse(decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('local-award-skips='))?.split('=').slice(1).join('=')??'[]'));}catch{return [];}}
 function save(next:Skip[]){document.cookie='local-award-skips='+encodeURIComponent(JSON.stringify(next))+'; Path=/; SameSite=Strict; Max-Age=604800';setSkips(next);router.refresh();}
 return <section className="card section-space"><h2>Local award preview</h2><p>Skip a car for one award only. It remains eligible for lower awards. Scores and live results stay unchanged.</p><div className="filters"><label>Current winner to skip<select value={selected} onFocus={()=>setSkips(read())} onChange={e=>setSelected(e.target.value)}><option value="">Choose an award / car</option>{awards.filter(a=>!a.award.startsWith('Top 40')).map(a=><option key={a.award} value={JSON.stringify({event,car_id:a.car_id,award:a.award})}>{a.award} — #{a.car_number} {a.vehicle_make} {a.vehicle_model}</option>)}</select></label><button disabled={!selected} onClick={()=>{save([...read(),JSON.parse(selected)]);setSelected('');}}>Skip for this award</button><button className="secondary" onClick={()=>save(read().filter(s=>s.event!==event))}>Reset local award skips</button></div>{skips.filter(s=>s.event===event).map(s=><p key={s.car_id+s.award}>{s.award} — car {awards.find(a=>a.car_id===s.car_id)?.car_number??s.car_id} <button className="secondary" onClick={()=>save(read().filter(v=>!(v.event===event&&v.car_id===s.car_id&&v.award===s.award)))}>Undo skip</button></p>)}</section>;
}
