/** Apply the shared dropdown to dynamically supplied native single-selects.
 * Retains the original node, labels, listeners and selection. Safe to repeat.
 */
export function enhanceDropdowns(root) {
  for (const select of root.querySelectorAll('select')) {
    if (select.multiple || select.size > 1 || select.classList.contains('dropdown-control'))
      continue;
    const wrapper = document.createElement('span');
    wrapper.className = 'dropdown';
    select.before(wrapper);
    select.classList.add('dropdown-control');
    wrapper.append(select);
  }
}
