# Site components

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
