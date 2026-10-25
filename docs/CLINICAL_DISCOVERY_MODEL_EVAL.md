# Clinical discovery — local-model selection evaluation (2026-10-23 / 24)

## Operator-reported round-3 live check and bounded follow-up repair

The operator reported a Mac check at `2ce05538`: the worktree fast-forwarded
without local changes, only the Clinical Discovery gateway was restarted, and
Ollama/Streamlit PIDs were preserved. The reported 41-second check window had
no other-client model requests. This is the operator's report, not a model run
independently observed in this environment. The source script/results remain on
that Mac as `r3check.ts` / `r3check.json`; they were not attached or read here.

Reported results, regression checks rather than a new benchmark:

- Known location/restoration/chewing-side over-matches passed through the gateway;
  six existing follow-up checks were correct at about 1.0–1.1 seconds.
- Two model choices remained wrong: apex imaging selected CBCT and the cold
  persistence follow-up selected pain severity.
- Fifteen failure-injection cases (three questions across five transport failure
  modes) returned exactly the authored-only IDs and text. The separate non-Founder
  check did not enable model use. The hanging response stopped at four seconds.
- The reported disconnect probe ended its long Ollama request after about 0.4
  seconds and the next request succeeded; this is evidence for the gateway's
  cancellation path, not an answer-accuracy score.
- No DB write, HTTPS tunnel, Worker secret, merge or deployment was reported.

The follow-up repair uses `discovery-intent/v4` with selector/3 unchanged:

- Case 001 variant B interprets an unspecified film/image of the apex or root
  tip/end as a PA request. This is an authored simulator convention, not logical
  certainty about a clinician's intended imaging modality. Explicit CBCT/3-D
  wording does not imply an additional PA; explicitly requesting both retains both.
- A pure cold-persistence follow-up can repeat only the immediately preceding
  single, available patient-history `cold` fact. It does not search older turns,
  convert cold-test findings into history, or resolve new-subject/mixed requests.
  The route is `authored-rules` plus `context-persistence/v1`, not a local-model
  success or fallback. It discloses no previously unseen fact.
- Other contexts retain the existing interpreter. This is a bounded cold-history
  repair, not a general pronoun resolver or a guarantee that all model choices
  are semantically correct. No patient answer or historical pack was changed.

The exact failure paths and boundaries have 28 new regressions; ten assertions
in the initial 24-case reproduction failed before the repair. The focused scope
now passes 342 tests. Live inference
has not been rerun on this follow-up head; historical model scores are unchanged.

Local verification used the existing actual Node-20 installation and unchanged
lockfile/dependencies from the preceding repair. TypeScript passed. The final full
run (`vitest run --maxWorkers=2 --minWorkers=1`) had 46 failed files / 156 failed
tests, 15,577 total, 15,012 passed and 409 skipped. Its exact normalized failed
file and assertion lists match the already-observed `2ce05538` run (46/156,
15,549 total). That baseline was reused, not freshly rerun; all 28 new tests pass.
The full suite remains red. Superseded in-progress runs were interrupted after
review found imaging-scope edges; only the final complete run is used here.
Ten isolated public browser tests passed (320/390/1280 px), with global setup and
the app server disabled. Fresh `npm run cf:build` passed with loopback public
placeholders and no production credentials. Artifact guard: 3,621 JavaScript
files, zero unsafe matches, 2/2 safe middleware implementations. In 739 public
text assets, 81 sampled author/fictional-answer markers had zero matches; this is
limited sample evidence, not an exhaustive proof of private-information isolation.

## Round-3 interpretation and transport repair

After the round-2 measurements below, the known held-out-2 authored over-matches
are used for regression repair: residence/work questions no longer select pain
location, chewing-side habits do not imply chewing pain, and a bare "Look at it"
does not automatically disclose a restoration. Explicit visual inspection and
named restoration requests remain supported. Variant B matches independent
question clauses separately so a tobacco question cannot suppress a later pain
question. Historical packs and all fixed answers remain unchanged.

The router version is now `discovery-intent/v3`; selector instructions remain
`selector/3`. There has been no new Mac inference or model-score measurement for
this repair. All raw round-1/round-2 JSON and the historical tables below are
preserved. Held-out-2 is now exposed regression material, not an unseen acceptance
set for a later model-quality claim.

The two contended runs below are excluded only from the isolated selector-quality
comparison. They remain relevant runtime evidence: the Mac is actually shared
with another application, so latency/fallback under contention matters for a
Founder trial. Report isolated and contended results separately rather than
discarding the latter as operationally meaningless.

Scoring-policy limits also remain: unspecified coffee does not establish its
temperature; answering a broad drinks question with a known cold trigger may be
adequate without disclosing every negative thermal finding. Current ID/regex
scores are historical evaluator judgments, not validated clinical-answer accuracy.
The manual partial-answer findings below remain unresolved patient-profile gaps;
this repair does not invent a warm-soup, chewing-gum or control-percussion result.

Selector/3's quote check validates lexical presence, not whether a quote supports
the selected topic's meaning. It can also accept one quote for multiple IDs. It
does not prove that every disclosed fact was requested; model-driven errors and
follow-up grounding failures remain part of the Founder preview's limitations.

Observed local verification for this follow-up (Node 20.20.2, actual `npm ci`,
stripped service environment): TypeScript exit 0; 24 focused files / 314 tests
passed; 10 isolated public browser tests passed at 320/390/1280 px. The gateway's
10 transport tests use in-memory streams and fake requests, with no listener or
model. Six of the new rule assertions first failed on unmodified `e88bead9`.

Full suites ran serially with `vitest run --maxWorkers=2 --minWorkers=1`, first
unmodified `e88bead9`, then this repair with identical dependencies. Baseline:
49 failed files / 159 failed tests, 15,517 total, 14,949 passed and 409 skipped.
Repair: 46 / 156, 15,549 total, 14,984 passed and 409 skipped. Normalized exact
failed assertion lists had no additions. Three unchanged UI assertions failed
only in baseline (Center consent request payload, learner unauthenticated refusal,
Teams resumed deep-link focus). Their passing result is not a fix attributed to
this change. The full suite remains red; these are this environment's results,
not the operator Mac's 35/129 or 36/130 measurements below.

