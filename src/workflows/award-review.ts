import type { Award } from '../domain/awards';
export function repeatedAwardKeys(current:Award[],previous:Award[]){const keys=new Set(previous.map(r=>`${r.car_id}|${r.award}`));return current.filter(r=>keys.has(`${r.car_id}|${r.award}`)).map(r=>`${r.car_id}|${r.award}`);}

import {classification,phpNumericCompare,type AwardInput} from '../domain/awards';
export type AwardTie={award:string;score:number|null;cars:AwardInput[]};
/** Review-only: follow the engine's awarded order and exclusions; never choose a winner. */
export function awardTies(inputs:readonly AwardInput[],awards:readonly Award[]):AwardTie[]{
 const remaining=new Map(inputs.map(car=>[car.car_id,car]));const ties:AwardTie[]=[];
 for(const winner of awards){
  if(!winner.award.startsWith('Top 40:')){
   const field=winner.award==='Best in Category: Paint'?'overall_paint':winner.award==='Best in Category: Interior'?'overall_interior':winner.award==='Best in Category: Engine'?'overall_engine':'total_score';
   const className=winner.award.startsWith('Best in Class: ')?winner.award.slice('Best in Class: '.length):null;
   const cars=[...remaining.values()].filter(car=>(!className||classification(car.vehicle_year)===className)&&phpNumericCompare(car[field],winner[field])===0);
   if(cars.length>1)ties.push({award:winner.award,score:winner[field],cars});
  }
  remaining.delete(winner.car_id);
 }
 return ties;
}
