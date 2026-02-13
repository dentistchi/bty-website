-- Add last_silence_indices column to user_sessions
-- Stores last 3 used silence sentence indices as JSON array
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS last_silence_indices JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_silence_indices 
ON user_sessions USING GIN (last_silence_indices);
