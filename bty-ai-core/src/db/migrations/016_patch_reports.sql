-- Patch reports: store generated patch suggestions for rule patching
CREATE TABLE IF NOT EXISTS bty_patch_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_days INTEGER NOT NULL,
  report JSONB NOT NULL,
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_bty_patch_reports_created_at ON bty_patch_reports (created_at DESC);
