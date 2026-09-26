# California propositions in San Francisco

`2024-11-05.json` records certified Yes and No votes for the ten California statewide propositions on the November 2024 ballot, grouped by San Francisco supervisorial district. The map uses the 2022 district boundaries.

The counts come from the [final San Francisco district statement of vote](https://www.sfelections.org/results/20241105/data/20241203/dsov.xlsx). Each proposition's eleven district counts sum to its San Francisco citywide total. The `title` fields are short navigation labels; read the [official certification](https://www.sfelections.org/results/20241105/data/20241203/CertificationLetterNov52024.pdf) for the full ballot wording.

Yes share is `yes / (yes + no)` and excludes undervotes and overvotes. This dataset contains SF votes, not statewide totals, demographic estimates, or individual voter records. [Full provenance and checksum](../../SOURCES.md#california-propositions-in-san-francisco) are documented in `SOURCES.md`.

To regenerate the JSON, download the final workbook above and run:

```sh
python -m pip install openpyxl
python scripts/import-2024-propositions.py path/to/dsov.xlsx
```

The import script is a data preparation tool. The library and GitHub Pages example use the generated JSON without Python or `openpyxl` at runtime.
