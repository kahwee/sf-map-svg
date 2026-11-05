// @ts-check
/** @typedef {{yes: number, no: number, undervotes?: number, overvotes?: number}} Votes */
/** @typedef {{id: string, title: string, citywide: Votes, districts: (Votes & {district: number})[]}} Measure */

/** @param {Votes} votes */
export function yesShare(votes) {
  const total = votes.yes + votes.no;
  return total ? votes.yes / total : null;
}

/** @param {{threshold: string, citywide: Votes}} measure */
export function passed(measure) {
  const { yes, no } = measure.citywide;
  return measure.threshold === 'two-thirds' ? yes * 3 >= (yes + no) * 2 : yes > no;
}

/** @param {number | null} share */
export function shareColor(share) {
  if (share === null) return '#d8dedb';
  const start = [240, 244, 232];
  const end = [37, 105, 103];
  return `rgb(${start.map((v, i) => Math.round(v + ((end[i] ?? v) - v) * share)).join(',')})`;
}

/** @param {string} hash
 * @param {string[]} ids
 */
export function readView(hash, ids) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const requested = params.get('measure') ?? '';
  const measure = ids.includes(requested) ? requested : ids[0];
  const district = Number(params.get('district'));
  const compare = params.get('compare') ?? '';
  return {
    measure,
    district: Number.isInteger(district) && district >= 0 && district <= 11 ? district : 0,
    compare: ids.includes(compare) && compare !== measure ? compare : '',
    mode: ['yes', 'no', 'districts'].includes(params.get('mode') ?? '')
      ? params.get('mode')
      : 'yes',
    labels: params.get('labels') !== '0',
  };
}

/** @param {{electionDate: string, source: string}} election
 * @param {Measure[]} measures
 */
export function resultsCsv(election, measures) {
  /** @type {(string | number)[][]} */
  const rows = [
    [
      'Election',
      'Measure',
      'Title',
      'Area',
      'Yes',
      'No',
      'Valid votes',
      'Yes share (%)',
      'Undervotes',
      'Overvotes',
      'Source',
    ],
  ];
  for (const m of measures) {
    for (const row of [{ district: 0, ...m.citywide }, ...m.districts]) {
      const share = yesShare(row);
      rows.push([
        election.electionDate,
        m.id,
        m.title,
        row.district ? `District ${row.district}` : 'San Francisco',
        row.yes,
        row.no,
        row.yes + row.no,
        share === null ? '' : (100 * share).toFixed(4),
        row.undervotes ?? '',
        row.overvotes ?? '',
        election.source,
      ]);
    }
  }
  return `${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;
}

/** @param {number | null} share */
export function noShareColor(share) {
  if (share === null) return '#d8dedb';
  const start = [247, 240, 226];
  const end = [160, 78, 44];
  return `rgb(${start.map((v, i) => Math.round(v + ((end[i] ?? v) - v) * share)).join(',')})`;
}
