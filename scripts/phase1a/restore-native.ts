/** Restore only the pinned dump into an EMPTY, loopback-only MariaDB reference.
 * This command has no Postgres connection and cannot target Supabase.
 */
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import mariadb from 'mariadb';
import { pinnedSource } from './source';
async function main(){
  const path=process.env.LEGACY_SQL_PATH;
  if(!path||!process.env.LEGACY_DB_URL) throw new Error('Set LEGACY_SQL_PATH and LEGACY_DB_URL');
  await pinnedSource(path);
  const url=new URL(process.env.LEGACY_DB_URL);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/car_show_reference') throw new Error('Restore requires a local car_show_reference database');
  const socket=process.env.LEGACY_DB_SOCKET;
  const connection=await mariadb.createConnection({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),socketPath:socket});
  try{
    await connection.query('CREATE DATABASE IF NOT EXISTS car_show_reference CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci');
    if((await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema='car_show_reference'")).length) throw new Error('Native reference is not empty; refusing destructive restore');
  }finally{await connection.end();}
  const args=['--no-defaults',...(socket?['--socket='+socket]:['--host='+url.hostname,'--port='+(url.port||'3306')]),'--user='+decodeURIComponent(url.username),'car_show_reference'];
  await new Promise<void>((done,fail)=>{
    const child=spawn(process.env.MARIADB_BIN||'mariadb',args,{env:{...process.env,MYSQL_PWD:decodeURIComponent(url.password)},stdio:['pipe','ignore','ignore']});
    const input=createReadStream(path);input.on('error',fail);child.on('error',fail);
    child.stdin.on('error',()=>{});input.pipe(child.stdin);
    child.on('close',code=>code===0?done():fail(new Error('Native restore failed; details suppressed')));
  });
  console.log('Pinned SQL restored to the isolated native reference. Run the source gate before target import.');
}
main().catch(error=>{console.error(error?.code?`Native restore failed (${error.code})`:error.message);process.exitCode=1;});
