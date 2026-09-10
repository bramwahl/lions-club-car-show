import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { calculateAwards, type AwardInput } from '../../src/domain/awards';
import { METRICS } from '../../src/domain/scoring';
import { canonical, EVENT_ID, TABLE_ORDER, type Mapped } from './mapping';
import { ROOT, type DB, type Row } from './db';
export async function targetAwards(db:DB) {
  const rows = (await db.query<AwardInput>(`SELECT r.car_id::text, c.legacy_car_id::text, s.legacy_score_id::text,
    r.car_number::text, r.vehicle_year, r.vehicle_make, r.vehicle_model,
    p.name AS participant_name, p.city AS participant_city,
    s.total_score, s.overall_paint, s.overall_interior, s.overall_engine
    FROM public.event_registrations r JOIN public.scores s ON s.event_registration_id=r.id
    JOIN public.participants p ON p.id=r.participant_id JOIN public.cars c ON c.id=r.car_id
    WHERE r.event_id=$1 ORDER BY s.total_score DESC NULLS LAST`,[EVENT_ID])).rows;
  return { input:rows, awards:calculateAwards(rows) };
}
export async function assertFixture(actual:Row[], native=false) {
  const fixture = JSON.parse(await readFile(resolve(ROOT,'docs/car-show-phase0/awards-2025.fixture.json'),'utf8')) as Row[];
  const differences:Row[]=[];
  if (actual.length !== fixture.length) differences.push({field:'row_count',expected:fixture.length,actual:actual.length});
  fixture.forEach((expected,index)=> {
    const row = actual[index]; if (!row) return;
    for (const key of ['award','car_number_display',...METRICS]) {
      if (canonical(row[key])!==canonical(expected[key])) differences.push({rank:index+1,field:key,expected:expected[key],actual:row[key]});
    }
  });
  // Independently maintained CSV has no embedded commas in its ID columns; parse all CSV safely.
  const csv = await readFile(resolve(ROOT,'docs/car-show-phase0/awards-2025-identities.csv'),'utf8');
  const csvRows = parseCsv(csv); const headers = csvRows.shift()!;
  const identities = csvRows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
  for (const f of identities) {
    const r=actual.find(row=>String(row.car_number)===f.public_car_number); if (!r) continue;
    const pairs = native ? {id:'legacy_car_id',year:'year',make:'make',model:'model',participant_name:'participant_name',participant_city:'city'} : {legacy_car_id:'legacy_car_id',legacy_score_id:'legacy_score_id',vehicle_year:'year',vehicle_make:'make',vehicle_model:'model',participant_name:'participant_name',participant_city:'city'};
    for (const [key,column] of Object.entries(pairs)) if (canonical(r[key])!==canonical(f[column])) differences.push({car_number:f.public_car_number,field:key});
  }
  if (differences.length) throw new AwardMismatch(differences);
  return { rows:actual.length, numeric_values:actual.length*4, differences:0 };
}
export class AwardMismatch extends Error {
  constructor(public differences:Row[]) { super('Award regression differs; STOP. No secondary tie key may be added.'); }
}
export function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(value);value='';}
    else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value='';}
    else value+=c;
  }
  if(value||row.length){row.push(value);rows.push(row);} return rows;
}
export async function compareRows(db:DB, mapped:Mapped) {
  for (const table of TABLE_ORDER) {
    const keys=Object.keys(mapped[table][0]);
    const projection=keys.map(k=>k.startsWith('legacy_')&&['legacy_timestamp','legacy_updated_at'].includes(k)?`${k}::text AS ${k}`:k.endsWith('_id')||k==='car_number'||k==='next_car_number'?`${k}::text AS ${k}`:k).join(',');
    const actual=(await db.query(`SELECT ${projection} FROM public.${table}`)).rows;
    if(actual.length!==mapped[table].length) throw new Error(`Target count differs: ${table}`);
    const byId=new Map(actual.map(r=>[r.id,r]));
    for(const row of mapped[table]){
      const got=byId.get(row.id);
      if(!got) throw new Error(`Target missing mapped ID: ${table}/${row.id}`);
      const changed=keys.filter(k=>canonical(row[k])!==canonical(got[k]));
      if(changed.length) throw new Error(`Target changed: ${table}/${row.id} fields ${changed.join(',')}`);
    }
  }
}
export async function validateTarget(db:DB, mapped:Mapped) {
  await compareRows(db,mapped);
  const counts:Row={};
  for (const table of [...TABLE_ORDER,'profiles']) counts[table]=String((await db.query(`SELECT count(*)::text AS n FROM public.${table}`)).rows[0].n);
  const rls=(await db.query(`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])`,[[...TABLE_ORDER,'profiles']])).rows;
  if(rls.length!==7||rls.some(r=>!r.rowsecurity)) throw new Error('RLS gate failed');
  if((await db.query(`SELECT count(*)::text AS n FROM pg_policies WHERE schemaname='public' AND tablename=ANY($1::text[])`,[[...TABLE_ORDER,'profiles']])).rows[0].n!=='0') throw new Error('Unexpected client policies');
  const totals=(await db.query(`SELECT s.legacy_score_id::text, s.total_score, s.overall_paint, s.overall_interior, s.overall_engine FROM public.scores s`)).rows;
  const {calculate,FIELDS}=await import('../../src/domain/scoring');
  for(const row of mapped.scores){
    const got=totals.find(r=>r.legacy_score_id===row.legacy_score_id)!;
    const expected=calculate(Object.fromEntries(FIELDS.map(k=>[k,row[k] as number|null])));
    for(const key of METRICS) if(canonical(got[key])!==canonical(expected[key])) throw new Error(`Generated total differs: ${row.legacy_score_id}/${key}`);
  }
  const aggregates=(await db.query(`SELECT
    count(*) FILTER (WHERE status <> 'Archived')::text AS registered,
    count(*) FILTER (WHERE status IN ('Checked-in','Judged'))::text AS checked_in,
    count(*) FILTER (WHERE status='Judged')::text AS judged,
    count(*) FILTER (WHERE payment_status='Paid')::text AS paid,
    sum(lions_choice_votes)::text AS lions_choice_votes,
    count(*) FILTER (WHERE legacy_car_id <> car_number)::text AS id_number_differences
    FROM public.event_registrations WHERE event_id=$1`,[EVENT_ID])).rows[0];
  const expected={registered:'74',checked_in:'70',judged:'70',paid:'73',lions_choice_votes:'2',id_number_differences:'88'};
  if(canonical(aggregates)!==canonical(expected)) throw new Error('Dashboard/source aggregate mismatch');
  const statuses=(await db.query("SELECT status,count(*)::text AS n FROM public.event_registrations GROUP BY status")).rows;
  const payments=(await db.query("SELECT payment_status,count(*)::text AS n FROM public.event_registrations GROUP BY payment_status")).rows;
  const sections=(await db.query("SELECT section,count(*)::text AS n FROM public.score_history GROUP BY section")).rows;
  const duplicates=(await db.query("SELECT count(*)::text AS n FROM (SELECT email FROM public.participants GROUP BY email HAVING count(*)>1) x")).rows[0].n;
  const repeats=(await db.query("SELECT count(*)::text AS n FROM (SELECT score_id,section FROM public.score_history GROUP BY score_id,section HAVING count(*)>1) x")).rows[0].n;
  const partial=(await db.query(`SELECT c.legacy_car_id::text, r.status, s.progress_percentage::text, s.total_score
    FROM public.scores s JOIN public.event_registrations r ON r.id=s.event_registration_id
    JOIN public.cars c ON c.id=r.car_id WHERE s.legacy_score_id=19`)).rows[0];
  const sourceAudit=JSON.parse(await readFile(resolve(ROOT,'docs/car-show-phase0/data-audit.json'),'utf8'));
  if(canonical(Object.fromEntries(statuses.map(r=>[r.status,r.n])))!==canonical(sourceAudit.statuses)) throw new Error('Status counts differ');
  if(canonical(Object.fromEntries(payments.map(r=>[r.payment_status,r.n])))!==canonical(sourceAudit.paid)) throw new Error('Payment counts differ');
  if(canonical(Object.fromEntries(sections.map(r=>[r.section,r.n])))!==canonical(sourceAudit.history_sections)) throw new Error('History section counts differ');
  if(String(duplicates)!==String(sourceAudit.duplicate_email_groups)||String(repeats)!==String(sourceAudit.history_repeated_section_groups)) throw new Error('Duplicates/repeated history differ');
  if(canonical(partial)!==canonical({legacy_car_id:'48',status:'Archived',progress_percentage:'29.41',total_score:null})) throw new Error('Partial archived score differs');
  const awards=await targetAwards(db);
  const fixture=await assertFixture(awards.awards);
  return {counts,aggregates,statuses,payments,history_sections:sections,duplicate_email_groups:duplicates,repeated_section_groups:repeats,partial_archived:partial,fixture,rls_tables:rls.length};
}
