-- Add reflection history for KeyPointReflectionLibrary (avoid repeating last 5)
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS last_reflection_templates JSONB DEFAULT '[]'::jsonb;
