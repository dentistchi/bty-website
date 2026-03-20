import type { LeadershipState } from "@/features/my-page/logic/types";
import { SummaryCard } from "./SummaryCard";

type Props = {
  state: LeadershipState;
  labelAir: string;
  labelTii: string;
  labelRhythm: string;
};

export function SummaryCardsRow({ state, labelAir, labelTii, labelRhythm }: Props) {
  return (
    <section data-testid="my-page-summary-row" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard data-testid="my-page-summary-insight" label={labelAir} value={state.airLabel} />
      <SummaryCard data-testid="my-page-summary-influence" label={labelTii} value={state.tiiLabel} />
      <SummaryCard data-testid="my-page-summary-rhythm" label={labelRhythm} value={state.rhythmLabel} />
    </section>
  );
}
