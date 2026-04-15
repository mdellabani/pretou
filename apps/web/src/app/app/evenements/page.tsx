import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@rural-community-platform/shared";
import { ThemeInjector } from "@/components/theme-injector";
import { EventsContent } from "./events-content";

export default async function EvenementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  // Fetch all events for the commune
  const { data: events } = await supabase
    .from("posts")
    .select(
      "id, title, body, type, event_date, event_location, created_at, profiles!author_id(display_name), rsvps(status)"
    )
    .eq("commune_id", profile.commune_id)
    .eq("type", "evenement")
    .order("event_date", { ascending: true, nullsFirst: false });

  return (
    <div className="space-y-4">
      <ThemeInjector theme={profile.communes?.theme} customPrimaryColor={profile.communes?.custom_primary_color} />

      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Événements</h1>

      <EventsContent
        events={
          (events ?? []).map((e) => ({
            id: e.id,
            title: e.title,
            body: e.body,
            type: e.type,
            event_date: e.event_date,
            event_location: e.event_location,
            created_at: e.created_at,
            profiles: Array.isArray(e.profiles) ? e.profiles[0] ?? null : e.profiles,
            rsvps: (e.rsvps ?? []) as { status: string }[],
          }))
        }
      />
    </div>
  );
}
