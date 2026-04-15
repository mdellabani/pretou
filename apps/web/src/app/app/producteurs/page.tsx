import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@rural-community-platform/shared";
import { ThemeInjector } from "@/components/theme-injector";
import { ProducersContent } from "./producers-content";
import type { Producer } from "@rural-community-platform/shared";

export default async function ProducteursPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  // Fetch active producers for the commune
  const { data: producers } = await supabase
    .from("producers")
    .select("*, communes(name), profiles!created_by(display_name)")
    .eq("status", "active")
    .eq("commune_id", profile.commune_id)
    .order("name", { ascending: true });

  return (
    <div className="space-y-4">
      <ThemeInjector theme={profile.communes?.theme} customPrimaryColor={profile.communes?.custom_primary_color} />
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Producteurs locaux</h1>
      <ProducersContent producers={(producers ?? []) as Producer[]} />
    </div>
  );
}
