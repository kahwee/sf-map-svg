# Repository tooling

Run commands from the repository root; prefer the stable `pnpm` scripts in
`package.json`. Directory names describe the operation, not the runtime language.

| Directory | Responsibility |
| --- | --- |
| `build/` | Compile the library, generate Pages and assistant-readable docs |
| `checks/` | Package, bundle, docs, Pages and browser-fixture validation |
| `data/` | Geographic/catalog generation, source importers and validation |
| `data/election/` | Official-source refresh, change detection and verified deployment recovery |
| `release/` | Generate and verify release notes |
| `benchmarks/` | Marker and toolchain measurements |

`checks/pages/` contains focused browser scenarios used by `pnpm test:pages`.
Build helpers stay in `build/`; source-specific helpers stay in `data/`.
Importers can update canonical data: follow `data/README.md` and `SOURCES.md`.
