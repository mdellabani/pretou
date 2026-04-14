"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  promoteModerator,
  demoteModerator,
} from "@/app/admin/dashboard/actions";
import { Shield, X } from "lucide-react";

interface CommuneMember {
  id: string;
  display_name: string;
  role: "admin" | "moderator" | "resident";
  status: "active" | "pending" | "rejected";
  created_at: string;
}

interface CommuneMembersProps {
  members: CommuneMember[];
}

export function CommuneMembers({ members }: CommuneMembersProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const activeMembers = members.filter((m) => m.status === "active");
  const residentCount = activeMembers.filter((m) => m.role === "resident").length;
  const moderatorCount = activeMembers.filter((m) => m.role === "moderator").length;

  async function handlePromoteToModerator(userId: string) {
    setLoading(userId);
    await promoteModerator(userId);
    router.refresh();
    setLoading(null);
  }

  async function handleDemote(userId: string) {
    setLoading(userId);
    await demoteModerator(userId);
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="rounded-[14px] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)]">
      <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">
        Membres actifs ({activeMembers.length}) — {residentCount} résident{residentCount !== 1 ? "s" : ""}, {moderatorCount} modérateur{moderatorCount !== 1 ? "s" : ""}
      </h2>

      {activeMembers.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Aucun membre actif.
        </p>
      ) : (
        <div className="space-y-2">
          {activeMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] px-4 py-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--foreground)]">
                    {member.display_name}
                  </p>
                  {member.role === "moderator" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                      <Shield size={12} />
                      Modérateur
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(member.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex gap-2">
                {member.role === "resident" ? (
                  <button
                    onClick={() => handlePromoteToModerator(member.id)}
                    disabled={loading === member.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50"
                    aria-label="Promouvoir modérateur"
                    title="Promouvoir modérateur"
                  >
                    <Shield size={16} />
                  </button>
                ) : member.role === "moderator" ? (
                  <button
                    onClick={() => handleDemote(member.id)}
                    disabled={loading === member.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 transition-colors hover:bg-yellow-100 disabled:opacity-50"
                    aria-label="Retirer modérateur"
                    title="Retirer modérateur"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
