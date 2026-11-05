# Site components

Edit authored HTML, CSS and TypeScript here; never patch generated `pages-dist`.
Use the [maintenance runbook](../docs/maintenance.md) for browser validation,
package/Pages alignment, and release steps. The visual guide is `docs.html`;
`api.html` is the exact reference. Their Markdown exports come from the selected
package, so package-owned documentation changes need a package release to appear
in released exports. Site navigation and layout can deploy independently.

## Dropdown

Use the shared native dropdown for single-value choices. `shared/site.css` imports
`shared/dropdown.css` for every Pages screen; the wrapper adds an inset, non-interactive
chevron and reserves 44px at the end of the control for it. Native labels,
keyboard navigation and mobile pickers remain intact.

```html
<label class="field" for="view">Map view
  <span class="dropdown">
    <select class="dropdown-control" id="view">
      <option value="districts">Districts</option>
      <option value="neighborhoods">Neighborhoods</option>
    </select>
  </span>
</label>
```

For existing controls supplied by the map, call `enhanceDropdowns(map.element)`
from `shared/dropdown.js` before mounting. It retains nodes and listeners, is safe to
repeat, and leaves multiple selects and list boxes alone.

Set `--dropdown-radius`, `--dropdown-font`, `--dropdown-padding-block`, and
`--dropdown-padding-inline` on a containing component to customize it. Keep the
end gutter and chevron inset consistent. Logical spacing also supports RTL.
Forced-colors mode uses the platform's native arrow for visibility.

## Feature directories

HTML entry points stay at the root to preserve public URLs. Each feature folder
owns its page script, styles, models and supporting views. `page.js`/`page.ts` is
the browser entry point; `style.css` holds that feature's styles. `shared/` contains
components used by multiple pages: dropdowns, motion, map helpers and site styling.
`boot.js` stays at the root because the build inlines it before first paint.

## Playground

`playground/page.ts` connects form controls and rendering updates:

- `preview.ts`: browser/static previews, camera and selection restoration, disposal.
- `history.ts`: detached undo/redo snapshots, branching and the 60-entry limit.
- `export.ts`: full-precision geography loading/retry, SVG downloads and share URLs.
- `model.ts`: validated design state, API adapters, share encoding and generated examples.

`pnpm typecheck:website` includes every website TypeScript file, including standalone
helpers. Existing JavaScript stays supported; dropdown and election refresh helpers
opt into strict checks with `@ts-check` and JSDoc. Add each newly checked JavaScript
entry to `tsconfig.website.json`; imported dependencies are discovered automatically.
Mode defaults follow the view while explicit layer overrides survive mode changes.
Static previews render without creating an interactive controller. Mobile previews
scroll with the page so controls cannot be covered by a tall pinned map.

Pages references and snippets describe the package used by that build. Released
builds require v6 or newer and use grouped static options directly.

## Shared CSS ownership

`shared/site.css` remains the stable entrypoint. Its ordered imports preserve the
cascade: dropdown, foundation (tokens/base/type/layout), shell (masthead), components
(controls/figures/cards/code/tables), footer, motion, then adaptations (responsive,
reduced motion and print). Keep new rules with their owning component and retain
accessibility overrides last. Feature-specific rules belong in feature stylesheets.
`shared/district-results.css` is imported only by candidates, measures and propositions
for their choropleth and ranking-bar presentation.

## Data loading and checked JavaScript

Use `shared/async-cache.js` for immutable map and historical result loads. It shares
in-flight requests and successful values by key, and evicts rejected requests before
callers retry. It does not retry automatically or cache live election refreshes.
The shared SVG loader rejects malformed XML and non-SVG responses.

The strict website project also checks the shared caches/loaders and historical
measure calculations, URL selection and CSV export through JSDoc. JavaScript module
paths remain unchanged. Dataset types come from the built package declarations,
matching the website's consumer boundary.

Playground component styles keep final declarations together, with responsive and
reduced-motion rules at the end. Fold refinements into those rules instead of adding
another override section.
