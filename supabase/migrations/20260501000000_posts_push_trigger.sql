-- Hook posts INSERT into the push-notification edge function so admin
-- annonces and evenements fan out to the commune. Mirrors the messaging
-- pattern (`invoke_notify_new_message` + `messages_notify_after_insert`):
-- a SECURITY DEFINER trigger reads the runtime_config endpoint and calls
-- the edge function via net.http_post. The edge function itself handles
-- type filtering (annonce/evenement only), commune scope, and author
-- exclusion, so the trigger fires on every post and does no logic.

CREATE OR REPLACE FUNCTION public.invoke_push_notification()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT value INTO v_url FROM public.runtime_config WHERE key = 'functions_url';
  IF v_url IS NULL OR v_url = '' THEN
    RETURN NEW;
  END IF;
  SELECT value INTO v_key FROM public.runtime_config WHERE key = 'service_role_key';
  PERFORM net.http_post(
    url := v_url || '/push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'posts',
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.invoke_push_notification() OWNER TO "postgres";

DROP TRIGGER IF EXISTS posts_notify_after_insert ON public.posts;
CREATE TRIGGER posts_notify_after_insert
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.invoke_push_notification();
