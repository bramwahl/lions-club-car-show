"""Pinned source comparison helper only. Never a substitute for native extraction.
Only allowlisted logical values leave this process. No user authentication secrets.
"""
import contextlib, io, json, runpy, sys
from pathlib import Path
root = Path(__file__).resolve().parents[2]
source = sys.argv[1]
sys.argv = [str(root/'docs/car-show-phase0/audit_legacy.py'), source]
with contextlib.redirect_stdout(io.StringIO()):
    data = runpy.run_path(sys.argv[0])
columns = {
 'participants': ('p', 'id name email phone address city state zip'),
 'cars': ('c', 'id participant_id car_number year make model notes classification status paid'),
 'scores': ('s', 'id car_id '+ ' '.join(data['fields'])+' overall_paint overall_interior overall_engine total_score progress_percentage lions_choice'),
 'history': ('u', 'id score_id user_id section_updated timestamp updated_at car_id section'),
 'judges': ('w', 'ID user_login'),
}
result = {}
for key,(variable,fields) in columns.items():
    result[key] = []
    for row in data[variable]:
        clean = {k: None if row[k] is None else str(row[k]) for k in fields.split()}
        if key == 'scores': clean['progress_percentage'] = format(row['progress_percentage'], '.2f')
        result[key].append(clean)
print(json.dumps(result, ensure_ascii=False))
