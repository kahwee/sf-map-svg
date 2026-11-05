// @ts-check
import { element } from './ui.js';

/** A visible failure message with a Retry button, for loads that can simply be attempted again.
 * @param {string} message
 * @param {() => void} retry
 */
export function retryNotice(message, retry) {
  const notice = element('div', undefined, 'load-retry');
  notice.setAttribute('role', 'alert');
  const button = element('button', 'Retry', 'button secondary small');
  button.type = 'button';
  button.addEventListener('click', () => {
    button.disabled = true;
    retry();
  });
  notice.append(element('p', message), button);
  return notice;
}

/** Starts a request and reports whether it is still the newest one, so a slow older response
 * cannot overwrite a later choice. Call the returned function after every await.
 */
export function latestRequest() {
  let newest = 0;
  return () => {
    const mine = ++newest;
    return () => mine === newest;
  };
}
