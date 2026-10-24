import type { DiscoveryFact, DiscoveryPatient } from "@/domain/clinical-pilot/discovery";

/** Fixed fictional extension for author trial, not Dr. Chi-authored patient findings.
 * The original base pack is preserved. These scripted responses must be shown as
 * awaiting review in provenance; no response is generated from the author benchmark.
 * Diagnostic-method context only (not validation of this fictional patient's data):
 * https://www.aae.org/specialty/cracking-the-cracked-tooth-code-from-unpredictability-to-predictability/
 */
const R = String.raw;
const PROVENANCE = "fictional-extension-awaiting-review" as const;
type FictionalFact = DiscoveryFact & { provenance: typeof PROVENANCE };

export function case001Variant(base: DiscoveryPatient): DiscoveryPatient {
  if (base.caseId !== "drchi-001") throw new Error("CASE001_REQUIRED");
  const fact = (id: string, channel: "patient" | "exam", topic: string, pattern: string, answer: string, available = true): FictionalFact => ({
    id: `${base.caseId}:${id}`, channel, topic, patterns: [pattern], answer, available, provenance: PROVENANCE,
  });
  const overrides: FictionalFact[] = [
    fact("bite-history", "patient", "Patient understanding of a general question about the bite",
      R`^(?![\s\S]*\b(?:jaw|mandible|shift|move|moving|slide|sliding|back|backward|backwards|side|sideways)\b)[\s\S]*(?:\bbite\b.*\b(?:feel|off|wrong|fit|problem|problems|okay|normal|right|comfortable|different)\b|\b(?:problem|problems|wrong|off|trouble)\b.*\b(?:bite|occlusion)\b|\bteeth\b.*\b(?:fit|meet|come together)\b|\bocclusion\b)`,
      "What do you mean by my bite?"),
    fact("bruxism", "patient", "Patient and partner reports of grinding or clenching",
      R`\b(?:grind|grinding|clench|clenching|bruxism|parafunction|night guard)\b|\bpartner\b.*\b(?:night|teeth|sleep)\b`,
      "I have not noticed grinding myself, but my partner has sometimes said that I grind my teeth at night."),
    fact("bite-test", "exam", "Cusp-specific bite-test response",
      R`\bbite[- ](?:test|testing)\b|\btooth slooth\b|\bcusp[- ]specific\b|\bcotton roll\b|\b(?:load|loading)\b.*\bcusp\b`,
      "Targeted bite testing reproduces sharp pain on release at one cusp."),
    fact("probing", "exam", "Periodontal probing measurements",
      R`\b(?:probing|probe|pocket|periodontal chart)\b`,
      "Probing measures 2–3 mm around the tooth, without an isolated deep pocket."),
    fact("transillumination", "exam", "Coronal transillumination finding",
      R`\b(?:transillumination|transilluminate)\b`,
      "Transillumination shows a coronal line adjacent to the restoration. Its root extent is not established."),
    fact("crack", "exam", "Unknown root extension and definitive restorability",
      R`\b(?:root extension|subgingival extension|apical extension|root extent|restorability|restorable|remaining structure|ferrule|cusp thickness)\b|\b(?:crack|fracture|line)\b.*\b(?:deep|depth|extent|root|visible|visualize|confirm)\b`,
      "Root extension and full depth have not been determined. The available findings do not establish definitive restorability.", false),
    fact("occlusion", "exam", "Evaluated single-tooth occlusal contact findings",
      R`\b(?:occlusion|occlusal|articulating|centric|mip|cr)\b|check (?:the )?bite`,
      "No obvious isolated high contact is identified on the evaluated tooth. A CR–MIP relationship has not been established."),
  ];
  const additions: FictionalFact[] = [
    fact("jaw-shift", "patient", "Reported jaw movement needed to bring the teeth together",
      R`\b(?:jaw|mandible|chin)\b.*\b(?:move|moving|shift|slide|back|backward|backwards|side|sideways|reposition)\b|\b(?:move|shift|slide|push)\b.*\b(?:jaw|mandible|chin)\b|\b(?:teeth|bite)\b.*\b(?:back|backward|backwards|side|sideways|shift|slide)\b|\b(?:move|shift|slide|push)\b.*\b(?:back|backward|backwards|side|sideways)\b.*\b(?:fit|meet|bite|together)\b`,
      "No, I do not need to move my jaw backward or sideways to bring my teeth together."),
    fact("symptom-duration", "patient", "Onset and duration of the presenting discomfort",
      R`\b(?:when|how long)\b.*\b(?:pain|hurt|symptoms|discomfort|start|started|begin|began)\b|\b(?:pain|symptoms|discomfort)\b.*\b(?:start|started|begin|began|long|weeks|duration)\b|\bwhen did (?:it|this) (?:start|begin)\b`,
      "I first noticed this discomfort about six weeks ago."),
    fact("recent-treatment", "patient", "Recent dental treatment history",
      R`\b(?:recent|recently|new|latest|last)\b.*\b(?:dental|treatment|fillings?|restorations?|crowns?|work)\b|\b(?:dental work|treatment|fillings?|restorations?)\b.*\b(?:recent|recently|new)\b`,
      "I have not had recent dental treatment."),
    fact("restoration-age", "patient", "Age of the existing restoration",
      R`\b(?:filling|restoration)\b.*\b(?:old|long|ago|placed|done|date|age)\b|\b(?:when|how long|how old|age)\b.*\b(?:filling|restoration)\b|\b(?:previous treatment|dental history|old filling)\b`,
      "That filling was placed about eight years ago."),
    fact("medical-history", "patient", "Reported general medical history",
      R`\b(?:medical|health)\b.*\b(?:history|problem|problems|condition|conditions|issue|issues)\b|\b(?:chronic conditions|systemic disease)\b`,
      "I do not have any diagnosed medical conditions."),
    fact("medications", "patient", "Regular medication history",
      R`\b(?:medication|medications|medicine|medicines|prescription|prescriptions|pills|supplements)\b`,
      "I do not take regular medications."),
    fact("allergies", "patient", "Known allergy history",
      R`\b(?:allergy|allergies|allergic|drug reactions)\b`,
      "I do not have any known allergies."),
    fact("cold-test", "exam", "Objective cold-test response",
      R`^(?![\s\S]*\b(?:ept|electric|electrical)\b)[\s\S]*(?:\bcold[- ](?:test|testing)\b|\bendo[- ]?ice\b|\brefrigerant\b|\bthermal testing\b|\bpulp sensibility\b|\b(?:sensibility|vitality) (?:test|testing)\b)`,
      "The tooth responds briefly to cold, and the response does not linger after the stimulus is removed."),
  ];
  const replacements = new Map(overrides.map(f => [f.id, f]));
  return {
    ...base,
    version: `${base.version}-variant-a`,
    facts: [
      ...base.facts.map(f => replacements.get(f.id) ?? { ...f, patterns: [...f.patterns] }),
      ...additions,
    ],
  };
}
