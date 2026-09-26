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
