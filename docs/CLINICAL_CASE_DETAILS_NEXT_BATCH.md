# Remaining clinical discovery content: next-batch triage

Status update: Cases 002, 003 and 008 are now prepared as separately versioned
fictional review-B packs. Their exact statements and measured checks are in
[CLINICAL_CASE_DETAILS_NEXT_REVIEW.md](CLINICAL_CASE_DETAILS_NEXT_REVIEW.md) and
[CLINICAL_CASE_DETAILS_NEXT_QA.md](CLINICAL_CASE_DETAILS_NEXT_QA.md). The original
report partition and priority map below are retained as the design baseline,
not presented as a new measurement of the original catalog.

This is a read-only mapping of the frozen original 23-case/205-turn report to
Dr. Chi's existing reference statements. It adds no patient finding, treatment
rule or evaluation requirement. The original report still has 74 required-gap
turns across 22 cases. Excluding Cases 005, 006 and 011 partitions that original
report into 60 gap turns across 19 other cases; it is not a measured 74-to-60
improvement. Case 004 has zero required gaps on its current finite path.

## Next coherent batch: Cases 002, 003 and 008

These cases exercise obtaining structural and site information before deciding
between preservation, retreatment and replacement. Their original paths contain
12 gap turns: 3 + 4 + 5. Any additions need new fictional versions and the same
review labels, historical-pack isolation and question-led disclosure as PR #90.

| Case | Missing requests | Design decisions required before writing new facts |
|---|---|---|
| 002 | Remaining sound structure/ferrule, isolation, apical imaging status | Specify the available observations and their timing. Keep post-excavation findings unknown unless a separate stage supplies them. Dr. Chi's source does not define the 0–2 mm interval; do not create an author rule for it. |
| 003 | Comparable previous films, current contacts, root-by-root probing, fracture assessment/retreatment feasibility | Separate observations from a conclusion of failure. Add the patient's preservation preference as its own history item. Do not convert a reference success percentage into this fictional patient's guarantee. |
| 008 | Adjacent-tooth position, opposing-tooth position, clearance/plane, ridge assessment, medical/medication history | The source says lower first molar, not right #30. A new version must establish tooth identity before assigning the conditional #3/#31 relationships. Do not infer adequate bone/space or normal position from comfortable chewing. |

## Full remaining map

Fact suffixes below belong to `drchi-NNN:<suffix>`. A missing topic is distinguished
from an existing authored fact whose answer is unavailable. Counts are required
gap turns, not unique facts, clinical severity or learner omissions.

| Priority | Case | Gap turns | Missing information to design or retain as unknown |
|---:|---|---:|---|
| 1 | 002 | 3 | `remaining-structure`, `isolation` (exam); apical-imaging topic (exam). |
| 2 | 003 | 4 | `previous-images`, `occlusion`, `probing`, `fracture` (exam). |
| 3 | 008 | 5 | `movement`, `opposing`, `occlusion`, `bone` (exam); `medical` (patient); 3-D assessment and medications topics. |
| 4 | 007 | 4 | `smoking`, `diabetes`, `homecare` (patient). Split home-care difficulty, current routine and willingness into separate requested subjects. |
| 5 | 009 | 5 | `spacing-history` (patient); `occlusion`, `proportions`, `periodontal` (exam). |
| 6 | 017 | 3 | `salivary-flow`, `restorability` (exam); `diet` (patient). |
| 7 | 013 | 3 | `endodontic-seal`, `smile-gingiva`, `occlusion`, `risk-cause` (exam). |
| 8 | 014 | 4 | `stability`, `occlusion` (exam); `parafunction` (patient); detailed 3-D measurements topic. Separate planning observations from future achieved primary stability. |
| 9 | 018 | 4 | `muscles`, `opening`, `joint` (exam); `habits` (patient). |
| 10 | 023 | 2 | `adjacent-contour`, `occlusal` (exam). The existing bitewing request may include a supplied finding; do not mark all parts of a mixed request missing. |
| 11 | 019 | 3 | `socket`, `adjacent` (exam); `medications` (patient). |
| 12 | 015 | 4 | `induration`, `nodes` (exam); `risk-history` and recent-prosthetic-history topic (patient). |
| 13 | 016 | 5 | `medications`, `renal-history` (patient); `renal`, `prescriber` (exam). Do not invent prescriber advice or a medication-change plan. |
| 14 | 012 | 3 | `cbct`, `other-third-molars` (exam); `medical` (patient). Distinguish individual tooth status, anxiety and medical suitability. |
| 15 | 010 | 2 | `brushing`, `diet` (patient). |
| 16 | 021 | 2 | `cement`, `defect` (exam). Preserve supplied crown findings separately. |
| 17 | 022 | 1 | `restorative-space`, `stability` (exam). Do not assign a future procedural outcome merely to close a content gate. |
| 18 | 020 | 2 | `medical` (patient); `surgical` (exam). Missing patient information and an unrecorded author policy are separate gaps. |
| 19 | 001 | 1 | `crack` (exam, variant B). Root extension may remain legitimately unestablished. |
| 20 | 004 | 0 | Current observation path is supported; additional recall/escalation details would be separate design work. |

This is a content implementation order. Cases 015, 016 and 020 also need explicit
clinical review of their reference scope before general release. Patient facts
cannot stand in for unrecorded author decisions. No missing measurement or future
outcome should be filled with a guessed normal result just to obtain a green gate.
