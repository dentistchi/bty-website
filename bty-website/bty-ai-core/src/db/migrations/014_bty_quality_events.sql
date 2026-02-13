-- bty_quality_events: track critic failures for weekly rule patching
-- Do NOT store userText or draft. Only issue signatures.
CREATE TABLE IF NOT EXISTS bty_quality_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT now(),
  role TEXT,
  intent TEXT,
  issues TEXT[],
  severity TEXT,
  css_score INTEGER,
  model_version TEXT,
  route TEXT
);

CREATE INDEX IF NOT EXISTS idx_bty_quality_events_timestamp ON bty_quality_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_bty_quality_events_severity ON bty_quality_events (severity);
CREATE INDEX IF NOT EXISTS idx_bty_quality_events_intent ON bty_quality_events (intent);
CREATE INDEX IF NOT EXISTS idx_bty_quality_events_route ON bty_quality_events (route);
