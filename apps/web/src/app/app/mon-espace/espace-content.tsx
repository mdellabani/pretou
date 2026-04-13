"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, CalendarDays, MapPin } from "lucide-react";
import { PostTypeBadge } from "@/components/post-type-badge";
import type { PostType } from "@rural-community-platform/shared";
import { deletePostAction } from "@/app/app/posts/[id]/actions";

type Tab = "posts" | "comments" | "rsvps";

interface MyPost {
  id: string;
  title: string;
  type: string;
  created_at: string;
  is_pinned: boolean;
  comment_count: number;
}

interface MyComment {
  id: string;
  body: string;
  created_at: string;
  post_id: string;
  post_title: string;
  post_type: string;
}

interface MyRsvp {
  status: string;
  post_id: string;
  post_title: string;
  post_type: string;
  event_date: string | null;
  event_location: string | null;
}

interface EspaceContentProps {
  myPosts: MyPost[];
  myComments: MyComment[];
  myRsvps: MyRsvp[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: "posts", label: "Mes publications" },
  { key: "comments", label: "Mes commentaires" },
  { key: "rsvps", label: "Mes inscriptions" },
];

const RSVP_LABELS: Record<string, string> = {
  going: "Participe",
  maybe: "Peut-être",
  not_going: "Ne participe pas",
};

export function EspaceContent({ myPosts, myComments, myRsvps }: EspaceContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  async function handleDeletePost(postId: string) {
    if (!confirm("Supprimer cette publication ? Cette action est irréversible.")) return;
    await deletePostAction(postId);
  }

  return (
    <div className="space-y-6">
      {/* Tab pills */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-white"
                : "bg-white text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            style={
              activeTab === tab.key
                ? { backgroundColor: "var(--theme-primary)" }
                : undefined
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* My posts */}
      {activeTab === "posts" && (
        <div className="space-y-3">
          {myPosts.length > 0 ? (
            myPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between rounded-[14px] border border-[#f0e8da] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)]"
              >
                <Link href={`/app/posts/${post.id}`} className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-tight text-[var(--foreground)]">
                      {post.title}
                    </h3>
                    <div className="shrink-0">
                      <PostTypeBadge type={post.type as PostType} />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>
                      {new Date(post.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {post.comment_count > 0 && (
                      <>
                        <span>·</span>
                        <span>{post.comment_count} commentaire{post.comment_count > 1 ? "s" : ""}</span>
                      </>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="ml-4 shrink-0 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                >
                  <Trash2 size={13} />
                  Supprimer
                </button>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-[var(--muted-foreground)]">
              Vous n'avez pas encore publié.
            </p>
          )}
        </div>
      )}

      {/* My comments */}
      {activeTab === "comments" && (
        <div className="space-y-3">
          {myComments.length > 0 ? (
            myComments.map((comment) => (
              <Link
                key={comment.id}
                href={`/app/posts/${comment.post_id}`}
                className="block rounded-[14px] border border-[#f0e8da] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)] transition-all hover:shadow-[0_4px_16px_rgba(140,120,80,0.14)]"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-[var(--foreground)]">
                    {comment.post_title}
                  </h3>
                  <PostTypeBadge type={comment.post_type as PostType} />
                </div>
                <p className="mt-2 text-sm text-[var(--muted-foreground)] line-clamp-2">
                  &laquo; {comment.body} &raquo;
                </p>
                <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                  {new Date(comment.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </Link>
            ))
          ) : (
            <p className="py-8 text-center text-[var(--muted-foreground)]">
              Vous n'avez pas encore commenté.
            </p>
          )}
        </div>
      )}

      {/* My RSVPs */}
      {activeTab === "rsvps" && (
        <div className="space-y-3">
          {myRsvps.length > 0 ? (
            myRsvps.map((rsvp) => (
              <Link
                key={rsvp.post_id}
                href={`/app/posts/${rsvp.post_id}`}
                className="block rounded-[14px] border border-[#f0e8da] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)] transition-all hover:shadow-[0_4px_16px_rgba(140,120,80,0.14)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-sm text-[var(--foreground)]">
                    {rsvp.post_title}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      rsvp.status === "going"
                        ? "bg-green-50 text-green-700"
                        : rsvp.status === "maybe"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {RSVP_LABELS[rsvp.status] ?? rsvp.status}
                  </span>
                </div>
                {(rsvp.event_date || rsvp.event_location) && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    {rsvp.event_date && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} />
                        {new Date(rsvp.event_date).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                    {rsvp.event_location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} />
                        {rsvp.event_location}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))
          ) : (
            <p className="py-8 text-center text-[var(--muted-foreground)]">
              Aucune inscription à un événement.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
