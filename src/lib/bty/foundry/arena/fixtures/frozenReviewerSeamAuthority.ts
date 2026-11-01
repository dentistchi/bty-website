/** Fixed synthetic seam fixtures. Never historical Run4/Run5 or provider evidence. */
export const SYNTHETIC_REPLAY_AUTHORITY = {
  "synthetic-a": {
    "artifactPath": "src/lib/bty/foundry/arena/fixtures/frozen-reviewer-seam-synthetic-a.json",
    "artifactSha256": "320a3b62ce5a3a50de5da85d77f0a471f7e9a376f3a2af731828211b70bcd0f3",
    "scenarioDigest": "eec15f10ce2e42ce67e8387dfc19638af7763cfaf0c365299756291c77e265a6",
    "sourceKind": "test-fixture"
  },
  "synthetic-b": {
    "artifactPath": "src/lib/bty/foundry/arena/fixtures/frozen-reviewer-seam-synthetic-b.json",
    "artifactSha256": "828dffc0ef4d7135f5ccda3fc3a207eb05235e0f63748c77ba6d83e8c6909d07",
    "scenarioDigest": "0e3eebc4647f49e63c86a45033a0e8831b58cf4117c81551ba5e2e7508fadfab",
    "sourceKind": "test-fixture"
  }
} as const;
export type SyntheticReplaySubjectId = keyof typeof SYNTHETIC_REPLAY_AUTHORITY;
