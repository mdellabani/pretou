import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SUPER_ADMIN_EMAILS } from "@/lib/super-admin";
import { SuperAdminDashboard } from "./dashboard";

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? "")) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Gestion des communes et inscriptions</p>
        </div>
        <SuperAdminDashboard />
      </div>
    </div>
  );
}
