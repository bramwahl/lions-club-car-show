import { createHash } from 'node:crypto';
import { calculate, FIELDS, METRICS } from '../../src/domain/scoring';
import type { Source } from './source';
import type { Row } from './db';
const NAMESPACE = '53c92e16-e9e8-5b74-899b-b56a3f12c660';
export const MAPPING_VERSION = 'qkby-2025-v1-d1-d10';
export const TABLE_ORDER = ['events','participants','cars','event_registrations','scores','score_history'] as const;
export type Mapped = Record<typeof TABLE_ORDER[number], Row[]>;
export function legacyId(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('Legacy identity must be canonical decimal text');
  return value;
}
export function uuid(name: string) {
  const digest = createHash('sha1').update(Buffer.from(NAMESPACE.replaceAll('-',''),'hex')).update(name,'utf8').digest().subarray(0,16);
  digest[6] = (digest[6] & 0x0f) | 0x50; digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString('hex'); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const entityId = (type:string, id:unknown) => uuid(`qkby:${type}:${legacyId(id)}`);
export const EVENT_ID = uuid('qkby:event:2025');
export function canonical(value:unknown):string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (typeof value === 'object') return '{'+Object.entries(value as Row).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(String(value));
}
export function mapSource(source:Source):Mapped {
  const ensureUnique = (rows:Row[], key:string) => {
    if (new Set(rows.map(r=>legacyId(r[key]))).size !== rows.length) throw new Error('Duplicate legacy identity');
  };
  for (const [key,rows] of Object.entries(source)) ensureUnique(rows,key==='judges'?'ID':'id');
  ensureUnique(source.cars,'car_number'); ensureUnique(source.scores,'car_id');
  const people = new Set(source.participants.map(r=>r.id));
  const cars = new Map(source.cars.map(r=>[r.id,r]));
  const scores = new Map(source.scores.map(r=>[r.id,r]));
  const byCar = new Map(source.scores.map(r=>[r.car_id,r]));
  const judges = new Map(source.judges.map(r=>[r.ID,r.user_login]));
  for (const r of source.cars) if (!people.has(r.participant_id)) throw new Error('Orphan source car');
  for (const r of source.scores) if (!cars.has(r.car_id)) throw new Error('Orphan source score');
  for (const r of source.history) if (!scores.has(r.score_id) || !judges.has(r.user_id)) throw new Error('Orphan source history');
  const pick = (r:Row, keys:string[]) => Object.fromEntries(keys.map(k=>[k,r[k]]));
  let max = BigInt(0);
  for (const r of source.cars) if (BigInt(legacyId(r.car_number)) > max) max = BigInt(legacyId(r.car_number));
  const mapped:Mapped = {
    events:[{id:EVENT_ID, slug:'dream-car-show-2025', name:'Zionsville Lions Club Dream Car Show 2025', event_year:2025, event_date:null, timezone_name:null, next_car_number:(max+BigInt(1)).toString(), legacy_source_key:'qkby:2025'}],
    participants:source.participants.map(r=>({id:entityId('participant',r.id),legacy_participant_id:r.id,...pick(r,['name','email','phone','address','city','state','zip'])})),
    cars:source.cars.map(r=>({id:entityId('car',r.id),legacy_car_id:r.id,participant_id:entityId('participant',r.participant_id),...pick(r,['year','make','model','notes'])})),
    event_registrations:source.cars.map(r=>{
      const votes = byCar.get(r.id)?.lions_choice ?? (byCar.has(r.id)?null:'0');
      if (typeof votes !== 'string' || !/^\d+$/.test(votes) || BigInt(votes)>BigInt(2147483647)) throw new Error('Invalid legacy votes');
      return {id:entityId('registration:2025',r.id),legacy_car_id:r.id,event_id:EVENT_ID,car_id:entityId('car',r.id),participant_id:entityId('participant',r.participant_id),car_number:r.car_number,vehicle_year:r.year,vehicle_make:r.make,vehicle_model:r.model,lions_choice_votes:votes,classification:r.classification,status:r.status,payment_status:r.paid,legacy_event_assignment:'2025-import-snapshot'};
    }),
    scores:source.scores.map(r=>{
      for (const k of FIELDS) if (r[k] !== null && (typeof r[k] !== 'string' || !/^\d+$/.test(r[k] as string))) throw new Error(`Invalid native score input: ${r.id}/${k}`);
      const values = Object.fromEntries(FIELDS.map(k=>[k,r[k]===null?null:Number(r[k])]));
      const computed = calculate(values);
      for (const key of [...METRICS,'progress_percentage'] as const) if (canonical(computed[key]) !== canonical(r[key])) throw new Error(`Legacy score ${r.id}: ${key} mismatch`);
      return {id:entityId('score',r.id),legacy_score_id:r.id,event_registration_id:entityId('registration:2025',r.car_id),...values,progress_percentage:r.progress_percentage};
    }),
    score_history:source.history.map(r=>({id:entityId('score-update',r.id),legacy_update_id:r.id,score_id:entityId('score',r.score_id),action_type:'section_submission',section:r.section_updated,score_values_before:null,score_values_after:null,user_id:null,judge_name_snapshot:judges.get(r.user_id),submitted_at:null,legacy_wp_user_id:r.user_id,legacy_username:judges.get(r.user_id),legacy_timestamp:r.timestamp,legacy_updated_at:r.updated_at,legacy_timestamp_raw:r.timestamp,legacy_updated_at_raw:r.updated_at,legacy_car_id_raw:r.car_id,legacy_section_raw:r.section,legacy_section_updated_raw:r.section_updated,timestamp_basis:'legacy-unresolved'})),
  };
  return mapped;
}
