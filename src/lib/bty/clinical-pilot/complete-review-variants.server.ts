import type { DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { buildCompleteReviewVariants } from "./case-review-builder.server";
import { medicalReviewPlans } from "./complete-medical-plans.server";
import { preventionReviewPlans } from "./complete-prevention-plans.server";
import { surgicalReviewPlans } from "./complete-surgical-plans.server";

/** Fixed new copies only; historical packs and recorded references stay intact. */
export const completeReviewVariants = (patients: readonly DiscoveryPatient[]) =>
  buildCompleteReviewVariants(patients, [...medicalReviewPlans, ...preventionReviewPlans, ...surgicalReviewPlans]
    .sort((a, b) => a.caseId.localeCompare(b.caseId)));
