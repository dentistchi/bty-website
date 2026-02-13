-- Add previous_was_question flag to user_sessions
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS previous_was_question BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_sessions_previous_question 
ON user_sessions (previous_was_question);
