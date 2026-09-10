"""Read-only, pinned-source Phase 0 preflight. Not a migration importer or app engine.
Literal parser supports the supplied phpMyAdmin INSERT grammar without executing SQL.
Source user credentials exist only in input memory and are never emitted or saved.
"""
import re,json,collections,hashlib,datetime,sys
from pathlib import Path
BASE=Path(__file__).resolve().parent
if len(sys.argv)!=2: raise SystemExit("Usage: python3 audit_legacy.py /path/to/i8194968_noxz1.sql")
source_path=Path(sys.argv[1])
expected=next(x['sha256'] for x in json.loads((BASE/'source-manifest.json').read_text()) if x['filename']=='i8194968_noxz1.sql')
if hashlib.sha256(source_path.read_bytes()).hexdigest()!=expected: raise SystemExit('Source fingerprint differs; review the new export before auditing.')
src=source_path.read_text(encoding='utf-8')
def parse_values(s):
    rows=[]; row=[]; i=0
    while i<len(s):
        c=s[i]
        if c in ' \r\n\t,;': i+=1; continue
        if c=='(': row=[]; i+=1; continue
        if c==')': rows.append(row); i+=1; continue
        if c=="'":
            i+=1; v=''
            while i<len(s):
                if s[i]=='\\':
                    i+=1; v+= {'n':'\n','r':'\r','0':'\0','Z':'\x1a'}.get(s[i],s[i]); i+=1
                elif s[i]=="'":
                    if i+1<len(s) and s[i+1]=="'": v+="'"; i+=2
                    else: i+=1; break
                else: v+=s[i]; i+=1
            row.append(v)
        else:
            j=i
            while i<len(s) and s[i] not in ',) \n\r': i+=1
            v=s[j:i]; row.append(None if v=='NULL' else float(v) if '.' in v else int(v))
    return rows
tables={}
for m in re.finditer(r'INSERT INTO `([^`]+)` \((.*?)\) VALUES\n(.*?);\n',src,re.S):
    cols=re.findall(r'`([^`]+)`',m[2]); rows=parse_values(m[3]); assert all(len(r)==len(cols) for r in rows)
    tables.setdefault(m[1],[]).extend(dict(zip(cols,r)) for r in rows)
p,c,s,u,w=[tables['qkby_'+x] for x in ['lionsclub_participants','lionsclub_cars','lionsclub_scores','lionsclub_score_updates','users']]
# Passwords/credentials are never written to output.
fields=dict(coverage=15,quality=20,engine_bay=20,original=5,plating_brass=10,dash=10,seats=10,carpet=10,door_panels=10,rims_hub_caps=10,tires=10,block=10,intake=10,belts_hoses_caps=5,radiator=10,breather=5,appearance=10)
cm={r['id']:r for r in c}; pm={r['id']:r for r in p}; sm={r['id']:r for r in s}
def dup(rows,k): return {str(v):n for v,n in collections.Counter(r[k] for r in rows).items() if n>1}
def total(r,fs): return None if any(r[f] is None for f in fs) else sum(r[f] for f in fs)
for r in s:
    for k,fs in [('overall_paint',['coverage','quality','engine_bay','original']),('overall_interior',['dash','seats','carpet','door_panels']),('overall_engine',['block','intake','belts_hoses_caps','radiator','breather']),('total_score',list(fields))]:r[k]=total(r,fs)
report={'counts':{k:len(v) for k,v in tables.items()},'statuses':dict(collections.Counter(r['status'] for r in c)),'paid':dict(collections.Counter(r['paid'] for r in c)), 'id_number_differences': [{'id':r['id'],'car_number':r['car_number']} for r in c if r['id']!=r['car_number']], 'duplicate_car_numbers':dup(c,'car_number'),'duplicate_score_car_ids':dup(s,'car_id'),'duplicate_email_groups':len(dup(p,'email')),'participants_with_multiple_cars':sum(n>1 for n in collections.Counter(r['participant_id'] for r in c).values()),'orphan_cars':[r['id'] for r in c if r['participant_id'] not in pm], 'orphan_scores':[r['id'] for r in s if r['car_id'] not in cm], 'orphan_updates':[r['id'] for r in u if r['score_id'] not in sm], 'orphan_judges':[r['id'] for r in u if r['user_id'] not in {x['ID'] for x in w}], 'history_sections':dict(collections.Counter(r['section_updated'] for r in u)), 'redundant_history_car_ids':dict(collections.Counter(r['car_id'] for r in u)),'redundant_history_sections':dict(collections.Counter(r['section'] for r in u)), 'history_timestamp_deltas_hours':dict(collections.Counter((datetime.datetime.fromisoformat(r['timestamp'])-datetime.datetime.fromisoformat(r['updated_at'])).total_seconds()/3600 for r in u)), 'history_repeated_section_groups':len(dup([{'key':(r['score_id'],r['section_updated'])} for r in u],'key')), 'invalid_scores':[(r['id'],f,r[f]) for r in s for f,m in fields.items() if r[f] is not None and not 0<=r[f]<=m], 'progress_mismatches':[(r['id'],r['progress_percentage'],round(sum(r[f] is not None and 0<=r[f]<=m for f,m in fields.items())/17*100,2)) for r in s if r['progress_percentage']!=round(sum(r[f] is not None and 0<=r[f]<=m for f,m in fields.items())/17*100,2)], 'null_total_scores':sum(r['total_score'] is None for r in s), 'zero_score_fields':sum(r[f]==0 for r in s for f in fields), 'lions_choice_total':sum(r['lions_choice'] or 0 for r in s),'scored_statuses':dict(collections.Counter(cm[r['car_id']]['status'] for r in s)), 'year_range':[min(r['year'] for r in c),max(r['year'] for r in c)]}

