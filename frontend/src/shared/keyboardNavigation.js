const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]';
const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

export function focusableElements(container) {
  const view = container.ownerDocument?.defaultView || container.defaultView;
  return [...container.querySelectorAll(FOCUSABLE)].filter(element => {
    if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const style = view.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
  });
}

function spatialTarget(elements, current, key) {
  const origin = current.getBoundingClientRect();
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  const from = center(origin);
  let best = null;
  let bestScore = Infinity;
  for (const element of elements) {
    if (element === current) continue;
    const to = center(element.getBoundingClientRect());
    const forward = (horizontal ? to.x - from.x : to.y - from.y) * sign;
    if (forward <= 1) continue;
    const sideways = Math.abs(horizontal ? to.y - from.y : to.x - from.x);
    const score = forward + sideways * 3;
    if (score < bestScore) { best = element; bestScore = score; }
  }
  return best;
}

export function handleArrowNavigation(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || !ARROW_KEYS.has(event.key)) return;
  const target = event.target;
  if (!target?.closest) return;
  // Edición, combobox, radios y deslizadores conservan sus teclas nativas.
  if (target.closest('textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="slider"]')) return;
  if (target.matches('input:not([type="checkbox"])')) return;
  if (!target.matches(FOCUSABLE)) return;

  const group = target.closest('[data-keyboard-group]');
  if (!group && (event.key === 'Home' || event.key === 'End' || target.matches('input'))) return;
  const elements = focusableElements(group || target.ownerDocument);
  const current = elements.indexOf(target);
  if (current < 0) return;
  let next;
  if (event.key === 'Home') next = elements[0];
  else if (event.key === 'End') next = elements.at(-1);
  else if (group?.dataset.keyboardGroup === 'grid') next = spatialTarget(elements, target, event.key);
  else {
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const index = current + step;
    next = group ? elements[(index + elements.length) % elements.length] : elements[index];
  }
  if (!next || next === target) return;
  event.preventDefault();
  next.focus({ preventScroll: true });
  next.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}

export function installKeyboardNavigation(document) {
  document.addEventListener('keydown', handleArrowNavigation);
  return () => document.removeEventListener('keydown', handleArrowNavigation);
}
