export const SUPER_ADMIN_EMAILS = ["mdellabani@gmail.com"];

export function isSuperAdmin(email: string | undefined | null): boolean {
  return SUPER_ADMIN_EMAILS.includes(email ?? "");
}
