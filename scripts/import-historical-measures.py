"""Import the complete local-measure ballots for the three district map vintages.

Download the official workbooks, summaries, 2002 pamphlet, and 2012 DataSF
precinct crosswalk to a local directory, then run:

  uv run --with xlrd --with openpyxl --with beautifulsoup4 \
    python3 scripts/import-historical-measures.py /path/to/sources

Expected filenames: 2002.xls, 2002-pamphlet.pdf, 2002-pamphlet.txt, 2012.xls,
2012-summary.html, precincts-2012.json, 2022.xlsx, 2022-summary.xlsx,
2022-summary.html. See SOURCES.md for exact source URLs. Source files are
ingestion inputs and are not committed or shipped with the Pages site.
"""

from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import sys

from bs4 import BeautifulSoup
import openpyxl
import xlrd


source_dir = Path(sys.argv[1])
output_dir = Path('data/elections')
downloaded_date = '2026-09-26'
keys = ('yes', 'no', 'undervotes', 'overvotes')


def checksum(name):
    return hashlib.sha256((source_dir / name).read_bytes()).hexdigest()


def write(year, election):
    assert all(m['districts'] and len(m['districts']) == 11 for m in election['measures'])
    for measure in election['measures']:
        assert [d['district'] for d in measure['districts']] == list(range(1, 12))
        for key in keys:
            city_value = measure['citywide'][key]
            if city_value is not None:
                assert sum(d[key] for d in measure['districts']) == city_value, (year, measure['id'], key)
    path = output_dir / f'{year}.json'
    path.write_text(json.dumps(election, ensure_ascii=False, indent=2) + '\n')
    print(f'{path}: {len(election["measures"])} measures, all 11 districts reconciled')


def html_titles(name, prefix):
    soup = BeautifulSoup((source_dir / name).read_text(), 'html.parser')
    result = {}
    for heading in soup.find_all('h4'):
        text = heading.get_text(' ', strip=True)
        match = re.match(rf'{prefix} ([A-Z])\s*-\s*(.+)', text)
        if match:
            result[match[1]] = (re.sub(r'\s+', ' ', match[2]).strip(), heading['id'], heading)
    return result


def counts(yes, no, undervotes=None, overvotes=None):
    values = (yes, no, undervotes, overvotes)
    assert all(value is None or (isinstance(value, int) and value >= 0) for value in values)
    return dict(zip(keys, values))


# 2002: the final official Excel workbook has one wide proposition sheet with
# an explicit eleven-row supervisorial summary. The voter pamphlet supplies
# measure titles and the bond threshold rules. Its workbook reports Yes/No
# only; missing undervote/overvote counts are represented as null.
titles_2002 = {
    'A': 'Water Bonds',
    'B': 'Affordable Housing Bonds',
    'C': 'Veterans Building Bonds',
    'D': 'Energy',
    'E': 'Water and Sewer Rates, Surplus Funds',
    'F': 'Entertainment Commission Appointments',
    'G': 'Elections Assistance',
    'H': 'Police and Firefighter Retirement Benefits',
    'I': 'Paid Parental Leave',
    'J': 'Supervisors Salaries',
    'K': 'Selection of Official Newspapers',
    'L': 'Real Estate Tax',
    'M': 'Economic Development',
    'N': 'Adjusting Services and Payments to Homeless Individuals',
    'O': 'Conditions for Providing Services and Payments to Homeless Individuals',
    'P': 'Revenue Bond Oversight Committee',
    'Q': 'Use of City Funds',
    'R': 'Condominium Conversion with Certain Conditions',
    'S': 'Medical Marijuana',
}
pamphlet_text = re.sub(r'\s+', ' ', (source_dir / '2002-pamphlet.txt').read_text().lower().replace('&', 'and'))
assert all(title.lower().replace('&', 'and') in pamphlet_text for title in titles_2002.values())
book = xlrd.open_workbook(source_dir / '2002.xls', on_demand=True)
sheet = book.sheet_by_name('PROPOSITIONS')
headers = sheet.row_values(0)
city_row = sheet.row_values(1267)
district_rows = [sheet.row_values(i) for i in range(1284, 1295)]
assert city_row[0] == 'SAN FRANCISCO TOTAL'
assert all(re.search('SUPERVISORIAL', row[0]) for row in district_rows)
measures = []
for col, heading in enumerate(headers):
    match = re.fullmatch(r'PROPOSITION ([A-S])', str(heading).strip())
    if not match:
        continue
    letter = match[1]
    assert sheet.cell_value(1, col) == 'YES' and sheet.cell_value(1, col + 1) == 'NO'
    district_counts = [
        {'district': index, **counts(int(row[col]), int(row[col + 1])), 'sourceRow': 1284 + index}
        for index, row in enumerate(district_rows, 1)
    ]
    measures.append({
        'id': letter,
        'title': titles_2002[letter],
        'sourceSheet': 'PROPOSITIONS',
        'sourceUrl': 'https://webbie1.sfpl.org/multimedia/pdf/elections/November5_2002.pdf',
        'threshold': 'two-thirds' if letter in 'BC' else 'majority',
        'citywide': counts(int(city_row[col]), int(city_row[col + 1])),
        'districts': district_counts,
    })
