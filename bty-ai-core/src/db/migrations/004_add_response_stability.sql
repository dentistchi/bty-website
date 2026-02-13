-- Add response_stability column to organization_emotional_metrics
-- Tracks AI response quality: +1 if <=3 sentences, -2 if >=5 sentences
ALTER TABLE organization_emotional_metrics 
ADD COLUMN IF NOT EXISTS response_stability INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_org_emotional_metrics_stability 
ON organization_emotional_metrics (response_stability);
