# Clinical Case Authoring Method V1

Use this method to author each Neurosight Clinical Encounter case. It is a practical authoring sequence, not a learner-facing script.

## Author the case before the questions

1. **Decision target.** Start with: *What clinical decision or reasoning behavior are we trying to observe?* Do not begin with quiz choices.
2. **Hidden case truth.** Write the actual case reality first. Keep it author-only; it is never automatically learner-visible.
3. **Epistemic layers.** Place every fact in one layer: patient-known facts, clinician-observable findings, diagnostic test results, media/imaging, or hidden author truth.
4. **Reveal rule.** Every fact states its route: patient question, clinical exam, diagnostic test, imaging/media request, or never learner-visible.
5. **Patient voice.** Keep canonical clinical truth separate from a natural patient response. For example, `spontaneous_pain = false` can be voiced as “No, it doesn’t hurt right now.”
6. **Discriminators.** Mark only facts that change the differential, diagnosis, treatment, or follow-up. Do not label every detail critical.
7. **Media.** Store the learner-visible asset separately from the hidden authored interpretation. Learners interpret the image themselves. Attest that every asset is synthetic or deidentified.
8. **Unknown is not normal.** Missing authored information never means negative. Use explicit states: `unknown`, `not available`, `patient does not know`, `requires exam`, `requires test`, or `requires imaging`.
9. **Decision space.** Define plausible diagnosis, treatment, and follow-up paths. Do not force one universal standard-of-care answer unless the case truly requires one.
10. **Author Reference.** Record Dr. Chi’s intended path with required, important, optional, acceptable alternatives, ordering preference, and author note. Label it **Author Reference**, never “Correct Answer.”
11. **Author Reference Trace.** After authoring, preferably run the case blind and save the actual reasoning trace as an Author Reference Trace.
12. **Pilot.** Run the case with several senior doctors before broad release. Use the variation to identify common questions, omissions, sequence variation, decision timing, treatment differences, and confidence differences. Do not average that variation into an intelligence score.

## Case Authoring Worksheet

Copy this into the case record before implementation.

```md
# Case [number] — Authoring Worksheet

## Case purpose
- Decision target:
- Chief complaint:
- Intended learner level and setting:

## Patient facts
| Concept | Canonical truth | Patient response | Aliases | Patient awareness | Reveal action |
| --- | --- | --- | --- | --- | --- |
| | | | | knows / does not know | patient question |

## Objective findings
| Concept | Target | Result | Reveal action |
| --- | --- | --- | --- |
| | | | clinical exam |

## Tests
| Test | Target | Result | Reveal action |
| --- | --- | --- | --- |
| | | | diagnostic test |

## Media
| Learner-visible asset | Reveal alias | Hidden interpretation truth | Deidentification attestation |
| --- | --- | --- | --- |
| | imaging/media request | | synthetic / deidentified |

## Hidden author truth
- Actual case reality:
- Explicit unknown/not-available facts:
- Discriminators that change differential, diagnosis, treatment, or follow-up:

## Decision space
- Plausible diagnosis paths:
- Plausible treatment paths:
- Follow-up paths:

## Author Reference
| Checkpoint | Importance | Acceptable alternative | Ordering preference | Author note |
| --- | --- | --- | --- | --- |
| | required / important / optional | | | |

## Validation
- Synthetic/deidentified attestation:
- Clinician validation state:
- Version:
- Pilot doctors and observed variation:
```

Clinical Case Builder authority remains internal-author-only. This method guides future case content; it does not widen who can create Clinical Encounter cases.
