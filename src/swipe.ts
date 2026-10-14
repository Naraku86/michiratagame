export function isDismissSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function dismissOnSwipe(menu: HTMLDetailsElement): void {
  let start: { id: number; x: number; y: number } | undefined;
  let blockClickUntil = 0;
  menu.addEventListener('pointerdown', (event) => {
    start = undefined;
    if (!menu.open || !event.isPrimary || event.pointerType !== 'touch' ||
      !matchMedia('(max-width: 47.99rem), (pointer: coarse)').matches ||
      (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]'))) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  menu.addEventListener('pointerup', (event) => {
    if (start?.id !== event.pointerId) return;
    const dismiss = isDismissSwipe(event.clientX - start.x, event.clientY - start.y);
    start = undefined;
    if (!dismiss) return;
    blockClickUntil = performance.now() + 400;
    menu.open = false;
    menu.querySelector<HTMLElement>(':scope > summary')?.focus({ preventScroll: true });
  });
  menu.addEventListener('pointercancel', () => { start = undefined; });
  menu.addEventListener('click', (event) => {
    if (performance.now() < blockClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}
