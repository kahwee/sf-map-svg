# Next San Francisco map datasets

Researched September 26, 2026. These are source candidates, not bundled data.
Add each as a dated, independently imported dataset after checking its field
definitions, spatial coverage, source rights, and year-to-year comparability.
Keep large event records out of the default renderer and publish compact,
precomputed Pages assets by year or topic.

| Priority | Map idea | Official source | Important constraint |
| --- | --- | --- | --- |
| 1 | Election turnout and party registration over time, by supervisorial district | [SF Department of Elections data catalog](https://sfelections.org/tools/election_data/datasets.php) and [registration by party](https://www.sfelections.org/tools/election_data/registration_by_party.php) | Store election date and boundary vintage; never interpret registration as votes. The catalog also links historical turnout and precinct lines. |
| 2 | Street trees by species and planting era | [DataSF Street Tree List](https://data.sfgov.org/City-Infrastructure/Street-Tree-List/tkzw-k3nq) | The current inventory is not a full historical census. A planting date does not prove a tree remains at the point today. Offer species or decade chunks. |
| 3 | Where city service requests changed | [DataSF SF311 case data](https://data.sfgov.org/City-Infrastructure/Case-Data-from-San-Francisco-311-SF311-/vw6y-z8j6) and its [city field guide](https://sfdigitalservices.gitbook.io/dataset-explainers/311-cases) | Normalize category changes and aggregate to a privacy-safe grid or district before shipping. Counts reflect reporting and service workflows as well as conditions. |
| 4 | Traffic injury patterns by year | [DataSF traffic crashes resulting in injury](https://data.sfgov.org/d/ubvf-ztfx/visualization) | The source combines reporting systems across years and updates quarterly. Use its methodology and avoid claiming a uniform longitudinal trend without adjustment. |
| 5 | Affordable housing pipeline locations and project stages | [DataSF affordable housing pipeline map](https://data.sfgov.org/Housing-and-Buildings/Map-of-Affordable-Housing-Pipeline/d4zr-mbcm/1000) | This is a changing project snapshot, not completed housing. Preserve each snapshot date and status. |

The election archive now includes six certified candidate snapshots from 2016
through 2026. Earlier candidate elections, intervening primaries, local ranked
choice contests, and precinct-level maps remain separate work. For ranked
choice contests, round-specific tallies and transfer rules need their own
schema; first-choice votes must not be presented as final outcomes.
