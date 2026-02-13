-- Quality Events aggregation: views and functions for weekly rule patching analytics
-- issues_signature = array_to_string(array_sort(issues), '|') via unnest+string_agg

-- Helper: canonical signature from issues array (sorted, pipe-separated)
CREATE OR REPLACE FUNCTION bty_issues_signature(issues_arr TEXT[])
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT COALESCE(
    (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(issues_arr) x),
    ''
  );
$$;

-- 1) Top 10 issue patterns with top roles, intents, routes
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
    SELECT
      bty_issues_signature(q.issues) AS sig,
      q.role,
      q.intent,
      q.route,
      q.severity,
      q.css_score
    FROM bty_quality_events q
    WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
  ),
  agg AS (
    SELECT
      b.sig,
      count(*)::BIGINT AS cnt,
      count(*) FILTER (WHERE b.severity = 'high')::BIGINT AS high_cnt,
      avg(b.css_score) AS avg_css
    FROM base b
    GROUP BY b.sig
    ORDER BY cnt DESC
    LIMIT 10
  )
  SELECT
    a.sig AS issues_signature,
    a.cnt AS count,
    a.high_cnt AS high_severity_count,
    round(a.avg_css::NUMERIC, 2) AS avg_css,
    (SELECT string_agg(role, ', ' ORDER BY rcnt DESC)
     FROM (SELECT role, count(*) AS rcnt FROM base WHERE sig = a.sig GROUP BY role ORDER BY rcnt DESC LIMIT 2) r) AS top_roles,
    (SELECT string_agg(intent, ', ' ORDER BY icnt DESC)
     FROM (SELECT intent, count(*) AS icnt FROM base WHERE sig = a.sig GROUP BY intent ORDER BY icnt DESC LIMIT 2) i) AS top_intents,
    (SELECT string_agg(route, ', ' ORDER BY rtcnt DESC)
     FROM (SELECT route, count(*) AS rtcnt FROM base WHERE sig = a.sig GROUP BY route ORDER BY rtcnt DESC LIMIT 2) rt) AS top_routes
  FROM agg a;
END;
$$;

-- 2) Issue code frequency (unnest single issues)
CREATE OR REPLACE FUNCTION bty_issue_code_frequency(days_back INTEGER DEFAULT 7)
RETURNS TABLE (issue_code TEXT, count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT u.code::TEXT AS issue_code, count(*)::BIGINT
  FROM bty_quality_events q,
       unnest(q.issues) AS u(code)
  WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
  GROUP BY u.code
  ORDER BY count(*) DESC;
$$;

-- 3) Severity distribution
CREATE OR REPLACE FUNCTION bty_severity_distribution(days_back INTEGER DEFAULT 7)
RETURNS TABLE (severity TEXT, count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT q.severity::TEXT, count(*)::BIGINT
  FROM bty_quality_events q
  WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
  GROUP BY q.severity
  ORDER BY count(*) DESC;
$$;

-- 4) Daily trend for top 5 signatures (last 14 days)
CREATE OR REPLACE FUNCTION bty_daily_trend_top_signatures(days_back INTEGER DEFAULT 14, top_n INTEGER DEFAULT 5)
RETURNS TABLE (
  day DATE,
  issues_signature TEXT,
  count BIGINT,
  rank_in_day INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
  top_sigs TEXT[];
BEGIN
  -- Get top N signatures overall in the window
  SELECT array_agg(sig ORDER BY cnt DESC)
  INTO top_sigs
  FROM (
    SELECT bty_issues_signature(q.issues) AS sig, count(*) AS cnt
    FROM bty_quality_events q
    WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
    GROUP BY bty_issues_signature(q.issues)
    ORDER BY cnt DESC
    LIMIT top_n
  ) t;

  IF top_sigs IS NULL OR array_length(top_sigs, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH daily_base AS (
    SELECT
      q.timestamp::DATE AS d,
      bty_issues_signature(q.issues) AS sig,
      count(*)::BIGINT AS cnt
    FROM bty_quality_events q
    WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
      AND bty_issues_signature(q.issues) = ANY(top_sigs)
    GROUP BY q.timestamp::DATE, bty_issues_signature(q.issues)
  )
  SELECT
    db.d AS day,
    db.sig AS issues_signature,
    db.cnt AS count,
    row_number() OVER (PARTITION BY db.d ORDER BY db.cnt DESC)::INTEGER AS rank_in_day
  FROM daily_base db
  ORDER BY db.d DESC, db.cnt DESC;
END;
$$;

-- 5) Issue code frequency with high_ratio
CREATE OR REPLACE FUNCTION bty_issue_code_frequency_with_severity(days_back INTEGER DEFAULT 7)
RETURNS TABLE (issue_code TEXT, count BIGINT, high_count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT u.code::TEXT, count(*)::BIGINT, count(*) FILTER (WHERE q.severity = 'high')::BIGINT
  FROM bty_quality_events q, unnest(q.issues) AS u(code)
  WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL
  GROUP BY u.code
  ORDER BY count(*) DESC;
$$;

-- 6) Summary stats: total_events, avg_css
CREATE OR REPLACE FUNCTION bty_quality_summary_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (total_events BIGINT, avg_css NUMERIC, severity_low BIGINT, severity_medium BIGINT, severity_high BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT
    count(*)::BIGINT,
    round(avg(q.css_score)::NUMERIC, 2),
    count(*) FILTER (WHERE q.severity = 'low')::BIGINT,
    count(*) FILTER (WHERE q.severity = 'medium')::BIGINT,
    count(*) FILTER (WHERE q.severity = 'high')::BIGINT
  FROM bty_quality_events q
  WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL;
$$;

-- 7) Breakdown top 5 by role, route, intent
CREATE OR REPLACE FUNCTION bty_quality_breakdown(days_back INTEGER DEFAULT 7)
RETURNS TABLE (dimension TEXT, value TEXT, count BIGINT)
LANGUAGE sql STABLE AS $$
  (SELECT 'role'::TEXT, role::TEXT, count(*)::BIGINT FROM bty_quality_events q
   WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY role ORDER BY count(*) DESC LIMIT 5)
  UNION ALL
  (SELECT 'route'::TEXT, route::TEXT, count(*)::BIGINT FROM bty_quality_events q
   WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY route ORDER BY count(*) DESC LIMIT 5)
  UNION ALL
  (SELECT 'intent'::TEXT, intent::TEXT, count(*)::BIGINT FROM bty_quality_events q
   WHERE q.timestamp >= now() - (days_back || ' days')::INTERVAL GROUP BY intent ORDER BY count(*) DESC LIMIT 5);
$$;
