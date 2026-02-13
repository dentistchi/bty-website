-- Add previous_was_silence flag to user_sessions
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS previous_was_silence BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_sessions_previous_silence 
ON user_sessions (previous_was_silence);