assert [m['id'] for m in measures] == list(titles_2002)
write('2002-11-05', {
    'districtYear': 2002,
    'electionDate': '2002-11-05',
    'electionName': 'November 5, 2002 · Consolidated General Election',
    'certifiedDate': None,
    'downloadedDate': downloaded_date,
    'source': 'https://sfelections.org/results/20021105/SOV021105.xls',
    'titleSource': 'https://webbie1.sfpl.org/multimedia/pdf/elections/November5_2002.pdf',
    'titleSourceSha256': checksum('2002-pamphlet.pdf'),
    'summarySource': 'https://sfelections.org/results/20021105w/index.html',
    'certificationSource': None,
    'sourceSha256': checksum('2002.xls'),
    'geography': '2002 supervisorial districts; official workbook supervisorial totals.',
    'method': 'Yes share = Yes / (Yes + No). The 2002 workbook omits separate under/overvote counts; null means unavailable, not zero.',
    'measures': measures,
})


# 2012: the official precinct workbook has no district summary. DataSF's
# historical 2012 precinct collection identifies each precinct's supervisorial
# district. Slash-combined and mail-ballot precinct names resolve to source
# precinct IDs, and each combined row must map to a single district.
precincts = json.loads((source_dir / 'precincts-2012.json').read_text())
crosswalk = {row['prec_2012']: int(row['supdist']) for row in precincts
             if row.get('prec_2012') and row.get('supdist')}
assert len(crosswalk) > 590


def precinct_district(label):
    text = label.removeprefix('Pct ').replace('Mail Ballot', '').strip()
    parts = text.split('/')
    if len(parts) > 1:
        parts = [parts[0], parts[0][:-len(parts[1])] + parts[1]]
    districts = {crosswalk[part] for part in parts}
    assert len(districts) == 1, (label, districts)
    return districts.pop()


book = xlrd.open_workbook(source_dir / '2012.xls', on_demand=True)
titles = html_titles('2012-summary.html', 'Local Measure')
measures = []
for sheet in book.sheets():
    match = re.fullmatch(r'Measure ([A-G])', str(sheet.cell_value(4, 2)).strip()) if sheet.nrows > 5 and sheet.ncols > 2 else None
    if not match:
        continue
    letter = match[1]
    totals = defaultdict(lambda: dict.fromkeys(keys, 0))
    precinct_ids = set()
    for index in range(6, sheet.nrows - 1):
        row = sheet.row_values(index)
        if not str(row[0]).startswith('Pct '):
            continue
        district = precinct_district(row[0])
        precinct_ids.add(row[0])
        result = counts(*(int(row[col] or 0) for col in (7, 8, 11, 10)))
        for key in keys:
            totals[district][key] += result[key]
    assert len(precinct_ids) == 596
    city_row = sheet.row_values(sheet.nrows - 1)
    assert city_row[0] == 'Contest Total'
    city = counts(*(int(city_row[col] or 0) for col in (7, 8, 11, 10)))
    name, anchor, _ = titles[letter]
    measures.append({
        'id': letter, 'title': name, 'sourceSheet': sheet.name,
        'sourceUrl': f'https://sfelections.org/results/20121106/index.html#{anchor}',
        'threshold': 'two-thirds' if letter in 'AB' else 'majority',
        'citywide': city,
        'districts': [
            {'district': number, **totals[number], 'sourceRow': 'precinct aggregate'}
            for number in range(1, 12)
        ],
    })