Fresh `npm run cf:build` passed using loopback public build placeholders and no
production service credentials. Its artifact guard passed: 3,621 JavaScript files,
zero unsafe matches, two of two middleware implementations verified safe.
In 739 public text assets, 81 sampled author and
fictional-answer markers had zero matches. This is a limited marker scan, not
an exhaustive proof of private-information isolation. The operator must rebuild
the committed source with the deployment environment before any authorized ship.

No live Mac model, HTTPS tunnel, Worker secret, learner record write, merge or
deployment was performed for this follow-up.

Case 001 `discovery-2026-10-23.1-variant-b`, measured through the production router
(`respondToDiscovery`, 4-second limit) on the operator Mac (M5 Max, Ollama 0.40.5). No database,
session or trace. Generated by `scripts/clinical-discovery-model-probe.ts`.

## Method

- Both question sets were committed in `2eb5037e` before any repair.
- **Tuning** set (32): the first measured set plus same-meaning variants of each reported error. Used to
  repair patterns, topic labels and selector instructions.
- **Held-out** set (20): same meanings in new words, context-dependent follow-ups, ambiguous and
  unrelated requests. It was not used to write patterns, labels or instructions. *(Corrected below: it
  was run twice, not once, and its results were seen during the repair.)*
- *Expected* lists the facts a correct interpretation discloses; `—` means nothing may be disclosed and
  the doctor is asked to clarify. *Extra* = disclosed but not asked; *Missing* = asked but not disclosed.
  Disclosure accuracy is ranked above speed.
- Expectations are the evaluator's reading. For example, "anything you drink" is expected to disclose
  cold and heat; disclosing sweets as well is counted as extra, which is debatable.
- Every wrong selection, omission or fallback below is **simulator behaviour**. None of it is evidence
  about a doctor. Each turn records `routing.method`, the selector version and the fallback.

## Corrections to this record (made when held-out-2 was frozen)

The round-1 tables below are kept exactly as first reported. Raw measurements are preserved in
`docs/clinical-discovery-eval/round-1/measured/` (byte-identical to the operator's output files).

**Run history.** "Run once, after the repair" was wrong. Actual order on 2026-10-23 (PDT):

| Time | Event |
|---|---|
| 21:24:46 | Tuning and held-out sets committed (`2eb5037e`). |
| 21:25–21:28 | Both sets run **before** the repair, both models (`before-*.json`). Held-out row results were printed and seen. |
| 21:29:47–21:29:54 | Three held-out phrases were written into the selector instructions and removed seven seconds later. No measurement ran in between. |
| 21:33–21:36 | Tuning, then held-out, run after the repair, both models (`after1-*.json`). |

So the held-out set was measured twice and its pre-repair failures were known while repairing. It was not
used to write patterns or labels, but it is not an unseen set. It is renamed **held-out-1** and is used
for tuning from round 2. Round 2 freezes a new **held-out-2** before its repair.

**Expectations.** Four items were judgement calls; each now carries a `note` in the probe:

| Question | Before | Corrected |
|---|---|---|
| Does anything you drink make it twinge? / Do drinks bother it at all? | cold, heat; sweets = extra | cold, heat required; **sweets accepted** (a sugary drink is a drink) |
| Does a sip of coffee bother it? | heat; cold = extra | heat required; **cold accepted** (iced coffee) |
| Does the feeling stay for a while? (after cold) | cold | unchanged; pain severity describes biting episodes and adds an unasked intensity |

**Answer check.** A matching fact ID is not enough: the words shown must answer the question. Each probe now
has answer patterns that the reply text must satisfy, and an ambiguous request must disclose nothing.
Re-scoring the preserved round-1 measurements this way found four rows whose fact ID was right but whose
answer was not: "How often do you get your teeth cleaned?" (the answer gives only the last date), "Compare
with the same tooth on the other side" and "Test the opposite molar as a control" (the answer mentions only
adjacent teeth), and "Do you chew tobacco?" (the answer says only that the patient does not smoke or vape).

Re-scored round 1 (same measurements, corrected expectations, answer check;
`docs/clinical-discovery-eval/round-1/rescored/`):

| Model | Run | Set | As reported | Disclosure correct | Answer correct | Both |
|---|---|---|---|---|---|---|
| qwen3-coder-next:q4_K_M | before | tuning-1 | 21/32 | 21/32 | 21/32 | 19/32 |
| qwen3-coder-next:q4_K_M | before | held-out-1 | 12/20 | 12/20 | 13/20 | 11/20 |
| qwen3-coder-next:q4_K_M | after | tuning-1 | 27/32 | 27/32 | 24/32 | 24/32 |
| qwen3-coder-next:q4_K_M | after | held-out-1 | 16/20 | 16/20 | 15/20 | 15/20 |
| gemma3:27b | before | tuning-1 | 21/32 | 22/32 | 21/32 | 19/32 |
| gemma3:27b | before | held-out-1 | 13/20 | 13/20 | 14/20 | 12/20 |
| gemma3:27b | after | tuning-1 | 29/32 | 31/32 | 29/32 | 29/32 |
| gemma3:27b | after | held-out-1 | 14/20 | 14/20 | 13/20 | 13/20 |

Corrected, round 1 after repair is qwen 39/52 and gemma 42/52, not 43/52 each. The round-1 choice of qwen
rested partly on the uncorrected held-out score and on a held-out set that had already been seen.

## Round 2 (2026-10-24): grounded selections, chewing over-matches, answers that answer

### Order of work

1. `f6e6f3e2` (pushed before any round-2 change): round-1 record corrected, expectations and answer
   checks added, **held-out-2** (25) frozen. The same person wrote held-out-2 and the repair, so it is
   unseen in results but not blind in authorship.
