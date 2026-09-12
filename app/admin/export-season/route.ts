import {requireStaff} from '../../../src/auth/session';
import {eventContext,registrations} from '../../../src/workflows/data';
import {seasonCsv} from '../../../src/workflows/season-export';
export async function GET(request:Request){
 const {client}=await requireStaff(true);
 const id=new URL(request.url).searchParams.get('event');
 const {events}=await eventContext(client);const event=events.find(e=>e.id===id);
 if(!event)return new Response('Select a valid event.',{status:400});
 const rows=await registrations(client,event.id);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Indiana/Indianapolis',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const name=event.name.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'')||'Car-Show';
 return new Response(seasonCsv(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${name}-Event-Export-${date}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
