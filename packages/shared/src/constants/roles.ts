import type { Role } from "../types";

export const ROLE_LABELS: Record<Role, string> = {
  resident: "Résident",
  moderator: "Modérateur",
  admin: "Administrateur",
  epci_admin: "Admin EPCI",
};

export const ADMIN_ROLES: Role[] = ["admin", "epci_admin"];
export const MODERATOR_ROLES: Role[] = ["moderator", "admin", "epci_admin"];
