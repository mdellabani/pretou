export const PRODUCER_CATEGORIES = [
  { value: "legumes", label: "Légumes" },
  { value: "fruits", label: "Fruits" },
  { value: "fromages", label: "Fromages" },
  { value: "miel", label: "Miel" },
  { value: "pain", label: "Pain" },
  { value: "viande", label: "Viande" },
  { value: "oeufs", label: "Œufs" },
  { value: "paniers", label: "Paniers / AMAP" },
  { value: "vin", label: "Vin" },
  { value: "conserves", label: "Conserves" },
  { value: "autre", label: "Autre" },
] as const;

export type ProducerCategory = (typeof PRODUCER_CATEGORIES)[number]["value"];
