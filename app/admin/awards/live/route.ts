import { requireStaff } from '../../../../src/auth/session';
import { awardResults } from '../../../../src/workflows/award-results';
export async function GET(request:Request){const {client}=await requireStaff(true);const id=new URL(request.url).searchParams.get('event');if(!id||!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:'Invalid event'},{status:400});return Response.json(await awardResults(client,id),{headers:{'Cache-Control':'private, no-store'}});}
