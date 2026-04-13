"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostTypeBadge } from "@/components/post-type-badge";
import { togglePinAction, deletePostAction } from "@/app/admin/dashboard/actions";
import type { PostType } from "@rural-community-platform/shared";

interface PostItem {
  id: string;
  title: string;
  type: PostType;
  is_pinned: boolean;
  created_at: string;
  profiles: { display_name: string } | null;
}

interface PostManagementProps {
  posts: PostItem[];
}

export function PostManagement({ posts }: PostManagementProps) {
  const router = useRouter();

  async function handleTogglePin(postId: string, isPinned: boolean) {
    await togglePinAction(postId, isPinned);
    router.refresh();
  }

  async function handleDelete(postId: string) {
    if (!confirm("Supprimer cette publication ? Cette action est irréversible.")) return;
    await deletePostAction(postId);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publications ({posts.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune publication.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex items-center justify-between gap-4 rounded-md border px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <PostTypeBadge type={post.type} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{post.title}</p>
                    <p className="text-muted-foreground text-sm">
                      {post.profiles?.display_name ?? "Inconnu"} &middot;{" "}
                      {new Date(post.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant={post.is_pinned ? "secondary" : "outline"}
                    onClick={() => handleTogglePin(post.id, post.is_pinned)}
                  >
                    {post.is_pinned ? "Désépingler" : "Épingler"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(post.id)}
                  >
                    Supprimer
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
