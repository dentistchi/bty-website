// Source guards for the V5.1.2 iPad drag-rendering RESET. The model is now:
// static list · one minimal overlay preview · a thin insertion line · frozen-rect
// index · one arrayMove on drop. These pin the anti-flicker architecture so a
// regression (e.g. re-introducing neighbour movement or a full-card overlay)
// fails CI.

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

function cssBlock(sel: string): string {
  const i = css.indexOf(sel + ' {');
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i));
}
/** The source between a start marker and the next end marker (exclusive). */
function between(src: string, startMarker: string, endMarker: string): string {
  const a = src.indexOf(startMarker);
  if (a < 0) return '';
  const b = src.indexOf(endMarker, a + startMarker.length);
  return src.slice(a, b < 0 ? undefined : b);
}

describe('Display stays read-only (no drag)', () => {
  it('DisplayClient has no dnd / sortable / reorder', () => {
    expect(displayCode).not.toMatch(/DndContext|useSortable|DragOverlay|reorder/i);
  });
});

describe('the list is STATIC during a drag (V5.1.2)', () => {
  it('rows take no transform/transition while frozen (no neighbour movement)', () => {
    expect(djCode).toContain('frozen={activeId != null}');
    expect(djCode).toMatch(/frozen\s*\?\s*\{\s*transform:\s*undefined,\s*transition:\s*'none'\s*\}/);
  });
  it('the dragged row is fully hidden (never double-paints under the overlay)', () => {
    expect(cssBlock('.q-card.dragging')).toMatch(/visibility:\s*hidden/);
    // The opacity-ghost placeholder is gone.
    expect(css).not.toContain('.q-card.placeholder');
  });
  it('a thin insertion line marks the drop slot (list does not reflow)', () => {
    expect(djCode).toContain('q-insert-line');
    expect(cssBlock('.q-insert-line')).toMatch(/position:\s*absolute/);
    expect(cssBlock('.q-insert-line')).toMatch(/pointer-events:\s*none/);
  });
});

describe('ONE minimal moving visual (V5.1.2)', () => {
  it('the overlay renders QueueDragPreview, not the full SortableQueueCard', () => {
    expect(djCode).toMatch(/<QueueDragPreview\s+r=\{r\}/);
    expect(djCode).not.toContain('q-card singer-first overlay');
  });
  it('the preview has NO useSortable, image, or button', () => {
    const preview = between(dj, 'function QueueDragPreview', 'interface QueuePayload');
    expect(preview).not.toMatch(/useSortable|<img|thumbnail|<button|onClick/);
  });
  it('the preview CSS carries pointer-events:none and no blur/backdrop-filter', () => {
    const block = cssBlock('.q-drag-preview');
    expect(block).toMatch(/pointer-events:\s*none/);
    expect(block).not.toMatch(/backdrop-filter|blur|filter:/);
    expect(block).not.toMatch(/transition:/);
  });
});

describe('one coordinate path: autoScroll off, no collision, frozen rects', () => {
  it('autoScroll is disabled', () => {
    expect(djCode).toContain('autoScroll={false}');
  });
  it('dnd-kit collision is disabled (we compute the slot ourselves)', () => {
    expect(djCode).toContain('collisionDetection={NO_COLLISION}');
    expect(djCode).toMatch(/const NO_COLLISION = \(\) => \[\]/);
  });
  it('rects are measured ONCE on lift, never per move', () => {
    // getBoundingClientRect only inside onDragStart; onDragMove uses the frozen snapshot.
    expect(between(dj, 'function onDragStart', 'function onDragMove')).toContain('getBoundingClientRect');
    const move = between(dj, 'function onDragMove', 'function onDragEnd');
    expect(move).not.toContain('getBoundingClientRect');
    expect(move).toContain('resolveInsertionIndex(');
  });
});

describe('drop-only sorting: one arrayMove on release', () => {
  it('there is no onDragOver; the order changes only in onDragEnd via insertAt', () => {
    expect(djCode).not.toMatch(/onDragOver/);
    expect(between(dj, 'function onDragEnd', 'function onDragCancel')).toContain('insertAt(');
  });
  it('no drop animation (the optimistic list already lands the row)', () => {
    expect(djCode).toContain('dropAnimation={null}');
  });
  it('SortableContext uses a stable memoized items reference', () => {
    expect(djCode).toContain('items={sortableIds}');
    expect(djCode).toMatch(/const sortableIds = useMemo/);
  });
});
