"use client";

import { useProfile } from "@/hooks/use-profile";
import { ThemeInjector } from "@/components/theme-injector";

export function AuthedThemeInjector() {
  const { profile } = useProfile();
  return (
    <ThemeInjector
      theme={profile?.communes?.theme}
      customPrimaryColor={profile?.communes?.custom_primary_color}
    />
  );
}
