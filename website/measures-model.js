export function yesShare(votes) {
  const total = votes.yes + votes.no;
  return total ? votes.yes / total : null;
}

export function passed(measure) {
  const { yes, no } = measure.citywide;
  return measure.threshold === 'two-thirds' ? yes * 3 >= (yes + no) * 2 : yes > no;
}

export function shareColor(share) {
  if (share === null) return '#d8dedb';
  const start = [240, 244, 232];
  const end = [37, 105, 103];
  return `rgb(${start.map((v, i) => Math.round(v + (end[i] - v) * share)).join(',')})`;
}

export function readView(hash, ids) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const measure = ids.includes(params.get('measure')) ? params.get('measure') : ids[0];
  const district = Number(params.get('district'));
  const compare = params.get('compare');
  return {
    measure,
    district: Number.isInteger(district) && district >= 0 && district <= 11 ? district : 0,
    compare: ids.includes(compare) && compare !== measure ? compare : '',
    mode: ['yes', 'no', 'districts'].includes(params.get('mode')) ? params.get('mode') : 'yes',
    labels: params.get('labels') !== '0',
  };
}

export function resultsCsv(election, measures) {
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
      rows.push([
        election.electionDate,
        m.id,
        m.title,
        row.district ? `District ${row.district}` : 'San Francisco',
        row.yes,
        row.no,
        row.yes + row.no,
        yesShare(row) === null ? '' : (100 * yesShare(row)).toFixed(4),
        row.undervotes,
        row.overvotes,
        election.source,
      ]);
    }
  }
  return `${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;
}

export function noShareColor(share) {
  if (share === null) return '#d8dedb';
  const start = [247, 240, 226];
  const end = [160, 78, 44];
  return `rgb(${start.map((v, i) => Math.round(v + (end[i] - v) * share)).join(',')})`;
}