2. `7d5693c2`: repair, using only tuning-1 and held-out-1. Two tuning iterations on those sets ran
   before the commit (`round-2/iteration-0953-contended`; its code differs slightly from `7d5693c2`).
3. All three sets measured at `7d5693c2` with no code change between runs. held-out-2 was run three
   times per model; the first two were invalid (below), so the third is the result. No change was made
   after seeing any held-out-2 result.

### What changed

- **Grounded selections (`selector/3`, all Founder model turns).** For each selected topic the model must
  copy the words of the question that name it. Evidence that is missing, not in the question, or made only
  of pointing words (it, this, one, other, else, check, test, look, examine…) makes the router fall back
  to authored rules, recorded as `local_model_ungrounded_selection`. "Check it." can no longer disclose
  guessed findings. One evidence item may cover several selections ("hot or cold drinks").
- **Authored over-matches (variant B only).** `chewing` no longer fires on chewing tobacco or on a preferred
  chewing side (favour/prefer/avoid/switch, "one/other/which side"); those reach `tobacco` and
  `chewing-avoidance`. `treatment-goal` no longer fires on "prefer … side".
- **Answers that did not answer (fictional facts only).** `tobacco` now covers chewing tobacco and nicotine;
  `last-visit` gives a frequency; `adjacent-teeth` speaks about the same tooth on the other side.
- **Labels the model reads.** Periapical radiograph (2-D, root tip) vs cone-beam CT (3-D); palpation
  (pressing on the gum) vs percussion (tapping); margins (edges of the filling); pain severity (biting
  episodes); tobacco ("lighting up", chewing tobacco).
- Recorded answers, availability, provenance, variant A and the base pack are unchanged.

### Contention: two runs were invalid

