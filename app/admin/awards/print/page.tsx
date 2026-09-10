import { ReportFooter } from '../../../components/report-footer';
import { reportTitle } from '../../../../src/workflows/report-title';
import { choiceConfirmation } from '../../../../src/workflows/award-results';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireStaff } from '../../../../src/auth/session';
import { eventContext,awardsFor,registrations } from '../../../../src/workflows/data';
import { statistics } from '../../../../src/workflows/types';
import { LionsLogo } from '../../../components/lions-logo';
import { PrintButton } from '../../../components/print-button';
const group=(award:string)=>award.split(':')[0];
export default async function AwardPrint({searchParams}:{searchParams:Promise<{event?:string}>}){
 const {client}=await requireStaff(true);const {events}=await eventContext(client);const query=await searchParams;const event=events.find(e=>e.id===query.event);if(!event)notFound();
 const [awards,rows]=await Promise.all([awardsFor(client,event.id),registrations(client,event.id)]);const choice=await choiceConfirmation(client,event.id);const lionsWinner=rows.find(r=>r.id===choice.winner?.registration_id);const stats=statistics(rows);const states=new Map(rows.map(r=>[r.car_id,r.participant.state]));
 return <main className="announcer-page"><div className="actions announcer-toolbar no-print"><Link className="button secondary" href="/admin/awards"><ArrowLeft size={18} aria-hidden="true"/>Awards</Link><PrintButton title={reportTitle(event.name,'Winner Summary')}/><p>Reload this page to capture the latest results before printing.</p></div><header className="announcer-heading"><LionsLogo/><h1>{event.event_year} {event.name} Award Summary</h1></header><p className="announcer-meta">{event.legacy_source_key?'Historical legacy snapshot':`Current results · ${stats.judged} judged / ${stats.checked} checked in · Provisional until judging is finalized`} · Generated {new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Indiana/Indianapolis'}).format(new Date())} Eastern</p><table className="announcer-table"><thead><tr>{['Award','Car #','Participant','City','State','Car'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{awards.map((r,i)=><tr key={`${r.award}-${r.car_id}`} className={i===0||group(r.award)!==group(awards[i-1].award)?'award-group-start':''}><td>{r.award}</td><td>{r.car_number_display}</td><td>{r.participant_name}</td><td>{r.participant_city}</td><td>{states.get(r.car_id)??'—'}</td><td>{r.vehicle_year} {r.vehicle_make} {r.vehicle_model}</td></tr>)}{lionsWinner&&<tr className="award-group-start"><td>Lions Choice</td><td>{lionsWinner.car_number}</td><td>{lionsWinner.participant.name}</td><td>{lionsWinner.participant.city}</td><td>{lionsWinner.participant.state}</td><td>{lionsWinner.vehicle_year} {lionsWinner.vehicle_make} {lionsWinner.vehicle_model}</td></tr>}</tbody></table>{!awards.length&&<p>No scores submitted.</p>}<p className="announcer-meta">* Equal category score among remaining eligible cars. No secondary tie-breaker. Only a manually confirmed Lions Choice winner is included.</p><ReportFooter/></main>;
}
