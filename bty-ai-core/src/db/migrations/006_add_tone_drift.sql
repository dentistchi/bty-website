-- Add tone_drift column to user_sessions
-- Tracks deviation from warm mentor tone
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS tone_drift INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_sessions_tone_drift 
ON user_sessions (tone_drift);
