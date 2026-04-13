import Link from "next/link";
import { PostTypeBadge } from "@/components/post-type-badge";
import type { Post, PostType } from "@rural-community-platform/shared";
import { Pin, MessageCircle } from "lucide-react";

export function PostCard({ post }: { post: Post }) {
  const commentCount = post.comments?.[0]?.count ?? 0;
  const rsvpCount =
    post.rsvps?.filter((r) => r.status === "going").length ?? 0;

  return (
    <Link href={`/app/posts/${post.id}`}>
      <div className="relative bg-white rounded-[14px] shadow-[0_1px_6px_rgba(160,130,90,0.06)] transition-shadow hover:shadow-[0_2px_12px_rgba(160,130,90,0.12)] overflow-hidden">
        {/* Pinned gradient accent bar */}
        {post.is_pinned && (
          <div
            className="h-[2.5px]"
            style={{
              background:
                "linear-gradient(90deg, var(--theme-gradient-1), var(--theme-gradient-2), var(--theme-gradient-3))",
            }}
          />
        )}

        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <PostTypeBadge type={post.type as PostType} />
                {post.is_pinned && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: "var(--theme-primary)" }}
                  >
                    <Pin size={12} />
                    Epingle
                  </span>
                )}
              </div>
              <h3 className="font-semibold leading-tight text-[var(--foreground)]">
                {post.title}
              </h3>
            </div>
          </div>

          <p className="mt-2 line-clamp-3 text-sm text-[var(--muted-foreground)]">
            {post.body}
          </p>

          <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
            <span>{post.profiles?.display_name}</span>
            <span>
              {new Date(post.created_at).toLocaleDateString("fr-FR")}
            </span>
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={12} />
                {commentCount} commentaire{commentCount > 1 ? "s" : ""}
              </span>
            )}
            {post.type === "evenement" && rsvpCount > 0 && (
              <span>
                {rsvpCount} participant{rsvpCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
