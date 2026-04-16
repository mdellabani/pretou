import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#2a2418] px-6 py-10 text-center text-sm text-white/70">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/auth/login" className="hover:text-white">Se connecter</Link>
          <Link href="/auth/register-commune" className="hover:text-white">Inscrire ma commune</Link>
          <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
        </div>
        <p className="mt-6 text-xs text-white/50">© {new Date().getFullYear()} Ma Commune. Fait avec soin pour la France rurale.</p>
      </div>
    </footer>
  );
}
