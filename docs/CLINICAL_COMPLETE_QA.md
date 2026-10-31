# Clinical Discovery and app verification — 2026-10-31

Runtime source: `bc0a95d84f54fefc3a5c7b02b3da563059f300cf`. Final repository documentation/evidence may follow this source commit; the runtime source hashes are recorded in the manifests. This is source preparation for Draft PR #90. No merge, deploy, migration, production write, authentication session, secret change or Mac service restart occurred.

## Resulting behavior

The latest Founder path now has fixed interview/examination content for all 23 cases: Case 001 variant B, six prior A/B review copies, and 16 new C copies. The C copies contain 276 marked fictional entries (247 available and 29 explicitly unavailable); every available original statement is retained. All 31 earlier patient objects and all nine earlier fixture files remain exact. Ordinary users retain their existing packs; stored attempts keep their saved pack version/hash. Nothing rewrites conversation history or author references.

The v11 interpreter separates ordinary history from objective examination, supports named multi-part requests, preserves tooth/root/surface scope, excludes declined subjects and requests clarification for tested vague continuations. Batches of five to eight explicitly scoped results use fixed rules; the model selector remains capped at four IDs with the same selector/3 instructions and four-second deadline. No diagnosis or treatment plan is generated during discovery.

Tracking ignores earlier fetch/body/auth-retry results after a newer read supersedes them. Saved ignores earlier lifecycle reads; its reproduction uses StrictMode, not an observed production double mount. Practice completion requires the canonical `completed:true` acknowledgement instead of treating every HTTP 200 as saved. HTTP/HTML/malformed-body failures retain error/retry behavior.

## Reproduction and fixed oracles

The 409-turn v1 journey was frozen before routing repairs. V1 is preserved; v2 has an explicit correction manifest for source wording, atomic medication facts and stale explanation text. It changes no question, required flag or expected resolution. It was not revised to accommodate router output. The new fixture includes the unchanged six A/B journeys and a nine-turn Case 001 variant-B path. Required flags describe these finite QA paths, never the learner's required questions.

After registering the C data, fixed v2 initially had 44 routing flags, 24 checked-answer mismatches and eight newly available extra-disclosure turns. After the first scope repair it had eight routing flags; after metadata repair it had zero routing flags but three false unavailable-topic acknowledgements. Those were corrected. Broader 77-file verification then caught 13 additional regressions: six cases' generic procedure history in both modes, plus subjective cold-history recognition in Case 007. Existing tests failed before the last repair and all 615 targeted checks passed afterwards.

An independently frozen 20-probe set improved 9/20 → 18/20 → 20/20 without changing its oracle. A separate controlled selector diagnostic initially disclosed facts for generic continuation words; the unchanged three-probe diagnostic ends 3/3 safe. The final controlled boundary test includes a valid narrow selection and opposite-surface rejection. These are visible finite regression probes, not held-out generalization or real-model accuracy.

## Final measured checks

| Check | Result | Scope |
|---|---|---|
| Related tests | 1,618/1,618 reported pass in 77 files | 15 PostgreSQL bodies inactive without BTY_PG_TEST_URL; no DB execution claim |
| Complete Founder fixture | 23 cases / 409 turns, exit 0 | Zero routing, answer-pattern, required-gap, invariant, new-extra or repeated-extra issues |
| Independent probes | 20/20; controlled diagnostic 3/3 | No outbound requests or actual inference |
| Browser flows | 135/135, zero retries/flakes/skips | 117 clinical encounters + 12 Saved/Tracking cases + six rewards cases; 320/390/1280px, intercepted transport |
| Types | Exit 0 | Node 20.20.2, 8 GB heap, no incremental cache |
| Fresh build | Exit 0 | Separate clean checkout, real npm ci, no inherited application credentials, explicit local placeholders |
| Artifact guard | 3,626 JS files, zero unsafe, 2/2 safe | Default function only; handler patch verified |
| Public content scan | 1,445 text files, 506 expanded needles, zero hits | 427 marked available answer occurrences (375 unique), 46 author prefixes and 12 selector lines; bounded scan, not an exhaustive privacy proof |
| Original historical fixture | 205 turns, unchanged 74 required gaps, exit 1 | Different stored packs and fixture; not converted to a pass by the new preview |
| Full suite | 16,074 passed / 151 failed / 409 pending, exit 1; zero new failing assertion identities | Fresh unchanged base and exact assertion identities are compared separately |

