# Clinical Discovery autonomous QA

Development now exercises all 23 authored cases through sequential synthetic
conversations, repairs interpretation defects, and preserves the measurements.
Doctors can focus their review on clinical judgment and the realism of new case
content. The automated test uses the actual discovery router and pure domain flow.

## Observed result — 2026-10-30

| Measurement, 23 cases / 205 turns | Original oracle, v5 | Reviewed oracle, v5 | Repaired v6 |
|---|---:|---:|---:|
| Subject selection / resolution issue turns | 48 | 45 | 0 |
| Checked answer-pattern mismatch turns | 34 | 31 | 0 |
| Required case-information gap turns | 74 | 74 | 74 |
| Cases with a required gap on this path | 22 | 22 | 22 |
| Domain capture invariant errors | 0 | 0 | 0 |
| Actual local-model selected turns | 0 | 0 | 0 |

The reviewed baseline has 6 turns with newly selected extra topics, of which
3 contain an additional **available finding**; 15 other turns select an
unrequested topic already issued earlier. The repaired journeys have zero in all
three categories. An unavailable fact ID is not an acquired clinical finding.

These are **regression measurements on visible scripted paths**, not an unseen
model benchmark, medical scoring rubric, or proof of clinical completeness.
205/205 turns have answer-pattern checks; the others check selection and capture.
The two cold-history granularity ambiguities in `oracle-review.json` remain:
“brief sensitivity” does not explicitly establish post-stimulus persistence.
A zero pattern-mismatch count does not resolve those content limitations.

The quality command with `--check` exits **1**, because required case information
is still unavailable in 74 turns. Correctly acknowledging missing information is
an interpretation improvement; it does not provide the clinical answer.

## Repairs

- Resolve the requested examination subject before generic target nouns. A
  periodontal probing request around a crown no longer selects crown integrity;
  TMJ palpation no longer substitutes a muscle finding; fixture mobility avoids
  unrelated retention/hygiene results.
- Resolve explicit independent clauses without allowing a scoped clause to swallow
  another named stimulus or test. Keep patient negative triggers together.
- Keep cold symptoms, cold testing, medication duration, medication indication,
  and symptom onset distinct. Preserve existing canonical history topic IDs.
- Repeat a single immediately preceding available patient finding for bounded
  persistence/time/recurrence questions. An ambiguous persistence follow-up asks
  for clarification. The existing model-mediated restoration-age follow-up remains.
- Explicitly declined examination orders disclose nothing and bypass model
  selection for that turn. Existing security gates and the four-topic limit remain.
- “Image the apex” selects PA rather than CBCT; explicitly named 3-D imaging stays
  3-D. A qualitative facial-defect finding also acknowledges missing quantitative
  CBCT measurements when those measurements are requested.
- Preserve the authored-rule/model mismatch guard. Mocked model tests cover an
  unrelated model selection; no live inference was used for these fixes.

Frozen patient packs, reference answers, source hashes of existing records, and
stored conversations are unchanged. New missing-topic messages are interpretation
metadata, never negative findings or newly acquired patient facts. Historical
Case 001 base/variant A interpretation remains untouched by the new catalog aliases.

## Repeatable runs

Run under Node 20.x with the installed dependencies. No `.env.local` is loaded by
this CLI. The in-memory harness imports no API, service, database, or auth client.
It uses the actual last four issued turns, working assessment, final submission,
reference release, and reaction handling. Synthetic answers never enter a learner
store. Browser requests use an in-memory transport and external network is blocked.

```sh
node --import tsx scripts/clinical-discovery-audit.ts \
  --mode rules --json /tmp/clinical-rules-qa-unique.json --check
```

Output files use exclusive creation, so an earlier measurement cannot be silently
overwritten. Reports record HEAD, working-tree source changes, exact runtime-file
hashes, fixture hash, pack hash, per-turn response/fact/availability/routing,
latency, fallback, and invariant errors. The runtime hashes identify the measured
working-tree code even before its commit; HEAD alone is not claimed to do that.

For the Mac operator, the same paths can use the already configured local gateway:

```sh
node --import tsx scripts/clinical-discovery-audit.ts \
  --mode model --base-url http://127.0.0.1:8788/v1 \
  --model qwen3-coder-next:q4_K_M \
  --key-file "$HOME/.config/bty/clinical-discovery-gateway.key" \
  --json /tmp/clinical-model-qa-unique.json --check
```

This requires existing model access; it does not start a listener, restart the
model, open a tunnel, read a database, create auth sessions, or print the key.
It tests router/model quality and does not exercise production Founder gating.
Actual Mac/gateway inference is **unrun here** because this execution environment
has no Mac execution channel or gateway credential. Earlier connection diagnostics
are not substituted for this measurement.

The normal Clinical test directory now includes a 23-case conversation regression
suite and catalog-coverage check. It fails on selection, checked-answer, or capture
regressions. The separate CLI quality gate also fails on required information gaps.
QA `required` flags describe this scripted review path; they never become mandatory
learner questions or a diagnostic score.

## Validation

- Related Clinical/Practice/domain/API/deployment-guard tests: **424/424**, 30 files.
- Isolated browser flows: **37/37** at 320, 390, 1280 px. This includes 27 new
  full synthetic flows (all 23 at 390; Cases 006/017 also at 320/1280), plus the
  previous 10 screen tests. They verify faithful display/capture/reference gating,
  assessment, comparison acknowledgement, reaction, completion and layout; routing
  and content quality are measured separately above.
- Independent reviewer: 18/18 negative/mixed regression probes on the actual
  router; no live model or database. Conservative grammar still has limits.
