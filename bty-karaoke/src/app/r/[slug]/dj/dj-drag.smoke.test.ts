// Source guards for the Admin-Controls queue-drag fluidity invariants (V5.1).
// These are client-component behaviors that can't run in the node env, so we pin
// the anti-jank structure to source: Display stays read-only, the optimistic
// order is HELD (no drop flash), rows are memoized, and the drag is transform-
// based off a touch-action:none handle.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url)); // …/dj/
const dj = readFileSync(here + 'DjBoard.tsx', 'utf8');
const display = readFileSync(here + '../display/DisplayClient.tsx', 'utf8');
const css = readFileSync(here + '../../../globals.css', 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const djCode = code(dj);
const displayCode = code(display);

/** The CSS block for a selector, `.sel { … }`. */
function cssBlock(sel: string): string {
  const i = css.indexOf(sel + ' {');
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i));
}

describe('Display stays read-only (no drag / reorder)', () => {
  it('DisplayClient has no dnd / sortable / reorder controls', () => {
    expect(displayCode).not.toMatch(/DndContext|useSortable|DragOverlay|SortableContext/);
    expect(displayCode).not.toMatch(/reorder/i);
  });
});

describe('Admin Controls owns the reorder, transform-based off a handle', () => {
  it('DjBoard uses dnd-kit sortable with a stable request-id key', () => {
    expect(dj).toContain('DndContext');
    expect(dj).toContain('useSortable(');
    expect(dj).toContain('key={r.id}');
    expect(dj).toContain('CSS.Translate.toString(transform)'); // transform-based move, not top/left
  });
  it('the grip handle is the drag activator and is touch-action:none', () => {
    expect(dj).toContain('setActivatorNodeRef');
    expect(cssBlock('.q-handle')).toMatch(/touch-action:\s*none/);
  });
});

describe('optimistic order is HELD until a fresh poll reconciles (no drop flash)', () => {
  it('reconcile uses the pure decision and only settles when idle', () => {
    expect(dj).toContain('reconcileDecision(');
    expect(dj).toMatch(/reconcileDecision\(override, serverWaitingIds\)\s*!==\s*'hold'/);
  });
  it('a successful save keeps the override (refresh, NOT snap-back)', () => {
    // In the ok branch we refresh and do NOT clear the override.
    expect(djCode).toMatch(/result === 'ok'\)\s*\{[^}]*onRefresh\(\)/);
    expect(djCode).not.toMatch(/result === 'ok'\)\s*\{[^}]*setOverride\(null\)/);
  });
  it('only a failed save rolls back with an inline error', () => {
    expect(dj).toContain('순서를 저장하지 못했습니다');
    expect(dj).toContain('reorder-error');
  });
});

describe('rows are render-isolated so a 4s poll does not re-render every card', () => {
  it('SortableQueueCard is memoized and takes a stable onOpenSheet', () => {
    expect(dj).toMatch(/const SortableQueueCard = memo\(/);
    expect(dj).toContain('onOpenSheet={openSheet}');
    expect(dj).toMatch(/const openSheet = useCallback/);
  });
});

describe('CSS avoids layout-thrashing move animations', () => {
  it('the queue card block has no transition: all and no top/left animation', () => {
    const block = cssBlock('.q-card');
    expect(block).not.toMatch(/transition:\s*all/);
    expect(block).not.toMatch(/\btop:\s|\bleft:\s/);
  });
});

describe('drag motion polish (V5.1.1) — placeholder, collision, drop, transition', () => {
  it('the source slot is a FAINT ghost, not a heavy empty box', () => {
    const block = cssBlock('.q-card.placeholder');
    // Low opacity, transparent background, weak solid border — never the big
    // dashed/filled box that competed with the lifted overlay.
    expect(block).toMatch(/opacity:\s*0\.(0|1|2)\d?/); // <= ~0.25
    expect(block).toMatch(/background:\s*transparent/);
    expect(block).not.toMatch(/border-style:\s*dashed/);
    // It keeps its space (height) — content is hidden, the row is NOT display:none.
    expect(djCode).not.toMatch(/display:\s*['"]?none/);
  });

  it('displaced neighbours use a short transform transition (not the ~200ms default, not "all")', () => {
    expect(djCode).toMatch(/transition:\s*\{\s*duration:\s*160/);
    expect(djCode).toMatch(/cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/);
    // The overlay itself carries no position transition (it follows the finger).
    expect(cssBlock('.q-card.overlay')).not.toMatch(/transition:/);
  });

  it('collision uses the hysteresis helper (no boundary flicker), not bare closestCenter', () => {
    expect(djCode).toContain('resolveVerticalOverId(');
    expect(djCode).toMatch(/collisionDetection=\{collisionDetection\}/);
    expect(djCode).toContain('overIdRef'); // previous-over kept in a ref (no re-render)
  });

  it('the drop animation is disabled so the optimistic list lands once (no double landing)', () => {
    expect(djCode).toMatch(/dropAnimation=\{null\}/);
  });

  it('the server mutation still fires only on drop end (drop-only sorting preserved)', () => {
    // No onDragOver reorder — arrayMove/applyReorder happens in onDragEnd only.
    expect(djCode).not.toMatch(/onDragOver/);
    expect(djCode).toMatch(/function onDragEnd[\s\S]*applyReorder\(/);
  });
});
