import { createTrend } from './trend.js';

export const formatTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        timeZoneName: 'short',
      })
    : 'not yet verified';
const scopeName = (contest) =>
  ({
    citywide: 'San Francisco',
    statewide: 'California',
    regional: 'Bay Area',
    district: 'District contest',
    'appellate-district': 'First Appellate District',
  })[contest.scope] || contest.scope;
export const contestLabel = (contest) =>
  contest.shortTitle
    ? `${contest.id === 'RTM' ? 'RTM' : `Prop ${contest.id.split('-').at(-1)}`} · ${contest.shortTitle}`
    : contest.title;

export function createContestView(contest, chartState = {}) {
  if (!contest) {
    return Object.assign(document.createElement('p'), {
      textContent: 'No matching contests. Change the search or filter.',
    });
  }
  const article = document.createElement('article');
  article.dataset.contestId = contest.id;
  const meta = Object.assign(document.createElement('p'), {
    className: 'contest-meta',
    textContent: `${contest.kind === 'measure' ? (contest.id === 'RTM' ? 'Regional measure' : `Proposition ${contest.id.split('-').at(-1)}`) : 'Ballot contest'} · ${contest.resultStatus ? '' : `${scopeName(contest)} · `}Uncalled`,
  });
  const title = Object.assign(document.createElement('h2'), {
    textContent: contest.shortTitle || contest.title,
  });
  article.append(meta, title);
  const totals = document.createElement('div');
  totals.className = 'contest-totals';
  const reported = contest.options.some((o) => o.votes !== null);
  const list = document.createElement('ul');
  list.className = 'vote-list';
  list.setAttribute('aria-label', 'Official vote totals');
  const total = contest.options.reduce((sum, option) => sum + (option.votes || 0), 0);
  for (const option of contest.options) {
    const row = document.createElement('li');
    const name = Object.assign(document.createElement('span'), { textContent: option.label });
    const votes = Object.assign(document.createElement('span'), {
      className: 'vote-count',
      textContent: option.votes === null ? 'Pending' : option.votes.toLocaleString('en-US'),
    });
    if (contest.kind === 'measure' && option.votes !== null && total > 0) {
      const share = (option.votes / total) * 100;
      votes.textContent += ` · ${share.toFixed(1)}%`;
      const bar = document.createElement('span');
      bar.className = 'vote-share';
      bar.style.width = `${share}%`;
      bar.setAttribute('aria-hidden', 'true');
      row.append(bar);
    }
    row.append(name, votes);
    list.append(row);
  }
  totals.append(list);
  const note = contest.resultStatus
    ? `SF county votes only · ${reported ? 'Unofficial' : 'Awaiting votes; source has a zero/pre-election report'}.`
    : 'Local results unavailable. Pending means unknown, not zero.';
  totals.append(
    Object.assign(document.createElement('p'), {
      className: 'result-note',
      textContent: `${note}${contest.resultCheckStatus && contest.resultCheckStatus !== 'ok' ? ' Latest source check failed; retained counts may be stale.' : ''}${contest.countingMethod === 'ranked-choice-first-choice' ? ' Ranked-choice: first choices do not determine the final winner.' : ''}`,
    }),
  );
  const details = document.createElement('div');
  details.className = 'contest-details';
  const source = Object.assign(document.createElement('a'), {
    href: contest.summarySource?.url || contest.sourceUrl,
    textContent: contest.summarySource
      ? `Official guide · printed page ${contest.summarySource.pages}`
      : 'Official ballot source',
  });
  details.append(source);
  if (contest.resultStatus) {
    const report = Object.assign(document.createElement('p'), { className: 'result-note' });
    report.append(
      Object.assign(document.createElement('a'), {
        href: contest.resultSourceUrl,
        textContent: 'California SOS',
      }),
      ` · Report: ${contest.sourceReportTime}.`,
    );
    totals.append(report);
  }
  totals.append(details);
  const dataGrid = document.createElement('div');
  dataGrid.className = 'contest-data-grid';
  dataGrid.append(totals, createTrend(contest, chartState));
  article.append(dataGrid);
  if (contest.summary) {
    const summary = Object.assign(document.createElement('p'), {
      className: 'contest-summary',
      textContent: contest.summary,
    });
    const explanation = document.createElement('section');
    explanation.className = 'contest-explanation';
    explanation.setAttribute('aria-label', 'What this measure does');
    explanation.append(summary);
    article.insertBefore(explanation, dataGrid);
  }
  return article;
}
