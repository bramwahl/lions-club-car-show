'use client';
import {useState} from 'react';
import Link from 'next/link';
import {sectionLabels} from '../../src/workflows/types';
import {filterMissingScores,missingScoresCsv,type MissingCar} from '../../src/workflows/missing-sections';
export function MissingScores({rows,eventName}:{rows:MissingCar[];eventName:string}){
 const [selected,setSelected]=useState<string[]>(Object.keys(sectionLabels));
 const filtered=filterMissingScores(rows,selected);
 function download(){
 const url=URL.createObjectURL(new Blob([missingScoresCsv(filtered)],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=eventName.replace(/[^a-zA-Z0-9-]+/g,'-')+'-Missing-Scores-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="card section-space missing-scores-widget"><h2>Missing scores</h2><p>Checked-in cars with incomplete scores, including cars not yet started. Select categories to show cars missing any of them.</p>
 <fieldset className="missing-score-filters"><legend>Categories</legend>{Object.entries(sectionLabels).map(([key,label])=><label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={()=>setSelected(values=>values.includes(key)?values.filter(v=>v!==key):[...values,key])}/>{label}</label>)}</fieldset>
 <div className="actions missing-scores-actions"><button type="button" className="secondary" onClick={()=>setSelected(Object.keys(sectionLabels))}>All categories</button><button type="button" className="secondary" onClick={()=>setSelected([])}>Clear filters</button><button type="button" className="missing-scores-export" disabled={!filtered.length} onClick={download}>Export filtered CSV</button></div>
 <p aria-live="polite">{filtered.length} cars with missing scores in selected categories</p>
 {filtered.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Car #</th><th>Year</th><th>Make</th><th>Model</th><th>Color</th><th>Scores missing</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><Link href={'/admin/registrations/'+r.id}>#{r.number}</Link></td><td>{r.year}</td><td>{r.make}</td><td>{r.model}</td><td>{r.color}</td><td>{r.missing.map(s=><div key={s.section}><strong>{sectionLabels[s.section]}:</strong> {s.fields.join(', ')}</div>)}</td></tr>)}</tbody></table></div>:<p>{selected.length?'No missing scores in these categories.':'Select at least one category.'}</p>}
 <p className="hint">Refresh to load the latest submissions. The export includes only selected categories.</p></section>;
}
