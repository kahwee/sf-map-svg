"""Import candidate contests from final SF district statements of vote.

Usage: uv run --with openpyxl python3 scripts/import-candidate-results.py SOURCE_DIR
SOURCE_DIR contains 2016.xlsx through 2026.xlsx downloaded from the
official URLs in SOURCES.md. Input workbooks are not committed or published.
"""

import hashlib
import json
from pathlib import Path
import re
import sys

import openpyxl


INPUT = Path(sys.argv[1])
OUTPUT = Path('data/candidates')
OUTPUT.mkdir(exist_ok=True)
SOURCES = {
    2016: ('2016-11-08', '2016-12-06', 'https://www.sfelections.org/results/20161108/data/20161206/20161206_sov.xlsx'),
    2018: ('2018-11-06', '2018-11-27', 'https://www.sfelections.org/results/20181106/data/20181127/20181127_sov.xlsx'),
    2020: ('2020-11-03', '2020-12-01', 'https://www.sfelections.org/results/20201103/data/20201201/20201201_dsov.xlsx'),
    2022: ('2022-11-08', '2022-12-01', 'https://www.sfelections.org/results/20221108/data/20221201/dsov.xlsx'),
    2024: ('2024-11-05', '2024-12-03', 'https://www.sfelections.org/results/20241105/data/20241203/dsov.xlsx'),
    2026: ('2026-06-02', '2026-06-25', 'https://sfelections.org/results/20260602/data/20260625/dsov.xlsx'),
}


def integer(value):
    number = float(value)
    assert int(number) == number and number >= 0, value
    return int(number)


def slug(title):
    return re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')


def selected(title):
    return bool(re.match(
        r'^(PRESIDENT AND VICE PRESIDENT|GOVERNOR|LIEUTENANT GOVERNOR|'
        r'SECRETARY OF STATE|CONTROLLER|TREASURER|ATTORNEY GENERAL|'
        r'INSURANCE COMMISSIONER|BOARD OF EQUALIZATION|UNITED STATES SENATOR|'
        r'UNITED STATES REPRESENTATIVE|US HOUSE OF REP|STATE SENATOR|'
        r'STATE ASSEMBLY MEMBER|MEMBER OF THE STATE ASSEMBLY)', title.upper()
        .replace('U.S.', 'UNITED STATES').replace('US HOUSE OF REP', 'UNITED STATES REPRESENTATIVE')
        .replace('STATE CONTROLLER', 'CONTROLLER').replace('STATE TREASURER', 'TREASURER')))


