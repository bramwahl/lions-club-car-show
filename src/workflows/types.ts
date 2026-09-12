import type { ScoreInputs, Totals } from '../domain/scoring';
export type EventRow={id:string;slug:string;name:string;event_year:number;event_date:string|null;timezone_name:string|null;judging_open:boolean;legacy_source_key:string|null;next_car_number:string};
export type Participant={id:string;legacy_participant_id:string|null;name:string;email:string;phone:string|null;address:string|null;city:string|null;state:string|null;zip:string|null};
export type Car={id:string;legacy_car_id:string|null;participant_id:string;year:number;make:string;model:string;color?:string|null;notes:string|null};
export type Score=ScoreInputs & Totals & {id:string;event_registration_id:string;progress_percentage:number};
export type Registration={id:string;event_id:string;car_id:string;participant_id:string;car_number:string|null;vehicle_year:number;vehicle_make:string;vehicle_model:string;vehicle_color?:string|null;status:string|null;payment_status:string;classification:string|null;lions_choice_votes:number;participant:Participant;score:Score|null};
export type History={id:string;score_id:string;action_type:string;section:string|null;judge_name_snapshot:string|null;submitted_at:string|null;legacy_timestamp_raw:string|null;legacy_updated_at_raw:string|null;timestamp_basis:string;score_values_before:ScoreInputs|null;score_values_after:ScoreInputs|null};
export const STATUSES=['Archived','Registered','Checked-in','Judged'] as const;
export const sectionLabels={body_paint:'Body / Paint',body_plating:'Body / Plating',interior:'Interior',wheels_tires:'Wheels / Tires',engine:'Engine',appearance:'Appearance'};
export const label=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function statistics(rows:Pick<Registration,'status'|'payment_status'>[]){
 const registered=rows.filter(r=>r.status!==null&&r.status!=='Archived').length;
 const checked=rows.filter(r=>r.status!==null&&!['Archived','Registered'].includes(r.status)).length;
 const judged=rows.filter(r=>r.status==='Judged').length;
 const paid=rows.filter(r=>r.payment_status==='Paid').length;
 return {registered,checked,judged,paid,checkedPercent:registered?checked/registered*100:0,judgedPercent:checked?judged/checked*100:0,paidPercent:registered?paid/registered*100:0};
}
export function safeReturn(value:unknown){return typeof value==='string'&&/^\/(?:admin|staff|judge)(?:\/[a-zA-Z0-9-]+)*$/.test(value)?value:'/staff';}

export type HistoryDisplay=Pick<History,'id'|'action_type'|'section'|'judge_name_snapshot'|'submitted_at'> & Partial<History>;

export const searchText=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase();

export const carNumber=(value:string|null|undefined)=>value?`#${value}`:'Not checked in';