- TypeScript: exit 0 (`--noEmit --incremental false`, 6 GiB Node heap).
  A separate post-build run with the default 2 GiB heap exhausted memory; increasing
  the verification process heap resolved it without application changes.
- `npm run cf:build`: exit 0 with loopback public placeholders and no credentials.
  The existing Next 15 support warning remains; no dependency change is included.
- Artifact guard: 3,621 emitted JS files, 0 unsafe matches, 2/2 safe middleware
  implementations. Client phrase scan: 238 private answer/selector prefixes across
  1,389 emitted public text files, zero matches. This sample scan is not a proof
  that every possible encoding or disclosure path is absent.
- Full unrelated repository suite, live production UI, actual iPhone/Teams device,
  and live local-model quality: **not run**. No merge, deployment, secret change,
  migration, seed, auth session or learner-store write occurred.

The first UI attempt failed because the test's nested `:scope/:has` selector did
not match rendered articles. Screenshots showed the actual question/reply present.
The test selector was corrected to semantic article roles; the fresh 37-test run
above passed. No application UI change was needed for that test error.

## Remaining authored-case information

The following review topics come from the fixture and actual replies. Multiple
turns may ask about one topic; **74 is a turn count, not 74 unique missing facts**.
Case 004 has no required gap on its short scripted path but still has declared
content gaps. Additional patient details need versioned, explicitly fictional case
extensions with clinical review; they must not be guessed into frozen records.

| Case | Required gap turns | Content topics for case design review |
|---|---:|---|
| drchi-001 | 1 | Definitive crack extent/restorability, CR–MIP relationship, Encounter breadth |
| drchi-002 | 3 | Lesion-to-bone/restorability measurement, Apical lesion status, Objective pulp status and excavation findings, Isolation |
| drchi-003 | 4 | Lesion trajectory, Fracture/retreatment feasibility, Occlusion/periodontal/crown integrity, Patient retention preference |
| drchi-004 | 0 | Percussion/occlusion, Follow-up trigger details |
| drchi-005 | 4 | Objective occlusion, Parafunction history, Exclusion of alternate sources |
| drchi-006 | 6 | Dentition-wide caries/restoration status, Fracture-risk information, Objective occlusal topic absent, Patient bite and habits |
| drchi-007 | 4 | Whole-mouth disease assessment, Smoking and diabetes, Readiness/home care/medical factors, Fact granularity, Progression and differential |
| drchi-008 | 5 | Missing-tooth identity, Adjacent/opposing movement, Restorative space/occlusion, Implant feasibility and systemic factors |
| drchi-009 | 5 | Occlusion and anterior clearance, Spacing etiology and progression, Tooth dimensions and periodontal findings |
| drchi-010 | 2 | Brushing demonstration, pressure and actual products, Dietary exposure and progression |
| drchi-011 | 4 | Occlusal contacts and prior bite-check results, Bite-history and parafunction, Source of mobility and component integrity/compatibility |
| drchi-012 | 3 | Other three third molars, Three-dimensional root/canal assessment, Medical history, anxiety and sedation eligibility |
| drchi-013 | 3 | Smile line, gingival height, symmetry and proportions, Occlusion, caries risk, discoloration cause and seal quality, Restorative indication and extent of esthetic goals |
| drchi-014 | 4 | Three-dimensional site dimensions and defect extent, Anchorage, primary stability and occlusion, Medical suitability and temporary-tooth tradeoffs |
| drchi-015 | 4 | Recent restorative/prosthetic history and horizontal overlap, Border palpation and cervical lymph nodes, Exposure/systemic history and tissue diagnosis |
| drchi-016 | 5 | Renal history and measured renal function, Complete medication list and prescriber advice, Extraction indication and postoperative variation |
| drchi-017 | 3 | Measured salivary flow, Complete medication history and medication review outcome, Diet and fluoride exposure, Lesion activity, depth and tooth-specific restorability, Dentition-wide progression and response over time |
| drchi-018 | 4 | Muscle palpation, Joint examination and opening range, Dental and occlusal assessment, Awake and sleep-related habits, Response to conservative management |
| drchi-019 | 3 | Socket findings and response to irrigation, Adjacent tissues and teeth, Postoperative medication exposure |
| drchi-020 | 2 | Complete medical and medication risk history, Surgical and jaw-bone assessment, Procedure scope and handoff |
| drchi-021 | 2 | Residual cement, Defect morphology, implant position and remaining support, Occlusion, Actual patient choice and treatment outcome |
| drchi-022 | 1 | Adjacent crown margins, underlying structure and prognosis, Restorative space and opposing teeth, Occlusion and parafunction, Achievable primary stability, Sinus-lift intraoperative contingency |
| drchi-023 | 2 | Distal contour and integrity of the #29 DO restoration, Occlusal/marginal-ridge relationships and mobility, Fees and responsibility |

## Preserved evidence

`docs/clinical-discovery-qa/` contains:

- `fixture-original.json.gz`: exact initial fixture before oracle review.
- `baseline-original.json.gz`: initial v5 result with that original fixture.
- `oracle-review.json`: eight separately explained oracle corrections; patient
  facts and question wording were not changed to improve the score.
- `baseline-corrected.json.gz`: v5 rerun with the reviewed oracle, before repair.
- `after.json.gz`: repaired-router result, exact runtime hashes and all 205 replies.

Gzip files are UTF-8 JSON (`gzip -dc <file>`). They contain fictional case material
and synthetic QA results, not real doctors' learning records. No new held-out
accuracy claim is made. Known conservative parsing limits include tooth targeting
across the whole request rather than individual clauses, and unsupported English
coordination; future failures should become explicit regression examples.
