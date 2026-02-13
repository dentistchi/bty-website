-- Add emotion probe tracking columns to user_sessions
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS emotion_probe BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS emotion_overprocessing_flag BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_sessions_emotion_probe 
ON user_sessions (emotion_probe);
