# Screenshots and screencasts

Captured October 11, 2026 from renderer commit `e6ebc5b` in Chromium. The recordings use the deterministic 2,000-marker catalog in `stories/Performance.stories.ts`, after each story's interaction checks finish.

| View | Screenshot | Screencast | Viewport | Duration |
| --- | --- | --- | --- | --- |
| Desktop | [PNG](markers-2000-desktop.png) | [WebM](markers-2000-desktop.webm) | 1280 × 1200 | 15.1 s |
| Phone | [PNG](markers-2000-phone.png) | [WebM](markers-2000-phone.webm) | 390 × 960 | 13.9 s |

The [generated-example preview](../map-preview.png) is captured at 1440 × 1280. Both the example page and marker story were inspected at desktop and 390 px widths, with no browser errors or horizontal overflow at phone width.

The storyboard starts with clustering enabled, then:

1. Disable clustering to show the full city catalog.
2. Zoom in twice and pan east; the visible pin count falls as markers leave the viewport.
3. Update labels while retaining marker IDs.
4. Select `pin-0` from the complete picker; selection fits the marker into view.
5. Zoom out, reset to city view, and restore clustering.

Videos use VP8 WebM encoded at 30 fps, with approximately 900 ms between actions. Optional English action captions accompany each silent recording on the [Pages examples page](https://kahwee.github.io/sf-map-svg/examples.html#marker-recordings). The encoding rate is not a measured rendering frame rate. See the README benchmark results for performance measurements. These files are excluded from the npm package and do not affect runtime bundle size.

## Refreshing the captures

Build the demo and Storybook, then serve the repository locally:

```sh
pnpm demo
pnpm build-storybook
python3 -m http.server 4176 --bind 127.0.0.1
```

Use an isolated Agent Browser session. For desktop, set the viewport to `1280 1200` and open `http://127.0.0.1:4176/storybook-static/iframe.html?id=checks-2000-markers--desktop&viewMode=story`. For phone, use `390 960` and the story ID `checks-2000-markers--phone`.

Wait until the marker option for `pin-0` contains `update 1` and the zoom indicator reads `100%`; this confirms the story checks have finished. Save the initial screenshot, start recording the current tab, perform the storyboard above, and stop the recording:

```sh
export AGENT_BROWSER_SESSION=sf-media-refresh
agent-browser set viewport 1280 1200
agent-browser open 'http://127.0.0.1:4176/storybook-static/iframe.html?id=checks-2000-markers--desktop&viewMode=story'
agent-browser wait --fn 'document.querySelector("option[value=pin-0]")?.textContent.includes("update 1") && document.querySelector(".sf-explorer-zoom")?.textContent.includes("100%")'
agent-browser screenshot /tmp/markers-2000.png
agent-browser record start /tmp/markers-2000.webm --cursor --contact-sheet
# Perform the storyboard using the outer story buttons and marker picker.
agent-browser record stop
agent-browser errors
agent-browser close
```

Inspect the screenshot, contact sheet, and video metadata before copying approved PNG/WebM files here. Keep annotated contact sheets and other temporary captures outside git. Capture the generated-example page at `/examples/generated/index.html` after all SVG images load.

Review visual test images before updating expectations, then verify a fresh run:

```sh
pnpm test:visual --update-snapshots
pnpm test:visual
```

Refresh each platform's expectations on that platform. These captures update the five workspace Linux baselines; Darwin baselines require a macOS run. GitHub Actions uses separate `linux-github` expectations because its Ubuntu system fonts differ from this workspace. Those expectations retain the images from the last passing Pages deployment at `e6ebc5b`; keep screenshot comparisons strict in both environments.
