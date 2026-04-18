import { NavBar } from "@/components/nav-bar";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthedThemeInjector } from "@/components/authed-theme-injector";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthedThemeInjector />
      <div className="min-h-screen bg-[var(--theme-background)]">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
