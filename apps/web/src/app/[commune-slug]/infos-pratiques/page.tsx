import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCommuneBySlug } from "@rural-community-platform/shared";

type Props = {
  params: Promise<{ "commune-slug": string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "commune-slug": slug } = await params;
  const supabase = await createClient();
  const { data: commune } = await getCommuneBySlug(supabase, slug);

  return {
    title: commune ? `Infos pratiques — ${commune.name}` : "Infos pratiques",
  };
}

interface InfosPratiques {
  horaires?: string;
  contact?: string;
  services?: string;
  associations?: string;
  liens?: string;
}

const SECTION_LABELS: Record<keyof InfosPratiques, string> = {
  horaires: "Horaires",
  contact: "Contact",
  services: "Services",
  associations: "Associations",
  liens: "Liens utiles",
};

const SECTION_ORDER: (keyof InfosPratiques)[] = [
  "horaires",
  "contact",
  "services",
  "associations",
  "liens",
];

export default async function InfosPratiquesPage({ params }: Props) {
  const { "commune-slug": slug } = await params;

  const supabase = await createClient();
  const { data: commune } = await getCommuneBySlug(supabase, slug);

  if (!commune) {
    notFound();
  }

  const infos = (commune.infos_pratiques ?? {}) as InfosPratiques;
  const sections = SECTION_ORDER.filter(
    (key) => infos[key] && infos[key]!.trim().length > 0
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        Infos pratiques
      </h1>

      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((key) => (
            <section
              key={key}
              className="rounded-[14px] bg-white p-5 shadow-[0_1px_6px_rgba(160,130,90,0.06)]"
            >
              <h2
                className="mb-3 text-lg font-semibold"
                style={{ color: "var(--theme-primary)" }}
              >
                {SECTION_LABELS[key]}
              </h2>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]/80">
                {infos[key]}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          Aucune information pratique disponible pour le moment.
        </p>
      )}
    </div>
  );
}
