import { reportTitle } from '../../../../src/workflows/report-title';
import { notFound } from 'next/navigation';
import { requireStaff } from '../../../../src/auth/session';
import { eventContext,registrations } from '../../../../src/workflows/data';
import { FullScoreReport } from './report';
export default async function ScorePrint({searchParams}:{searchParams:Promise<{event?:string}>}){
 const {client}=await requireStaff(true);const {events}=await eventContext(client);const query=await searchParams;const event=events.find(e=>e.id===query.event);if(!event)notFound();const rows=await registrations(client,event.id);
 const ids=rows.flatMap(r=>r.score?[r.score.id]:[]);const names=new Set<string>();
 for(let start=0;start<ids.length;start+=100){for(let offset=0;;offset+=500){const {data,error}=await client.from('score_history').select('judge_name_snapshot').in('score_id',ids.slice(start,start+100)).eq('action_type','section_submission').order('id').range(offset,offset+499);if(error)throw new Error('Judge attribution could not be loaded.');for(const r of data)names.add(r.judge_name_snapshot||'Unattributed submission');if(data.length<500)break;}}
 return <FullScoreReport filename={reportTitle(event.name,'Full Score Report')} event={event} rows={rows} judges={[...names].sort((a,b)=>a.localeCompare(b))} generated={new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Indiana/Indianapolis'}).format(new Date())}/>;
}
