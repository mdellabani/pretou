import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@rural-community-platform/shared";
import { ThemeInjector } from "@/components/theme-injector";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  const { data: commune } = await supabase
    .from("communes")
    .select("name, theme")
    .eq("id", profile.commune_id)
    .single();

  return (
    <div className="space-y-6">
      <ThemeInjector theme={commune?.theme} />

      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        Paramètres du compte
      </h1>

      {/* User info card */}
      <div className="rounded-[14px] border border-[#f0e8da] bg-white p-5 shadow-[0_2px_8px_rgba(140,120,80,0.08)]">
        <h2
          className="mb-4 text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--theme-primary)" }}
        >
          Informations du compte
        </h2>
        <dl className="space-y-3">
          <div className="flex items-center gap-3">
            <dt className="w-32 text-sm text-[var(--muted-foreground)]">
              E-mail
            </dt>
            <dd className="text-sm font-medium text-[var(--foreground)]">
              {user.email}
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="w-32 text-sm text-[var(--muted-foreground)]">
              Commune
            </dt>
            <dd className="text-sm font-medium text-[var(--foreground)]">
              {commune?.name ?? "—"}
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="w-32 text-sm text-[var(--muted-foreground)]">
              Rôle
            </dt>
            <dd className="text-sm font-medium text-[var(--foreground)]">
              {profile.role === "admin" ? "Administrateur" : "Résident"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Edit form */}
      <SettingsForm
        userId={profile.id}
        initialDisplayName={profile.display_name ?? ""}
      />
    </div>
  );
}
