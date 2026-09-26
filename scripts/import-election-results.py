"""Extract the certified June 2026 local measures. Requires openpyxl for ingestion only.
Usage: python scripts/import-election-results.py /path/to/dsov.xlsx /path/to/summary.html
Download URLs and file checksum are retained in the JSON and SOURCES.md.
"""
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import openpyxl

workbook_path, summary_path = map(Path, sys.argv[1:])
workbook = openpyxl.load_workbook(workbook_path, read_only=True, data_only=True)
summary = summary_path.read_text()
base = 'https://sfelections.org/results/20260602/'
result = {
    'districtYear': 2022,
    'electionDate': '2026-06-02',
    'electionName': 'June 2, 2026 · Consolidated Statewide Direct Primary',
    'certifiedDate': '2026-06-25',
    'downloadedDate': '2026-09-26',
    'source': base + 'data/20260625/dsov.xlsx',
    'summarySource': base + 'index.html',
    'certificationSource': base + 'data/20260625/CertificationLetterJun22026.pdf',
    'sourceSha256': hashlib.sha256(workbook_path.read_bytes()).hexdigest(),
    'geography': '2022 supervisorial districts; district totals are reported directly by the Department of Elections.',
    'method': 'Yes share = Yes / (Yes + No). Undervotes and overvotes are excluded from the denominator. Election Day and Vote by Mail are combined in the source total rows.',
    'measures': [],
}
for sheet in workbook:
    rows = list(sheet.values)
    if not rows[1] or not re.fullmatch(r'Measure [A-D]\s*', str(rows[1][0])):
        continue
    letter = rows[1][0].strip()[-1]
    heading = re.search(r"<h4 id='(a_english_\d+)'>Measure " + letter + r' -\s*(.*?)</h4>', summary)
    assert heading, letter
    title = html.unescape(heading[2]).strip()
    headers = rows[3]
    yes_col = next(i for i, v in enumerate(headers) if v and 'YES' in str(v))
    no_col = next(i for i, v in enumerate(headers) if v and 'NO' in str(v))
    def counts(row):
        d = dict(yes=row[yes_col], no=row[no_col], undervotes=row[2], overvotes=row[4])
        assert all(isinstance(v, int) and v >= 0 for v in d.values())
        assert d['yes'] + d['no'] == row[10]
        return d
    city = counts(next(r for r in rows if r and r[0] == 'San Francisco - Total'))
    districts = []
    for number, row in enumerate(rows, 1):
        match = re.fullmatch(r'SUP DIST (\d+) - Total', str(row[0])) if row else None
        if match:
            districts.append({'district': int(match[1]), **counts(row), 'sourceRow': number})
    assert [d['district'] for d in districts] == list(range(1, 12))
    for key in city:
        assert sum(d[key] for d in districts) == city[key], (letter, key)
    # Cross-check each citywide count against the independently published summary HTML.
    section = summary.split(f"id='{heading[1]}'")[1].split('<h4 ')[0]
    assert f"data-value={city['yes']}" in section and f"data-value={city['no']}" in section
    result['measures'].append({
        'id': letter, 'title': title, 'sourceSheet': sheet.title,
        'sourceUrl': base + 'index.html#' + heading[1],
        'threshold': 'two-thirds' if letter == 'A' else 'majority',
        'citywide': city, 'districts': districts,
    })
assert [m['id'] for m in result['measures']] == list('ABCD')
Path('data/elections/2026-06-02.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('Verified four measures, 44 district rows, and all citywide totals against the official summary.')
