import { useEffect, type RefObject } from 'react';

/**
 * Keep Tab inside the TOPMOST open overlay, and stop the page behind it scrolling.
 *
 * Both overlays in the shell declared `aria-modal="true"` — a promise to assistive
 * tech that the rest of the page is inert — while Tab walked straight out of the
 * drawer into the search box behind the backdrop. So the promise was a lie, and
 * the behaviour was made to match.
 *
 * The first version of this fix treated `document.body.style.overflow` and the
 * keydown listener as if only one overlay could ever be open. Two can: Ctrl+K
 * opens the command bar from inside the mobile drawer. With two independent
 * instances there was no "topmost", and every global they touched was corrupted:
 *
 *   - Body scroll: the second overlay to open captured 'hidden' — already set by
 *     the first — as "the value to restore", so once both closed the page could
 *     be left permanently unscrollable.
 *   - Tab: neither trap's container holds the other's focus, so BOTH judged every
 *     Tab an escape and both yanked focus back. Focus ping-ponged between the two
 *     overlays instead of cycling inside either.
 *
 * Hence a stack. Only the last trap to open is active; it alone owns Tab. Body
 * scroll is locked by the FIRST trap on the stack and restored only when the
 * stack empties, so the original value is the one that comes back.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open traps, oldest first. The last entry is the topmost overlay. */
const stack: symbol[] = [];
let restoreOverflow: string | null = null;

/**
 * The element that actually scrolls.
 *
 * The lock used to be written to `document.body`, and a check that read
 * `getComputedStyle(document.body).overflow === 'hidden'` duly reported success —
 * while the page scrolled underneath the drawer exactly as before. `index.css`
 * puts `overflow-y: scroll` on `html`, so `<html>` is the scrolling box and
 * `body` is not; setting overflow on body does nothing at all. The property was
 * set. The behaviour was unchanged. Lock the box that scrolls, and prove it by
 * scrolling, not by reading back the property you just wrote.
 */
const scrollBox = (): HTMLElement =>
  (document.scrollingElement as HTMLElement | null) ?? document.documentElement;

/** True when `id` is the topmost open trap — i.e. it owns the keyboard. */
export function isTopmostTrap(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  id: symbol,
): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    stack.push(id);
    // Only the first overlay records the page's real overflow. A later one would
    // record 'hidden' — the value the first just wrote — and restore that.
    if (stack.length === 1) {
      restoreOverflow = scrollBox().style.overflow;
      scrollBox().style.overflow = 'hidden';
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      // A trap that is not on top has no say: the overlay above it owns the
      // keyboard, and its own container is behind a backdrop.
      if (!isTopmostTrap(id)) return;

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed',
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has escaped the overlay
      // entirely — which is what happens on the very first Tab, while focus still
      // sits on the trigger outside.
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
      const i = stack.lastIndexOf(id);
      if (i !== -1) stack.splice(i, 1);
      if (stack.length === 0) {
        scrollBox().style.overflow = restoreOverflow ?? '';
        restoreOverflow = null;
      }
    };
  }, [ref, active, id]);
}
