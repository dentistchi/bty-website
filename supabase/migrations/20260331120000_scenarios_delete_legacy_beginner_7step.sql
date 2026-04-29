-- Remove legacy beginner_7step JSON blobs from public.scenarios (canonical format is plain body + choices).
-- Safe to run after deploy; runtime also blocks these via scenarioPayloadFromDb.

delete from public.scenarios
where scenario_type = 'beginner_7step'
   or body::text like '%beginner_7step%'
   or body::text like '%"emotionOptions"%'
   or body::text like '%"hiddenRiskQuestion"%';
