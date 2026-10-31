import type { DiscoveryChannel, DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";
import type { HistoryIntentId } from "./clinical-intents.server";
import { COMPLETE_REVIEW_VERSION } from "./case-review-builder.server";

const cases = [4, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
export const isCompleteReview = (patient: DiscoveryPatient) => patient.version === COMPLETE_REVIEW_VERSION
  && cases.some(n => patient.caseId === `drchi-${String(n).padStart(3, "0")}`);
export type CompleteReviewSubject = { id: string; topic: string; channel: DiscoveryChannel; suffixes: string[]; historyIntentIds?: HistoryIntentId[]; suppressHistoryIntentIds?: HistoryIntentId[] };
const suffix = (fact: DiscoveryFact) => fact.id.slice(fact.id.lastIndexOf(":") + 1);
const unique = <T,>(values: T[]): T[] => [...new Set(values)];
const teeth = (q: string) => unique([
  ...[...q.matchAll(/(?:#\s*|\btooth\s*(?:number\s*)?#?\s*)([1-9]|[12]\d|3[0-2])\b/giu)].map(m => Number(m[1])),
  ...[...q.matchAll(/#\s*([1-9]|[12]\d|3[0-2])\s*[-–]\s*#?\s*([1-9]|[12]\d|3[0-2])\b/giu)].flatMap(m => [Number(m[1]), Number(m[2])]),
]);

/** Interpretation metadata only. Suffixes identify fixed observation slots;
 * an absent slot remains missing. No answer or clinical value is generated.
 * Call after request-security/advice gates and separately for each active clause.
 */
export function completeReviewSubject(q: string, channel: DiscoveryChannel, patient: DiscoveryPatient): CompleteReviewSubject | undefined {
  if (!isCompleteReview(patient)) return;
  const n = Number(patient.caseId.slice(-3)), requestedTeeth = teeth(q);
  const histories: string[] = [], exams: string[] = [], intents: HistoryIntentId[] = [];
  const p = (test: RegExp | boolean, ...ids: string[]) => { if (typeof test === "boolean" ? test : test.test(q)) histories.push(...ids); };
  const e = (test: RegExp | boolean, ...ids: string[]) => { if (typeof test === "boolean" ? test : test.test(q)) exams.push(...ids); };
  // A named protocol at an unsupported tooth is recognized unavailable content,
  // not permission to fall back to a broader multi-tooth result.
  const scoped = (ids: number[], projection: (n: number) => string) => (requestedTeeth.length ? requestedTeeth : ids).map(projection);
  const allergy = /\ballerg\w*\b|\b(?:latex|nkda|nka|drug reactions?)\b/iu.test(q);
  const medicationText = q.replace(/\b(?:medications?|medicines?|meds|drugs?)\s+allerg\w*|\ballerg\w*\s+to\s+(?:any\s+)?(?:medications?|medicines?|meds|drugs?)/giu, "allergies");
  const medicationPlan = /\b(?:prescriber|cardiologist|medication[- ]change|medication[- ]interruption|drug holiday|coordination|interruption plan)\b/iu.test(q);
  const medical = /\b(?:medical (?:history|conditions?|diagnoses)|general health|health history|chronic conditions?|illness(?:es)?|other medical conditions?)\b/iu.test(q);
  const medicines = !medicationPlan && /\b(?:medications?|medicines?|meds|prescriptions?|supplements?|drug list|other drugs|painkillers?)\b/iu.test(medicationText)
    && !/\b(?:prescribed for|indication|how long|how often|last dose|latest dose|most recent dose)\b/iu.test(q);
  p(medical, n === 22 ? "health" : [12, 14, 20].includes(n) ? "medical" : "medical-history");
  p(allergy, "allergies");
  if (allergy) intents.push("allergies");
  if (medicines) {
    const ids = n === 17 ? ["medication", ...(/\b(?:supplements?|complete|other|additional|remaining)\b/iu.test(q) ? ["additional-medications"] : [])]
      : n === 19 && !/\b(?:for pain|painkillers?|analgesic|ibuprofen)\b/iu.test(q) ? ["medications", "other-postoperative-medications", "steroid-use", "opioid-use", "acetaminophen-use"]
      : n === 22 ? ["antiresorptive", "medications"] : ["medications"];
    histories.push(...ids); intents.push("medications");
  }
  // More specific patient subjects must not be replaced by the general list.
  if (n === 4) {
    p(/\bwhich tooth\b/iu, "location");
    e(/\b(?:recall interval|follow[- ]up interval|next review|monitoring duration|intervention trigger)\b/iu, "recall-plan");
  }
  if (n === 7) {
    p(/\b(?:a1c|hba1c|blood sugar|glyc[ae]mic)\b/iu, "a1c");
    p(/\b(?:diabetes|diabetic)\b/iu, "diabetes");
    p(/\b(?:brush|brushing|home care|oral hygiene)\b/iu, "homecare");
    p(/\b(?:floss|flossing|interdental|waterpik|water flosser)\b/iu, "interdental-care");
    p(/\b(?:barriers?|difficult|difficulty|adherence|gets in the way)\b/iu, "adherence-barriers");
    p(/\b(?:willing|readiness|ready|motivat\w*)\b/iu, "willingness");
    e(/\b(?:test\w*|apply|stimulus|sensibility|vitality|pulp test|endo[- ]?ice)\b/iu.test(q)
      && /\b(?:cold|sensibility|vitality|pulp test|endo[- ]?ice)\b/iu.test(q), "vitality");
    e(/\b(?:earlier|previous|prior|old|compare|comparison)\b.{0,40}\b(?:radiograph|image|film|bone)\b/iu, "previous-images");
  }
  if (n === 9) {
    e(/\b(?:inspect|document|examine)\b/iu.test(q) && /\b(?:anterior teeth|rotation|rotated)\b/iu.test(q)
      && !/\b(?:proportions?|width|length|dimensions?)\b/iu.test(q), "teeth");
    p(/\b(?:specific|exact|shape|shade|colou?r|wider|longer)\b/iu, "precise-goals");
    p(/\b(?:when|how long|since|widened|progressed)\b.{0,40}\b(?:spaces?|spacing|gaps?)\b|\b(?:spaces?|spacing|gaps?)\b.{0,25}\b(?:changed|there)\b/iu, "spacing-history");
    e(/\b(?:proportions?|width[- ]to[- ]length|width|dimensions?)\b/iu, ...scoped([8, 7, 9, 10], t => t === 8 ? "proportions" : `proportions-${t}`));
    const palatal = /\b(?:palatal|lingual|veneer)\b/iu.test(q) && /\b(?:clearance|room|space|side)\b/iu.test(q);
    e(palatal, "palatal-clearance");
    e(!palatal && /\b(?:occlus\w*|bite|overjet|overbite|lower incisors?|lower anterior)\b/iu.test(q), "occlusion");
    e(/\b(?:excursion\w*|protrusi\w*|interference)\b/iu, "excursions");
    e(/\b(?:established cause|cause of|why|etiology|aetiology|bolton)\b/iu, "spacing-cause");
  }
  if (n === 10) {
    const pressure = /\b(?:pressure|force|press|pressing|how hard|aggressive)\b/iu.test(q);
    p(pressure, "brushing-pressure");
    p(!pressure && /\b(?:brush|brushing|technique|show me how)\b/iu.test(q), "brushing");
    p(/\b(?:brush type|toothbrush|manual|electric|bristles?|your brush)\b/iu, "brush-type");
    p(/\b(?:toothpaste|paste|fluoride|pronamel|ctx)\b/iu, "toothpaste");
    p(/\b(?:diet|sip|sipping|drinks? throughout|energy drinks?|coffee|tea)\b/iu, "diet");
    e(/\b(?:air blast|air syringe|isolated air|air stimulus)\b/iu, "air-test");
    e(/\b(?:cold test|test.{0,20}cold|pulp sensibility|vitality)\b/iu, "cold-test");
    e(/\b(?:previous|prior|earlier|old|serial)\b.{0,40}\b(?:notch|measurements?|photographs?|scans?)\b/iu, "lesion-trajectory");
  }
  if (n === 12) {
    const side = /\bmesial\b/iu.test(q) ? "mesial" : /\bdistal\b/iu.test(q) ? "distal" : undefined;
    const roots = /\b(?:root|canal|nerve|clearance|distance)\b/iu.test(q);
    e(Boolean(side && roots), `cbct-${side}-root`);
    const wisdom = [...requestedTeeth.filter(t => [1, 16, 17].includes(t)),
      ...(/\bupper right\b/iu.test(q) ? [1] : []), ...(/\bupper left\b/iu.test(q) ? [16] : []), ...(/\blower left\b/iu.test(q) ? [17] : [])];
    const all = /\b(?:other (?:three )?(?:wisdom|third)|all (?:four|4)|remaining wisdom)\b/iu.test(q);
    const targets = all ? [1, 16, 17] : unique(wisdom);
    const position = /\b(?:position|present|erupt\w*|impact\w*|upright|inclination)\b/iu.test(q);
    const disease = /\b(?:diseased?|caries|decay)\b/iu.test(q);
    const periodontal = /\b(?:prob\w*|inflam\w*|pockets?|bleeding)\b/iu.test(q);
    e(all && position, "other-third-molars");
    if (targets.length) {
      e(position || !disease && !periodontal, ...targets.map(t => `third-${t}-position`));
      e(disease, ...targets.map(t => `third-${t}-disease`));
      e(periodontal, ...targets.map(t => `third-${t}-periodontal`));
    }
    e(/\b(?:sedation suitability|formal sedation|airway|sedation eligibility|asa class|iv sedation)\b/iu, "sedation-assessment");
    if (!side && !targets.length) e(/\b(?:cbct|scan|three dimensions|three[- ]dimensional|3d)\b/iu, "cbct");
  }
  if (n === 13) {
    e(/\b(?:smile line|gingival display|full smile|high smile)\b/iu, "smile-gingiva");
    e(/\b(?:phenotype|biotype|tissue thickness)\b/iu, "phenotype");
    e(/\b(?:gingival[- ]?margin|gingival margins?|gum ?lines?|gingival.{0,15}(?:height|symmetry|asymmetry))\b/iu, "gingival-levels");
    e(/\b(?:root[- ]?filling|obturation|endodontic quality)\b/iu, "endodontic-seal");
    e(/\b(?:coronal seal|palatal seal|composite margins?|restoration seal)\b/iu, "coronal-seal");
    e(/\b(?:caries risk|active caries|dentition[- ]wide caries)\b/iu, "risk-cause");
    e(/\b(?:occlusion|occlusal|articulating|bite check)\b/iu.test(q)
      || /\bcontact\b/iu.test(q) && /\blower (?:teeth|incisors?|anterior)\b/iu.test(q), "occlusion");
    e(/\b(?:discoloration cause|precise discoloration|pigment source|why.{0,20}(?:dark|discol))\b/iu, "discoloration-cause");
  }
  if (n === 14) {
    e(/\b(?:apical bone|apical.{0,20}anchorage|available anchorage)\b/iu, "stability");
    e(/\bpalatal\b.{0,30}\b(?:bone|anchorage|thickness|geometry)\b|\bapical and palatal anchorage\b/iu, "palatal-bone");
    e(/\b(?:primary stability|implant stability|insertion torque|isq|achieved anchorage)\b/iu, "primary-stability");
    e(/\b(?:facial|buccal|bone defect)\b/iu.test(q) && /\b(?:dimensions?|measurements?|extent|height|width|defect)\b/iu.test(q), "facial-defect-dimensions");
    e(/\b(?:healing|final gingival|esthetic outcome|aesthetic outcome|future gum|final margin)\b/iu, "esthetic-healing");
    e(/\b(?:same[- ]day feasibility|provisional feasibility|fixed temporary feasible|immediate loading)\b/iu, "same-day-feasibility");
  }
  if (n === 15) {
    p(/\b(?:tobacco|smok\w*|nicotine|vap\w*)\b/iu, "risk-history");
    p(/\balcohol\b|\b(?:beer|wine|spirits)\b/iu, "alcohol");
    p(/\b(?:recent|new|last)\b.{0,50}\b(?:crown|partial denture|prosthe\w*|dental treatment)\b/iu, "recent-prosthesis");
    e(/\b(?:horizontal overlap|buccolingual overlap|tongue clearance)\b/iu, "horizontal-overlap");
    e(/\b(?:induration|indurated|border|firmness|hardness)\b/iu, "induration");
    e(/\b(?:lymph nodes?|cervical nodes?|neck nodes?)\b/iu, "nodes");
  }
  if (n === 16) {
    p(/\b(?:told|history|disease|dialysis)\b/iu.test(q) && /\b(?:kidney|renal|dialysis)\b/iu.test(q), "renal-history");
    e(/\b(?:egfr|filtration|crcl|renal function|kidney function)\b/iu.test(q) && !/\btold\b/iu.test(q), "renal");
    e(/\bcreatinine\b/iu, "creatinine");
    e(medicationPlan || /\bprescribing cardiologist\b/iu.test(q), "prescriber");
    e(/\b(?:actual bleeding|bleeding outcome|after extraction|postoperative|post[- ]?op)\b/iu, "procedure-outcome");
  }
  if (n === 17) {
    e(/\b(?:map|location|sites?|time course|past year)\b/iu.test(q) && /\b(?:caries|lesions?|cavities)\b/iu.test(q)
      && !/\b(?:depth|deep|active|activity|structure|fracture)\b/iu.test(q), "caries");
    p(/\b(?:sugar\w*|snacks?|diet|candy|sweet\w*)\b/iu, "diet");
    p(/\b(?:acidic?|juice|soda|energy drinks?)\b/iu, "acidic-drinks");
    const stimulated = /\bstimulated\b/iu.test(q) && !/\bunstimulated\b/iu.test(q);
    e(/\b(?:flow|sialometry|salivary output|saliva collection)\b/iu, stimulated ? "stimulated-flow" : "salivary-flow");
    e(/\b(?:depth|deep|active|activity|softness)\b/iu, ...scoped([22, 27, 28], t => `depth-${t}`));
    e(/\b(?:remaining structure|sound structure|tooth structure|fracture|broken|walls?|bone support)\b/iu.test(q)
      && !/\b(?:future|full[- ]arch|failed prevention|all[- ]?on[- ]?[x46])\b/iu.test(q), ...scoped([22, 27, 28], t => `structure-${t}`));
    e(/\b(?:restorab\w*|ferrule|post[- ]excavation|after caries removal)\b/iu, "restorability");
    e(/\b(?:future|full[- ]arch|failed prevention|all[- ]?on[- ]?[x46]|extraction plan)\b/iu, "future-full-arch");
  }
  if (n === 18) {
    const named = /\b(?:masseter|temporalis|temporal|scm|sternocleidomastoid|neck|cervical|shoulder|trapezius)\b/iu.test(q);
    e(/\bmasseters?\b/iu.test(q) || (!named && /\bmuscles?\b/iu.test(q)), "muscles");
    e(/\b(?:temporalis|temporal muscles?)\b/iu, "temporalis");
    e(/\b(?:scm|sternocleidomastoid)\b/iu, "scm");
    e(/\b(?:neck|cervical|suboccipital)\b/iu, "neck");
    e(/\b(?:shoulders?|trapezius)\b/iu, "shoulder");
    e(/\b(?:opening|open|range|rom|interincisal)\b/iu, "opening");
    e(/\b(?:tmjs?|temporomandibular|joint palpation|condyles?)\b/iu, "joint");
    const sleepTest = /\b(?:instrumented|polysomnography|sleep study|sleep test|emg|electromyography|confirmed sleep bruxism)\b/iu.test(q);
    e(sleepTest, "sleep-testing");
    p(!sleepTest && /\b(?:awake|daytime|during the day|clench\w*)\b/iu.test(q)
      && (!/\b(?:asleep|sleep|night)\b/iu.test(q) || /\b(?:awake|daytime|during the day)\b/iu.test(q)), "habits");
    p(!sleepTest && /\b(?:asleep|sleep|nighttime|grind\w*|bruxism)\b/iu.test(q), "sleep-habits");
    e(/\b(?:mri|joint scan|joint imaging|tmj imaging|cbct)\b/iu, "joint-imaging");
  }
  if (n === 19) {
    const pus = /\b(?:pus|purulen\w*|suppuration)\b/iu.test(q), clot = /\bclot\b/iu.test(q), exposed = /\b(?:exposed bone|bare bone|bone exposure)\b/iu.test(q);
    const inside = /\bsocket\b/iu.test(q) && /\b(?:look inside|inspect|examine|examination|inspection)\b/iu.test(q)
      && !pus && !clot && !exposed && !/\b(?:debris|food)\b/iu.test(q);
    e(pus || inside, "socket-pus"); e(clot || inside, "socket-clot"); e(exposed || inside, "socket-exposed-bone");
    e(/\b(?:debris|trapped food|food)\b/iu.test(q) || inside, "socket");
    e(/\b(?:irrigat\w*|flush\w*|after cleaning)\b/iu, "irrigation-result");
    e(/\b(?:soft tissue|socket rim|gingival tissue)\b/iu, "socket-soft-tissue");
    e(/\b(?:adjacent|neighbou?ring)\b.{0,15}\b(?:tooth|teeth)\b/iu, "adjacent");
    e(requestedTeeth.includes(31) && /\bcold\b/iu.test(q), "adjacent-cold-31");
    e(requestedTeeth.includes(31) && /\b(?:percuss\w*|tap\w*)\b/iu.test(q), "adjacent-percussion-31");
    p(/\b(?:for pain|painkillers?|analgesic|ibuprofen)\b/iu, "medications");
    p(/\b(?:antibiotics?|amoxicillin|amox)\b/iu, "other-postoperative-medications");
    p(/\b(?:steroids?|decadron|dexamethasone)\b/iu, "steroid-use");
    p(/\b(?:opioids?|codeine|t3)\b/iu, "opioid-use");
    p(/\b(?:acetaminophen|paracetamol|tylenol)\b/iu, "acetaminophen-use");
  }
  if (n === 20) {
    e(/\b(?:mucosa|exposed bone|necrotic bone|fistula|mronj|local examination)\b/iu, "surgical");
    e(/\b(?:cbct|apical radiolucency|periapical imaging)\b/iu, "cbct-apical");
    e(medicationPlan || /\b(?:prescriber|medication plan|hold prolia|stop prolia)\b/iu.test(q), "medication-plan");
    e(/\b(?:future healing|healing outcome|implant outcome|primary stability|insertion torque|isq)\b/iu, "future-healing");
  }
  if (n === 21) {
    e(/\bcement\b/iu, "cement");
    e(/\b(?:buccal|lingual)\b/iu.test(q) && /\b(?:support|plate|bone|dehiscence)\b/iu.test(q),
      ...(/\bbuccal\b/iu.test(q) ? ["remaining-support-buccal"] : []), ...(/\blingual\b/iu.test(q) ? ["remaining-support-lingual"] : []));
    const support = /\b(?:remaining (?:bony|bone) support|circumferential support)\b/iu.test(q);
    e(support && !/\b(?:buccal|lingual)\b/iu.test(q), "remaining-support-buccal", "remaining-support-lingual");
    e(/\b(?:morphology|defect shape|shape of.{0,15}defect|walls?|crater)\b/iu, "defect");
    e(/\b(?:crown contours?|crown emergence)\b/iu, "crown");
    e(/\b(?:hygiene access|cleaning access|interdental brush|floss access|overcontour)\b/iu, "hygiene-access");
    e(/\b(?:implant position|implant angulation|buccolingual position|malposition)\b/iu, "implant-position");
    e(/\b(?:treatment outcome|treatment response|regenerative.{0,15}outcome|reconstructive.{0,15}outcome|removal plan)\b/iu, "treatment-outcome");
  }
  if (n === 22) {
    e(/\b(?:sinus membrane|membrane thickness|schneiderian|mucosal thickness)\b/iu.test(q)
      && !/\b(?:perforat\w*|membrane tear|torn membrane)\b/iu.test(q), "sinus-membrane");
    e(/\b(?:septum|septa|sinus floor anatomy)\b/iu, "sinus-septum");
    e(/\b(?:perforat\w*|membrane tear|torn membrane)\b/iu, "membrane-perforation");
    e(/\bsinus\b/iu.test(q) && /\b(?:appearance|pathology|itself|image|imaging)\b/iu.test(q) && !/\b(?:membrane|septum|septa|perforat\w*)\b/iu.test(q), "sinus-image");
    e(/\b(?:residual|ridge|bone)\b/iu.test(q) && /\b(?:height|width|dimensions?)\b/iu.test(q), "cbct-dimensions");
    e(/\b(?:restorative (?:space|clearance)|vertical clearance|crown height)\b/iu, "restorative-space");
    e(/\b(?:mesiodistal|mesio[- ]distal|gap width|space width)\b/iu, "mesiodistal-space");
    e(/\b(?:primary stability|implant stability|insertion torque|isq|anchorage)\b/iu, "stability");
    e(/\b(?:opposing|supraerupt\w*|overerupt\w*)\b/iu, "opposing-30");
    const single = requestedTeeth.filter(t => t === 2 || t === 4);
    if (/\b(?:margins?|coronal seal|margin integrity)\b/iu.test(q)) e(true, ...(single.length ? single : [2, 4]).map(t => t === 2 ? "abutment-assessment" : "abutment-4-margins"));
    else {
      e(/\b(?:crown|crowns|restorations?)\b/iu, ...(single.length === 1 ? [`crown-${single[0]}`] : ["adjacent-crowns"]));
      e(/\b(?:probing|probe|periodontal|mobility)\b/iu, ...(single.length === 1 ? [`periodontal-${single[0]}`] : ["adjacent-periodontal"]));
    }
  }
  if (n === 23) {
    e(/\b(?:floss|proximal contact|interproximal contact)\b/iu.test(q) && /\bcontact\b/iu.test(q), "contact");
    const only29 = requestedTeeth.length === 1 && requestedTeeth[0] === 29;
    const only30 = requestedTeeth.length === 1 && requestedTeeth[0] === 30;
    const distal = /\b(?:distal contour|composite contour|filling contour)\b/iu.test(q);
    e(distal || (only29 && /\bcontour\b/iu.test(q)), "adjacent-contour");
    e(/\b(?:integrity|margins?|seal)\b/iu.test(q) && (distal || only29 || /\bcomposite\b/iu.test(q)), "composite-29-margin");
    e(/\b(?:margins?|seating|seated|seal)\b/iu.test(q) && !only29 && !distal && /\bcrown\b/iu.test(q), "crown-margins");
    e(/\b(?:mesial contour|crown contour)\b/iu.test(q) || (only30 && /\bcontour\b/iu.test(q)), "crown-30-contour");
    e(/\b(?:mobility|mobile|loose)\b/iu, ...(only29 ? ["mobility-29"] : only30 ? ["mobility-30"] : ["mobility"]));
    e(/\b(?:bitewing|bwx|recurrent caries|recurrent decay)\b/iu, ...(only29 ? ["bitewing-29"] : only30 ? ["bitewing-30"] : ["bitewing"]));
    e(/\b(?:occlusal|occlusion|articulating)\b/iu, ...(only29 ? ["occlusal-29"] : only30 ? ["occlusal"] : ["occlusal", "occlusal-29"]));
    e(/\bmarginal[- ]ridges?\b|\bridge (?:levels?|heights?|relationships?)\b/iu, "marginal-ridge-levels");
    e(/\b(?:corrective procedure|fee responsibility|warranty|definitive plan|final plan)\b/iu, "corrective-plan");
  }
  const selected = histories.length ? histories : channel === "exam" ? exams : [];
  if (!selected.length) return;
  const resultChannel = histories.length ? "patient" : "exam";
  // An explicit objective protocol in patient mode must not become a history
  // answer merely because it contains an overlapping noun such as "cold".
  if (channel === "patient" && resultChannel === "exam") return;
  const suffixes = unique(selected);
  const suppress: HistoryIntentId[] = [];
  if (n === 4 && suffixes.includes("location")) suppress.push("endodontic-history");
  if (n === 7 && suffixes.includes("vitality")) suppress.push("cold-history");
  if (n === 9 && suffixes.includes("spacing-history")) intents.push("symptom-onset");
  return { id: `complete-review:${suffixes.join("+")}`, topic: suffixes.map(id => patient.facts.find(f => suffix(f) === id)?.topic ?? id).join("; "),
    channel: resultChannel, suffixes, ...(intents.length ? { historyIntentIds: unique(intents) } : {}),
    ...(suppress.length ? { suppressHistoryIntentIds: suppress } : {}) };
}

/** Source tooth scopes are metadata, never inferred from answer wording. */
export function completeReviewFactTeeth(patient: DiscoveryPatient, fact: DiscoveryFact): readonly number[] | undefined {
  if (!isCompleteReview(patient)) return;
  if (fact.toothNumbers) return fact.toothNumbers;
  const n = Number(patient.caseId.slice(-3)), id = suffix(fact);
  const inherited: Record<number, Record<string, number[]>> = {
    4: Object.fromEntries(["rct-timing", "symptoms", "radiographic-comparison", "crown-margins", "probing", "sinus-tract"].map(id => [id, [30]])),
    9: { teeth: [7, 8, 9, 10], periodontal: [6, 7, 8, 9, 10, 11] },
    12: { "third-molar": [32], probing: [31], panoramic: [32], "other-third-molars": [1, 16, 17] },
    13: Object.fromEntries(["appearance", "history", "pain", "coronal-structure", "pa"].map(id => [id, [9]])),
    14: { "tooth-status": [8], "smile-phenotype": [8], "margin-height": [8, 9], cbct: [8] },
    17: { caries: [22, 27, 28], recession: [22, 27, 28] },
    19: { procedure: [32], course: [32] },
    20: { symptoms: [30], "tooth-status": [30] },
    21: Object.fromEntries(["history", "symptoms", "pain", "probing", "bone", "stability", "crown"].map(id => [id, [30]])),
    22: { history: [3], "adjacent-crowns": [2, 4], "adjacent-periodontal": [2, 4], "cbct-dimensions": [3], "sinus-image": [3] },
    23: { history: [30], concern: [30], food: [29, 30], contact: [29, 30], probing: [29, 30], percussion: [30], "crown-margins": [30], "adjacent-restoration": [29], bitewing: [29, 30], pa: [30], "delivery-record": [30] },
  };
  const projection = id.match(/^(?:third|depth|structure|proportions|mobility|bitewing|crown|periodontal)-(\d+)(?:-|$)/u);
  return projection ? [Number(projection[1])] : inherited[n]?.[id];
}

export function completeReviewFactMatchesClause(q: string, patient: DiscoveryPatient, fact: DiscoveryFact): boolean {
  if (!isCompleteReview(patient)) return true;
  const scope = completeReviewFactTeeth(patient, fact), requested = teeth(q);
  // A multi-tooth source answer cannot be projected by rewriting its prose.
  if (requested.length && scope && scope.some(t => !requested.includes(t))) return false;
  const subject = completeReviewSubject(q, "exam", patient);
  if (subject) return subject.channel === fact.channel && subject.suffixes.includes(suffix(fact));
  // Generic invitations never enable a broad frozen source pattern.
  return completeReviewHasSubject(q);
}

export function completeReviewHasSubject(q: string): boolean {
  if (/^\s*(?:where\s+do\s+you\s+live|what\s+do\s+you\s+do\s+for\s+work|do\s+you\s+(?:like\s+music|have\s+pets))[?.!\s]*$/iu.test(q)) return false;
  const generic = new Set("a an the this that these those it its tooth teeth number numbers site for on at of to in from with and or also plus me you your my we us do did does can could would is are was were have has what which how tell describe about background detail details else elaborate please check look examine assess evaluate inspect perform measure only hello hi okay ok now then there here continue go carry further information more additional explain share give walk through say something anything everything rest context".split(" "));
  return (q.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/gu) ?? []).some(word => !/^\d+$/u.test(word) && !generic.has(word));
}
