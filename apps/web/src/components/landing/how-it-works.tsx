import Link from "next/link";

export function HowItWorks() {
  return (
    <section className="bg-[#faf6ee] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold text-[#2a2418]">Comment ça marche</h2>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-[#2a2418]">Pour la mairie</h3>
            <ol className="mt-4 space-y-3 text-sm text-[#5a4d36]">
              <li><span className="font-semibold text-[#2a2418]">1.</span> S'inscrire sur la plateforme avec les infos de la commune.</li>
              <li><span className="font-semibold text-[#2a2418]">2.</span> Validation par notre équipe sous 48h.</li>
              <li><span className="font-semibold text-[#2a2418]">3.</span> Publier annonces, événements, et inviter les habitants avec un code.</li>
            </ol>
            <Link
              href="/auth/register-commune"
              className="mt-6 inline-flex items-center text-sm font-semibold text-[#2a2418] underline"
            >
              Inscrire ma commune →
            </Link>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#2a2418]">Pour les habitants</h3>
            <ol className="mt-4 space-y-3 text-sm text-[#5a4d36]">
              <li><span className="font-semibold text-[#2a2418]">1.</span> Télécharger l'application mobile.</li>
              <li><span className="font-semibold text-[#2a2418]">2.</span> Saisir le code d'invitation fourni par la mairie.</li>
            </ol>
            <p className="mt-6 text-sm italic text-[#7a6d56]">App Store et Play Store — bientôt disponibles.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
