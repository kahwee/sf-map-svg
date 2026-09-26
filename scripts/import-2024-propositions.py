"""Extract certified 2024 California proposition votes for SF supervisor districts.

Usage: python scripts/import-2024-propositions.py path/to/dsov.xlsx
Requires openpyxl for this one-time data preparation; the map has no runtime dependency.
"""

import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

SOURCE = "https://www.sfelections.org/results/20241105/data/20241203/dsov.xlsx"
TITLES = {
    2: "Public school and community college bonds",
    3: "Constitutional right to marriage",
    4: "Climate and water infrastructure bonds",
    5: "Local infrastructure bond threshold",
    6: "Involuntary servitude in prisons",
    32: "Minimum wage increase",
    33: "Local rent control authority",
    34: "Prescription drug revenue spending",
    35: "Medi-Cal funding",
    36: "Penalties for theft and drug crimes",
}


def counts(row):
    return {"yes": int(row[6]), "no": int(row[8])}


def main():
    workbook = load_workbook(sys.argv[1], read_only=True, data_only=True)
    propositions = []
    for sheet in workbook:
        rows = list(sheet.values)
        match = re.fullmatch(r"PROPOSITION (\d+)\s*", str(rows[1][0])) if len(rows[1]) else None
        if not match:
            continue
        number = int(match.group(1))
        city = next(counts(row) for row in rows if row and row[0] == "Electionwide - Total")
        districts = []
        for row in rows:
            if not row or not isinstance(row[0], str):
                continue
            district = re.fullmatch(r"SUP DIST (\d+) - Total", row[0])
            if district:
                districts.append({"district": int(district.group(1)), **counts(row)})
        assert len(districts) == 11, f"Proposition {number}: expected eleven districts"
        for vote in ("yes", "no"):
            assert sum(row[vote] for row in districts) == city[vote], (
                f"Proposition {number}: {vote} district sum differs from certified city total"
            )
        propositions.append(
            {"number": number, "title": TITLES[number], "citywide": city, "districts": districts}
        )
    assert [item["number"] for item in propositions] == list(TITLES)
    output = {
        "electionDate": "2024-11-05",
        "districtYear": 2022,
        "scope": "Votes cast in San Francisco by supervisorial district; not statewide totals",
        "source": SOURCE,
        "certification": "https://www.sfelections.org/results/20241105/data/20241203/CertificationLetterNov52024.pdf",
        "method": "Yes share = Yes / (Yes + No). Undervotes and overvotes excluded. District counts sum to certified SF citywide totals.",
        "propositions": propositions,
    }
    Path("data/propositions").mkdir(parents=True, exist_ok=True)
    Path("data/propositions/2024-11-05.json").write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
