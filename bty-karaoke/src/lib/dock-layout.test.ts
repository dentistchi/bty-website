import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Layout-invariant regression guard for the My Requests bottom sheet. Real pixel
// layout (overlap/clipping/scroll reachability) is a browser/device concern, but
// the ROOT CAUSES of the multi-request bug were CSS invariants we CAN pin here:
//   - rows must have a fixed min-height that does NOT depend on request count
//   - the list must be a real flex scroll viewport (flex:1 + min-height:0 + auto)
//   - the header stays fixed; cancel labels never wrap
//   - the component renders exactly one row per request (no collapsing/merging)

const css = readFileSync('src/app/globals.css', 'utf8');
const dock = readFileSync('src/app/r/[slug]/MyRequestsDock.tsx', 'utf8');

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing CSS rule ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('dock sheet layout invariants', () => {
  it('rows carry a fixed min-height (never shrink with count)', () => {
    const m = rule('.sheet-row').match(/min-height:\s*(\d+)px/);
    expect(m, '.sheet-row must set a px min-height').not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(60);
  });

  it('the list is a real internal scroll viewport', () => {
    const list = rule('.dock-sheet-list');
    expect(list).toMatch(/flex:\s*1/);
    expect(list).toMatch(/min-height:\s*0/);
    expect(list).toMatch(/overflow-y:\s*auto/);
  });

  it('the header/close stay fixed above the scrolling list', () => {
    expect(rule('.dock-sheet-head')).toMatch(/flex:\s*0\s+0\s+auto/);
  });

  it('the sheet height uses the dynamic viewport (iOS toolbar/safe-area aware)', () => {
    expect(rule('.dock-sheet')).toMatch(/max-height:\s*\d+dvh/);
    expect(css).toContain('calc(16px + var(--safe-b))');
  });

  it('cancel labels stay on one line', () => {
    expect(rule('.cancel-link')).toMatch(/white-space:\s*nowrap/);
    expect(rule('.cancel-commit')).toMatch(/white-space:\s*nowrap/);
  });

  it('renders one row per request and never scales row height by count', () => {
    expect(dock).toMatch(/requests\.map\(/);
    expect(dock).not.toMatch(/min-?height[^;]*requests\.length/i);
    // The swipe reveal must be invisible at rest (no ghost "신청 취소").
    expect(readFileSync('src/app/r/[slug]/SwipeableCard.tsx', 'utf8')).toMatch(
      /opacity:\s*dragging\s*\?\s*progress\s*:\s*0/,
    );
  });
});
