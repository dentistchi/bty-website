import type { DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";

/** New, fictional examination/history details for author review. This module does
 * not import the catalog, register a pack, choose a user, diagnose, or access I/O.
 * Existing attempts continue to use their separately registered frozen packs.
 */
export const CASE_DETAIL_REVIEW_VERSION = "discovery-2026-10-31.1-review-a";
const BASE_VERSION = "discovery-2026-10-23.1";
const PROVENANCE = "fictional-extension-awaiting-review" as const;
const R = String.raw;
type ReviewFact = DiscoveryFact & { provenance: typeof PROVENANCE };
type Plan = { caseId: string; replacements: ReviewFact[]; additions: ReviewFact[] };

/** The old fact mixes a known observation with an unresolved assessment. Only in
 * the new pack, retain the initial known finding and let a separately requested
 * directed component examination provide the additional fictional observations.
 */
export const CASE_DETAIL_REVISED_SOURCE_FACTS = [{
  factId: "drchi-011:crown",
  reason: "Retain screw-retained/mobile initial finding; remove the stale unresolved-source clause before adding a separately requested directed examination.",
}] as const;

const fact = (caseId: string, id: string, channel: "patient" | "exam", topic: string,
  pattern: string, answer: string, available = true, teeth?: number[]): ReviewFact => ({
  id: `${caseId}:${id}`, channel, topic, patterns: [pattern], answer, available,
  provenance: PROVENANCE, ...(teeth ? { toothNumbers: teeth } : {}),
});

function case005(): Plan {
  const f = (id: string, channel: "patient" | "exam", topic: string, pattern: string,
    answer: string, available = true, teeth?: number[]) => fact("drchi-005", id, channel, topic, pattern, answer, available, teeth);
  return { caseId: "drchi-005", replacements: [
    f("occlusion", "exam", "Occlusal examination: current contacts on the crowned tooth",
      R`\b(?:occlusion|occlusal|articulating|centric)\b|check (?:the )?bite`,
      "On light closure, the #30 crown contacts before the adjacent teeth. A firm mark and shimstock hold are present on its distal marginal ridge, while adjacent posterior contacts are lighter. This records a contact finding, not the cause of all symptoms.", true, [30]),
    f("probing", "exam", "Periodontal probing around the crowned tooth",
      R`\b(?:probing|probe|pocket|periodontal chart)\b`,
      "Six-site probing around #30 measures 2–3 mm, with no isolated deep site or bleeding on probing at this visit.", true, [30]),
    f("crown-integrity", "exam", "Crown integrity and accessible margins",
      R`\b(?:crown integrity|crown margins?|coronal seal|recurrent caries|recurrent decay)\b|\b(?:inspect|examine|check)\b.{0,25}\bcrown\b`,
      "The #30 crown is seated and does not move under gentle examination. Accessible margins are intact to an explorer, without visible recurrent caries. The crown has not been removed, so the covered tooth structure is not directly visible.", true, [30]),
    f("adjacent", "exam", "Focused examination of adjacent teeth",
      R`\b(?:adjacent|neighboring|neighbouring)\b.{0,25}\b(?:teeth|tooth)\b`,
      "Focused visual examination of #29 and #31 shows no visible cavitation, fractured restoration, or localized swelling. Their cold and percussion responses are recorded separately.", true, [29, 31]),
    f("parafunction", "patient", "Reported grinding and clenching history",
      R`\b(?:grind|grinding|clench|clenching|bruxism|parafunction)\b`,
      "My partner has heard me grinding at night. I also catch myself clenching while driving. I have not had a sleep recording."),
  ], additions: [
    f("location", "patient", "Location of the presenting tooth",
      R`\bwhere\b.{0,25}\b(?:hurt|pain|discomfort|tooth)\b|which (?:tooth|side)|\blocation\b`,
      "It is the crowned lower right first molar, #30.", true, [30]),
    f("crown-history", "patient", "Timing of the definitive crown",
      R`\b(?:when|how long ago)\b.{0,40}\bcrown\b|\bcrown\b.{0,35}\b(?:placed|fitted|delivered|ago|history)\b`,
      "The definitive crown on #30 was fitted three weeks ago. The chewing discomfort returned about a week after that.", true, [30]),
    f("pain-severity", "patient", "Severity of the chewing discomfort",
      R`\b(?:severity|intensity)\b|how (?:bad|severe|strong)|out of (?:10|ten)|\bscale\b`,
      "It is a dull pressure, about 2 out of 10, while I chew. It settles when I stop chewing.", true, [30]),
    f("spontaneous", "patient", "Spontaneous pain history",
      R`\b(?:spontaneous|unprovoked)\b|on its own|by itself|without (?:chewing|biting|eating)`,
      "The tooth does not ache by itself.", true, [30]),
    f("night", "patient", "Nocturnal tooth pain history",
      R`\b(?:night|nocturnal|sleep|wake|waking)\b.{0,25}\b(?:pain|hurt|tooth)\b|\bpain\b.{0,25}\b(?:night|sleep)\b`,
      "Tooth pain has not woken me from sleep.", true, [30]),
    f("cold", "patient", "Cold sensitivity history",
      R`\b(?:cold|iced|chilled)\b(?![ -]test)|\bcold sensitivity\b`,
      "I have not noticed discomfort from cold food or drinks.", true, [30]),
    f("bite-history", "patient", "Patient perception of the current bite",
      R`bite.*(?:feel|off|wrong|fit|problem)|teeth.*(?:fit|come together)|first contact`,
      "That crowned tooth seems to touch before the others when I close gently.", true, [30]),
    f("jaw-shift", "patient", "Deliberate jaw repositioning to bring teeth together",
      R`\bjaw\b.{0,40}\b(?:back|side|shift|move|reposition)\b|\b(?:move|shift)\b.{0,35}\bjaw\b`,
      "I do not deliberately move my jaw backward or sideways to make my teeth fit."),
    f("night-guard", "patient", "Use of a night guard",
      R`\b(?:night guard|nightguard|occlusal guard|splint)\b`,
      "I have never used a night guard."),
    f("palpation", "exam", "Apical soft-tissue palpation",
      R`\bpalpat(?:e|ion)\b|press.{0,25}(?:gum|root)`,
      "Buccal and lingual apical palpation at #30 does not reproduce tenderness.", true, [30]),
    f("mobility", "exam", "Tooth mobility under gentle examination",
      R`\b(?:mobility|mobile|loose|wobbles?|wiggles?)\b`,
      "#30 has physiologic mobility on gentle examination.", true, [30]),
    f("bite-test", "exam", "Cusp-specific bite testing on the crowned tooth",
      R`\bbite[ -]test\b|tooth slooth|cotton roll`,
      "Light cusp-specific loading on the #30 crown reproduces the mild pressure discomfort. There is no distinct sharp pain on release. The underlying tooth has not been directly inspected beneath the crown.", true, [30]),
    f("adjacent-cold", "exam", "Cold-test responses of adjacent control teeth",
      R`\b(?:adjacent|neighboring|neighbouring|29|31)\b.{0,35}\bcold\b|\bcold\b.{0,35}\b(?:adjacent|neighboring|neighbouring|29|31)\b`,
      "#29 and #31 each give a brief cold response that stops after removal of the stimulus.", true, [29, 31]),
    f("adjacent-percussion", "exam", "Percussion responses of adjacent control teeth",
      R`\b(?:adjacent|neighboring|neighbouring|29|31)\b.{0,35}\b(?:percuss|percussion|tap)\b|\b(?:percuss|percussion|tap)\b.{0,35}\b(?:adjacent|neighboring|neighbouring|29|31)\b`,
      "Neither #29 nor #31 is tender to gentle vertical or lateral percussion.", true, [29, 31]),
    // Derived projections of the two paired observations above, not new clinical
    // findings. A request for one control tooth must not reveal or credit the
    // other control tooth. Keep the paired IDs for an explicitly paired request.
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
    f("muscles", "exam", "Masticatory muscle palpation",
      R`\b(?:masseter|temporalis|muscle palpation|masticatory muscles)\b`,
      "Bilateral masseter palpation produces mild soreness. Temporalis palpation is not tender. These findings do not establish when any clenching occurs."),
    f("medical-history", "patient", "General medical conditions reported by the patient",
      R`\b(?:medical history|general health|illness|illnesses|medical conditions)\b`,
      "I do not report any diagnosed chronic medical conditions."),
    f("medications", "patient", "Regular medication history",
      R`\b(?:medications?|prescriptions?|medicines?|drugs?)\b`,
      "I do not take regular prescription medicines or supplements."),
    f("allergies", "patient", "Reported allergies to drugs and dental materials",
      R`\b(?:allergies|allergy|allergic|penicillin|latex)\b`,
      "I have no known drug, latex, or dental-material allergies."),
    f("cr-assessment", "exam", "Unperformed CR–MIP assessment",
      R`\b(?:cr[-– ]mip|centric relation record|deprogrammer|ideal jaw position)\b`,
      "No deprogramming or CR–MIP record has been performed for this fictional visit. An ideal jaw position or a discrepancy has not been established.", false),
    f("covered-fracture-extent", "exam", "Unestablished fracture extent beneath the crown",
      R`\b(?:root fracture|vertical fracture|crack depth|crack extent|fracture extent)\b`,
      "The crown has not been removed, and no definitive finding about a covered crack or root-fracture extent is supplied. The probing and bite findings do not exclude one.", false, [30]),
  ] };
}

function case006(): Plan {
  const f = (id: string, channel: "patient" | "exam", topic: string, pattern: string,
    answer: string, available = true, teeth?: number[]) => fact("drchi-006", id, channel, topic, pattern, answer, available, teeth);
  return { caseId: "drchi-006", replacements: [
    f("cusp-thickness", "exam", "Measured accessible cusp-wall thickness",
      R`\b(?:cusp thickness|cusp wall|thickness|remaining structure|remaining tooth)\b`,
      "At the accessible occlusal edge, the remaining mesiolingual cusp wall at #30 is approximately 1.6 mm thick. Other accessible cusp walls are about 2.5–3 mm. The MOD restoration has not been removed to inspect covered structure.", true, [30]),
    f("bite-test", "exam", "Cusp-specific bite-test response",
      R`\bbite[ -]test\b|tooth slooth|cotton roll`,
      "Light loading and release on each accessible cusp of #30 do not reproduce pain or visible cusp movement at this visit.", true, [30]),
    f("transillumination", "exam", "Transillumination of the visible cusp line",
      R`\b(?:transillumination|transilluminate|shine a light)\b`,
      "Transillumination highlights the visible line on the mesiolingual cusp of #30. The line can be followed on the exposed enamel, but its extent beneath the MOD restoration is not visible.", true, [30]),
    f("caries-risk", "exam", "Dentition-wide caries assessment",
      R`\bcaries[- ]risk\b|whole[- ]mouth caries|dentition[- ]wide caries`,
      "The current whole-mouth examination records two cavitated interproximal lesions with soft dentin: #23 distal and #24 mesial. These are observations of lesion location and activity; no bacterial-count test has been obtained.", true, [23, 24]),
    f("bite-and-habits", "patient", "Patient perception of the bite",
      R`bite.*(?:off|wrong|feel|fit)|(?:problems?|wrong|off|trouble).*(?:bite|occlusion)|jaw.*(?:back|side|shift)`,
      "My bite feels comfortable, and I do not deliberately shift my jaw to make my teeth fit."),
  ], additions: [
    f("location", "patient", "Location of the longstanding filling",
      R`which tooth|which side|\blocation\b|\bwhere\b.{0,25}\bfilling\b`,
      "The old filling we are discussing is in the lower right first molar, #30.", true, [30]),
    f("other-restorations", "exam", "Restorations on teeth other than the presenting tooth",
      R`other (?:teeth|restorations|fillings)|restorations? on other teeth|only (?:filled|treated|restored) tooth|any other restoration`,
      "Besides the MOD restoration on #30, #3 and #19 have small occlusal composites. No other restorations are recorded in the current examination.", true, [3, 19]),
    f("lower-anterior-caries", "exam", "Lower-anterior interproximal lesion findings",
      R`lower anterior|mandibular anterior|\b(?:23|24)\b.{0,25}\b(?:caries|decay|lesion)\b`,
      "#23 distal and #24 mesial have clinically cavitated interproximal lesions with soft dentin. These are clinical examination findings, not a measurement of bacterial count.", true, [23, 24]),
    f("root-caries", "exam", "Root-surface caries examination",
      R`\broot[- ](?:surface )?caries\b|\broot decay\b`,
      "Examination of the accessible exposed root surfaces shows no root-surface caries at this visit."),
    f("bitewing", "exam", "Current bitewing findings",
      R`\b(?:bitewings?|bw|bwx)\b`,
      "The posterior bitewings show the #30 MOD restoration without an obvious adjacent recurrent radiolucency. The small occlusal composites on #3 and #19 show no obvious recurrent radiolucency. These posterior images do not image the lower incisors.", true, [3, 19, 30]),
    f("occlusion", "exam", "Current occlusal contacts",
      R`\b(?:occlusion|occlusal|articulating|centric)\b|check (?:the )?bite`,
      "In repeated habitual closure, posterior contacts occur on several teeth on both sides. #30 is not the first or only contact, and no isolated working or nonworking contact on its visible cusp line is recorded. No CR–MIP record has been made.", true, [30]),
    f("wear", "exam", "Visible occlusal tooth wear",
      R`\b(?:wear facets?|attrition|worn teeth|tooth wear)\b`,
      "Moderate polished wear facets are present on several posterior teeth and the canines. The examination does not establish whether the activity producing them is current or occurs during sleep."),
    f("parafunction", "patient", "Awareness of clenching or grinding",
      R`\b(?:grinding|clenching|grind|clench|bruxism|parafunction)\b`,
      "I am not aware of clenching or grinding, and my partner has not mentioned grinding noises. I have not had a sleep recording, so I do not know whether it happens during sleep."),
    f("night-guard", "patient", "Night-guard use",
      R`\b(?:night guard|nightguard|splint|occlusal guard)\b`,
      "I have not used a night guard."),
    f("dry-mouth", "patient", "Patient-reported dry-mouth symptoms",
      R`\b(?:dry mouth|xerostomia|dryness)\b|mouth.{0,20}dry`,
      "My mouth does not usually feel dry, and I do not need water to swallow dry food. No salivary-flow measurement has been obtained."),
    f("diet", "patient", "Daily dietary exposures",
      R`\b(?:diet|snacks?|snacking|sweetened|sugary drinks|sipping|coffee)\b`,
      "I sip sweetened coffee through the morning and usually snack between meals."),
    f("home-care", "patient", "Home-care routine reported by the patient",
      R`\b(?:brushing|brush|floss|home care|oral hygiene|waterpik)\b`,
      "I brush twice a day and floss about twice a week."),
    f("last-visit", "patient", "Previous preventive dental visit",
      R`last (?:dental )?(?:visit|cleaning|checkup|check-up)|how often.{0,25}(?:clean|dentist)`,
      "My last checkup and cleaning were about a year ago."),
    f("medical-history", "patient", "Reported medical conditions",
      R`\b(?:medical history|medical conditions|general health|illnesses|illness)\b`,
      "I do not report any diagnosed chronic medical conditions."),
    f("medications", "patient", "Regular medications and supplements",
      R`\b(?:medications?|medicines?|prescriptions?|drugs?)\b`,
      "I do not take regular prescription medicines or supplements."),
    f("allergies", "patient", "Reported medication and material allergies",
      R`\b(?:allergies|allergy|allergic|penicillin|latex)\b`,
      "I have no known drug, latex, or dental-material allergies."),
    f("mobility", "exam", "Mobility of the presenting tooth",
      R`\b(?:mobility|mobile|loose|wobbles?|wiggles?)\b`,
      "#30 has physiologic mobility on gentle examination.", true, [30]),
    f("crack-extent", "exam", "Unestablished extent of the visible cusp line",
      R`\b(?:crack depth|crack extent|root extension|root fracture|fracture extent)\b`,
      "The MOD restoration has not been removed. The line's extent into covered dentin or toward the root has not been established; painless bite testing does not settle that question.", false, [30]),
  ] };
}

function case011(): Plan {
  const f = (id: string, channel: "patient" | "exam", topic: string, pattern: string,
    answer: string, available = true, teeth?: number[]) => fact("drchi-011", id, channel, topic, pattern, answer, available, teeth);
  return { caseId: "drchi-011", replacements: [
    f("crown", "exam", "Initial restoration retention and mobility finding",
      R`\b(?:crown|retention|retained|screw|restoration|mobile|mobility)\b`,
      "This is a screw-retained implant crown at #30. The crown is mobile on the initial gross examination.", true, [30]),
    f("components", "exam", "Directed assessment of the source of implant-restoration movement",
      R`\b(?:component|components|source of (?:movement|mobility)|connection|fit|abutment|compatibility|implant stability|fixture|screw integrity|fracture)\b`,
      "During the additional directed mobility assessment, the crown/abutment assembly moves relative to the fixture. The fixture itself does not move under gentle isolated clinical testing. These observations localize the observed movement to the restorative assembly; they do not identify its underlying cause or verify part compatibility.", true, [30]),
    f("occlusion", "exam", "Current light-contact occlusal observations",
      R`\b(?:occlusion|occlusal|articulating|bite check|centric)\b|check (?:the )?bite`,
      "On light closure, #30 contacts before the adjacent posterior teeth, and a working-side contact is visible on the crown. The crown moves even with light contact, so these observations require reassessment after the restoration is stabilized; no forceful loading test is recorded.", true, [30]),
    f("bite-history", "patient", "Patient perception of bite and jaw repositioning",
      R`bite.*(?:off|wrong|feel|fit|problem)|jaw.*(?:back|side|shift|move)|teeth.*come together`,
      "When the crown is tight, I do not deliberately move my jaw backward or sideways to make my teeth fit. Right now the crown feels unsteady when my teeth touch."),
    f("parafunction", "patient", "Patient and partner reports of parafunction",
      R`\b(?:grind|grinding|clench|clenching|bruxism|parafunction)\b`,
      "My partner has heard grinding at night, and I sometimes notice myself clenching at work. I have not had a sleep recording."),
  ], additions: [
    f("previous-occlusion", "exam", "Documented occlusal findings at the prior retightening visits",
      R`\b(?:previous|prior|past|last|earlier)\b.{0,45}\b(?:occlusion|occlusal|bite check|bite findings|contacts)\b|\b(?:occlusion|occlusal|bite check)\b.{0,45}\b(?:previous|prior|twice|last two)\b`,
      "The fictional note from the first retightening, five months ago, documents one heavy #30 contact that was reduced. The second note, two months ago, records retightening but no occlusal findings. The records therefore do not establish two normal bite checks.", true, [30]),
    f("fixture-stability", "exam", "Isolated clinical fixture stability examination",
      R`\bfixture\b.{0,25}\b(?:stable|stability|mobility|mobile|move)\b|\bimplant itself\b|\btest\b.{0,25}\bfixture\b`,
      "With movement of the crown/abutment assembly isolated during the directed examination, the #30 fixture does not move under gentle clinical testing. This is a clinical mobility observation, not a measurement of the entire bone–implant interface.", true, [30]),
    f("screw-examination", "exam", "Visual examination of the retrieved prosthetic screw",
      R`\b(?:screw condition|screw wear|screw fracture|inspect (?:the )?screw|examine (?:the )?screw|retrieved screw)\b`,
      "For the requested component inspection, the retrieved screw is intact without a visible fracture. Shiny wear marks are visible on its engagement surfaces. No dimensional analysis or manufacturer confirmation of the screw has been completed.", true, [30]),
    f("connection-examination", "exam", "Accessible implant-connection examination",
      R`\b(?:connection examination|connection integrity|inspect (?:the )?connection|examine (?:the )?connection|internal connection)\b`,
      "The accessible internal connection has no visible fracture under magnification after retrieval of the restoration for inspection. This visual examination does not establish complete component compatibility or exclude microscopic damage.", true, [30]),
    f("component-compatibility", "exam", "Unverified component identity and compatibility",
      R`\b(?:compatibility|compatible|manufacturer|implant system|implant brand|platform|correct parts?|part numbers?)\b`,
      "The implant-system identification and component part numbers are not available in the supplied records. Compatibility has not been verified; a similar appearance is not verification.", false, [30]),
    f("torque-specification", "exam", "Unavailable manufacturer-specific tightening specification",
      R`\b(?:torque|newton|ncm|n-cm|tightening specification)\b`,
      "No manufacturer-specific tightening specification can be supplied because the implant and component identities are unverified. No torque value is prescribed by this case.", false, [30]),
    f("night-guard", "patient", "History of an existing night guard",
      R`\b(?:night guard|nightguard|occlusal guard|splint)\b`,
      "A night guard was made several years ago, but I stopped wearing it about two years ago."),
    f("recent-restorative-history", "patient", "Recent changes to other restorations or prostheses",
      R`\brecent\b.{0,35}\b(?:crowns?|fillings?|restorations?|partials?|dentures?)\b|\bnew\b.{0,25}\b(?:crown|filling|partial|denture)\b`,
      "I have not had another crown, filling, implant crown, or partial denture placed during the last year."),
    f("current-loosening-duration", "patient", "Duration of the current episode of crown movement",
      R`\b(?:when|how long|started|noticed)\b.{0,35}\b(?:moving|loose|loosen|movement|current episode)\b`,
      "I noticed the crown moving again about a week ago.", true, [30]),
    f("home-care", "patient", "Reported home care around the implant restoration",
      R`\b(?:brush|brushing|floss|waterpik|home care|oral hygiene|clean around)\b`,
      "I brush twice a day and use a water flosser around the implant most evenings."),
    f("probing", "exam", "Peri-implant probing and bleeding examination",
      R`\b(?:probing|probe|pockets?|bleeding|bop|suppuration)\b`,
      "Gentle peri-implant probing at #30 measures 2–4 mm, with no bleeding or suppuration at this visit.", true, [30]),
    f("wear", "exam", "Visible tooth and restoration wear",
      R`\b(?:wear facets?|attrition|tooth wear|worn teeth)\b`,
      "Polished wear facets are visible on the adjacent posterior teeth and canines. The examination alone does not establish when the activity occurred."),
    f("adjacent", "exam", "Focused examination of neighboring teeth",
      R`\b(?:adjacent|neighboring|neighbouring)\b.{0,25}\b(?:tooth|teeth)\b`,
      "#29 and #31 show no visible fracture, swelling, or mobility beyond physiologic movement on gentle examination.", true, [29, 31]),
    f("medical-history", "patient", "Reported general medical conditions",
      R`\b(?:medical history|medical conditions|general health|illness|illnesses)\b`,
      "I do not report any diagnosed chronic medical conditions."),
    f("medications", "patient", "Regular medication history",
      R`\b(?:medications?|medicines?|prescriptions?|drugs?)\b`,
      "I do not take regular prescription medicines or supplements."),
    f("allergies", "patient", "Reported medication and material allergies",
      R`\b(?:allergies|allergy|allergic|penicillin|latex)\b`,
      "I have no known drug, latex, or dental-material allergies."),
  ] };
}

/** Strict copy construction makes omission, duplicate IDs and accidental changes
 * to an available authored observation fail during development rather than hiding
 * them in an appended version. A successful return does not constitute author review.
 */
export function caseDetailVariants(basePatients: readonly DiscoveryPatient[]): DiscoveryPatient[] {
  return [case005(), case006(), case011()].map(plan => {
    const matches = basePatients.filter(p => p.caseId === plan.caseId && p.version === BASE_VERSION);
    if (matches.length !== 1) throw new Error(`CASE_DETAIL_BASE_REQUIRED:${plan.caseId}`);
    const source = matches[0]!;
    const replacements = new Map(plan.replacements.map(f => [f.id, f]));
    const sourceIds = new Set(source.facts.map(f => f.id));
    const exceptions = new Set<string>(CASE_DETAIL_REVISED_SOURCE_FACTS.map(f => f.factId));
    for (const replacement of plan.replacements) {
      const old = source.facts.find(f => f.id === replacement.id);
      if (!old || old.available !== false && !exceptions.has(old.id)) throw new Error(`CASE_DETAIL_REPLACEMENT_NOT_ALLOWED:${replacement.id}`);
    }
    const ids = new Set(sourceIds);
    for (const addition of plan.additions) {
      if (ids.has(addition.id)) throw new Error(`CASE_DETAIL_DUPLICATE:${addition.id}`);
      ids.add(addition.id);
    }
    return { ...source, version: CASE_DETAIL_REVIEW_VERSION, facts: [
      ...source.facts.map(old => replacements.get(old.id) ?? { ...old, patterns: [...old.patterns],
        ...(old.toothNumbers ? { toothNumbers: [...old.toothNumbers] } : {}) }),
      ...plan.additions,
    ] };
  });
}
