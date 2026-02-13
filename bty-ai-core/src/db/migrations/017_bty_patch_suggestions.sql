-- bty_patch_suggestions: structured patch proposals only
-- No raw conversation text. Only aggregates + proposed rules.
CREATE TABLE IF NOT EXISTS bty_patch_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window TEXT NOT NULL,
  model_version TEXT NOT NULL,
  input_summary JSONB NOT NULL,
  suggestions JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'applied')),
  applied_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bty_patch_suggestions_created_at ON bty_patch_suggestions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bty_patch_suggestions_status ON bty_patch_suggestions (status);
