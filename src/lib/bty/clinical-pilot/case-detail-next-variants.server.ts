import type { DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";

/** Pure, separately versioned fictional details for review. No catalog imports,
 * pack registration, user selection, diagnosis, treatment selection, or I/O.
 * The supplied original packs and their available observations remain intact.
 */
export const CASE_DETAIL_NEXT_REVIEW_VERSION = "discovery-2026-10-31.2-review-b";
const BASE_VERSION = "discovery-2026-10-23.1";
const PROVENANCE = "fictional-extension-awaiting-review" as const;
const R = String.raw;
type ReviewFact = DiscoveryFact & { provenance: typeof PROVENANCE };
type Plan = { caseId: string; replacements: ReviewFact[]; additions: ReviewFact[] };

const fact = (caseId: string, id: string, channel: "patient" | "exam", topic: string,
  pattern: string, answer: string, available = true, teeth?: number[]): ReviewFact => ({
  id: `${caseId}:${id}`, channel, topic, patterns: [pattern], answer, available,
  provenance: PROVENANCE, ...(teeth ? { toothNumbers: teeth } : {}),
});

function case002(): Plan {
  const f = (id: string, channel: "patient" | "exam", topic: string, pattern: string,
    answer: string, available = true, teeth?: number[]) => fact("drchi-002", id, channel, topic, pattern, answer, available, teeth);
  return { caseId: "drchi-002", replacements: [
    f("remaining-structure", "exam", "Accessible remaining tooth structure before excavation",
      R`\b(?:remaining structure|remaining tooth|sound structure|wall thickness|cusp thickness)\b`,
      "Before removal of the restoration or caries at #30, accessible buccal and lingual walls are approximately 2 mm thick. Sound tooth structure is visible mesially; the distal wall is undermined. Covered structure has not been directly inspected.", true, [30]),
    f("isolation", "exam", "Pre-excavation isolation feasibility",
      R`\b(?:isolation|isolate|rubber dam|moisture control)\b`,
      "At the directed pre-excavation check on #30, a rubber dam can be seated and a dry field maintained with gentle distal gingival retraction. This has not tested isolation at any deeper margin that excavation might reveal.", true, [30]),
    f("pulp-testing", "exam", "Objective cold sensibility test of the presenting tooth",
      R`\b(?:cold[ -]test|cold sensibility|pulp sensibility|pulp test|pulpal test|vitality|vital)\b`,
      "On cold testing, #30 responds promptly; the sensation stops within two seconds after stimulus removal. This is a sensibility observation, not a direct measurement of pulpal blood flow.", true, [30]),
  ], additions: [
    f("location", "patient", "Identity of the tooth with the recurrent lesion",
      R`which (?:tooth|side)|\blocation\b|\bwhere\b.{0,25}\b(?:tooth|cold|sensitive|filling)\b`,
      "The tooth we are discussing is my lower right first molar, #30.", true, [30]),
    f("onset", "patient", "Onset of the cold sensitivity",
      R`\b(?:when|how long|started|onset|duration)\b.{0,35}\b(?:cold|sensitivity|sensitive|symptoms)\b`,
      "I first noticed the cold sensitivity about three weeks ago.", true, [30]),
    f("severity", "patient", "Patient-rated cold discomfort intensity",
      R`\b(?:severity|intensity|scale)\b|how (?:bad|severe|strong)|out of (?:10|ten)`,
      "The cold discomfort is about 2 out of 10.", true, [30]),
    f("night", "patient", "Nocturnal pain history",
      R`\b(?:night|nocturnal|sleep|wake|waking)\b.{0,25}\b(?:pain|hurt|tooth)\b|\bpain\b.{0,25}\b(?:night|sleep)\b`,
      "Tooth pain has not woken me from sleep.", true, [30]),
    f("heat", "patient", "Heat sensitivity history",
      R`\b(?:heat|hot drinks?|hot food|warm drinks?)\b`,
      "I have not noticed discomfort from hot food or drinks.", true, [30]),
    f("lesion-to-bone", "exam", "Measured accessible distal lesion-to-bone relationship",
      R`\b(?:lesion[- ]to[- ]bone|caries[- ]to[- ]bone|bone level|bone crest|crestal bone|distance.{0,20}bone|bone.{0,20}distance)\b`,
      "Before excavation, the accessible distal caries boundary at #30 is estimated to be 2.5 mm coronal to the alveolar crest using the current bitewing and local sounding under anesthesia. The deepest boundary beneath the restoration is not yet visible.", true, [30]),
    f("ferrule", "exam", "Accessible axial heights relevant to ferrule assessment",
      R`\b(?:ferrule|crown length|restorability|restorable)\b`,
      "At #30, accessible sound axial tooth height above the gingival margin is about 2 mm buccally and lingually and 1 mm mesially. No continuous distal band can be confirmed before excavation; a complete circumferential ferrule is not established.", true, [30]),
    f("apical-imaging", "exam", "Current periapical appearance",
      R`\b(?:pa|periapical|apical|pdl|lamina dura)\b`,
      "The current PA of #30 shows no obvious apical radiolucency, with a visible lamina dura and no obvious apical periodontal-ligament widening. The image does not determine whether endodontic treatment will be needed.", true, [30]),
    f("ept", "exam", "Electric pulp sensibility test of the presenting tooth",
      R`\b(?:ept|electric pulp|electrical pulp)\b`,
      "#30 gives a reproducible response to electric pulp testing. No absolute numeric threshold or pulpal blood-flow measurement was recorded.", true, [30]),
    f("probing", "exam", "Six-site periodontal probing before excavation",
      R`\b(?:probing|probe|pockets?|periodontal chart)\b`,
      "Six-site probing at #30 measures 2–3 mm except for a 4 mm distal site, which bleeds on probing. No isolated narrow deep pocket is recorded.", true, [30]),
    f("mobility", "exam", "Presenting-tooth mobility",
      R`\b(?:mobility|mobile|loose|wobbles?|wiggles?)\b`,
      "#30 has physiologic mobility on gentle examination.", true, [30]),
    f("bite-test", "exam", "Cusp-specific bite-test response",
      R`\bbite[ -]test\b|tooth slooth|cotton roll`,
      "Light loading and release on the accessible cusps of #30 do not reproduce pain or visible cusp movement at this visit.", true, [30]),
    f("palpation", "exam", "Apical soft-tissue palpation",
      R`\bpalpat(?:e|ion)\b|press.{0,25}(?:gum|root)`,
      "Buccal and lingual apical palpation at #30 does not reproduce tenderness.", true, [30]),
    f("swelling", "exam", "Swelling and sinus-tract examination",
      R`\b(?:swelling|swollen|sinus tract|fistula|drainage)\b`,
      "No localized swelling or sinus tract is visible around #30.", true, [30]),
    f("medical-history", "patient", "Reported general medical conditions",
      R`\b(?:medical history|medical conditions|general health|illness|illnesses)\b`,
      "I do not report any diagnosed chronic medical conditions."),
    f("medications", "patient", "Regular medications and supplements",
      R`\b(?:medications?|medicines?|prescriptions?|drugs?|supplements?)\b`,
      "I do not take regular prescription medicines or supplements."),
    f("allergies", "patient", "Reported medication and material allergies",
      R`\b(?:allergies|allergy|allergic|penicillin|latex)\b`,
      "I have no known drug, latex, or dental-material allergies."),
    f("post-excavation", "exam", "Unperformed excavation and unresolved definitive assessment",
      R`\b(?:excavation|excavate|after caries removal|after removing.{0,15}(?:caries|decay)|pulp exposure|definitive restorability|rct decision|need.{0,15}root canal)\b`,
      "The restoration and caries at #30 have not been removed. Pulp exposure, the final lesion boundary, remaining structure after excavation, definitive restorability, and any root-canal decision are not established.", false, [30]),
  ] };
}

function case003(): Plan {
  const f = (id: string, channel: "patient" | "exam", topic: string, pattern: string,
    answer: string, available = true, teeth?: number[]) => fact("drchi-003", id, channel, topic, pattern, answer, available, teeth);
  return { caseId: "drchi-003", replacements: [
    f("previous-images", "exam", "Comparable previous and current periapical images",
      R`\b(?:previous|prior|old|compare|comparison|serial|interval)\b.{0,45}\b(?:pa|radiograph|image|x[- ]?ray|lesion)\b`,
      "A PA of #30 from twelve months ago is available with a comparable projection. The distal-root apical radiolucency measures approximately 3 mm on that image and 5 mm on the current PA. These are two-dimensional measurements with inherent projection limits.", true, [30]),
    f("occlusion", "exam", "Current habitual and excursive contacts",
      R`\b(?:occlusal|occlusion|articulating|centric)\b|check (?:the )?bite`,
      "In repeated habitual closure, #30 contacts with the other posterior teeth rather than first. No isolated heavy mark or working/nonworking interference on its crown is recorded. No deprogramming or CR–MIP record has been made.", true, [30]),
    f("probing", "exam", "Root-surface periodontal probing",
      R`\b(?:probing|probe|pockets?|periodontal chart)\b`,
      "Probing at #30 measures 2–3 mm around the mesial and distal root surfaces, without an isolated narrow deep site, bleeding, or suppuration at this visit.", true, [30]),
    f("crown-margins", "exam", "Accessible crown-margin and seal examination",
      R`\b(?:margin|seal|crown integrity|recurrent caries|recurrent decay)\b`,
      "The #30 crown is seated without gross movement. Accessible margins are intact to an explorer with no visible recurrent caries. The crown has not been removed to inspect covered margins or underlying tooth structure.", true, [30]),
    f("adjacent", "exam", "Focused visual examination of neighboring teeth",
      R`\b(?:adjacent|neighboring|neighbouring|other teeth)\b`,
      "Visual examination of #29 and #31 shows no cavitation, fractured restoration, or localized swelling. Their sensibility and percussion observations are recorded as separate directed tests.", true, [29, 31]),
    f("fracture", "exam", "Unestablished covered crack and root-fracture status",
      R`\b(?:root fracture|vertical fracture|crack extent|crack depth|fracture extent|cbct)\b`,
      "No root fracture has been established at #30. The crown remains in place, and no CBCT or direct inspection of the covered root structure has been performed. The current probing and two-dimensional PA findings do not exclude a fracture.", false, [30]),
  ], additions: [
    f("location", "patient", "Identity of the previously treated tooth",
      R`which (?:tooth|side)|\blocation\b|\bwhere\b.{0,25}\b(?:tooth|pain|sore|hurt)\b`,
      "It is my crowned lower right first molar, #30.", true, [30]),
    f("rct-timing", "patient", "Timing of prior root-canal treatment",
      R`\b(?:when|how long ago|timing|date)\b.{0,40}\b(?:root canal|rct|endodontic)\b|\b(?:root canal|rct)\b.{0,35}\b(?:ago|completed|done)\b`,
      "The root-canal treatment on #30 was completed four years ago.", true, [30]),
    f("preservation-preference", "patient", "Patient preference about preserving the tooth",
      R`\b(?:prefer|preference|preserve|preserving|save|saving|keep|keeping|choice|goals?)\b`,
      "I would like to keep this tooth if that is reasonably possible. I am willing to have a specialist assessment and hear the uncertainties before choosing a treatment.", true, [30]),
    f("percussion", "exam", "Percussion response of the presenting tooth",
      R`\bpercuss(?:ion)?\b|\btap(?:ping)?\b`,
      "#30 is mildly tender to gentle vertical percussion and is not tender to lateral percussion.", true, [30]),
    f("palpation", "exam", "Apical soft-tissue palpation",
      R`\bpalpat(?:e|ion)\b|press.{0,25}(?:gum|root)`,
      "Buccal apical palpation at the distal root of #30 produces mild tenderness; lingual palpation is not tender.", true, [30]),
    f("mobility", "exam", "Presenting-tooth mobility",
      R`\b(?:mobility|mobile|loose|wobbles?|wiggles?)\b`,
      "#30 has physiologic mobility on gentle examination.", true, [30]),
    f("bite-test", "exam", "Cusp-specific bite-test response",
      R`\bbite[ -]test\b|tooth slooth|cotton roll`,
      "Light cusp-specific loading on the #30 crown reproduces mild pressure soreness, without a distinct sharp release pain. Covered tooth structure has not been inspected.", true, [30]),
    f("structural-inspection", "exam", "Accessible structural inspection under magnification",
      R`\b(?:structural inspection|structural condition|remaining structure|remaining tooth|visible crack|inspect.{0,15}(?:crack|fracture)|transillumination)\b`,
      "Under magnification, no fracture line is visible on the accessible surfaces of #30. The crown blocks inspection and transillumination of the covered coronal tooth; sound structure and ferrule beneath it have not been established.", true, [30]),
    f("root-filling-quality", "exam", "Two-dimensional root-filling appearance",
      R`\b(?:root filling quality|root[- ]filling|obturation|gutta[- ]?percha|filling length|canal filling)\b`,
      "On the current PA of #30, the visible distal canal filling ends approximately 2.5 mm short of the radiographic apex; the mesial fillings end about 1 mm short. No gross filling void is visible on this projection. Untreated anatomy cannot be assessed from this image alone.", true, [30]),
    f("root-filling-quality-mesial", "exam", "Mesial-root filling appearance on the current PA",
      R`\bmesial\b.{0,45}\b(?:root[- ]filling|filling quality|obturation|canal filling)\b|\b(?:root[- ]filling|filling quality|obturation|canal filling)\b.{0,45}\bmesial\b`,
      "On the current PA of #30, the mesial canal fillings end about 1 mm short of the radiographic apex, without a gross visible filling void on this projection. Untreated mesial anatomy cannot be assessed from this image alone.", true, [30]),
    f("root-filling-quality-distal", "exam", "Distal-root filling appearance on the current PA",
      R`\bdistal\b.{0,45}\b(?:root[- ]filling|filling quality|obturation|canal filling)\b|\b(?:root[- ]filling|filling quality|obturation|canal filling)\b.{0,45}\bdistal\b`,
      "On the current PA of #30, the distal canal filling ends approximately 2.5 mm short of the radiographic apex, without a gross visible filling void on this projection. Untreated distal anatomy cannot be assessed from this image alone.", true, [30]),
    f("retreatment-feasibility", "exam", "Unestablished feasibility of endodontic retreatment",
      R`\b(?:retreatment feasibility|retreatable|can.{0,20}retreat|feasible.{0,20}retreat|retreatment assessment)\b`,
      "Specialist retreatment assessment of #30 has not been completed. Access through or removal of the crown, canal negotiability, covered structural condition, and the feasibility of retention remain unestablished.", false, [30]),
    // Fixed projections of the combined probing observation. A root-specific
    // request can disclose only that root's sites, without the other root.
    f("probing-mesial", "exam", "Mesial-root periodontal probing",
      R`\bmesial\b.{0,35}\b(?:probing|probe|pockets?)\b|\b(?:probing|probe|pockets?)\b.{0,35}\bmesial\b`,
      "Probing around the mesial root surfaces of #30 measures 2–3 mm, without an isolated narrow deep site, bleeding, or suppuration at those sites.", true, [30]),
    f("probing-distal", "exam", "Distal-root periodontal probing",
      R`\bdistal\b.{0,35}\b(?:probing|probe|pockets?)\b|\b(?:probing|probe|pockets?)\b.{0,35}\bdistal\b`,
      "Probing around the distal root surfaces of #30 measures 2–3 mm, without an isolated narrow deep site, bleeding, or suppuration at those sites.", true, [30]),
    f("adjacent-cold-29", "exam", "Cold-test response of control tooth #29",
      R`(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b).{0,45}\bcold\b|\bcold\b.{0,45}(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b)`,
      "#29 gives a brief cold response that stops after removal of the stimulus.", true, [29]),
    f("adjacent-cold-31", "exam", "Cold-test response of control tooth #31",
      R`(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b).{0,45}\bcold\b|\bcold\b.{0,45}(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b)`,
      "#31 gives a brief cold response that stops after removal of the stimulus.", true, [31]),
    f("adjacent-percussion-29", "exam", "Percussion response of control tooth #29",
      R`(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b).{0,45}\b(?:percuss(?:ion)?|tap(?:ping)?)\b|\b(?:percuss(?:ion)?|tap(?:ping)?)\b.{0,45}(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b)`,
      "#29 is not tender to gentle vertical or lateral percussion.", true, [29]),
    f("adjacent-percussion-31", "exam", "Percussion response of control tooth #31",
      R`(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b).{0,45}\b(?:percuss(?:ion)?|tap(?:ping)?)\b|\b(?:percuss(?:ion)?|tap(?:ping)?)\b.{0,45}(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b)`,
      "#31 is not tender to gentle vertical or lateral percussion.", true, [31]),
    f("adjacent-29", "exam", "Focused visual examination of neighboring tooth #29",
      R`(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b).{0,45}\b(?:visual|inspect|examine|cavitation|fractured restoration|swelling)\b|\b(?:visual|inspect|examine)\b.{0,45}(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b)`,
      "Visual examination of #29 shows no cavitation, fractured restoration, or localized swelling.", true, [29]),
    f("adjacent-31", "exam", "Focused visual examination of neighboring tooth #31",
      R`(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b).{0,45}\b(?:visual|inspect|examine|cavitation|fractured restoration|swelling)\b|\b(?:visual|inspect|examine)\b.{0,45}(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b)`,
      "Visual examination of #31 shows no cavitation, fractured restoration, or localized swelling.", true, [31]),
    f("medical-history", "patient", "Reported general medical conditions",
      R`\b(?:medical history|medical conditions|general health|illness|illnesses)\b`,
      "I do not report any diagnosed chronic medical conditions."),
    f("medications", "patient", "Regular medications and supplements",
      R`\b(?:medications?|medicines?|prescriptions?|drugs?|supplements?)\b`,
      "I do not take regular prescription medicines or supplements."),
    f("allergies", "patient", "Reported medication and material allergies",
      R`\b(?:allergies|allergy|allergic|penicillin|latex)\b`,
      "I have no known drug, latex, or dental-material allergies."),
  ] };
}

function case008(): Plan {
  const f = (id: string, channel: "patient" | "exam", topic: string, pattern: string,
    answer: string, available = true, teeth?: number[]) => fact("drchi-008", id, channel, topic, pattern, answer, available, teeth);
  return { caseId: "drchi-008", replacements: [
    f("bone", "exam", "CBCT ridge dimensions at the missing-tooth site",
      R`\b(?:ridge dimensions?|ridge width|bone width|bone availability|cbct|scan)\b`,
      "At the explicitly identified missing #30 site, the CBCT ridge is approximately 5.2 mm buccolingually at the crest and 6.6 mm wide 3 mm apical to the crest. The ridge cross-section narrows coronally; these measurements do not establish an implant size or final plan.", true, [30]),
    f("movement", "exam", "Measured mesial inclination of the distal neighboring tooth",
      R`\b(?:tilt|tilted|tilting|tipping|mesial|movement|drift|drifting)\b|\b#?31\b`,
      "With #30 confirmed missing, #31 is mesially inclined approximately 18 degrees relative to the mandibular occlusal-plane perpendicular on the current study model. This is a position measurement, not an extraction indication.", true, [31]),
    f("opposing", "exam", "Measured vertical position of the opposing tooth",
      R`\b(?:opposing|supraeruption|supraerupted|overeruption|over-eruption|over erupted|opponent)\b|\b#?3\b`,
      "With #30 confirmed missing, the opposing #3 palatal cusp lies approximately 1.8 mm below the neighboring maxillary posterior occlusal plane on the current study model, consistent with a recorded supraerupted position. The cause and timing are not established.", true, [3]),
    f("occlusion", "exam", "Measured interarch restorative clearance",
      R`\b(?:occlusal|occlusion|restorative space|interarch|bite|clearance|crown height)\b`,
      "At the missing #30 site in habitual closure, the vertical distance from the ridge crest to the opposing #3 cusp is approximately 5.5 mm on the mounted casts. This is measured interarch space; restorative adequacy has not been determined.", true, [3, 30]),
    f("medical", "patient", "Reported medical conditions relevant to general history",
      R`\b(?:medical history|medical conditions|general health|illness|illnesses|diabetes|osteoporosis)\b`,
      "I report controlled hypertension. I do not report diabetes, osteoporosis, or a prior head-and-neck radiation history."),
  ], additions: [
    // This new identity is placed before the position findings in the copy. The
    // original source identifies only a lower first molar, not a right-side tooth.
    f("location", "patient", "Explicit fictional identity of the missing tooth",
      R`which (?:tooth|side)|\blocation\b|\bwhere\b.{0,25}\b(?:missing|gap|space)\b`,
      "For this fictional review version, the missing tooth is my lower right first molar, #30.", true, [30]),
    f("restorative-plane", "exam", "Current occlusal-plane relationship across the space",
      R`\b(?:occlusal plane|restorative plane|plane relationship|plane discrepancy)\b`,
      "On the mounted casts, the #3 cusp and the mesially inclined #31 create an uneven plane across the #30 space. No diagnostic wax-up or proposed replacement occlusal surface has been completed.", true, [3, 30, 31]),
    f("mesiodistal-space", "exam", "Measured mesiodistal space at the missing-tooth site",
      R`\b(?:mesiodistal space|mesio[- ]distal|gap width|space width|available length|horizontal space)\b`,
      "At the missing #30 site, the study model shows approximately 8.0 mm between #29 distal and #31 mesial at the occlusal level and 10.5 mm at the gingival level.", true, [29, 30, 31]),
    f("ian-dimensions", "exam", "CBCT ridge-to-inferior-alveolar-canal measurement",
      R`\b(?:ian|inferior alveolar|mandibular canal|nerve|canal clearance|crest[- ]to[- ]canal)\b`,
      "At the center of the missing #30 ridge, the CBCT measures approximately 11.2 mm from the crest to the superior border of the inferior alveolar canal. This anatomic distance is not a planned implant length or a prescribed safety allowance.", true, [30]),
    f("ridge-contour", "exam", "CBCT lingual ridge contour",
      R`\b(?:lingual concavity|lingual undercut|ridge contour|buccal plate|lingual plate)\b`,
      "The CBCT cross-section at the #30 site shows a shallow lingual concavity and continuous visible buccal and lingual cortices. No implant osteotomy or surgical inspection has occurred.", true, [30]),
    f("soft-tissue", "exam", "Soft-tissue examination at the edentulous site",
      R`\b(?:soft tissue|keratinized|mucosa|ridge tissue)\b`,
      "The #30 ridge is covered by intact mucosa without ulceration or suppuration. Approximately 3 mm of keratinized tissue is measured buccally.", true, [30]),
    f("adjacent-probing", "exam", "Periodontal probing of neighboring teeth",
      R`\b(?:probing|probe|pockets?|periodontal chart)\b`,
      "Six-site probing at #29 and #31 measures 2–3 mm without bleeding or suppuration at this visit.", true, [29, 31]),
    f("adjacent-mobility", "exam", "Mobility of neighboring teeth",
      R`\b(?:mobility|mobile|loose|wobbles?|wiggles?)\b`,
      "#29 and #31 have physiologic mobility on gentle examination.", true, [29, 31]),
    f("adjacent-probing-29", "exam", "Periodontal probing of neighboring tooth #29",
      R`(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b).{0,45}\b(?:probing|probe|pockets?)\b|\b(?:probing|probe|pockets?)\b.{0,45}(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b)`,
      "Six-site probing at #29 measures 2–3 mm without bleeding or suppuration at this visit.", true, [29]),
    f("adjacent-probing-31", "exam", "Periodontal probing of neighboring tooth #31",
      R`(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b).{0,45}\b(?:probing|probe|pockets?)\b|\b(?:probing|probe|pockets?)\b.{0,45}(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b)`,
      "Six-site probing at #31 measures 2–3 mm without bleeding or suppuration at this visit.", true, [31]),
    f("adjacent-mobility-29", "exam", "Mobility of neighboring tooth #29",
      R`(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b).{0,45}\b(?:mobility|mobile|loose)\b|\b(?:mobility|mobile|loose)\b.{0,45}(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b)`,
      "#29 has physiologic mobility on gentle examination.", true, [29]),
    f("adjacent-mobility-31", "exam", "Mobility of neighboring tooth #31",
      R`(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b).{0,45}\b(?:mobility|mobile|loose)\b|\b(?:mobility|mobile|loose)\b.{0,45}(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b)`,
      "#31 has physiologic mobility on gentle examination.", true, [31]),
    // The available original paired adjacent-teeth fact remains unchanged;
    // these projections let a single-tooth request remain a single-tooth reply.
    f("adjacent-29", "exam", "Appearance of neighboring tooth #29",
      R`(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b).{0,45}\b(?:visual|inspect|examine|sound|caries)\b|\b(?:visual|inspect|examine)\b.{0,45}(?:#\s*29\b|\btooth\s*(?:number\s*)?#?\s*29\b)`,
      "Neighboring tooth #29 appears sound on the current examination.", true, [29]),
    f("adjacent-31", "exam", "Appearance of neighboring tooth #31",
      R`(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b).{0,45}\b(?:visual|inspect|examine|sound|caries)\b|\b(?:visual|inspect|examine)\b.{0,45}(?:#\s*31\b|\btooth\s*(?:number\s*)?#?\s*31\b)`,
      "Neighboring tooth #31 appears sound on the current examination.", true, [31]),
    f("food-trapping", "patient", "Food-trapping symptoms at the missing-tooth space",
      R`\b(?:food trap|food trapping|food impaction|food stuck|food pack|food packing)\b`,
      "Food sometimes collects in the open space next to #31. I can remove it, and it has not caused pain.", true, [30, 31]),
    f("bite-history", "patient", "Patient perception of the bite",
      R`bite.*(?:feel|off|wrong|fit|problem)|jaw.*(?:back|side|shift|move)|teeth.*come together`,
      "My bite feels comfortable. I do not deliberately move my jaw backward or sideways to bring my teeth together."),
    f("medications", "patient", "Regular medications and supplements",
      R`\b(?:medications?|medicines?|prescriptions?|drugs?|supplements?|antiresorptive|bisphosphonate|denosumab)\b`,
      "I take amlodipine 5 mg daily. I report no other regular medicines or supplements and no past bisphosphonate or denosumab use."),
    f("allergies", "patient", "Reported medication and material allergies",
      R`\b(?:allergies|allergy|allergic|penicillin|latex)\b`,
      "I have no known drug, latex, or dental-material allergies."),
    f("smoking", "patient", "Tobacco and nicotine history",
      R`\b(?:smok(?:e|es|ing)|tobacco|nicotine|vap(?:e|ing))\b`,
      "I do not smoke, vape, or use other nicotine products."),
    f("home-care", "patient", "Reported home-care routine",
      R`\b(?:brush|brushing|floss|waterpik|home care|oral hygiene)\b`,
      "I brush twice daily and use floss around the teeth beside the gap most evenings."),
    f("primary-stability", "exam", "Unknown future implant primary stability",
      R`\b(?:primary stability|insertion torque|implant stability|implant torque|isq)\b`,
      "No implant has been placed at #30. Future primary stability, insertion torque, and resonance-frequency measurements are unknown and cannot be supplied from these preoperative observations.", false, [30]),
    f("final-plan", "exam", "Unestablished definitive replacement and positional-correction plan",
      R`\b(?:final plan|definitive plan|implant size|implant length|implant diameter|orthodontic feasibility|need.{0,15}(?:graft|extraction)|treatment selected)\b`,
      "No definitive replacement, grafting, orthodontic movement, tooth reduction, or extraction plan has been selected for this fictional visit. A diagnostic wax-up and assessment of corrective feasibility have not been completed.", false, [3, 30, 31]),
  ] };
}

/** Strict copy construction rejects ambiguous bases, unauthorized replacement of
 * available source observations, and duplicate IDs. Returning data is not review
 * approval and does not register the new version or change prior attempts.
 */
export function caseDetailNextVariants(basePatients: readonly DiscoveryPatient[]): DiscoveryPatient[] {
  return [case002(), case003(), case008()].map(plan => {
    const matches = basePatients.filter(p => p.caseId === plan.caseId && p.version === BASE_VERSION);
    if (matches.length !== 1) throw new Error(`CASE_DETAIL_NEXT_BASE_REQUIRED:${plan.caseId}`);
    const source = matches[0]!;
    const replacements = new Map(plan.replacements.map(f => [f.id, f]));
    const ids = new Set(source.facts.map(f => f.id));
    if (ids.size !== source.facts.length) throw new Error(`CASE_DETAIL_NEXT_DUPLICATE_SOURCE:${plan.caseId}`);
    for (const replacement of plan.replacements) {
      const old = source.facts.find(f => f.id === replacement.id);
      if (!old || old.available !== false) throw new Error(`CASE_DETAIL_NEXT_REPLACEMENT_NOT_ALLOWED:${replacement.id}`);
    }
    for (const addition of plan.additions) {
      if (ids.has(addition.id)) throw new Error(`CASE_DETAIL_NEXT_DUPLICATE:${addition.id}`);
      ids.add(addition.id);
    }
    const retained = source.facts.map(old => replacements.get(old.id) ?? { ...old, patterns: [...old.patterns],
      ...(old.toothNumbers ? { toothNumbers: [...old.toothNumbers] } : {}) });
    const location = plan.additions.find(f => f.id === `${plan.caseId}:location`)!;
    return { ...source, version: CASE_DETAIL_NEXT_REVIEW_VERSION, facts: [
      location, ...retained, ...plan.additions.filter(f => f !== location),
    ] };
  });
}