Two independent fresh installs/builds were performed. The first aa156af build is retained as superseded intermediate evidence. The final bc0a95d checkout has no tracked changes and all 61 inspected source/config/dependency hashes remain unchanged. The final build console log is short; phase/page-count claims are based only on independently inspected emitted artifacts. The unsupported Next 15 override remains an existing warning and does not confer vendor support.

Rewards screenshots were inspected at 390px, including reduced motion. Text contrast is readable and the settled progress bars match the numeric state. The non-reduced-motion screenshot captures an in-progress transition; it is not used to assert final progress-bar geometry.

## Live read-only catalog check

`live-catalog-readonly.json` records system catalog/ACL and advisor reads for the source-verified Supabase project. No learner rows were read. Both legacy XP increment RPCs currently deny anon/authenticated execution and permit service_role; earlier reports describing the old direct-call gap are historical. The four Learning Rewards tables and three RPCs are service-only; the tables have RLS. Clinical pilot writes have restrictive API-owned policies alongside owner-scoped learner policies. Catalog evidence is not a real-session authorization test.

## Remaining release gates

- Actual Mac/qwen inference on the new packs and signed-in Worker/Teams/physical-iPhone verification remain unrun in this context. The existing browser plugin cannot attach to an originating local browser. No session was manufactured. Automated synthetic checks are not substituted for actual inference.
- The ordinary-user historical packs still retain their original content limits. C data is a Founder preview awaiting clinical review; full author reference alignment is not implied by plausible fictional observations. Cases 015, 016 and 020 require particular attention to unresolved biopsy, anticoagulant and Prolia coordination decisions. No invented policy or future outcome was found by content review.
- Two reachable legacy reward invariants remain RED: repeated legacy events can award twice, and a Beginner reward outage can leave DONE without recoverable award/reflection persistence. These are separate from native Practice and the atomic Learning Rewards ledger. Their explicit failing probes and ten passing controls are preserved in `APP_RELEASE_FLOW_AUDIT.md`; no live double-payment or historical replay was attempted.
- The pre-existing full-suite baseline is not green. No general public-release or bug-free claim is made.

## Repeatable synthetic model audit

On the authorized Mac gateway environment, the same fixed fixture can run without DB/auth imports or learner writes:

```sh
node --import tsx scripts/clinical-discovery-audit.ts --mode model \
  --fixture scripts/fixtures/clinical-discovery-complete.v2.json \
  --base-url http://127.0.0.1:8788/v1 --model qwen3-coder-next:q4_K_M \
  --key-file ~/.config/bty/clinical-discovery-gateway.key \
  --json /tmp/clinical-complete-model-UNIQUE.json --check
```

The output path must be new; the audit refuses to overwrite a previous run. Report accepted model turns, rules-only turns and fallback reasons separately. Do not apply earlier 205-turn qwen metrics to the new review packs.

## Full-suite comparison details

The unchanged b913a7d baseline reports 15,595 passed / 152 failed / 409 pending (16,156 total, 46 failed files). Final bc0a95d reports 16,074 passed / 151 failed / 409 pending (16,634 total, 45 failed files). Comparison uses a multiset of `(file, fullName)` to retain duplicate parameterized names. There are no newly failing assertion identities. All 478 added assertion identities pass, none of the baseline identities are removed, and the 409 skipped identities remain unchanged. One earlier SavedForLaterSwipe synchronization assertion is absent; it also passed the independent focused rerun before these final checks, so no new repair attribution is made. The missing `e71b3c84` suite-load failure is unchanged.

All 151 remaining assertion messages match after dependency-path normalization except one unchanged MyPageLeadershipConsole missing-button failure: its rendered expiry changes 23h to 1d and its DOM excerpt truncates at a different point. This is a clock/rendered-message difference, not a new failure identity. Full raw reports, normalized messages and the exact difference are archived rather than inferring equality from counts. The first integrated full run was interrupted with exit 130 after the 77-file run exposed the 13 C regressions; no result or PASS is claimed for that interrupted run.

See [verification.json](clinical-complete-qa/verification.json) and [manifest.json](clinical-complete-qa/manifest.json) for exact sources, hashes and bounded scopes. Gzip archives contain the unchanged raw JSON, including earlier failures. English new-case details are in [CLINICAL_COMPLETE_REVIEW.md](CLINICAL_COMPLETE_REVIEW.md). Existing A/B records remain in their original documents.
