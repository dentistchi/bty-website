-- Metadata only. No conversation content.
CREATE TABLE IF NOT EXISTS organization_emotional_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  detected_emotion TEXT NOT NULL,
  maturity_risk_level TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_emotional_metrics_user_id ON organization_emotional_metrics (user_id);
CREATE INDEX IF NOT EXISTS idx_org_emotional_metrics_timestamp ON organization_emotional_metrics (timestamp);
