import Link from 'next/link';
import { sectionLabels } from '../../src/workflows/types';
import type { dashboardInsights } from '../../src/workflows/dashboard';
type Insights=ReturnType<typeof dashboardInsights>;
function Pie({title,count,total,detail,href,action,note}:{title:string;count:number;total:number;detail:string;href:string;action:string;note?:React.ReactNode}){
 const percent=total?count/total*100:0;
 const progress=Math.min(1,Math.max(0,percent/100));
 const point=(fraction:number,radius=59.5)=>[Number((64+radius*Math.sin(fraction*Math.PI*2)).toFixed(4)),Number((64-radius*Math.cos(fraction*Math.PI*2)).toFixed(4))];
 const color=(fraction:number)=>{
 const start=fraction<=.5?[255,91,53]:[235,183,0],end=fraction<=.5?[235,183,0]:[0,171,104];
 const t=fraction<=.5?fraction*2:(fraction-.5)*2;
 return 'rgb('+start.map((v,i)=>Math.round(v+(end[i]-v)*t)).join(',')+')';
 };
 const pieces=Array.from({length:Math.ceil(progress*180)},(_,i)=>{
 const from=i/180,to=Math.min(progress,(i+1)/180+.0001);
 return <path key={i} d={`M ${point(from,64).join(' ')} A 64 64 0 0 1 ${point(to,64).join(' ')} L ${point(to,55).join(' ')} A 55 55 0 0 0 ${point(from,55).join(' ')} Z`} fill={color((from+to)/2)}/>;
 });
 return <section className="card dashboard-chart"><h2>{title}</h2><div className="dashboard-chart-body"><div className="dashboard-donut" role="img" aria-label={total?`${count} of ${total}, ${percent.toFixed(1)}%`:'No cars yet'}><svg className="dashboard-donut-svg" viewBox="0 0 128 128" aria-hidden="true"><path fill="#e7ebf3" fillRule="evenodd" d="M 64 0 A 64 64 0 1 1 64 128 A 64 64 0 1 1 64 0 Z M 64 9 A 55 55 0 1 0 64 119 A 55 55 0 1 0 64 9 Z"/>{pieces}{progress>0&&progress<1&&<><circle cx="64" cy="4.5" r="4.5" fill="#ff5b35"/><circle cx={point(progress)[0]} cy={point(progress)[1]} r="4.5" fill={color(progress)}/></>}</svg><span>{total?`${Math.round(percent)}%`:'—'}</span></div><div><strong>{count} <small>of {total} cars</small></strong><p>{detail}</p></div></div>{note&&<p className="chart-report-note">{note}</p>}<Link className="button secondary chart-action" href={href}>{action}</Link></section>;
}
function Ranking({title,heading,rows}:{title:string;heading:string;rows:Insights['makes']}){return <section className="card"><h2>{title}</h2><p className="hint">Share of registered cars in this event</p><div className="dashboard-ranking"><table><thead><tr><th>{heading}</th><th>Cars</th><th>% of total</th></tr></thead><tbody>{rows.map(row=><tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{row.percent.toFixed(1)}%</td></tr>)}</tbody></table>{!rows.length&&<p>No registered cars yet.</p>}</div></section>;}
export function DashboardInsights({data,attendance,report=false,section='all',missingSectionsWidget,reportJudging,reportPayments}:{data:Insights;reportPayments?:{prepaidNoShows:number;unpaidAttendees:number};reportJudging?:{count:number;total:number;left:number};missingSectionsWidget?:React.ReactNode;report?:boolean;section?:'all'|'charts'|'comparisons';attendance:{year:number;previousYear:number|null;previousCount:number|null}}){return <>
 {section!=='comparisons'&&<div className={report?"dashboard-charts report-charts":"dashboard-charts"}><Pie href="/admin/registrations?status=Registered" action="View Registrations" title="Checked-In" count={data.checked} total={data.total} detail="Arrived, including judged cars" note={report?<><strong>{data.total-data.checked}</strong> registered cars did not attend.</>:undefined}/><Pie href="/admin/registrations?paid=Unpaid&status=attending" action="View Unpaid" title="Paid" count={data.paid} total={data.checked} detail="Checked-in cars marked Paid" note={reportPayments?<><strong>{reportPayments.prepaidNoShows}</strong> registered cars paid but did not attend.<br/><strong>{reportPayments.unpaidAttendees}</strong> checked-in cars did not pay.</>:undefined}/><Pie href="/admin/registrations?status=Checked-in" action="View Un-judged" title="Judged" count={reportJudging?.count??data.judgingCompleted} total={reportJudging?.total??data.judgingEligible} detail={reportJudging?'Judged / checked-in cars':data.leftCount?'Judging completed; Left Show cars excluded':'Judging completed'} note={reportJudging?<><strong>{reportJudging.left}</strong> cars left the show.</>:undefined}/></div>}
 {!report&&<><JudgingCompletion data={data.judging}/>{missingSectionsWidget}</>}
 {section!=='charts'&&<><Attendance current={data.checked} {...attendance}/>
 <section className="card section-space"><h2>New & returning cars</h2>{data.newCars===null?<p>No earlier event baseline is available to identify new or returning cars.</p>:<><div className="dashboard-car-mix"><div><strong>{data.newCars}</strong><span>New cars</span></div><div><strong>{data.returning}</strong><span>Returning cars</span></div><div><strong>{data.total?`${(data.newCars/data.total*100).toFixed(1)}%`:'—'}</strong><span>New cars / registered cars</span></div></div><p className="hint">Returning means this car appears in an earlier event record, including the 2025 legacy snapshot. This does not establish prior attendance. New means no earlier event record exists.</p></>}</section>
 </>}{!report&&<><div className="dashboard-tables"><Ranking title="Top 7 locations" heading="City, State" rows={data.locations}/><Ranking title="Top 7 car makes" heading="Make" rows={data.makes}/></div><p className="hint dashboard-disclaimer">Charts and tables exclude archived and unclassified registrations. Locations use current participant details; makes use event vehicle snapshots. Each car counts once, including multiple cars from one participant.</p></>}
 </>;}

