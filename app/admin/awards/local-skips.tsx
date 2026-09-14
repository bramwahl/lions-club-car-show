'use client';
import {ArrowDown,ArrowUp} from 'lucide-react';
export type Adjustment={car_id:string;award:string;number:string|null;vehicle:string;result:string|null};
type Skip={event:string;car_id:string;award:string};
function change(event:string,car_id:string,award:string,undo=false){
 let stored:Skip[]=[];
 try{const value=JSON.parse(decodeURIComponent(document.cookie.split('; ').find(c=>c.startsWith('local-award-skips='))?.split('=').slice(1).join('=')??'[]'));if(Array.isArray(value))stored=value;}catch{}
 const next=stored.filter(s=>!(s.event===event&&s.car_id===car_id&&s.award===award));
 if(!undo)next.push({event,car_id,award});
 document.cookie='local-award-skips='+encodeURIComponent(JSON.stringify(next))+'; Path=/; SameSite=Strict; Max-Age=604800';
 window.location.reload();
}
export function BumpButton({event,car,award}:{event:string;car:string;award:string}){
 return <button type="button" className="secondary" onClick={()=>change(event,car,award)}><ArrowDown size={16}/>bump</button>;
}
export function BumpIndicator({event,adjustment}:{event:string;adjustment:Adjustment}){
 return <span className="award-indicator bump-indicator"><ArrowDown size={16}/>Bumped from {adjustment.award}<button type="button" className="secondary" onClick={()=>change(event,adjustment.car_id,adjustment.award,true)}><ArrowUp size={14}/>Undo</button></span>;
}
export function LocalSkips({event,adjustments}:{event:string;adjustments:Adjustment[]}){
 return <section className="card section-space"><h2>Award adjustments</h2><p>Local preview: bumps skip only the selected award. The car remains eligible for lower awards. Scores and live results are unchanged.</p>{adjustments.length?<ul className="adjustment-summary">{adjustments.map(a=><li key={a.car_id+a.award}><div className="adjustment-car"><strong>#{a.number??'—'} · {a.vehicle}</strong></div><div className="adjustment-move"><p className="adjustment-transition">{a.award} → {a.result??'No award currently available'}</p><button type="button" className="secondary" onClick={()=>change(event,a.car_id,a.award,true)}><ArrowUp size={14}/>Undo</button></div></li>)}</ul>:<p>No awards have been bumped.</p>}</section>;
}
