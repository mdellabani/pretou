-- Used by integration tests to TRUNCATE/seed between describe blocks.
-- SECURITY DEFINER + service-role-only execution permission means it
-- can't be abused by app users (anon/authenticated have no EXECUTE).
CREATE OR REPLACE FUNCTION "public"."exec_sql"(sql text) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET "search_path" TO 'public', 'pg_temp'
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

REVOKE ALL ON FUNCTION "public"."exec_sql"(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."exec_sql"(text) TO service_role;
