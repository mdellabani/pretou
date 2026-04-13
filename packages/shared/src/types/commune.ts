import type { Database } from "./database";
import type { ThemeSlug } from "../constants/themes";

export type Commune = Database["public"]["Tables"]["communes"]["Row"];
export type EPCI = Database["public"]["Tables"]["epci"]["Row"];

export type CommuneWithDesign = Commune & {
  theme: ThemeSlug;
  motto: string | null;
  hero_image_url: string | null;
  description: string | null;
  blason_url: string | null;
  infos_pratiques: Record<string, string>;
};