catalog = []
for year, (date, certified, url) in SOURCES.items():
    raw = (INPUT / f'{year}.xlsx').read_bytes()
    book = openpyxl.load_workbook(INPUT / f'{year}.xlsx', read_only=True, data_only=True)
    contests = []
    for sheet in book:
        rows = list(sheet.values)
        if len(rows) < 4:
            continue
        old_format = year in (2016, 2018)
        if old_format:
            title = re.sub(r'\s+', ' ', str(rows[0][0]).split(' - ')[0]).strip()
        elif rows[1]:
            title = re.sub(r'\s+', ' ', str(rows[1][0])).strip()
        else:
            continue
        if not selected(title):
            continue
        if old_format:
            section = next(i for i, row in enumerate(rows) if row and str(row[0]).startswith('District and Neighborhood Totals'))
            headers = rows[section + 1]
            total_col = next(i for i, value in enumerate(headers) if str(value).strip() == 'Under Vote')
            candidate_start = 7
        else:
            headers = rows[3]
            total_col = next((i for i, value in enumerate(headers) if str(value).strip() == 'Total Votes'), None)
            assert total_col is not None, (year, sheet.title)
            candidate_start = 6
        candidates = []
        for col in range(candidate_start, total_col):
            value = headers[col] if col < len(headers) else None
            if not value or not str(value).strip():
                continue
            label = re.sub(r'\s+', ' ', str(value)).strip()
            party = re.search(r'\(([A-Z]+)\)$', label)
            name = label[:party.start()].strip() if party else label
            candidates.append({'name': name, 'party': party[1] if party else None, 'sourceColumn': col + 1})
        assert candidates, (year, title)
        city_index = next((i for i, row in enumerate(rows) if row and isinstance(row[0], str)
                           and (row[0].strip() == 'CITY/COUNTY OF SAN FRANCISCO' if old_format else
                                re.fullmatch(r'(Countywide|County|San Francisco) - Total', row[0].strip()))), None)
        assert city_index is not None, (year, title)

        def result(index):
            row = rows[index]
            votes = [integer(row[c['sourceColumn'] - 1] or 0) for c in candidates]
            total = sum(votes) if old_format else integer(row[total_col] or 0)
            assert sum(votes) == total, (year, title, index + 1, sum(votes), total)
            return {'votes': votes, 'totalVotes': total,
                    'registeredVoters': integer(row[4] or 0) if old_format else integer(row[1] or 0),
                    'undervotes': integer(row[total_col] or 0) if old_format else integer(row[2] or 0),
                    'overvotes': integer(row[total_col + 1] or 0) if old_format else integer(row[4] or 0),
                    'sourceRow': index + 1}

        citywide = result(city_index)
        if not citywide['totalVotes']:
            continue  # The workbook also lists offices entirely outside San Francisco.
        districts = []
        for district in range(1, 12):
            label = f'SUPERVISORIAL DISTRICT {district}' if old_format else f'SUP DIST {district} - Total'
            indexes = [i for i, row in enumerate(rows) if row and str(row[0]).strip() == label]
            if indexes:
                assert len(indexes) == 1, (year, title, district)
                district_result = result(indexes[0])
                districts.append({'district': district, 'eligible': district_result['registeredVoters'] > 0,
                                  **district_result})
            else:
                districts.append({'district': district, 'eligible': False, 'votes': None,
                                  'totalVotes': None, 'undervotes': None, 'overvotes': None,
                                  'registeredVoters': None, 'sourceRow': None})
        unassigned = {key: citywide[key] - sum(d[key] or 0 for d in districts)
                      for key in ('totalVotes', 'undervotes', 'overvotes')}
        unassigned['votes'] = [citywide['votes'][index] - sum(
            (d['votes'] or [0] * len(candidates))[index] for d in districts)
            for index in range(len(candidates))]
        assert all(value >= 0 for value in [*unassigned['votes'], *(
            unassigned[key] for key in ('totalVotes', 'undervotes', 'overvotes'))]), (year, title, unassigned)
        assert sum(unassigned['votes']) == unassigned['totalVotes'], (year, title, unassigned)
        cumulative_rows = [row for row in rows if row and str(row[0]).strip() == 'Cumulative - Total']
        if any(unassigned['votes']) or unassigned['undervotes'] or unassigned['overvotes']:
            if not old_format:
                assert cumulative_rows and any(integer(row[total_col] or 0) == unassigned['totalVotes']
                                               for row in cumulative_rows), (year, title, unassigned)
        contests.append({'id': slug(title), 'title': title, 'sourceSheet': sheet.title,
                         'candidates': candidates, 'citywide': citywide, 'districts': districts,
                         'unassigned': unassigned})
    assert contests, year
    baseline = next((c for c in contests if c['title'].upper().startswith(('PRESIDENT', 'GOVERNOR'))), None)
    assert baseline, year
    for contest in contests:
        for district, base in zip(contest['districts'], baseline['districts']):
            registered = district['registeredVoters'] or 0
            all_registered = base['registeredVoters'] or 0
            assert registered <= all_registered, (year, contest['title'], district['district'])
            district['partiallyEligible'] = 0 < registered < all_registered
    output = {'electionDate': date, 'electionName': f'{date} San Francisco candidate results',
              'districtYear': 2012 if year <= 2020 else 2022, 'certifiedDate': certified, 'downloadedDate': '2026-09-26',
              'source': url, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
              'geography': 'Votes cast in San Francisco, reported by supervisorial district. Congressional and state legislative contests include only eligible portions of each district.',
              'method': 'Candidate vote share divides a candidate count by all valid votes in that contest and area. Write-ins are included when reported. District eligibility uses registered-voter counts in the official workbook compared with the election’s citywide presidential or gubernatorial contest. Missing supervisorial rows indicate no eligible voters, not zero support. County cumulative votes, when present, are recorded separately as unassigned.',
              'contests': contests}
    (OUTPUT / f'{date}.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    catalog.append({'date': date, 'label': f'{year} {"June primary" if year == 2026 else "November general"}',
                    'file': f'{date}.json', 'contestCount': len(contests)})
    print(f'{year}: {len(contests)} contests, {sum(len(c["candidates"]) for c in contests)} candidate choices')
(OUTPUT / 'catalog.json').write_text(json.dumps({'elections': catalog}, indent=2) + '\n')
