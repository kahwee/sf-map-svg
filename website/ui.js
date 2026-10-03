// Shared interface pieces for the site: segmented controls, code blocks, and copying.

/** @template {keyof HTMLElementTagNameMap} T
 * @param {T} tag
 * @param {string} [text]
 * @param {string} [className]
 * @returns {HTMLElementTagNameMap[T]}
 */
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export { element };

/**
 * A segmented control whose pill slides to the pressed option.
 * `options` is [{ value, label }]; `onChange(value)` runs on user choice.
 */
export function segmented(host, { label, options, value, onChange }) {
  host.classList.add('segmented');
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', label);
  const pill = element('span', undefined, 'pill');
  pill.setAttribute('aria-hidden', 'true');
  const buttons = options.map((option) => {
    const button = element('button', option.label);
    button.type = 'button';
    button.dataset.value = String(option.value);
    button.addEventListener('click', () => {
      set(option.value);
      onChange(option.value);
    });
    return button;
  });
  host.replaceChildren(pill, ...buttons);
  function place() {
    const active = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
    if (!active) return;
    pill.style.width = `${active.offsetWidth}px`;
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
  }
  function set(next) {
    for (const button of buttons)
      button.setAttribute('aria-pressed', String(button.dataset.value === String(next)));
    place();
  }
  set(value);
  new ResizeObserver(place).observe(host);
  return { set };
}

const keywords =
  /\b(import|from|export|const|let|await|async|function|return|new|true|false|null|undefined|if|else|for|of)\b/g;
/** Minimal JavaScript highlighting: comments, strings, and keywords. Input is plain text. */
export function highlight(code) {
  const escapeHtml = (text) =>
    text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return code
    .split(/(\/\/[^\n]*|'[^'\n]*'|`[^`]*`|"[^"\n]*")/g)
    .map((part, index) => {
      if (index % 2) {
        const safe = escapeHtml(part);
        return part.startsWith('//')
          ? `<span class="tok-c">${safe}</span>`
          : `<span class="tok-s">${safe}</span>`;
      }
      return escapeHtml(part).replace(keywords, '<span class="tok-k">$1</span>');
    })
    .join('');
}

const copyStates = new WeakMap();

/** Copy text, then announce the result without losing icons or accessible labels. */
export async function copyText(button, text) {
  const state = copyStates.get(button) ?? { original: [...button.childNodes] };
  clearTimeout(state.timer);
  copyStates.set(button, state);
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Select to copy';
  }
  state.timer = setTimeout(() => {
    button.replaceChildren(...state.original);
    copyStates.delete(button);
  }, 1600);
}

/**
 * Enhance every `.code` block on the page: highlight its source and wire its copy button.
 * Blocks stay readable, selectable plain text without JavaScript.
 */
export function enhanceCode(root = document) {
  for (const block of root.querySelectorAll('.code')) {
    const pre = block.querySelector('pre code, pre');
    if (!pre || pre.dataset.highlighted) continue;
    const source = pre.textContent;
    pre.innerHTML = highlight(source);
    pre.dataset.highlighted = '';
    block.querySelector('.copy')?.addEventListener('click', (event) => {
      copyText(event.currentTarget, source);
    });
  }
}

/** Replace a code block's text, keeping highlighting and the copy button's source current. */
export function setCode(block, source) {
  const pre = block.querySelector('pre code, pre');
  pre.innerHTML = highlight(source);
  pre.dataset.highlighted = '';
  const copy = block.querySelector('.copy');
  if (copy && !copy.dataset.wired) {
    copy.dataset.wired = '';
    copy.addEventListener('click', () => copyText(copy, block.dataset.source ?? ''));
  }
  block.dataset.source = source;
}
