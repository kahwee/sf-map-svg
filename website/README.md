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

`pnpm typecheck:website` checks the entry point and imported modules in strict mode.
Mode defaults follow the view while explicit layer overrides survive mode changes.
Static previews render without creating an interactive controller. Mobile previews
scroll with the page so controls cannot be covered by a tall pinned map.

Pages references and snippets describe the package used by that build. Released
builds require v6 or newer and use grouped static options directly.
