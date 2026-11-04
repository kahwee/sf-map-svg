import { dot } from '@tanstack/charts/dot';
import { lineY } from '@tanstack/charts/line';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { createChartScene, defineChart } from '@tanstack/charts/scene';
import { renderChartSvg } from '@tanstack/charts/svg';

// Published 1.2.1 ChartCurve API. Horizontal holds and vertical corrections show
// cumulative snapshots, never interpolation or invented observations.
export const reportSteps = {
  line(points) {
    return points.map(([x, y], i) => (i ? `H${x}V${y}` : `M${x},${y}`)).join('');
  },
  area() {
    throw new Error('Election snapshots do not use filled interpolated areas');
  },
};

export function renderElectionChart(values, { share, batch, unit, label }) {
  const rows = values.map((value, index) => ({ value, index: String(index + 1) }));
  const max = share ? 100 : Math.max(1, ...values);
  const marks = [];
  if (rows.length > 1)
    marks.push(
      lineY(rows, {
        x: 'index',
        y: 'value',
        curve: reportSteps,
        stroke: 'var(--accent)',
        strokeWidth: 2,
      }),
    );
  marks.push(
    dot(rows, {
      x: 'index',
      y: 'value',
      r: (row) => (Number(row.index) - 1 === batch ? 5 : 3),
      fill: 'var(--accent)',
    }),
  );
  const definition = defineChart({
    marks,
    scales: {
      x: {
        scale: () => scalePoint().padding(0.15),
        grid: { stroke: 'var(--muted)', strokeOpacity: 0.2, strokeDasharray: '2 4' },
        axis: {
          label: { text: `${unit} (release order)`, fontSize: 13, opacity: 1 },
          ticks: { size: 0 },
          tickLabels: { fontSize: 14, opacity: 1 },
        },
      },
      y: {
        scale: scaleLinear().domain([0, max]),
        nice: !share,
        grid: { stroke: 'var(--muted)', strokeOpacity: 0.35 },
        axis: {
          label: {
            text: share ? 'Reported vote share (%)' : 'Reported votes',
            fontSize: 13,
            opacity: 1,
          },
          ticks: {
            count: 4,
            size: 0,
            format: (value) =>
              share
                ? `${value}%`
                : new Intl.NumberFormat('en-US', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(value),
          },
          tickLabels: { fontSize: 14, opacity: 1 },
        },
      },
    },
    margin: { top: 12, right: 14, bottom: 42, left: 64 },
    theme: {
      focusRing: false,
      foreground: 'var(--ink)',
      muted: 'var(--ink)',
      grid: 'var(--rule)',
      background: 'transparent',
      palette: ['var(--accent)'],
    },
  });
  return renderChartSvg(createChartScene(definition, { width: 400, height: 210 }), {
    ariaLabel: label,
    tabIndex: -1,
    ariaDescription:
      'Discrete cumulative snapshots in release order. Guide lines show the value scale; exact values are available in Table view.',
    idPrefix: 'election-trend',
  }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
}
