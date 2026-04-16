import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#f5e8d4] via-[#e8d5b8] to-[#d4b896] px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[#2a2418] sm:text-6xl">
          L'application qui rapproche votre commune et ses habitants
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#5a4d36]">
          Une plateforme simple pour communiquer, organiser, et faire vivre votre village.
          Pensée pour les petites communes rurales.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/auth/register-commune"
            className="inline-flex items-center justify-center rounded-lg bg-[#2a2418] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#3a3225]"
          >
            Inscrire ma commune
          </Link>
          <Link
            href="#communes"
            className="inline-flex items-center justify-center rounded-lg border border-[#2a2418] bg-white/60 px-6 py-3 text-base font-semibold text-[#2a2418] transition-colors hover:bg-white"
          >
            Trouver ma commune
          </Link>
        </div>
      </div>
    </section>
  );
}
