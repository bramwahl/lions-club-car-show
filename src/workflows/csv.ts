export const CSV_COLUMNS=['Name','Email','Phone','Address','City','State','ZIP','Year','Make','Model','Notes'];
export type CsvEntrant={name:string;email:string;phone:string;address:string;city:string;state:string;zip:string;year:number;make:string;model:string;notes:string};
export function parseEntrantCsv(source:string):CsvEntrant[]{
 if(source.length>250000)throw new Error('Use a CSV smaller than 250 KB.');
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false,closed=false;
 const push=()=>{row.push(value);value='';closed=false;};
 for(let i=0;i<source.length;i++){const c=source[i];if(quoted){if(c==='"'){if(source[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
 if(c==='"'){if(value||closed)throw new Error('Malformed CSV quoting.');quoted=true;}else if(c===',')push();else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;push();if(row.some(v=>v!==''))rows.push(row);row=[];}else{if(closed&&!/\s/.test(c))throw new Error('Malformed CSV quoting.');if(!closed)value+=c;}}
 if(quoted)throw new Error('Unclosed CSV quote.');if(value||row.length||closed){push();rows.push(row);}const header=rows.shift();if(!header||header.length!==11)throw new Error('CSV must have the eleven legacy columns and a header row.');if(!rows.length||rows.length>500)throw new Error('Import 1–500 rows per batch.');
 return rows.map((r,index)=>{if(r.length!==11)throw new Error(`Row ${index+2} must contain eleven columns.`);const [name,email,phone,address,city,state,zip,year,make,model,notes]=r;const y=Number(year);if(!name.trim()||!make.trim()||!model.trim()||!/^\d{4}$/.test(year)||y<1901||y>2155)throw new Error(`Row ${index+2} needs name, make, model and a valid four-digit year.`);if(name.length>255||email.length>255||phone.length>50||address.length>2000||city.length>255||state.length>100||zip.length>20||make.length>255||model.length>255||notes.length>5000)throw new Error(`Row ${index+2} contains a field that is too long.`);return {name,email,phone,address,city,state,zip,year:y,make,model,notes};});
}
