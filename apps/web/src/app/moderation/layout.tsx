import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@rural-community-platform/shared";

export default async function ModerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (
    !profile ||
    (profile.role !== "moderator" && profile.role !== "admin")
  ) {
    redirect("/app/feed");
  }

  return <>{children}</>;
}
