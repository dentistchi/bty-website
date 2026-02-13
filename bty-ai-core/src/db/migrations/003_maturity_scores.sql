-- Internal maturity scores storage (not exposed to users)
CREATE TABLE IF NOT EXISTS maturity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  emotional_regulation INTEGER NOT NULL,
  ownership_level INTEGER NOT NULL,
  perspective_taking INTEGER NOT NULL,
  integrity_alignment INTEGER NOT NULL,
  recovery_effort INTEGER NOT NULL,
  integrity_alignment_score INTEGER NOT NULL DEFAULT 0,
  seri NUMERIC(5,2) NOT NULL,
  detected_emotion TEXT NOT NULL,
  maturity_risk_level TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maturity_scores_user_id ON maturity_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_maturity_scores_role ON maturity_scores (role);
CREATE INDEX IF NOT EXISTS idx_maturity_scores_timestamp ON maturity_scores (timestamp);
