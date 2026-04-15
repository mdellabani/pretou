import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@rural-community-platform/shared";
import { ThemeInjector } from "@/components/theme-injector";
import { HomepageEditor } from "./homepage-editor";

export default async function AdminHomepagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile || profile.role !== "admin") redirect("/app/feed");

  const { data: sections } = await supabase
    .from("page_sections")
    .select("id, section_type, visible, sort_order, content")
    .eq("commune_id", profile.commune_id)
    .eq("page", "homepage")
    .order("sort_order", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <ThemeInjector theme={profile.communes?.theme} customPrimaryColor={profile.communes?.custom_primary_color} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Éditeur de page d'accueil</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Personnalisez les sections de votre site communal</p>
        </div>
        <a href="/admin/dashboard" className="text-sm underline" style={{ color: "var(--theme-primary)" }}>
          ← Retour au tableau de bord
        </a>
      </div>
      <HomepageEditor initialSections={(sections ?? []) as any[]} />
    </div>
  );
}
