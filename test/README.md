# Node test domains

`pnpm test` builds the library and runs all tests through Node's recursive test
discovery. `pnpm test:built` runs against an existing current build.

- `library/`: exported API, static rendering, geometry and interactive primitives.
- `website/`: page models, election presentation, generated snippets and playground history.
- `tooling/`: release/docs generation, source validation and deployment recovery.
- `fixtures/`: shared source samples and geometry fingerprints. Preserve their provenance.

Browser integration tests remain in `browser/` and `visual/`; Storybook interaction
checks remain in `stories/`. These exercise different environments and have separate
pnpm commands in the maintenance runbook.
