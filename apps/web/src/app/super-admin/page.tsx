import { SuperAdminDashboard } from "./dashboard";

export default function SuperAdminPage() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Gestion des communes</h1>
          <p className="text-sm text-muted-foreground">
            Inscriptions en attente et communes actives
          </p>
        </div>
        <SuperAdminDashboard />
      </div>
    </div>
  );
}
