import { useEffect, type RefObject } from 'react';

/**
 * Keep Tab inside an open overlay, and stop the page behind it from scrolling.
 *
 * Both overlays in the shell declared `aria-modal="true"`, which tells assistive
 * technology the rest of the page is inert — while Tab happily walked straight
 * out of the drawer and into the search box behind the backdrop, and the page
 * scrolled under it. A claim the behaviour contradicts is worse than no claim,
 * so the behaviour is made to match.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has escaped the overlay
      // entirely (which is what happens on the very first Tab, when focus still
      // sits on the trigger outside).
      if (e.shiftKey) {
        if (current === first || !node.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !node.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
    };
  }, [ref, active]);
}
