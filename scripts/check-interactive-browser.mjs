// Run via agent-browser eval after serving the repository root; no test runtime dependency.
import { createInteractiveSFMap } from '../dist/src/interactive.js';

export async function checkInteractiveBrowser() {
  let assertions = 0;
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    assertions++;
  };
  const settle = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const host = document.createElement('div');
  document.body.append(host);
  const maps = [];
  try {
    for (const theme of ['districts', 'transit']) {
      const map = createInteractiveSFMap({
        theme,
        mode: 'neighborhoods',
        source: 'analysis',
        labelSize: { min: 12, max: 15 },
      });
      maps.push(map);
      host.replaceChildren(map);
      const svg = map.querySelector('svg');
      let selection,
        viewportEvents = 0;
      map.addEventListener('neighborhoodchange', (event) => {
        selection = event.detail;
      });
      map.addEventListener('viewportchange', () => {
        viewportEvents++;
      });
      for (const width of [350, 390, 960]) {
        host.style.width = `${width}px`;
        for (const size of [800, 400, 800 / 12]) {
          map.setViewport([(800 - size) / 2, (800 - size) / 2, size]);
          await settle();
          const labels = [...map.querySelectorAll('[data-layer=explorer-labels] text')];
          if (size >= 400)
            check(labels.length > 0, `Expected labels: ${theme}, ${width}px, size ${size}`);
          for (const text of labels) {
            const font = parseFloat(text.getAttribute('font-size')) * text.getScreenCTM().a;
            check(font >= 12 - 0.01 && font <= 15 + 0.01, `Label size ${font}`);
          }
          const boxes = labels.map((text) => text.getBoundingClientRect());
          for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i],
                b = boxes[j];
              check(
                a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
                'Labels overlap',
              );
            }
          const canvas = map.querySelector('.sf-explorer-canvas');
          check(
            map.querySelector('.sf-explorer-toolbar').scrollWidth <= map.clientWidth,
            'Toolbar overflows',
          );
          check(canvas.getBoundingClientRect().width <= width, 'Canvas overflows');
        }
      }
      map.setViewport([200, 200, 400]);
      const saved = map.getViewport();
      map.setViewport(saved);
      const n = viewportEvents;
      map.setViewport(saved);
      check(viewportEvents === n, 'Controlled viewport feedback loop');
      map.selectNeighborhood('Mission', { fit: false });
      check(
        selection.name === 'Mission' && selection.source === 'analysis' && !!selection.id,
        'Stable source selection payload',
      );
      check(JSON.stringify(map.getViewport()) === JSON.stringify(saved), 'fit:false changed view');
      map.selectNeighborhood(null);
      check(selection.id === null && map.getSelection() === null, 'Selection clearing');
      map.setSource('sf-find');
      check(map.querySelector('desc').textContent.includes('2006'), 'SF Find attribution vintage');
      map.setSource('realtor');
      check(map.querySelector('desc').textContent.includes('2010'), 'Realtor attribution vintage');
      map.setViewport([200, 200, 400]);
      svg.focus();
      svg.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
      check(map.getViewport()[0] > 200, 'Keyboard pan');
      svg.dispatchEvent(
        new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }),
      );
      check(map.getViewport()[2] < 400, 'Keyboard zoom');
      map.setTouchNavigation(true);
      check(
        getComputedStyle(map.querySelector('.sf-explorer-canvas')).touchAction === 'none',
        'Engaged touch',
      );
      svg.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      check(
        getComputedStyle(map.querySelector('.sf-explorer-canvas')).touchAction.includes('pan-y'),
        'Escape restores scroll',
      );
      const path = map.querySelector('[data-neighborhood-id]');
      path.focus();
      path.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      check(
        map.getSelection()?.id === path.dataset.neighborhoodId,
        'Keyboard neighborhood selection',
      );
      check(document.activeElement === path, 'Neighborhood selection lost focus');
      path.dispatchEvent(
        new KeyboardEvent('keydown', { key: ']', bubbles: true, cancelable: true }),
      );
      check(
        document.activeElement !== path && document.activeElement.dataset.neighborhoodId,
        'Roving neighborhood focus',
      );
      const markers = Array.from({ length: 36 }, (_, i) => ({
        id: `p${i}`,
        label: `Place ${i}`,
        lng: -122.42,
        lat: 37.77,
      }));
      map.setMarkers(markers);
      const select = map.querySelectorAll('.sf-explorer-feature-controls select')[1];
      check(select.options.length === 37, 'Dense marker menu lost members');
      for (const marker of markers) {
        select.value = marker.id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        check(map.getSelectedMarker()?.id === marker.id, 'Overlapping marker unreachable');
      }
      await settle();
      const hit = map.querySelector('[data-marker-id] circle');
      check(Math.abs(hit.getBoundingClientRect().width - 44) < 0.1, '44px marker target');
      let markerChanges = 0;
      map.addEventListener('markerchange', () => {
        markerChanges++;
      });
      map.selectMarker('p35', { fit: false });
      check(markerChanges === 0, 'Controlled marker feedback loop');
      map.setMarkers([]);
      check(
        map.getSelectedMarker() === null && markerChanges === 1,
        'Removed marker selection not cleared',
      );
      map.fitGeometry(
        {
          type: 'MultiPoint',
          coordinates: [
            [-122.45, 37.75],
            [-122.41, 37.78],
          ],
        },
        { left: 20, right: 30, top: 40, bottom: 50 },
      );
      check(map.getViewport().every(Number.isFinite), 'Invalid fitted viewport');
      map.setMode('basemap');
      check(
        !/district|realtor|neighborhood/i.test(map.querySelector('desc').textContent),
        'Hidden boundary attribution remains',
      );
      map.destroy();
      const stopped = map.getViewport();
      svg.dispatchEvent(
        new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }),
      );
      check(
        JSON.stringify(stopped) === JSON.stringify(map.getViewport()),
        'Destroy leaves navigation listener',
      );
    }
    const plain = createInteractiveSFMap({
      layers: { landmarks: false, bartStations: false, highways: false, keyRoads: false },
    });
    maps.push(plain);
    host.replaceChildren(plain);
    await settle();
    check(plain.dataset.mode === 'basemap', 'New interactive default must be basemap');
    check(
      !/district|neighborhood|BART|Park property|Road geometry/i.test(
        plain.querySelector('desc').textContent,
      ),
      'Plain map description',
    );
    return {
      assertions,
      themes: 2,
      widths: [350, 390, 960],
      zoom: [1, 2, 12],
      physicalDevices: 'not tested',
    };
  } finally {
    for (const map of maps) map.destroy();
    host.remove();
  }
}
