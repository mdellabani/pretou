import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function CommunesGrid() {
  const supabase = await createClient();
  const { data: communes } = await supabase
    .from("communes")
    .select("name, slug, code_postal")
    .order("created_at", { ascending: false })
    .limit(24);

  if (!communes || communes.length === 0) return null;

  return (
    <section id="communes" className="bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold text-[#2a2418]">Communes déjà sur la plateforme</h2>
        <p className="mt-2 text-center text-sm text-[#5a4d36]">
          Cliquez pour visiter le site public de chaque commune.
        </p>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {communes.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="block rounded-lg border border-[#f0e8da] bg-[#faf6ee] px-4 py-3 text-center text-sm transition-colors hover:bg-[#f0e8da]"
              >
                <div className="font-semibold text-[#2a2418]">{c.name}</div>
                {c.code_postal && (
                  <div className="text-xs text-[#7a6d56]">{c.code_postal}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
