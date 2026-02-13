-- User session tracking for dependency flags and integrity scores
CREATE TABLE IF NOT EXISTS user_sessions (
  user_id TEXT PRIMARY KEY,
  dependency_flag INTEGER NOT NULL DEFAULT 0,
  integrity_alignment_score INTEGER NOT NULL DEFAULT 3,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_updated ON user_sessions (last_updated);
