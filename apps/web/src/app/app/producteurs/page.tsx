import { ProducersClient } from "./producers-client";

export default function ProducteursPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Producteurs locaux</h1>
      <div className="mt-4">
        <ProducersClient />
      </div>
    </>
  );
}
