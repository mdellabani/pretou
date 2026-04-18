import { EventsClient } from "./events-client";

export default function EvenementsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Événements</h1>
      <div className="mt-4">
        <EventsClient />
      </div>
    </>
  );
}