function Attendance({current,year,previousYear,previousCount}:{current:number;year:number;previousYear:number|null;previousCount:number|null}) {
 const change=previousCount?((current-previousCount)/previousCount*100):null;
 const capacity=Math.max((previousCount??0)*1.5,current,1);
 const fill=current/capacity*100;
 const benchmark=(previousCount??0)/capacity*100;
 return <section className="card section-space attendance-summary"><h2>Attendance compared with last year</h2><div className="dashboard-car-mix"><div><strong>{current}</strong><span>{year} attending</span></div><div><strong>{previousCount??'—'}</strong><span>{previousYear?`${previousYear} attended`:'No previous-year baseline'}</span></div><div><strong>{change===null?'—':`${change>0?'+':''}${change.toFixed(1)}%`}</strong><span>{change===null?'Change unavailable':change>0?'Increase':change<0?'Below last year':'No change'}</span></div></div>{previousCount!==null&&previousCount>0&&<div className="attendance-meter" role="img" aria-label={`${current} attendees so far; last year’s benchmark is ${previousCount}.`}><div className="attendance-meter-track"><div className="attendance-meter-fill" style={{width:`${fill}%`,background:`linear-gradient(to right, #ff5b35 0%, #ebb700 ${current?previousCount/current*50:50}%, #00ab68 ${current?previousCount/current*100:100}%)`}}/></div><span className="attendance-meter-tick" style={{left:`${benchmark}%`}}/><span className="attendance-meter-label" style={{left:`${benchmark}%`}}>Last year: {previousCount}</span></div>}<p className="hint">Attending means Checked-in or Judged; pre-registered and Archived cars are excluded. The marker shows last year’s recorded attendance. Refresh to update the current count. Only the validated historical event is used as a baseline.</p></section>;
}


function JudgingCompletion({data}:{data:Insights['judging']}) {
 function bar(label:string,complete:number,total:number,overall=false){
 const percent=total?complete/total*100:0;
 return <div className={overall?'judging-completion-total':'judging-completion-section'} key={label}>
 <div className="judging-completion-label"><span>{label}</span><strong>{percent.toFixed(1)}%</strong></div>
 <div className="judging-completion-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(percent.toFixed(1))} aria-valuetext={`${complete} of ${total} criteria completed`}><div style={{width:`${percent}%`,background:`linear-gradient(to right, #ff5b35 0%, #ebb700 ${percent?5000/percent:50}%, #00ab68 ${percent?10000/percent:100}%)`}}/></div>
 <small>{complete} of {total} criteria completed</small></div>;
 }
 return <section className="card section-space judging-completion"><h2>Overall judging progress</h2>
 {bar('All judging criteria',data.complete,data.total,true)}
 <div className="judging-completion-sections">{data.sections.map(s=>bar(sectionLabels[s.section as keyof typeof sectionLabels],s.complete,s.total))}</div>
 <p className="hint">Counts completed criteria for attending cars still eligible for judging; Left Show cars are excluded. Zero scores count as complete. Refresh to update.</p></section>;
}
