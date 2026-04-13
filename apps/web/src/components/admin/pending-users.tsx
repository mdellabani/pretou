"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { approveUserAction, rejectUserAction } from "@/app/admin/dashboard/actions";

interface PendingUser {
  id: string;
  display_name: string;
  created_at: string;
}

interface PendingUsersProps {
  users: PendingUser[];
}

export function PendingUsers({ users }: PendingUsersProps) {
  const router = useRouter();

  async function handleApprove(userId: string) {
    await approveUserAction(userId);
    router.refresh();
  }

  async function handleReject(userId: string) {
    await rejectUserAction(userId);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inscriptions en attente ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune inscription en attente.
          </p>
        ) : (
          <ul className="space-y-3">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-4 rounded-md border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{user.display_name}</p>
                  <p className="text-muted-foreground text-sm">
                    {new Date(user.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(user.id)}>
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(user.id)}
                  >
                    Refuser
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
