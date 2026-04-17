import { NavBar } from "@/components/nav-bar";
import { QueryProvider } from "@/components/providers/query-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen bg-[var(--theme-background)]">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
