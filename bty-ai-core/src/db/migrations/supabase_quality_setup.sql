-- Supabase SQL Editor에서 실행 (Pooler 연결 실패 시)
-- bty_quality_events + aggregation functions

CREATE TABLE IF NOT EXISTS bty_quality_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT now(),
  role TEXT,
  intent TEXT,
  issues TEXT[],
  severity TEXT,
  css_score INTEGER,
  model_version TEXT,
  route TEXT
);

CREATE INDEX IF NOT EXISTS idx_bty_quality_events_timestamp ON bty_quality_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_bty_quality_events_severity ON bty_quality_events (severity);
CREATE INDEX IF NOT EXISTS idx_bty_quality_events_intent ON bty_quality_events (intent);
CREATE INDEX IF NOT EXISTS idx_bty_quality_events_route ON bty_quality_events (route);

CREATE OR REPLACE FUNCTION bty_issues_signature(issues_arr TEXT[])
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT COALESCE(
    (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(issues_arr) x),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION bty_top_issue_patterns(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  issues_signature TEXT,
  count BIGINT,
  high_severity_count BIGINT,
  avg_css NUMERIC,
  top_roles TEXT,
  top_intents TEXT,
  top_routes TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT bty_issues_signature(q.issues) AS sig, q.role, q.intent, q.route, q.severity, q.css_score
    FROM bty_quality_events q
    WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
  ),
  agg AS (
    SELECT b.sig, count(*)::BIGINT AS cnt, count(*) FILTER (WHERE b.severity = 'high')::BIGINT AS high_cnt, avg(b.css_score) AS avg_css
    FROM base b GROUP BY b.sig ORDER BY cnt DESC LIMIT 10
  )
  SELECT a.sig, a.cnt, a.high_cnt, round(a.avg_css::NUMERIC, 2),
    (SELECT string_agg(role, ', ' ORDER BY rcnt DESC) FROM (SELECT role, count(*) AS rcnt FROM base WHERE sig = a.sig GROUP BY role ORDER BY rcnt DESC LIMIT 2) r),
    (SELECT string_agg(intent, ', ' ORDER BY icnt DESC) FROM (SELECT intent, count(*) AS icnt FROM base WHERE sig = a.sig GROUP BY intent ORDER BY icnt DESC LIMIT 2) i),
    (SELECT string_agg(route, ', ' ORDER BY rtcnt DESC) FROM (SELECT route, count(*) AS rtcnt FROM base WHERE sig = a.sig GROUP BY route ORDER BY rtcnt DESC LIMIT 2) rt)
  FROM agg a;
END;
$$;

CREATE OR REPLACE FUNCTION bty_issue_code_frequency(days_back INTEGER DEFAULT 7)
RETURNS TABLE (issue_code TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT u.code::TEXT, count(*)::BIGINT FROM bty_quality_events q, unnest(q.issues) AS u(code)
  WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY u.code ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION bty_severity_distribution(days_back INTEGER DEFAULT 7)
RETURNS TABLE (severity TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT q.severity::TEXT, count(*)::BIGINT FROM bty_quality_events q
  WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY q.severity ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION bty_daily_trend_top_signatures(days_back INTEGER DEFAULT 14, top_n INTEGER DEFAULT 5)
RETURNS TABLE (day DATE, issues_signature TEXT, count BIGINT, rank_in_day INTEGER) LANGUAGE plpgsql AS $$
DECLARE top_sigs TEXT[];
BEGIN
  SELECT array_agg(sig ORDER BY cnt DESC) INTO top_sigs
  FROM (SELECT bty_issues_signature(q.issues) AS sig, count(*) AS cnt FROM bty_quality_events q
        WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
        GROUP BY bty_issues_signature(q.issues) ORDER BY cnt DESC LIMIT top_n) t;
  IF top_sigs IS NULL OR array_length(top_sigs, 1) IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH daily_base AS (
    SELECT q.timestamp::DATE AS d, bty_issues_signature(q.issues) AS sig, count(*)::BIGINT AS cnt
    FROM bty_quality_events q
    WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL AND bty_issues_signature(q.issues) = ANY(top_sigs)
    GROUP BY q.timestamp::DATE, bty_issues_signature(q.issues)
  )
  SELECT db.d, db.sig, db.cnt, row_number() OVER (PARTITION BY db.d ORDER BY db.cnt DESC)::INTEGER
  FROM daily_base db ORDER BY db.d DESC, db.cnt DESC;
END;
$$;

CREATE OR REPLACE FUNCTION bty_issue_code_frequency_with_severity(days_back INTEGER DEFAULT 7)
RETURNS TABLE (issue_code TEXT, count BIGINT, high_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT u.code::TEXT, count(*)::BIGINT, count(*) FILTER (WHERE q.severity = 'high')::BIGINT
  FROM bty_quality_events q, unnest(q.issues) AS u(code)
  WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY u.code ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION bty_quality_summary_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (total_events BIGINT, avg_css NUMERIC, severity_low BIGINT, severity_medium BIGINT, severity_high BIGINT) LANGUAGE sql STABLE AS $$
  SELECT count(*)::BIGINT, round(avg(q.css_score)::NUMERIC, 2),
    count(*) FILTER (WHERE q.severity = 'low')::BIGINT,
    count(*) FILTER (WHERE q.severity = 'medium')::BIGINT,
    count(*) FILTER (WHERE q.severity = 'high')::BIGINT
  FROM bty_quality_events q WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL;
$$;

CREATE OR REPLACE FUNCTION bty_quality_breakdown(days_back INTEGER DEFAULT 7)
RETURNS TABLE (dimension TEXT, value TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  (SELECT 'role'::TEXT, role::TEXT, count(*)::BIGINT FROM bty_quality_events q WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY role ORDER BY count(*) DESC LIMIT 5)
  UNION ALL (SELECT 'route'::TEXT, route::TEXT, count(*)::BIGINT FROM bty_quality_events q WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY route ORDER BY count(*) DESC LIMIT 5)
  UNION ALL (SELECT 'intent'::TEXT, intent::TEXT, count(*)::BIGINT FROM bty_quality_events q WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY intent ORDER BY count(*) DESC LIMIT 5);
$$;
