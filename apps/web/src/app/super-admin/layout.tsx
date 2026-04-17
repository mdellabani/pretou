import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SUPER_ADMIN_EMAILS } from "@/lib/super-admin";
import { signOutAction } from "./signout-action";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? "")) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">Super Admin</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-600">{user.email}</span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
