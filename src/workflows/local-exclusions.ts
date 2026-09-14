import 'server-only';
import {cookies} from 'next/headers';
// A development-browser preview only. Production never reads this cookie.
export async function localLeftIds():Promise<string[]>{
 if(process.env.NODE_ENV!=='development')return [];
 try {const value=JSON.parse((await cookies()).get('local-left-show')?.value??'[]');return Array.isArray(value)?value.filter(v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)):[];}catch{return [];}
}

export async function localAwardSkips(event:string):Promise<{car_id:string;award:string}[]>{
 if(process.env.NODE_ENV!=='development')return [];
 try{const v=JSON.parse((await cookies()).get('local-award-skips')?.value??'[]');return Array.isArray(v)?v.filter(s=>s.event===event&&typeof s.car_id==='string'&&typeof s.award==='string'):[];}catch{return [];}
}
