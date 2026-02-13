-- Add css_score column to organization_emotional_metrics
ALTER TABLE organization_emotional_metrics 
ADD COLUMN IF NOT EXISTS css_score INTEGER DEFAULT 5;

CREATE INDEX IF NOT EXISTS idx_org_emotional_metrics_css_score 
ON organization_emotional_metrics (css_score);
