-- Admins must be able to update their own commune's settings (theme,
-- custom_primary_color, logo_url, contact fields, opening_hours,
-- associations, custom_domain, etc.). The original schema only had
-- SELECT policies, so RLS silently dropped all UPDATEs from the app.

CREATE POLICY "Admins can update own commune" ON "public"."communes"
  FOR UPDATE TO "authenticated"
  USING (
    "id" = "public"."auth_commune_id"()
    AND "public"."is_commune_admin"()
  )
  WITH CHECK (
    "id" = "public"."auth_commune_id"()
    AND "public"."is_commune_admin"()
  );
