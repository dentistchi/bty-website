import type { DiscoveryChannel, DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import { CASE_DETAIL_NEXT_REVIEW_VERSION } from "./case-detail-next-variants.server";

export const isNextCaseDetailReview = (patient: DiscoveryPatient) => patient.version === CASE_DETAIL_NEXT_REVIEW_VERSION
  && ["drchi-002", "drchi-003", "drchi-008"].includes(patient.caseId);
type Subject = { id: string; topic: string; channel: DiscoveryChannel; suffixes: string[];
  historyIntentIds?: ("endodontic-history" | "cold-history" | "symptom-onset")[] };
const s = (id: string, topic: string, channel: DiscoveryChannel, ...suffixes: string[]): Subject => ({ id, topic, channel, suffixes });
const suffix = (fact: DiscoveryFact) => fact.id.slice(fact.id.lastIndexOf(":") + 1);
const rootSide = (q: string) => /\bmesial\b/iu.test(q) && !/\bdistal\b/iu.test(q) ? "mesial"
  : /\bdistal\b/iu.test(q) && !/\bmesial\b/iu.test(q) ? "distal" : undefined;
const controlTooth = (q: string) => [...q.matchAll(/(?:#\s*|\btooth\s*(?:number\s*)?#?\s*)(29|31)\b/giu)].map(m => m[1]);

/** Interpretation metadata only: every suffix points to a fixed registered fact.
 * No measurement, diagnosis, treatment decision or normal finding is generated. */
export function nextCaseDetailSubject(q: string, channel: DiscoveryChannel, patient: DiscoveryPatient): Subject | undefined {
  if (!isNextCaseDetailReview(patient)) return;
  const c = patient.caseId;
  if (/\b(?:which (?:tooth|side)|location)\b|\bwhere\b.{0,25}\b(?:tooth|sore|hurt|missing)\b/iu.test(q)) {
    return s("tooth-identity", "Presenting tooth identity", "patient", "location");
  }
  if (c === "drchi-003" && /\b(?:prefer|preference|want|like)\b/iu.test(q) && /\b(?:keep|save|preserv\w*|retain)\b/iu.test(q)) {
    return s("preservation-preference", "Patient preference about retaining the tooth", "patient", "preservation-preference");
  }
  if (/\b(?:should|recommend|prescribe|best treatment)\b/iu.test(q)) return;
  const medical = /\b(?:medical|health|illness\w*)\b/iu.test(q) && /\b(?:history|conditions?|health|illness\w*)\b/iu.test(q);
  const medicationQuestion = q.replace(/\b(?:drugs?|medications?|medicines?)\s+(?:(?:or|and)\s+(?:latex|materials?)\s+)?allerg\w*/giu, "allergies");
  const medicines = /\b(?:medications?|medicines?|meds|prescriptions?|supplements?|drugs?)\b/iu.test(medicationQuestion);
  if (medical || medicines || /\ballerg\w*\b|\blatex\b/iu.test(q)) {
    return s("general-history", "Requested general medical history", "patient",
      ...(medical ? [c === "drchi-008" ? "medical" : "medical-history"] : []),
      ...(medicines ? ["medications"] : []), ...(/\ballerg\w*\b|\blatex\b/iu.test(q) ? ["allergies"] : []));
  }
  if (c === "drchi-002" && /\b(?:when|how long|start\w*|onset|duration)\b/iu.test(q)
    && /\b(?:cold|sensitiv\w*|symptoms?|it)\b/iu.test(q)) {
    return { ...s("symptom-onset", "Onset of cold sensitivity", "patient", "onset"), historyIntentIds: ["symptom-onset", "cold-history"] };
  }
  if (c === "drchi-003" && /\b(?:when|how long|timing|date)\b/iu.test(q) && /\b(?:root canal|rct|endodontic)\b/iu.test(q)) {
    return { ...s("rct-timing", "Timing of root-canal treatment", "patient", "rct-timing"), historyIntentIds: ["endodontic-history"] };
  }
  const objective = /\b(?:test\w*|apply|perform|endo[- ]?ice|refrigerant|ept|pulp tester)\b/iu.test(q);
  if (c === "drchi-002" && /\b(?:cold|iced|chilled)\b/iu.test(q) && !objective) {
    return { ...s("cold-history", "Patient-reported cold sensitivity", "patient", "cold"), historyIntentIds: ["cold-history"] };
  }
  if (c === "drchi-003" && /\b(?:chew\w*|biting)\b/iu.test(q) && /\b(?:sore\w*|hurt\w*|pain|what happens)\b/iu.test(q) && !objective) {
    return s("chewing-history", "Reported chewing discomfort", "patient", "symptoms");
  }
  if (c === "drchi-008" && /\b(?:clean|brush\w*|floss\w*|home[- ]care|oral hygiene)\b/iu.test(q)) return s("home-care", "Reported home care", "patient", "home-care");
  if (c === "drchi-008" && /\b(?:bite|teeth)\b/iu.test(q) && /\b(?:feel|comfortable|wrong|fit)\b/iu.test(q)) return s("bite-history", "Patient bite perception", "patient", "bite-history");
  if (channel !== "exam") return;

  if (c === "drchi-002") {
    if (/\b(?:after caries removal|after excavation|pulp expos\w*|definitively restorable|definitive restorability)\b/iu.test(q)) return s("post-excavation", "Unperformed post-excavation assessment", "exam", "post-excavation");
    if (/\bmargin\b/iu.test(q) && /\b(?:bone|crest)\b/iu.test(q)) return s("restorative-margin-to-bone", "Restorative margin-to-bone relationship", "exam", "restorative-margin-to-bone");
    const structure = /\b(?:remaining (?:sound )?(?:tooth|structure)|sound tooth|wall thickness|cusp thickness)\b/iu.test(q);
    const bone = /\b(?:lesion|caries)[- ]to[- ]bone\b|\b(?:above|distance|relative|relationship)\b.{0,30}\b(?:bone|crest)\b|\bbone\b.{0,25}\bdistance\b/iu.test(q);
    const ferrule = /\bferrule\b/iu.test(q);
    if (structure || bone || ferrule) return s("structural-observations", "Requested pre-excavation structural observations", "exam",
      ...(structure ? ["remaining-structure"] : []), ...(bone ? ["lesion-to-bone"] : []), ...(ferrule ? ["ferrule"] : []));
    if (/\b(?:isolate|isolation|rubber dam|moisture control)\b/iu.test(q)) return s("isolation", "Pre-excavation isolation", "exam", "isolation");
    if (/\b(?:ept|electric(?:al)? pulp|pulp tester)\b/iu.test(q)) return s("ept", "Electric pulp sensibility test", "exam", "ept");
    if (/\b(?:cold[- ]?test|pulp sensibility|pulp test|vitality|endo[- ]?ice|refrigerant)\b/iu.test(q)) return s("cold-test", "Objective cold sensibility test", "exam", "pulp-testing");
    if (/\b(?:periapical|apical|pa|lamina dura|pdl)\b/iu.test(q)) return s("apical-imaging", "Current periapical status", "exam", "apical-imaging");
    if (/\b(?:bitewing|bwx|radiographic caries|caries depth|decay depth)\b/iu.test(q)) return s("radiographic-depth", "Radiographic caries depth", "exam", "radiograph");
    if (/\b(?:margin|gumline|gum line|subgingival)\b/iu.test(q)) return s("margin", "Distal restorative margin", "exam", "margin");
    if (/\b(?:restoration|filling|recurrent (?:decay|caries))\b/iu.test(q)) return s("restoration", "Current restoration and recurrent lesion", "exam", "restoration");
  }
  if (c === "drchi-003") {
    const side = rootSide(q);
    if (/\b(?:retreat\w*|re[- ]treatment)\b/iu.test(q) && /\b(?:feasib\w*|can|whether|removed|remov\w*|possible)\b/iu.test(q)) return s("retreatment-feasibility", "Unestablished retreatment feasibility", "exam", "retreatment-feasibility");
    if (/\b(?:fracture|crack)\b/iu.test(q) && !/\b(?:visible|accessible|magnification|structural inspection)\b/iu.test(q)) return s("root-fracture", "Unestablished root-fracture status", "exam", "fracture");
    if (/\b(?:visible crack|accessible structure|structural inspection|structural condition|magnification|transillumination)\b/iu.test(q)) return s("structural-inspection", "Accessible structural inspection", "exam", "structural-inspection");
    if (/\b(?:root[- ]?filling|obturation|gutta[- ]?percha|filling length|canal filling)\b/iu.test(q)) return s("root-filling", "Two-dimensional root-filling appearance", "exam", `root-filling-quality${side ? `-${side}` : ""}`);
    if (/\b(?:prob\w*|pockets?)\b/iu.test(q)) return s("root-probing", "Requested root-surface probing", "exam", `probing${side ? `-${side}` : ""}`);
    if (/\b(?:previous|prior|old|compare|comparison|serial|interval)\b/iu.test(q) && /\b(?:films?|images?|radiographs?|pa|lesion)\b/iu.test(q)) return s("previous-images", "Comparable previous and current periapical images", "exam", "previous-images");
    const controls = [...new Set(controlTooth(q))];
    if (controls.length && /\b(?:cold|ice|refrigerant)\b/iu.test(q)) return s("control-cold", "Requested control cold testing", "exam", ...controls.map(n => `adjacent-cold-${n}`));
    if (controls.length && /\b(?:percuss\w*|tap\w*|knock\w*)\b/iu.test(q)) return s("control-percussion", "Requested control percussion", "exam", ...controls.map(n => `adjacent-percussion-${n}`));
    if (controls.length === 1 && /\b(?:visual\w*|examine|inspect|existing condition)\b/iu.test(q) && !/\b(?:margins?|crown)\b/iu.test(q)) return s("control-visual", "Requested control visual inspection", "exam", `adjacent-${controls[0]}`);
  }
  if (c === "drchi-008") {
    if (/\b(?:primary stability|insertion torque|implant stability|implant torque|isq)\b/iu.test(q)) return s("future-stability", "Unestablished future implant stability", "exam", "primary-stability");
    if (/\b(?:mesiodistal|mesio[- ]distal|horizontal space|gap width)\b/iu.test(q)) return s("mesiodistal-space", "Mesiodistal restorative space", "exam", "mesiodistal-space");
    if (/\b(?:occlusal plane|restorative plane|plane relationship)\b/iu.test(q)) return s("restorative-plane", "Restorative plane relationship", "exam", "restorative-plane");
    if (/\b(?:clearance|interarch|restorative space|crown height)\b/iu.test(q)) return s("clearance", "Measured interarch clearance", "exam", "occlusion");
    const ridge = /\b(?:ridge|bone|cbct|scan)\b/iu.test(q);
    const height = /\b(?:height|inferior[- ]alveolar|inferior alveolar|ian|mandibular canal|crest[- ]to)\b/iu.test(q);
    if (ridge || height) return s("ridge-measurements", "Requested ridge and anatomic measurements", "exam",
      ...(!height || /\b(?:width|dimensions?|cbct|scan)\b/iu.test(q) ? ["bone"] : []), ...(height ? ["ian-dimensions"] : []));
    if (/\b(?:supraerupt\w*|over[- ]?erupt\w*|eruption|opposing|opponent)\b/iu.test(q)) return s("opposing-position", "Opposing-tooth position", "exam", "opposing");
    if (/\b(?:tilt\w*|tipp\w*|inclination|inclined|drift\w*)\b/iu.test(q)) return s("adjacent-position", "Neighboring-tooth inclination", "exam", "movement");
    const controls = [...new Set(controlTooth(q))];
    if (/\b(?:prob\w*|pockets?)\b/iu.test(q)) return s("adjacent-probing", "Requested adjacent-tooth probing", "exam", ...(controls.length === 1 ? [`adjacent-probing-${controls[0]}`] : ["adjacent-probing"]));
    if (/\b(?:mobility|mobile|loose|wobbl\w*)\b/iu.test(q)) return s("adjacent-mobility", "Requested adjacent-tooth mobility", "exam", ...(controls.length === 1 ? [`adjacent-mobility-${controls[0]}`] : ["adjacent-mobility"]));
    if (controls.length === 1 && /\b(?:visual\w*|examine|inspect|existing condition)\b/iu.test(q)) return s("adjacent-visual", "Requested adjacent-tooth inspection", "exam", `adjacent-${controls[0]}`);
  }
}

export function nextCaseDetailFactTeeth(patient: DiscoveryPatient, fact: DiscoveryFact): readonly number[] | undefined {
  if (!isNextCaseDetailReview(patient)) return;
  if (patient.caseId === "drchi-008" && suffix(fact) === "adjacent") return [29, 31];
  const inherited: Record<string, string[]> = {
    "drchi-002": ["cold", "spontaneous", "restoration", "radiograph", "margin", "percussion"],
    "drchi-003": ["symptoms", "treatment-history", "pa", "swelling"], "drchi-008": ["duration"],
  };
  return inherited[patient.caseId]?.includes(suffix(fact)) ? [30] : undefined;
}

export function nextCaseDetailFactMatchesClause(q: string, patient: DiscoveryPatient, fact: DiscoveryFact): boolean {
  if (!isNextCaseDetailReview(patient)) return true;
  const id = suffix(fact);
  if (patient.caseId === "drchi-003") {
    const side = rootSide(q);
    if (side && ["probing", "root-filling-quality"].includes(id)) return false;
    if (side && /^(?:probing|root-filling-quality)-(?:mesial|distal)$/u.test(id) && !id.endsWith(`-${side}`)) return false;
  }
  const teeth = controlTooth(q);
  return !(teeth.length === 1 && ["adjacent", "adjacent-probing", "adjacent-mobility"].includes(id));
}

/** A tooth number or a generic invitation alone does not name a clinical subject.
 * This excludes only generic wording, not unfamiliar clinical synonyms. */
export function nextCaseDetailHasSubject(q: string): boolean {
  const generic = new Set("a an the this that these those it its tooth teeth number numbers site for on at of to in from with and or also plus me you your my we us do did does can could would is are was were have has what which how tell describe about background detail details elaborate please check look examine assess evaluate inspect perform measure only hello hi okay ok".split(" "));
  return (q.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/gu) ?? []).some(word => !/^\d+$/u.test(word) && !generic.has(word));
}
