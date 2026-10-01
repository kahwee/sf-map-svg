# Offline map showcase

Build a standalone demo from the current checkout. It bundles the map controller
and canonical geography into one HTML file; opening it requires no server or
network connection. This is a working-tree preview, not proof of an npm release.

```sh
pnpm build
node examples/build-showcase.mjs
```

Open `examples/generated/showcase/showcase.html` and press **Play 20-second demo**.
The same directory contains three district SVGs and a comparison contact sheet.
Generated files stay out of Git.

## Recording

Use a desktop window with the map and controls visible. The sequence is:

| Time | Scene |
| --- | --- |
| 0–4 seconds | 2002 supervisorial districts |
| 4–8 seconds | Transition to 2012 |
| 8–12 seconds | Transition to 2022 |
| 12–16 seconds | Select Inner Mission using SFAR realtor neighborhoods |
| 16–20 seconds | Show a static 2022 SVG export |

Keep the year and source labels in the recording. Neighborhood definitions are
separate datasets; they are not supervisorial districts. Motion interpolation is
illustrative; each settled district map uses its year's canonical geometry.
Reduced-motion preferences are handled by the controller.

Before sharing, open the file at desktop and 390 px widths, check the browser
console, and exercise the year controls, neighborhood selection, and SVG download.
Verify the live demo separately if linking to it; it may use a different package
version. A generated artifact is not evidence that browser interactions passed.

## Sharing

A useful opening is: “I made an offline San Francisco map that shows how its
district boundaries changed.” Follow it with the clip, the
[live examples](https://kahwee.github.io/sf-map-svg/examples.html), and the
[source](https://github.com/kahwee/sf-map-svg).

For developers, explain the explicit geography imports, SVG export, and zero
runtime dependencies. For a local audience, lead with the boundary changes and
neighborhood definitions. Check the chosen community's current posting rules.

Software is MIT; geography retains the attribution and terms in
[SOURCES.md](../SOURCES.md).
