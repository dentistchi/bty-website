# Clinical Reasoning Trainer V1

Case 001 is a deterministic, synthetic incisor-fracture learning case. Evidence configuration, rubric references, event recording, metrics, feedback, browser persistence, and Neurosight serialization are separate modules under `src/domain/clinical-reasoning`.

The learner sees a progressive disclosure interface in Arena. The raw ordered trace remains the source for all review. Browser storage supports resume and retrieval of completed local traces only; no network, provider, database, or production data write is involved. Benchmark references are optional and empty by default. Feedback describes observed learner actions and does not make senior-review claims.
