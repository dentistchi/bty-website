# BTY Foundry Lab — Arena Training baseline (M0)

An external measurement layer for the Arena Training Builder. The application never imports it.
It feeds frozen benchmark cases to the **unchanged** production generator (`generateProgram`),
evaluates what comes back with the Arena's own deterministic authority plus an explicit product-quality
vector, and writes resumable, per-candidate results to `.foundry/` (git-ignored).

```sh
npm run foundry:arena:baseline                                   # 20 cases × 3, local model
npm run foundry:arena -- baseline --cases arena-training-001 --generations 1   # smoke
npm run foundry:arena -- resume <run-id>                         # after an interruption
npm run foundry:arena -- replay <run-id> --model gpt-oss:120b    # same cases, another model
npm run foundry:arena -- report <run-id>
npm run foundry:arena -- baseline --provider mock --allow-dirty  # plumbing check, no model
```

| Flag | Meaning |
|---|---|
| `--provider local\|mock\|frontier` | default `local`. `frontier` also needs `--allow-paid-provider`. |
| `--base-url` | local endpoint, default `$FOUNDRY_LLM_BASE_URL` or `http://127.0.0.1:11434/v1` (must be loopback/private). |
| `--model` | default `$FOUNDRY_LLM_MODEL` or `gemma4:31b`. Cases never name a model. |
| `--pipeline generator\|simple` | `generator` = one `generateProgram` (detailed builder). `simple` adds Simple Mode's one product repair. |
| `--generations N`, `--cases a,b` | repetition and case filter. |
| `--critic` | optional Layer C model critic (advisory, never overrides a deterministic result). |
| `--allow-dirty` | record a run from a tree with tracked modifications (marked dirty in every artifact). |

**Safety.** The CLI never reads `.env` files and never prompts. In local mode it removes every provider
API key from its own process, so nothing is sent to the local server and nothing can fall back to a paid
provider. The generator writes to an in-memory ledger (`ledgerCapture.ts`), so no database is touched.

**Artifacts.** `.foundry/runs/<run-id>/` holds `manifest.json` (identity: source SHA, benchmark hash,
provider, pipeline), `cases/<case>/gen-NN.json` (one per candidate, the authority), `events.jsonl`
(append-only), `state.json` (derived), `report.json` and `report.md`.

**Changing the benchmark.** A case edit without a new `benchmark_version` fails validation (the lock file
pins every case's SHA-256). Bump the version and regenerate the lock deliberately.
