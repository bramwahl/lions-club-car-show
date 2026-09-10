'use server';
import { portal } from '../../src/workflows/public-registration';
export async function findReturning(name:string,contact:string){
 if(typeof name!=='string'||typeof contact!=='string'||name.length>255||contact.length>255)return {matched:false};
 return portal('lookup',{name:name.trim(),contact:contact.trim()});
}
export async function submitRegistration(data:Record<string,unknown>){
 if(JSON.stringify(data).length>12000)return {error:'Please submit no more than ten cars.'};
 if(!data.token && !data.confirmNew){
  const details=data.details as {name?:string;email?:string;phone?:string}|undefined;
  if(details?.name){for(const contact of [details.email,details.phone]){if(contact){const match=await findReturning(details.name,contact);if(match.error)return match;if(match.matched)return {suggestion:match};}}}
 }
 return portal('submit',data);
}
