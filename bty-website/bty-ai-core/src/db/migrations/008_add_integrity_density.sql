-- Add integrity_density_flag column to user_sessions
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS integrity_density_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS integrity_turn_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_sessions_integrity_density 
ON user_sessions (integrity_density_flag);
