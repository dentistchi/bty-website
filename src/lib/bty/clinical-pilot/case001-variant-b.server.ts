import type { DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";

/** Case 001 interview variant B: a fuller fictional encounter for author trial.
 * Built ON variant A, which stays registered unchanged so attempts already frozen on it keep
 * resolving. Every fact added or replaced here is a fictional addition awaiting Dr. Chi's review,
 * never his recorded case context or testimony. Deliberately unknown items (CBCT, dye, crack depth)
 * stay `available: false`: a missing result is case information, not a gap in the doctor's work.
 */
const R = String.raw;
const PROVENANCE = "fictional-extension-awaiting-review" as const;
type FictionalFact = DiscoveryFact & { provenance: typeof PROVENANCE };

export function case001VariantB(variantA: DiscoveryPatient): DiscoveryPatient {
  if (variantA.caseId !== "drchi-001" || !variantA.version.endsWith("-variant-a")) throw new Error("CASE001_VARIANT_A_REQUIRED");
  const fact = (id: string, channel: "patient" | "exam", topic: string, pattern: string, answer: string, available = true): FictionalFact => ({
    id: `${variantA.caseId}:${id}`, channel, topic, patterns: [pattern], answer, available, provenance: PROVENANCE,
  });
  const overrides: FictionalFact[] = [
    fact("location", "patient", "Location of discomfort",
      R`\bwhere\b.{0,45}\b(?:hurt\w*|pain|ache\w*|discomfort|sensitive|sensitivity|problem|tooth|teeth)\b|\bwhere (?:is|does) it\b|\bwhich (?:tooth|teeth)\b|\bwhich side\b.{0,35}\b(?:hurt\w*|pain|ache\w*|discomfort|bother\w*)\b|\b(?:location of|locate|point (?:to|at)|show me)\b.{0,30}\b(?:pain|discomfort|problem|tooth|teeth|it)\b`,
      "It is on the lower right, toward the back. It is the tooth with the big filling."),
  ];
  const additions: FictionalFact[] = [
    // History
    fact("pain-severity", "patient", "Intensity and duration of each pain episode",
      R`\bhow (?:bad|severe|strong|intense|painful)\b|\bscale\b|\bout of (?:10|ten)\b|\b(?:intensity|severity)\b|\bhow long does (?:it|the pain|each episode) last\b|\blast(?:s)? (?:long|for)\b`,
      "When it happens it is sharp, about 6 out of 10, and it is gone within a second or two."),
    fact("release-pain", "patient", "Pain on biting compared with pain on release",
      R`\b(?:release|releasing|let go|letting go)\b|\bopen(?:ing)? (?:after|again)\b`,
      "It is worst right when I let go after biting on something hard."),
    fact("heat", "patient", "Heat sensitivity history",
      R`\b(?:hot|heat|warm)\b`,
      "Hot drinks do not bother it."),
    fact("sweets", "patient", "Sweet sensitivity history",
      R`\b(?:sweet|sweets|sugar|sugary|candy)\b`,
      "Sweets do not bother it."),
    fact("chewing-avoidance", "patient", "Change in chewing habits",
      R`\b(?:avoid|avoiding)\b|\bother side\b|\bswitch(?:ed)? sides?\b|\bchew(?:ing)? on the (?:other|left|right)\b`,
      "I have started chewing on the left side to avoid it."),
    fact("pain-relief", "patient", "Pain relief the patient has used",
      R`\b(?:painkillers?|pain killers?|pain relievers?|ibuprofen|advil|tylenol|acetaminophen|analgesics?)\b|\btaken anything\b|\btake anything for\b`,
      "I have not needed anything for the pain."),
    fact("previous-episodes", "patient", "Previous similar episodes",
      R`\bhappened before\b|\bhad (?:this|that|it) before\b|\bfirst time\b|\bever had (?:this|that|it)\b|\bprevious episodes?\b|\bsimilar (?:pain|problem|episode)\b`,
      "This is the first time I have had this with that tooth."),
    fact("last-visit", "patient", "Dental checkups and cleanings (how often, and the most recent visit)",
      R`\blast (?:dental )?(?:visit|checkup|check-up|cleaning|exam)\b|\blast (?:saw|seen|see) (?:a|the|your) dentist\b|\bregular (?:checkups?|dentist|cleanings?)\b`,
      "I have a checkup and cleaning about once a year. The last one was about a year ago, and nobody mentioned this tooth."),
    fact("swelling-history", "patient", "Patient-noticed swelling, bump or bad taste",
      R`\b(?:swelling|swollen|bad taste|pus|bump|pimple|gum boil)\b`,
      "I have not noticed any swelling, bump or bad taste."),
    fact("jaw-symptoms", "patient", "Jaw joint, muscle and headache symptoms",
      R`\b(?:tmj|tmd|jaw joints?)\b|\bjaw (?:pain|ache|aches|clicking|clicks|popping|pops|locks?|locking|tired|sore|muscles?)\b|\b(?:clicking|popping)\b|\bheadaches?\b`,
      "My jaw joints do not click or hurt, and I do not get headaches."),
    fact("treatment-goal", "patient", "Patient goals and preferences for treatment",
      // A preferred chewing side is a chewing habit, not a treatment preference.
      R`^(?![\s\S]*\b(?:side|left|right)\b)[\s\S]*\b(?:prefer|preference|preferences|goals?|expectations?|hoping for)\b|\bwant to (?:keep|save)\b|\bwhat (?:would you|do you) (?:like|want)\b`,
      "I would like to keep the tooth if that is possible."),
    fact("tobacco", "patient", "Tobacco use",
      R`\b(?:smoke|smoking|smoker|cigarettes?|tobacco|vape|vaping|nicotine)\b`,
      "I do not smoke, vape, chew tobacco or use any other nicotine."),
    // Examination
    fact("palpation", "exam", "Buccal and lingual palpation (pressing on the gum beside the tooth)",
      R`\bpalpat(?:e|ion)\b|\bvestibul(?:e|ar)\b|\bpress on the gum\b`,
      "There is no tenderness to buccal or lingual palpation."),
    fact("mobility", "exam", "Tooth mobility",
      R`\b(?:mobility|mobile|loose|looseness|wiggle|wiggles)\b`,
      "Mobility is within normal limits."),
    fact("soft-tissue", "exam", "Swelling and sinus tract examination",
      R`\b(?:swelling|swollen|sinus tract|fistula|drainage|soft tissue)\b`,
      "There is no swelling or sinus tract."),
    fact("ept", "exam", "Electric pulp test response",
      R`\bept\b|\belectric(?:al)? pulp\b|\belectric(?:al)? (?:test|testing)\b`,
      "The tooth responds to electric pulp testing within the range of the adjacent teeth."),
    fact("heat-test", "exam", "Heat test response",
      R`\b(?:heat|hot) (?:test|testing)\b|\bwarm gutta\b`,
      "Heat does not provoke a response different from the adjacent teeth."),
    fact("bitewing", "exam", "Bitewing imaging",
      R`\b(?:bitewing|bitewings|bw|bwx|recurrent caries|recurrent decay)\b`,
      "The bitewing shows the large MOD restoration with no obvious recurrent caries. Interproximal bone levels appear normal."),
    fact("margins", "exam", "Restoration margins",
      R`\b(?:margins?|explorer|marginal integrity|open margin|leakage)\b`,
      "The restoration margins are intact to an explorer, without obvious recurrent caries."),
    fact("wear", "exam", "Tooth wear",
      R`\b(?:wear|facets?|attrition|abfraction)\b`,
      "Moderate wear facets are present on the molars and canines."),
    fact("gingiva", "exam", "Gingival condition around the tooth",
      R`\b(?:gingiva|recession)\b|\bgingival (?:health|tissue|condition|inflammation)\b|\bgum (?:health|tissue|condition|recession)\b`,
      "The gingiva around the tooth is healthy, without recession."),
    fact("muscles-tmj", "exam", "Masticatory muscle and TMJ examination",
      R`\b(?:masseter|temporalis)\b|\bmuscle palpation\b|\btmj (?:exam|examination|palpation)\b|\brange of motion\b|\b(?:mouth|maximum) opening\b|\bdeviation\b`,
      "There is no masseter, temporalis or TMJ tenderness. Opening is about 45 mm without deviation."),
    fact("adjacent-teeth", "exam", "Adjacent and control teeth",
      R`\b(?:adjacent|neighbou?ring|contralateral|control tooth|control teeth)\b|\bnext to it\b|\bother teeth\b`,
      "The adjacent teeth and the same tooth on the other side have small restorations, respond normally to cold and are not tender to biting."),
    fact("cbct", "exam", "Cone-beam CT",
      R`\b(?:cbct|cone[- ]beam)\b|\b3d (?:scan|image|imaging)\b`,
      "No cone-beam CT is available for this visit.", false),
    fact("crack-dye", "exam", "Crack dye staining",
      R`\bmethylene blue\b|\bdye\b|\bstain(?:ing)? (?:the |a )?crack\b`,
      "Crack dye staining has not been performed at this visit.", false),
  ];
  const replacements = new Map(overrides.map(f => [f.id, f]));
  const ids = new Set(variantA.facts.map(f => f.id));
  for (const f of additions) if (ids.has(f.id)) throw new Error(`CASE001_VARIANT_B_DUPLICATE:${f.id}`);
  const facts = [
    ...variantA.facts.map(f => replacements.get(f.id) ?? { ...f, patterns: [...f.patterns] }),
    ...additions,
  ];
  // Interpretation only: the topic label the model reads and the authored pattern. The answer,
  // availability and provenance stay exactly as recorded (recorded facts stay Dr. Chi's context).
  const reinterpretation: Record<string, { topic?: string; pattern?: string }> = {
    // "eat" alone, negated or changed chewing ("not eating", "without biting", "changed the way you
    // chew"), a preferred chewing side ("favour one side") and chewing tobacco are not questions about
    // pain on chewing.
    chewing: { topic: "Pain when biting or chewing food",
      pattern: R`^(?![\s\S]*\b(?:without|not|no|never|changed?|the way)\b[\s\S]{0,25}\b(?:chew|chewing|bite|biting|eat|eating)\b)(?![\s\S]*\b(?:tobacco|favou?r\w*|prefer\w*|avoid\w*|switch\w*)\b)(?![\s\S]*\b(?:one|other|which|either|that|this) side\b)[\s\S]*(?:\b(?:chew|chewing|biting|bite down|hard food|sharp|intermittent)\b|\bwhen (?:you |i )?eat(?:ing)?\b|what (?:triggers|causes|brings on)|what.*pain (?:like|feel)|\bbite\b.*\b(?:hurt|pain)\b|\b(?:hurt|pain)\b.*\bbite\b)` },
    spontaneous: { topic: "Pain that starts on its own, without any trigger",
      pattern: R`\bspontaneous\b|unprovoked|\bon its own\b|\bby itself\b|out of (?:the )?blue|\bfor no reason\b|\bwithout (?:biting|eating|chewing|a trigger|any trigger)\b|\bnot (?:eating|chewing|biting)\b` },
    "chewing-avoidance": { topic: "Change in chewing habits because of the tooth (avoiding it, or favouring one side)",
      pattern: R`\b(?:avoid|avoiding)\b|\bother side\b|\bswitch(?:ed)? sides?\b|\bchew(?:ing)? on (?:the|your|my) (?:other|left|right)\b|\bchanged? (?:how|the way) (?:you |i )?(?:eat|chew)\b|\b(?:favou?r\w*|prefer\w*)\b.{0,30}\b(?:side|left|right)\b|\b(?:one|which|either) side\b.{0,30}\b(?:chew\w*|eat\w*|bit\w*)\b` },
    cold: { topic: "Cold sensitivity (cold food or drinks)" },
    heat: { topic: "Heat sensitivity (hot food or drinks)" },
    sweets: { topic: "Sweet sensitivity (sugary food or drinks)" },
    "symptom-duration": { topic: "When the discomfort first started" },
    "medical-history": { topic: "General medical conditions or illnesses" },
    medications: { topic: "Medicines the patient takes regularly" },
    allergies: { topic: "Allergies or reactions to drugs or materials" },
    tobacco: { topic: "Smoking (lighting up), vaping, chewing tobacco or other nicotine use" },
    "pain-severity": { topic: "How severe each biting-pain episode is, and how long that pain lasts" },
    // In this simulator an unspecified film/image of the root end is a PA request.
    // Explicit CBCT/3-D wording never implies an additional PA; named PA+CBCT still requests both.
    pa: { topic: "Periapical radiograph (2-D x-ray of the tooth and its root tip)",
      pattern: R`\bpa\b|^(?![\s\S]*\b(?:cbct|cone[- ]beam|3[- ]?d|three[- ]dimensional)\b)[\s\S]*(?:\b(?:periapical|radiograph|x[- ]?ray)\b|\b(?:image|imaging|film|picture)\b.{0,45}\b(?:apex|root (?:tip|end))\b)` },
    cbct: { topic: "Cone-beam CT (3-D scan)", pattern: R`\b(?:cbct|cone[- ]beam)\b|\b(?:3[- ]?d|three[- ]dimensional) (?:scan|image|imaging|view)\b` },
    margins: { topic: "Restoration margins (the edges of the filling)" },
    percussion: { topic: "Percussion (tapping on the tooth)" },
    restoration: { topic: "Existing restoration on the tooth (presence and type)",
      pattern: R`\b(?:restorations?|fillings?|mod)\b|\bvisual(?:ly)? (?:inspect(?:ion)?|exam(?:ination)?)(?: of)?(?: the| this| that)?(?: tooth| teeth)?\s*$|\binspect visually\s*$` },
    "adjacent-teeth": { topic: "Comparison with adjacent and contralateral control teeth" },
  };
  for (const [suffix, change] of Object.entries(reinterpretation)) {
    const i = facts.findIndex(f => f.id === `${variantA.caseId}:${suffix}`);
    if (i < 0) throw new Error(`CASE001_VARIANT_B_UNKNOWN:${suffix}`);
    facts[i] = { ...facts[i]!, ...(change.topic ? { topic: change.topic } : {}), ...(change.pattern ? { patterns: [change.pattern] } : {}) };
  }
  return { ...variantA, version: variantA.version.replace(/-variant-a$/u, "-variant-b"), facts };
}