The operator Mac's Ollama is shared with another local application (a Streamlit app using
`gemma4:31b`). Its `/api/chat` requests (11 s to 5 min each, from Ollama's server log) covered almost
all of runs 1 and 2: qwen slowed from ~1.1 s to ~2.6 s, and gemma timed out on most turns. Those runs
measure the machine, not the selector. They are preserved, not used. Run 3 started after five minutes of
model-server idle CPU, and the log shows **0 s** of other-client requests during it. Round 1 had none
either. The other application was not stopped or changed.

| Run | Other client busy | Model | tuning-1 | held-out-1 | held-out-2 | Timeouts | Median ms |
|---|---|---|---|---|---|---|---|
| iteration-0953-contended | 13–99 s of each window (partial) | qwen3-coder-next | 27/32 | 19/20 | — | 0 | 1098 |
| iteration-0953-contended | 13–99 s of each window (partial) | gemma3 | 29/32 | 13/20 | — | 17 | 3336 |
| run-1-1002-contended | ~100% of each window | qwen3-coder-next | 29/32 | 19/20 | 18/25 | 6 | 2575 |
| run-1-1002-contended | ~100% of each window | gemma3 | 11/32 | 13/20 | 10/25 | 63 | 4004 |
| run-2-1013-contended | ~100% of each window | qwen3-coder-next | 29/32 | 18/20 | 14/25 | 12 | 2632 |
| run-2-1013-contended | ~100% of each window | gemma3 | 11/32 | 13/20 | 10/25 | 59 | 4004 |
| run-3-1045-clean | 0 s | qwen3-coder-next | 30/32 | 19/20 | 19/25 | 0 | 1130 |
| run-3-1045-clean | 0 s | gemma3 | 28/32 | 17/20 | 20/25 | 3 | 3226 |

### Result (run 3, clean)

| Model | tuning-1 | held-out-1 | **held-out-2** | Over-disclosure rows (by model / by authored rules) | Median / max ms | Model answered |
|---|---|---|---|---|---|---|
| qwen3-coder-next:q4_K_M | 30/32 | 19/20 | **19/25** | 6 (2 / 4) | 1130 / 1348 | 59 of 77 |
| gemma3:27b | 28/32 | 17/20 | **20/25** | 4 (0 / 4) | 3226 / 4007 | 48 of 77 |

Every disclosure row scored correct also passed its answer check. A manual reading of the held-out-2 reply
text found three replies the patterns accepted but that answer only part of the question: "What about warm
soup?" (the answer speaks of drinks), "Is it sore when you chew gum?" (hard food), and "Do the same on the
neighbouring tooth" after percussion (the answer gives cold and biting, not percussion). They are content
gaps in fictional facts, recorded here and not repaired against held-out-2.

### Remaining errors (held-out-2, not repaired)

| Question | Both / one model | What happened | Cause |
|---|---|---|---|
| Look at it. | both | restoration disclosed | authored `restoration` matches "look at". A visual inspection reading may be reasonable; the frozen expectation (clarify) is kept. |
| Where do you live? | both | location disclosed | authored `location` matches "where" |
| Which side do you eat on now? | both | location + chewing-avoidance | authored `location` matches "which side" |
| Do you mostly chew on your left these days? | both | chewing | authored `chewing`: "chew on your left" is not in the side-preference exclusion |
| Image the apex of that tooth. | qwen | cbct instead of pa | model; the reply only says no CBCT is available |
| How long does that last? (after cold) | qwen: pain-severity; gemma: clarify | qwen discloses an unasked intensity | model |
| Follow-ups (linger, hang around, at night, edges, how long) | gemma | clarify instead of answering | gemma's evidence copies the earlier question, so it is ungrounded |

### Model choice

Disclosure accuracy first: on held-out-2 gemma over-disclosed in 4 rows, all from authored rules, and qwen in
6 (2 from the model). gemma's lead comes largely from falling back to authored rules: its model answered 48
of 77 turns against qwen's 59, because its follow-up evidence is ungrounded, and its median 3.2 s leaves
under 1 s of the 4 s limit for a tunnel round trip (one local timeout already). qwen stays the default
because it answers far more turns within the limit, while each of its two model over-disclosures discloses
one fact. Neither model is ready to be called accurate on unseen questions: 19–20 of 25.

### Per-question results (run 3, clean, `7d5693c2`)

`✗answer` = the reply text failed the answer check. Fallback in parentheses.

| # | Set | Ch | Question | Previous context | Expected (accepted) | qwen | gemma |
|---|---|---|---|---|---|---|---|
| 1 | tuning-1 | patient | Does anything you drink make it twinge? | — | cold, heat (sweets) | cold **−heat** ✗answer 1.1s | cold, heat, sweets 2.1s |
| 2 | tuning-1 | patient | Does it ever ache while you're sleeping? | — | night | night 1.1s | night 1.4s |
| 3 | tuning-1 | patient | Does it act up all by itself, even when you're not eating? | — | spontaneous | spontaneous 0.6s | spontaneous 1.3s |
| 4 | tuning-1 | patient | Are you on any drugs your doctor gave you? | — | medications | medications 0.5s | medications 1.3s |
| 5 | tuning-1 | patient | Any illnesses I should know about? | — | medical-history | medical-history 1.0s | medical-history 3.2s |
| 6 | tuning-1 | patient | Has anyone ever said you gnash your teeth? | — | bruxism | bruxism 1.1s | bruxism 3.4s |
| 7 | tuning-1 | exam | Let me knock on the tooth with the mirror handle. | — | percussion | percussion 1.1s | percussion 3.2s |
| 8 | tuning-1 | exam | Shine a light through the tooth. | — | transillumination | transillumination 1.1s | transillumination 3.3s |
| 9 | tuning-1 | exam | Measure the gum depth around it. | — | probing | probing 1.1s | probing 3.1s |
| 10 | tuning-1 | exam | Take a picture of the root tip. | — | pa | pa 1.1s | pa 3.2s |
| 11 | tuning-1 | exam | Put some ice on the tooth and see how it reacts. | — | cold-test | cold-test 1.2s | cold-test 3.1s |
| 12 | tuning-1 | patient | How long ago was it put in? | Is there a filling in that tooth? | restoration-age | restoration-age 1.2s | restoration-age 3.5s |
| 13 | tuning-1 | patient | Does it hang around afterwards? | Does cold bother it? | cold | cold 1.2s | — **−cold** ✗answer (ungrounded_selection) 3.0s |
| 14 | tuning-1 | patient | What about at night? | Does it hurt when you chew? | night | night 1.1s | — **−night** ✗answer (ungrounded_selection) 3.2s |
| 15 | tuning-1 | patient | How bad is it, from one to ten? | — | pain-severity | pain-severity 1.2s | pain-severity 3.3s |
| 16 | tuning-1 | patient | Have you changed how you eat because of it? | — | chewing-avoidance | chewing-avoidance 1.2s | chewing-avoidance 3.3s |
| 17 | tuning-1 | patient | Do you light up at all? | — | tobacco | tobacco 1.1s | tobacco 3.3s |
| 18 | tuning-1 | patient | How often do you get your teeth cleaned? | — | last-visit | last-visit 1.2s | last-visit 3.4s |
| 19 | tuning-1 | exam | Check whether it wobbles. | — | mobility | mobility 1.1s | mobility 3.2s |
| 20 | tuning-1 | exam | Use the pulp tester on it. | — | ept | ept 1.1s | — **−ept** ✗answer (ungrounded_selection) 3.1s |
| 21 | tuning-1 | exam | Press along the gum beside the roots. | — | palpation | palpation 1.2s | palpation 3.3s |
| 22 | tuning-1 | exam | Compare with the same tooth on the other side. | — | adjacent-teeth | adjacent-teeth 1.2s | adjacent-teeth 3.4s |
| 23 | tuning-1 | exam | Can we get a 3-D scan of the area? | — | cbct | cbct 1.1s | cbct 3.2s |
| 24 | tuning-1 | exam | What is their blood pressure? | — | — | — (low_confidence) 0.9s | — 2.7s |
| 25 | tuning-1 | patient | What's the weather like? | — | — | — (low_confidence) 1.0s | — 2.6s |
| 26 | tuning-1 | exam | Which test should I do next? | — | — | — 0.0s | — 0.0s |
| 27 | tuning-1 | patient | Do drinks bother it at all? | — | cold, heat (sweets) | cold **−heat** ✗answer 1.1s | cold, heat, sweets 3.8s |
| 28 | tuning-1 | patient | Do you have any diseases? | — | medical-history | medical-history 1.2s | medical-history 3.4s |
| 29 | tuning-1 | patient | Does the feeling stay for a while? | Is it sensitive to cold? | cold | cold 1.2s | — **−cold** ✗answer (ungrounded_selection) 3.4s |
| 30 | tuning-1 | exam | Check the tooth on the opposite side too. | — | adjacent-teeth | adjacent-teeth 1.2s | adjacent-teeth 3.4s |
| 31 | tuning-1 | patient | Does it hurt for no reason, without biting? | — | spontaneous | spontaneous 1.2s | spontaneous (ungrounded_selection) 3.5s |
| 32 | tuning-1 | patient | Has this changed the way you chew? | — | chewing-avoidance | chewing-avoidance (selection_mismatch) 1.3s | chewing-avoidance (selection_mismatch) 3.4s |
| 33 | held-out-1 | patient | Is it sensitive to iced water? | — | cold | cold 1.1s | cold 3.2s |
| 34 | held-out-1 | patient | Do hot or cold drinks set it off? | — | cold, heat | cold, heat 1.2s | cold, heat 3.7s |
| 35 | held-out-1 | patient | Does a sip of coffee bother it? | — | heat (cold) | cold **−heat** ✗answer 1.1s | — **−heat** ✗answer (timeout) 4.0s |
| 36 | held-out-1 | patient | Have you been diagnosed with anything? | — | medical-history | medical-history 1.2s | medical-history 3.5s |
| 37 | held-out-1 | patient | Do you chew tobacco? | — | tobacco | tobacco 1.1s | tobacco 3.2s |
| 38 | held-out-1 | patient | Do you avoid eating on that side? | — | chewing-avoidance | chewing-avoidance 1.2s | chewing-avoidance 3.5s |
| 39 | held-out-1 | patient | Is the pain there when you're just sitting still? | — | spontaneous | spontaneous 1.2s | spontaneous 3.3s |
| 40 | held-out-1 | patient | Do you favour one side when chewing now? | — | chewing-avoidance | chewing-avoidance 1.2s | chewing-avoidance 3.5s |
| 41 | held-out-1 | exam | Check the teeth beside it. | — | adjacent-teeth | adjacent-teeth 1.1s | adjacent-teeth 3.3s |
| 42 | held-out-1 | exam | Test the opposite molar as a control. | — | adjacent-teeth | adjacent-teeth 1.1s | adjacent-teeth 3.2s |
| 43 | held-out-1 | exam | Check around its edges. | Is there a filling in that tooth? | margins | margins 1.1s | — **−margins** ✗answer (ungrounded_selection) 3.6s |
| 44 | held-out-1 | patient | Does it linger? | Does cold bother it? | cold | cold 1.1s | — **−cold** ✗answer (ungrounded_selection) 3.0s |
| 45 | held-out-1 | patient | And hot ones? | Do cold drinks bother it? | heat | heat 1.1s | heat 3.2s |
| 46 | held-out-1 | patient | When did it start this time? | Have you had this before? | symptom-duration | symptom-duration 1.2s | symptom-duration (timeout) 4.0s |
| 47 | held-out-1 | patient | Does it bother you? | — | — | — (low_confidence) 0.9s | — (low_confidence) 2.9s |
| 48 | held-out-1 | patient | Anything else? | — | — | — (low_confidence) 0.9s | — (low_confidence) 2.6s |
| 49 | held-out-1 | exam | Check it. | — | — | — (low_confidence) 0.9s | — (low_confidence) 2.6s |
| 50 | held-out-1 | patient | How about the other one? | — | — | — (low_confidence) 0.9s | — (ungrounded_selection) 3.1s |
| 51 | held-out-1 | patient | Do you have pets? | — | — | — (low_confidence) 0.9s | — 2.7s |
| 52 | held-out-1 | patient | What do you do for work? | — | — | — (low_confidence) 0.9s | — (low_confidence) 2.7s |
| 53 | held-out-2 | exam | Look at it. | — | — | restoration **+restoration** ✗answer (low_confidence) 1.1s | restoration **+restoration** ✗answer (low_confidence) 2.6s |
| 54 | held-out-2 | exam | Can you test this one? | — | — | — (low_confidence) 1.1s | — (ungrounded_selection) 3.1s |
| 55 | held-out-2 | patient | What else? | — | — | — (low_confidence) 1.0s | — (low_confidence) 2.7s |
| 56 | held-out-2 | exam | Examine it for me. | — | — | — (low_confidence) 0.9s | — (ungrounded_selection) 3.0s |
| 57 | held-out-2 | exam | Get a film of the root end. | — | pa | pa 1.2s | pa 3.3s |
| 58 | held-out-2 | exam | Image the apex of that tooth. | — | pa | cbct **+cbct** **−pa** ✗answer 1.2s | pa 3.1s |
| 59 | held-out-2 | patient | Do you use snuff or dip? | — | tobacco | tobacco 1.1s | tobacco 3.3s |
| 60 | held-out-2 | patient | Any chewing tobacco? | — | tobacco | tobacco 1.1s | tobacco 3.2s |
| 61 | held-out-2 | patient | Do you mostly chew on your left these days? | — | chewing-avoidance | chewing **+chewing** **−chewing-avoidance** ✗answer (selection_mismatch) 1.3s | chewing **+chewing** **−chewing-avoidance** ✗answer (selection_mismatch) 3.3s |
| 62 | held-out-2 | patient | Which side do you eat on now? | — | chewing-avoidance | location, chewing-avoidance **+location** (selection_mismatch) 1.2s | location, chewing-avoidance **+location** (selection_mismatch) 3.4s |
| 63 | held-out-2 | patient | Are you protecting that side when you eat? | — | chewing-avoidance | chewing-avoidance 1.2s | chewing-avoidance 3.5s |
| 64 | held-out-2 | patient | Does biting into an apple hurt? | — | chewing | chewing 1.2s | chewing (timeout) 4.0s |
| 65 | held-out-2 | patient | Is it sore when you chew gum? | — | chewing | chewing 1.1s | chewing (selection_mismatch) 3.9s |
| 66 | held-out-2 | patient | Does iced tea set it off? | — | cold (sweets) | cold 1.1s | cold 3.2s |
| 67 | held-out-2 | patient | What about warm soup? | — | heat | heat 1.1s | heat (low_confidence) 2.7s |
| 68 | held-out-2 | patient | How long does that last? | Does cold bother it? | cold | pain-severity **+pain-severity** **−cold** ✗answer 1.2s | — **−cold** ✗answer (ungrounded_selection) 3.1s |
| 69 | held-out-2 | patient | And sweet things? | Do cold drinks bother it? | sweets | sweets 1.1s | sweets 3.2s |
| 70 | held-out-2 | exam | Do the same on the neighbouring tooth. | Percuss the tooth. | adjacent-teeth | adjacent-teeth 1.2s | adjacent-teeth (ungrounded_selection) 3.2s |
| 71 | held-out-2 | exam | What about its edges? | Is there a filling in that tooth? | margins | margins 1.1s | margins 3.1s |
| 72 | held-out-2 | patient | Is there anything wrong with your general health? | — | medical-history | medical-history 1.1s | medical-history 3.2s |
| 73 | held-out-2 | patient | Any reactions to penicillin? | — | allergies | allergies 1.2s | allergies 3.2s |
| 74 | held-out-2 | exam | Feel the tissue over the roots. | — | palpation | palpation 1.2s | palpation 3.2s |
| 75 | held-out-2 | exam | How firm is it in the socket? | — | mobility | mobility 1.2s | mobility 3.3s |
| 76 | held-out-2 | patient | Do you like music? | — | — | — (low_confidence) 1.0s | — (low_confidence) 2.7s |
| 77 | held-out-2 | patient | Where do you live? | — | — | location **+location** ✗answer (low_confidence) 1.0s | location **+location** ✗answer (low_confidence) 2.6s |


## Round 1 — what changed (Founder-only variant B and selector `selector/2`)

- Authored over-matches (variant B only; variant A and the base pack are frozen):
  - `chewing` no longer fires on bare "eat", or on negated or changed chewing.
  - `spontaneous` recognizes "by itself", "for no reason" and "without biting".
  - `chewing-avoidance` recognizes "changed how/the way you eat/chew".
- Topic labels the model reads were made specific (cold/heat/sweets "food or drinks", medical history
  "conditions or illnesses", tobacco "smoking, vaping…", comparison teeth). Answers, availability and
  provenance are unchanged; recorded facts remain Dr. Chi's context.
- Selector instructions: disclose the fewest topics; a general word selects only the general topic; a
  referring follow-up selects the previous request's topic; an ambiguous request, or one with no
  specific subject, selects nothing, so the doctor is asked to clarify.

## Round 1 — summary (as first reported; see corrections above)

| Model | Run | Set | Correct | Rows with extra disclosure (facts) | Rows with missing | Fallbacks | Max ms |
|---|---|---|---|---|---|---|---|
| qwen3-coder-next:q4_K_M | before | tuning | 21/32 | 11 (13) | 8 | 6 | 1079 |
| qwen3-coder-next:q4_K_M | before | held-out | 12/20 | 8 (13) | 3 | 6 | 1052 |
| qwen3-coder-next:q4_K_M | after | tuning | 27/32 | 3 (3) | 5 | 3 | 1339 |
| qwen3-coder-next:q4_K_M | after | held-out | 16/20 | 4 (7) | 2 | 6 | 1298 |
| gemma3:27b | before | tuning | 21/32 | 10 (16) | 7 | 6 | 3473 |
| gemma3:27b | before | held-out | 13/20 | 6 (7) | 4 | 10 | 3248 |
| gemma3:27b | after | tuning | 29/32 | 2 (2) | 1 | 3 | 3479 |
| gemma3:27b | after | held-out | 14/20 | 6 (6) | 3 | 6 | 3350 |

## Round 1 — remaining errors after repair

| Model | Set | Question | Extra / missing | Cause |
|---|---|---|---|---|
| qwen | tuning | Do you light up at all? | +spontaneous, −tobacco | model reads "light up" as a pain flare |
| qwen | tuning | Take a picture of the root tip. | +cbct, −pa | regression after the repair |
| qwen | tuning | Does the feeling stay for a while? (after cold) | +pain-severity, −cold | follow-up resolved to duration |
| qwen | tuning | Drinks questions (2) | −heat | narrower than expected; no over-disclosure |
| qwen | held-out | Does a sip of coffee bother it? | +cold, −heat | model |
| qwen | held-out | Do you chew tobacco? | +chewing | **authored** `chewing` pattern ("chew"); mismatch guard keeps it |
| qwen | held-out | Do you favour one side when chewing now? | +chewing, −chewing-avoidance | model + authored pattern |
| qwen | held-out | Check it. | +4 exam findings | **largest over-disclosure** |
| gemma | tuning | Drinks questions (2) | +sweets | expectation debatable |
| gemma | tuning | How often do you get your teeth cleaned? | −last-visit | low confidence; clarifies instead |
| gemma | held-out | coffee / chew tobacco / favour one side | as qwen | same causes |
| gemma | held-out | Check around its edges. (after filling) | +restoration, −margins | model |
| gemma | held-out | Check it. | +cold-test | model |
| gemma | held-out | How about the other one? | +location | model |

The held-out authored over-matches ("chew tobacco", "favour… when chewing") are not repaired here,
because repairing them would tune on the held-out set. They need a new held-out set.

## Round 1 — model choice (superseded by round 2)

Both models are 43/52 overall. On the held-out set qwen is 16/20 with 4 over-disclosure rows; gemma is
14/20 with 6. gemma is better on tuning (29/32 vs 27/32). gemma answers in 2.7–3.5 s against the 4 s
limit, so a tunnel round trip would push some turns into timeout. Timeouts fall back to authored rules
and do not over-disclose, but the model would then go unused. qwen answers in at most 1.3 s.
`qwen3-coder-next:q4_K_M` stays the default. Its worst remaining error is a broad "check it"
disclosing four exam findings.

## Round 1 — per-question results (as first reported)

### qwen3-coder-next:q4_K_M — after repair

| # | Set | Ch | Question | Previous context | Expected | Actual | Extra | Missing | Fallback | ms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tuning | patient | Does anything you drink make it twinge? | — | cold, heat | cold | — | **heat** | — | 1339 |
| 2 | tuning | patient | Does it ever ache while you're sleeping? | — | night | night | — | — | — | 812 |
| 3 | tuning | patient | Does it act up all by itself, even when you're not eating? | — | spontaneous | spontaneous | — | — | — | 889 |
| 4 | tuning | patient | Are you on any drugs your doctor gave you? | — | medications | medications | — | — | — | 868 |
| 5 | tuning | patient | Any illnesses I should know about? | — | medical-history | medical-history | — | — | — | 832 |
| 6 | tuning | patient | Has anyone ever said you gnash your teeth? | — | bruxism | bruxism | — | — | — | 825 |
| 7 | tuning | exam | Let me knock on the tooth with the mirror handle. | — | percussion | percussion | — | — | — | 761 |
| 8 | tuning | exam | Shine a light through the tooth. | — | transillumination | transillumination | — | — | — | 741 |
| 9 | tuning | exam | Measure the gum depth around it. | — | probing | probing | — | — | — | 718 |
| 10 | tuning | exam | Take a picture of the root tip. | — | pa | cbct | **cbct** | **pa** | — | 728 |
| 11 | tuning | exam | Put some ice on the tooth and see how it reacts. | — | cold-test | cold-test | — | — | — | 847 |
| 12 | tuning | patient | How long ago was it put in? | Is there a filling in that tooth? | restoration-age | restoration-age | — | — | — | 924 |
| 13 | tuning | patient | Does it hang around afterwards? | Does cold bother it? | cold | cold | — | — | — | 783 |
| 14 | tuning | patient | What about at night? | Does it hurt when you chew? | night | night | — | — | — | 874 |
| 15 | tuning | patient | How bad is it, from one to ten? | — | pain-severity | pain-severity | — | — | — | 826 |
| 16 | tuning | patient | Have you changed how you eat because of it? | — | chewing-avoidance | chewing-avoidance | — | — | — | 838 |
| 17 | tuning | patient | Do you light up at all? | — | tobacco | spontaneous | **spontaneous** | **tobacco** | — | 820 |
| 18 | tuning | patient | How often do you get your teeth cleaned? | — | last-visit | last-visit | — | — | — | 818 |
| 19 | tuning | exam | Check whether it wobbles. | — | mobility | mobility | — | — | — | 735 |
| 20 | tuning | exam | Use the pulp tester on it. | — | ept | ept | — | — | — | 727 |
| 21 | tuning | exam | Press along the gum beside the roots. | — | palpation | palpation | — | — | — | 760 |
| 22 | tuning | exam | Compare with the same tooth on the other side. | — | adjacent-teeth | adjacent-teeth | — | — | — | 855 |
| 23 | tuning | exam | Can we get a 3-D scan of the area? | — | cbct | cbct | — | — | — | 774 |
| 24 | tuning | exam | What is their blood pressure? | — | — | — | — | — | local_model_low_confidence | 644 |
| 25 | tuning | patient | What's the weather like? | — | — | — | — | — | local_model_low_confidence | 730 |
| 26 | tuning | exam | Which test should I do next? | — | — | — | — | — | — | 0 |
| 27 | tuning | patient | Do drinks bother it at all? | — | cold, heat | cold | — | **heat** | — | 899 |
| 28 | tuning | patient | Do you have any diseases? | — | medical-history | medical-history | — | — | — | 830 |
| 29 | tuning | patient | Does the feeling stay for a while? | Is it sensitive to cold? | cold | pain-severity | **pain-severity** | **cold** | — | 949 |
| 30 | tuning | exam | Check the tooth on the opposite side too. | — | adjacent-teeth | adjacent-teeth | — | — | — | 879 |
| 31 | tuning | patient | Does it hurt for no reason, without biting? | — | spontaneous | spontaneous | — | — | — | 953 |
| 32 | tuning | patient | Has this changed the way you chew? | — | chewing-avoidance | chewing-avoidance | — | — | local_model_selection_mismatch | 1031 |
| 33 | held-out | patient | Is it sensitive to iced water? | — | cold | cold | — | — | — | 856 |
| 34 | held-out | patient | Do hot or cold drinks set it off? | — | cold, heat | cold, heat | — | — | — | 1193 |
| 35 | held-out | patient | Does a sip of coffee bother it? | — | heat | cold | **cold** | **heat** | — | 999 |
| 36 | held-out | patient | Have you been diagnosed with anything? | — | medical-history | medical-history | — | — | — | 1026 |
| 37 | held-out | patient | Do you chew tobacco? | — | tobacco | chewing, tobacco | **chewing** | — | local_model_selection_mismatch | 969 |
| 38 | held-out | patient | Do you avoid eating on that side? | — | chewing-avoidance | chewing-avoidance | — | — | — | 1042 |
| 39 | held-out | patient | Is the pain there when you're just sitting still? | — | spontaneous | spontaneous | — | — | — | 1115 |
| 40 | held-out | patient | Do you favour one side when chewing now? | — | chewing-avoidance | chewing | **chewing** | **chewing-avoidance** | — | 986 |
| 41 | held-out | exam | Check the teeth beside it. | — | adjacent-teeth | adjacent-teeth | — | — | — | 921 |
| 42 | held-out | exam | Test the opposite molar as a control. | — | adjacent-teeth | adjacent-teeth | — | — | — | 1023 |
| 43 | held-out | exam | Check around its edges. | Is there a filling in that tooth? | margins | margins | — | — | — | 1063 |
| 44 | held-out | patient | Does it linger? | Does cold bother it? | cold | cold | — | — | — | 1003 |
| 45 | held-out | patient | And hot ones? | Do cold drinks bother it? | heat | heat | — | — | — | 979 |
| 46 | held-out | patient | When did it start this time? | Have you had this before? | symptom-duration | symptom-duration | — | — | — | 1107 |
| 47 | held-out | patient | Does it bother you? | — | — | — | — | — | local_model_low_confidence | 869 |
| 48 | held-out | patient | Anything else? | — | — | — | — | — | local_model_low_confidence | 904 |
| 49 | held-out | exam | Check it. | — | — | restoration, percussion, transillumination, crack | **restoration, percussion, transillumination, crack** | — | — | 1298 |
| 50 | held-out | patient | How about the other one? | — | — | — | — | — | local_model_low_confidence | 852 |
| 51 | held-out | patient | Do you have pets? | — | — | — | — | — | local_model_low_confidence | 912 |
| 52 | held-out | patient | What do you do for work? | — | — | — | — | — | local_model_low_confidence | 887 |

### gemma3:27b — after repair

| # | Set | Ch | Question | Previous context | Expected | Actual | Extra | Missing | Fallback | ms |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tuning | patient | Does anything you drink make it twinge? | — | cold, heat | cold, heat, sweets | **sweets** | — | — | 3383 |
| 2 | tuning | patient | Does it ever ache while you're sleeping? | — | night | night | — | — | — | 2728 |
| 3 | tuning | patient | Does it act up all by itself, even when you're not eating? | — | spontaneous | spontaneous | — | — | — | 2810 |
| 4 | tuning | patient | Are you on any drugs your doctor gave you? | — | medications | medications | — | — | — | 2892 |
| 5 | tuning | patient | Any illnesses I should know about? | — | medical-history | medical-history | — | — | — | 2945 |
| 6 | tuning | patient | Has anyone ever said you gnash your teeth? | — | bruxism | bruxism | — | — | — | 3007 |
| 7 | tuning | exam | Let me knock on the tooth with the mirror handle. | — | percussion | percussion | — | — | — | 2875 |
| 8 | tuning | exam | Shine a light through the tooth. | — | transillumination | transillumination | — | — | — | 2780 |
| 9 | tuning | exam | Measure the gum depth around it. | — | probing | probing | — | — | — | 2683 |
| 10 | tuning | exam | Take a picture of the root tip. | — | pa | pa | — | — | — | 2774 |
| 11 | tuning | exam | Put some ice on the tooth and see how it reacts. | — | cold-test | cold-test | — | — | — | 2730 |
| 12 | tuning | patient | How long ago was it put in? | Is there a filling in that tooth? | restoration-age | restoration-age | — | — | — | 2917 |
| 13 | tuning | patient | Does it hang around afterwards? | Does cold bother it? | cold | cold | — | — | — | 2746 |
| 14 | tuning | patient | What about at night? | Does it hurt when you chew? | night | night | — | — | — | 2763 |
| 15 | tuning | patient | How bad is it, from one to ten? | — | pain-severity | pain-severity | — | — | — | 3016 |
| 16 | tuning | patient | Have you changed how you eat because of it? | — | chewing-avoidance | chewing-avoidance | — | — | — | 2990 |
| 17 | tuning | patient | Do you light up at all? | — | tobacco | tobacco | — | — | — | 2932 |
| 18 | tuning | patient | How often do you get your teeth cleaned? | — | last-visit | — | — | **last-visit** | local_model_low_confidence | 2472 |
| 19 | tuning | exam | Check whether it wobbles. | — | mobility | mobility | — | — | — | 2597 |
| 20 | tuning | exam | Use the pulp tester on it. | — | ept | ept | — | — | — | 2671 |
| 21 | tuning | exam | Press along the gum beside the roots. | — | palpation | palpation | — | — | — | 2816 |
| 22 | tuning | exam | Compare with the same tooth on the other side. | — | adjacent-teeth | adjacent-teeth | — | — | — | 2817 |
| 23 | tuning | exam | Can we get a 3-D scan of the area? | — | cbct | cbct | — | — | — | 2844 |
| 24 | tuning | exam | What is their blood pressure? | — | — | — | — | — | local_model_low_confidence | 2409 |
| 25 | tuning | patient | What's the weather like? | — | — | — | — | — | local_model_low_confidence | 2474 |
| 26 | tuning | exam | Which test should I do next? | — | — | — | — | — | — | 0 |
| 27 | tuning | patient | Do drinks bother it at all? | — | cold, heat | cold, heat, sweets | **sweets** | — | — | 3479 |
| 28 | tuning | patient | Do you have any diseases? | — | medical-history | medical-history | — | — | — | 3120 |
| 29 | tuning | patient | Does the feeling stay for a while? | Is it sensitive to cold? | cold | cold | — | — | — | 2958 |
| 30 | tuning | exam | Check the tooth on the opposite side too. | — | adjacent-teeth | adjacent-teeth | — | — | — | 2915 |
| 31 | tuning | patient | Does it hurt for no reason, without biting? | — | spontaneous | spontaneous | — | — | — | 3094 |
| 32 | tuning | patient | Has this changed the way you chew? | — | chewing-avoidance | chewing-avoidance | — | — | — | 3088 |
| 33 | held-out | patient | Is it sensitive to iced water? | — | cold | cold | — | — | — | 2997 |
| 34 | held-out | patient | Do hot or cold drinks set it off? | — | cold, heat | cold, heat | — | — | — | 3331 |
| 35 | held-out | patient | Does a sip of coffee bother it? | — | heat | cold | **cold** | **heat** | — | 3101 |
| 36 | held-out | patient | Have you been diagnosed with anything? | — | medical-history | medical-history | — | — | — | 3041 |
| 37 | held-out | patient | Do you chew tobacco? | — | tobacco | chewing, tobacco | **chewing** | — | local_model_selection_mismatch | 3072 |
| 38 | held-out | patient | Do you avoid eating on that side? | — | chewing-avoidance | chewing-avoidance | — | — | — | 3170 |
| 39 | held-out | patient | Is the pain there when you're just sitting still? | — | spontaneous | spontaneous | — | — | — | 3112 |
| 40 | held-out | patient | Do you favour one side when chewing now? | — | chewing-avoidance | chewing | **chewing** | **chewing-avoidance** | local_model_selection_mismatch | 3188 |
| 41 | held-out | exam | Check the teeth beside it. | — | adjacent-teeth | adjacent-teeth | — | — | — | 3000 |
| 42 | held-out | exam | Test the opposite molar as a control. | — | adjacent-teeth | adjacent-teeth | — | — | — | 3024 |
| 43 | held-out | exam | Check around its edges. | Is there a filling in that tooth? | margins | restoration | **restoration** | **margins** | — | 3136 |
| 44 | held-out | patient | Does it linger? | Does cold bother it? | cold | cold | — | — | — | 3094 |
| 45 | held-out | patient | And hot ones? | Do cold drinks bother it? | heat | heat | — | — | — | 3079 |
| 46 | held-out | patient | When did it start this time? | Have you had this before? | symptom-duration | symptom-duration | — | — | — | 3350 |
| 47 | held-out | patient | Does it bother you? | — | — | — | — | — | local_model_low_confidence | 2818 |
| 48 | held-out | patient | Anything else? | — | — | — | — | — | local_model_low_confidence | 2657 |
| 49 | held-out | exam | Check it. | — | — | cold-test | **cold-test** | — | — | 2951 |
| 50 | held-out | patient | How about the other one? | — | — | location | **location** | — | — | 3156 |
| 51 | held-out | patient | Do you have pets? | — | — | — | — | — | local_model_low_confidence | 2767 |
| 52 | held-out | patient | What do you do for work? | — | — | — | — | — | local_model_low_confidence | 2717 |
