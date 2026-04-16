const mairieFeatures = [
  { title: "Gain de temps", desc: "Une seule publication apparaît sur l'app, le site, et notifie les habitants." },
  { title: "Communication moderne", desc: "Touchez tous vos administrés, pas seulement ceux qui passent devant la mairie." },
  { title: "Simple et abordable", desc: "Pensé pour des secrétaires de mairie qui travaillent 2 jours par semaine." },
];

const residentFeatures = [
  { title: "Annonces officielles", desc: "Recevez les informations de votre mairie directement sur votre téléphone." },
  { title: "Entraide locale", desc: "Demandez un coup de main, prêtez des outils, partagez vos surplus du jardin." },
  { title: "Agenda du village", desc: "Tous les événements, le marché, le conseil municipal, en un coup d'œil." },
];

export function Features() {
  return (
    <section className="bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-[#2a2418]">Pour les mairies</h2>
            <ul className="mt-6 space-y-4">
              {mairieFeatures.map((f) => (
                <li key={f.title}>
                  <h3 className="font-semibold text-[#2a2418]">{f.title}</h3>
                  <p className="mt-1 text-sm text-[#5a4d36]">{f.desc}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#2a2418]">Pour les habitants</h2>
            <ul className="mt-6 space-y-4">
              {residentFeatures.map((f) => (
                <li key={f.title}>
                  <h3 className="font-semibold text-[#2a2418]">{f.title}</h3>
                  <p className="mt-1 text-sm text-[#5a4d36]">{f.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
