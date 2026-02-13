-- Add confirmation tracking columns to user_sessions
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS confirmation_count_in_session INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS turns_since_last_confirmation INTEGER DEFAULT 999;
