# Site components

Edit authored HTML, CSS and TypeScript here; never patch generated `pages-dist`.
Use the [maintenance runbook](../docs/maintenance.md) for browser validation,
package/Pages alignment, and release steps. The visual guide is `docs.html`;
`api.html` is the exact reference. Their Markdown exports come from the selected
package, so package-owned documentation changes need a package release to appear
in released exports. Site navigation and layout can deploy independently.

## Dropdown

Use the shared native dropdown for single-value choices. `site.css` imports
`dropdown.css` for every Pages screen; the wrapper adds an inset, non-interactive
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
from `dropdown.js` before mounting. It retains nodes and listeners, is safe to
repeat, and leaves multiple selects and list boxes alone.

Set `--dropdown-radius`, `--dropdown-font`, `--dropdown-padding-block`, and
`--dropdown-padding-inline` on a containing component to customize it. Keep the
end gutter and chevron inset consistent. Logical spacing also supports RTL.
Forced-colors mode uses the platform's native arrow for visibility.

## Playground

`playground.ts` owns the form and preview lifecycle; `playground-model.ts` owns the
validated design state, API option adapters, versioned share links, and generated
JavaScript/TypeScript examples. `pnpm typecheck:website` checks both in strict mode.
Mode defaults follow the view while explicit layer overrides survive mode changes.
Static previews render without creating an interactive controller. Mobile previews
scroll with the page so controls cannot be covered by a tall pinned map.

Pages references and snippets describe the package used by that build. Released
builds adapt unsupported grouped static options to the published flat API.
