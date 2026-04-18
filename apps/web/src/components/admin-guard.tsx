"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/hooks/use-profile";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) router.replace("/app/feed");
  }, [loading, isAdmin, router]);

  if (loading || !profile || !isAdmin) return null;
  return <>{children}</>;
}
