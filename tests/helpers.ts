import { PGlite } from '@electric-sql/pglite';
import { migrate, type DB } from '../scripts/phase1a/db';
import { calculate, FIELDS } from '../src/domain/scoring';
import type { Source } from '../scripts/phase1a/source';
export async function database() {
  const pg=new PGlite();
  const db:DB={query:async(sql,params)=>pg.query(sql,params),exec:sql=>pg.exec(sql)};
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid primary key,email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  await migrate(db);
  return {db,close:()=>pg.close()};
}
export function syntheticSource():Source {
  const scores=Object.fromEntries(FIELDS.map(k=>[k,null]));
  return {
    participants:[{id:'1',name:'Synthetic Tester',email:'',phone:null,address:'',city:'Test',state:null,zip:'00100'}],
    cars:[{id:'2',participant_id:'1',car_number:'1',year:'1959',make:'Synthetic',model:'Vehicle',notes:null,classification:'1950s',status:'Archived',paid:'Unpaid'}],
    scores:[{id:'3',car_id:'2',...scores,...Object.fromEntries(Object.entries(calculate(scores)).map(([k,v])=>[k,v===null?null:String(v)])),lions_choice:'2'}],
    history:[{id:'4',score_id:'3',user_id:'9007199254740993',section_updated:'engine',timestamp:'2025-09-07 12:00:00',updated_at:'2025-09-07 05:00:00',car_id:'0',section:''}, {id:'5',score_id:'3',user_id:'9007199254740993',section_updated:'engine',timestamp:'2025-09-07 12:00:01',updated_at:'2025-09-07 05:00:01',car_id:'0',section:''}],
    judges:[{ID:'9007199254740993',user_login:'synthetic-judge'}],
  };
}
