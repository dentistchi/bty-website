/**
 * MANAGER CANVAS — the one place a Foundry Manager surface decides how much width to take.
 *
 * WHAT WAS MEASURED (Slice R4-R4A → R4-R4B). The app shell's scroll container is
 * `<main className="… flex-1 overflow-y-auto px-5 pb-4 pt-8">` — no max-width, no breakpoints —
 * and not one of the five Manager surfaces carries a single responsive class. The repo has 258
 * Tailwind breakpoints and every one of them is in a legacy Arena screen.
 *
 * SO THE DESKTOP FAILURE IS THE OPPOSITE OF THE OBVIOUS ONE. The Manager screens do not render as
 * a phone card marooned in whitespace; they STRETCH. On a 1920px monitor a Builder question and
 * its help text run the full width minus 40px of padding, which is roughly 220 characters a line —
 * unreadable in a different way from a cramped phone. (The 448px `max-w-md` column IS real, but it
 * belongs to the learner rooms at `/f/[token]`, which this slice does not touch.)
 *
 * TWO DIFFERENT JOBS, TWO DIFFERENT WIDTHS. Prose has an optimal measure and stops benefiting from
 * space; work surfaces keep benefiting. Collapsing both into one container would either cramp the
 * roster or stretch the questions, so the variant is named after the JOB rather than a size:
 *
 *   measure    a question and its help text — a comfortable reading line, and it does NOT grow.
 *   wide       Review, Control Room — scannable state that earns more room as the screen allows.
 *   workspace  document setup — the most room, because a 100-page PDF is real work.
 *
 * MORE SPACE IS NOT MORE INFORMATION. These widths exist to bound line length and to let a few
 * existing blocks sit side by side. Nothing here adds a field, a metric, or a panel.
 */

export type ManagerCanvasWidth = "measure" | "wide" | "workspace";

/**
 * Deliberately literal rather than composed, so the full set of widths is greppable and a
 * reviewer can read what every breakpoint does without running Tailwind.
 *
 * Default screens (no custom `screens` key in tailwind.config.ts): sm 640 · md 768 · lg 1024 ·
 * xl 1280. `measure` intentionally has no breakpoints — that is the point of it.
 */
const WIDTH: Record<ManagerCanvasWidth, string> = {
  measure: "max-w-[34rem]",
  wide: "max-w-[34rem] md:max-w-[46rem] lg:max-w-[60rem]",
  workspace: "max-w-[34rem] md:max-w-[48rem] lg:max-w-[64rem] xl:max-w-[72rem]",
};

export function ManagerCanvas({
  width = "wide",
  className = "",
  children,
  testId,
}: {
  width?: ManagerCanvasWidth;
  className?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-manager-canvas={width}
      data-testid={testId}
      className={`mx-auto w-full ${WIDTH[width]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