# Diagnostic only: source INSERT order is not a guaranteed SQL query order.
fixture=json.loads((BASE/'awards-2025.fixture.json').read_text())
joined=[dict(cm[r['car_id']], **{k:v for k,v in r.items() if k not in ('id','car_id')}) for r in s]
by_number={r['car_number']:r for r in joined}
metrics=['total_score','overall_paint','overall_interior','overall_engine']
numeric_diffs=[{'car_number':f['car_number'],'field':k,'expected':f[k],'actual':by_number[f['car_number']][k]} for f in fixture for k in metrics if f[k]!=by_number[f['car_number']][k]]
classes=['Pre-1950','1950s','1960s','1970s','1980s','1990s','Post-2000']
def classification(year):
    return next((label for limit,label in zip([1950,1960,1970,1980,1990,2000],classes) if int(year)<limit),classes[-1])
def stable_sort(rows,key):
    rows.sort(key=lambda r:(r[key] is not None,r[key] or 0),reverse=True)
remaining=joined.copy();stable_sort(remaining,'total_score')
actual=[]
def take(i,label,asterisk=False):
    row=remaining.pop(i).copy(); row['award']=label; row['car_number_display']=str(row['car_number'])+('*' if asterisk else '');actual.append(row)
take(0,'Best in Show')
for cls in classes:
    idx=next((i for i,r in enumerate(remaining) if classification(r['year'])==cls),None)
    if idx is not None: take(idx,'Best in Class: '+cls)
for name,key in [('Paint','overall_paint'),('Interior','overall_interior'),('Engine','overall_engine')]:
    stable_sort(remaining,key)
    take(0,'Best in Category: '+name,any(r[key]==remaining[0][key] for r in remaining[1:]))
stable_sort(remaining,'total_score')
for i in range(min(40,len(remaining))):take(0,'Top 40: '+str(i+1))
award_diffs=[{'rank':i+1,'expected':f['car_number_display'],'actual':r['car_number_display']} for i,(f,r) in enumerate(zip(fixture,actual)) if any(f[k]!=r[k] for k in ['award','car_number_display',*metrics])]
report['classification_mismatches']=[{'legacy_car_id':r['id'],'stored':r['classification'],'year_derived':classification(r['year'])} for r in c if r['classification']!=classification(r['year'])]
report['pdf_numeric_differences']=numeric_diffs
report['diagnostic_stable_replay_differences']=award_diffs
report['pdf_rows_checked']=len(fixture)
report['replay_assumption']='Source score INSERT order; Python stable sorts; not native MariaDB/PHP/Postgres execution or a production tie rule.'
# Compare separately maintained displayed identity fixture, never expose contacts.
import csv
identity_diffs=[]
with (BASE/'awards-2025-identities.csv').open() as file:
    for f in csv.DictReader(file):
        r=by_number[int(f['public_car_number'])]; person=pm[r['participant_id']]
        expected_identity={'participant_name':person['name'],'city':person['city'],'year':str(r['year']),'make':r['make'],'model':r['model'],'legacy_car_id':str(r['id'])}
        for key,value in expected_identity.items():
            if f[key]!=value:identity_diffs.append({'car_number':r['car_number'],'field':key})
report['identity_fixture_differences']=identity_diffs
expected_counts={'qkby_lionsclub_cars':256,'qkby_lionsclub_participants':239,'qkby_lionsclub_scores':71,'qkby_lionsclub_score_updates':486,'qkby_users':10}
if report['counts']!=expected_counts:raise SystemExit('Pinned-source count mismatch')
print(json.dumps(report,indent=2))
if len(actual)!=51 or len(fixture)!=51 or numeric_diffs or award_diffs or identity_diffs:raise SystemExit(1)
if any(report[k] for k in ['orphan_cars','orphan_scores','orphan_updates','orphan_judges','invalid_scores','progress_mismatches','duplicate_car_numbers','duplicate_score_car_ids']):raise SystemExit(1)
