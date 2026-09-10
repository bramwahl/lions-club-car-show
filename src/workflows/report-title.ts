export function reportTitle(event:string,report:string,date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${event} - ${report} - ${get('year')}-${get('month')}-${get('day')}`.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-');
}
