import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CommunesGrid } from "@/components/landing/communes-grid";
import { Footer } from "@/components/landing/footer";

export const revalidate = 3600;

export const metadata = {
  title: "Ma Commune — L'application des villages",
  description:
    "Une plateforme simple pour les petites communes rurales : annonces de la mairie, agenda local, entraide entre voisins. Pour les mairies et les habitants.",
};

export default function Home() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <CommunesGrid />
      <Footer />
    </main>
  );
}
