# Clinical Reasoning productionization V1

`clinical_reasoning_traces` is the durable store for synthetic Clinical Reasoning traces. The browser holds a fast resilience copy; the server derives ownership from the authenticated BTY user and stores the raw ordered trace as the source of truth. Metrics are reproducible snapshots.

A doctor starts in the Teams tab (`/teams`), opens Arena, then Clinical reasoning. Local changes save immediately and server synchronization is non-blocking; an unsynced indication means local data remains available but durable completion must be retried.

Platform admins may review the minimal case summary, promote a completed learner trace to an immutable `expert_benchmark` snapshot, and download the authorized NDJSON export. Export subjects are SHA-256 pseudonyms, never email. Case 001 remains synthetic and its clinician validation status remains `pending`. To add Case 002, add a versioned validated case configuration and include it in server validation before accepting traces.
