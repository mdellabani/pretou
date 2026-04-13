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
    title: commune ? `Evenements — ${commune.name}` : "Evenements",
  };
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEventTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EvenementsPage({ params }: Props) {
  const { "commune-slug": slug } = await params;

  const supabase = await createClient();
  const { data: commune } = await getCommuneBySlug(supabase, slug);

  if (!commune) {
    notFound();
  }

  const now = new Date().toISOString();

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, body, event_date, event_location, created_at")
      .eq("commune_id", commune.id)
      .eq("type", "evenement")
      .gte("event_date", now)
      .order("event_date", { ascending: true }),
    supabase
      .from("posts")
      .select("id, title, body, event_date, event_location, created_at")
      .eq("commune_id", commune.id)
      .eq("type", "evenement")
      .lt("event_date", now)
      .order("event_date", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        Evenements a {commune.name}
      </h1>

      {/* Upcoming events */}
      <section>
        <h2
          className="mb-4 border-b-2 pb-2 text-xl font-semibold"
          style={{ borderColor: "var(--theme-primary)", color: "var(--foreground)" }}
        >
          A venir
        </h2>
        {upcoming && upcoming.length > 0 ? (
          <div className="space-y-4">
            {upcoming.map((event) => (
              <article
                key={event.id}
                className="rounded-[14px] bg-white p-5 shadow-[0_1px_6px_rgba(160,130,90,0.06)]"
              >
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {event.title}
                </h3>
                {event.event_date && (
                  <div className="mt-2 flex flex-col gap-0.5 text-sm text-[var(--muted-foreground)]">
                    <time dateTime={event.event_date} className="font-medium">
                      {formatEventDate(event.event_date)} a{" "}
                      {formatEventTime(event.event_date)}
                    </time>
                    {event.event_location && (
                      <p>{event.event_location}</p>
                    )}
                  </div>
                )}
                {event.body && (
                  <p className="mt-3 whitespace-pre-line text-sm text-[var(--foreground)]/80">
                    {event.body}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Aucun evenement a venir pour le moment.
          </p>
        )}
      </section>

      {/* Past events */}
      {past && past.length > 0 && (
        <section>
          <h2
            className="mb-4 border-b-2 pb-2 text-xl font-semibold"
            style={{ borderColor: "var(--theme-muted)", color: "var(--foreground)" }}
          >
            Evenements passes
          </h2>
          <div className="space-y-4">
            {past.map((event) => (
              <article
                key={event.id}
                className="rounded-[14px] bg-white p-5 opacity-60 shadow-[0_1px_6px_rgba(160,130,90,0.06)]"
              >
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {event.title}
                </h3>
                {event.event_date && (
                  <div className="mt-2 flex flex-col gap-0.5 text-sm text-[var(--muted-foreground)]">
                    <time dateTime={event.event_date}>
                      {formatEventDate(event.event_date)}
                    </time>
                    {event.event_location && (
                      <p>{event.event_location}</p>
                    )}
                  </div>
                )}
                {event.body && (
                  <p className="mt-3 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                    {event.body}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