assert [m['id'] for m in measures] == list('ABCDEFG')
write('2012-11-06', {
    'districtYear': 2012,
    'electionDate': '2012-11-06',
    'electionName': 'November 6, 2012 · Consolidated General Election',
    'certifiedDate': None,
    'downloadedDate': downloaded_date,
    'source': 'https://sfelections.org/results/20121106/data/SOV_Nov2012.xls',
    'summarySource': 'https://sfelections.org/results/20121106/index.html',
    'certificationSource': None,
    'sourceSha256': checksum('2012.xls'),
    'crosswalkSource': 'https://data.sfgov.org/resource/bsfq-aeyw.json?$limit=1000',
    'crosswalkSha256': checksum('precincts-2012.json'),
    'geography': '2012 supervisorial districts; 596 official precincts grouped by the DataSF historical 2012 precinct-to-district field.',
    'method': 'Election Day and vote-by-mail rows are summed for each precinct. Yes share = Yes / (Yes + No); under/overvotes are excluded. Every precinct resolves to one district and all district counts reconcile to the official contest totals.',
    'measures': measures,
})


# 2022: the final district workbook reports city and district totals directly.
# The election site's HTML retains preliminary counts, so final counts are
# checked against the separately published final summary workbook instead.
book = openpyxl.load_workbook(source_dir / '2022.xlsx', read_only=True, data_only=True)
summary = openpyxl.load_workbook(source_dir / '2022-summary.xlsx', read_only=True, data_only=True).active
summary_rows = list(summary.values)
final_totals = {}
for index, row in enumerate(summary_rows):
    match = re.fullmatch(r'Measure ([A-Z])\s*', str(row[0])) if row else None
    if match:
        vote_rows = summary_rows[index + 9:index + 11]
        votes = {str(vote_row[0]).strip().lower(): int(vote_row[3]) for vote_row in vote_rows}
        final_totals[match[1]] = counts(votes['yes'], votes['no'],
                                         int(summary_rows[index + 5][3]),
                                         int(summary_rows[index + 6][3]))
titles = html_titles('2022-summary.html', 'Proposition')
measures = []
for sheet in book:
    rows = list(sheet.values)
    match = re.fullmatch(r'Measure ([A-Z])\s*', str(rows[1][0])) if len(rows) > 1 and rows[1] else None
    if not match:
        continue
    letter = match[1]
    name, anchor, heading = titles[letter]
    threshold_text = ' '.join(str(sibling) for sibling in heading.next_siblings if getattr(sibling, 'name', None) != 'table')
    threshold = 'two-thirds' if '66⅔%' in threshold_text else 'majority'
    city_row = next((row for row in rows if row and row[0] == 'Countywide - Total'), None)
    assert city_row
    city = counts(*(int(city_row[col]) for col in (6, 8, 2, 4)))
    assert city == final_totals[letter], (letter, city, final_totals[letter])
    districts = []
    for index, row in enumerate(rows, 1):
        match = re.fullmatch(r'SUP DIST (\d+) - Total', str(row[0])) if row else None
        if match:
            districts.append({'district': int(match[1]),
                              **counts(*(int(row[col]) for col in (6, 8, 2, 4))),
                              'sourceRow': index})
    districts.sort(key=lambda row: row['district'])
    measures.append({
        'id': letter, 'title': name, 'sourceSheet': sheet.title,
        'sourceUrl': f'https://sfelections.org/results/20221108/index.html#{anchor}',
        'threshold': threshold, 'citywide': city, 'districts': districts,
    })
assert [m['id'] for m in measures] == list('ABCDEFGHIJLMNO')
write('2022-11-08', {
    'districtYear': 2022,
    'electionDate': '2022-11-08',
    'electionName': 'November 8, 2022 · Consolidated General Election',
    'certifiedDate': '2022-12-01',
    'downloadedDate': downloaded_date,
    'source': 'https://www.sfelections.org/results/20221108/data/20221201/dsov.xlsx',
    'summarySource': 'https://www.sfelections.org/results/20221108/data/20221201/summary.xlsx',
    'certificationSource': 'https://www.sfelections.org/results/20221108/data/20221201/N2022_CertificationLetter.pdf',
    'sourceSha256': checksum('2022.xlsx'),
    'summarySha256': checksum('2022-summary.xlsx'),
    'geography': '2022 supervisorial districts; final official district workbook totals.',
    'method': 'Yes share = Yes / (Yes + No). Under/overvotes are excluded. District rows reconcile to countywide totals and the final summary workbook; the election HTML supplies titles and thresholds only.',
    'measures': measures,
})
