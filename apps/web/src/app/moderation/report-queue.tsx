"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_CATEGORIES } from "@rural-community-platform/shared";
import { restorePostAction, deleteReportedPostAction } from "./report-actions";

interface Report {
  id: string;
  post_id: string;
  reporter_id: string;
  category: string;
  reason: string | null;
  status: string;
  created_at: string;
  profiles?: { display_name: string };
}

interface Post {
  id: string;
  title: string;
  body: string;
  author_id: string;
  commune_id: string;
  type: string;
  profiles?: { display_name: string };
}

interface ReportWithPost extends Report {
  posts: Post;
}

interface ReportQueueProps {
  reports: ReportWithPost[];
}

export function ReportQueue({ reports }: ReportQueueProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  // Group reports by post_id
  const reportsByPost = reports.reduce(
    (acc, report) => {
      if (!report.posts) return acc;
      const postId = report.post_id;
      if (!acc[postId]) {
        acc[postId] = {
          post: report.posts,
          reports: [],
        };
      }
      acc[postId].reports.push(report);
      return acc;
    },
    {} as Record<
      string,
      { post: Post; reports: ReportWithPost[] }
    >
  );

  // Sort by report count (most reported first)
  const sortedPostGroups = Object.values(reportsByPost).sort(
    (a, b) => b.reports.length - a.reports.length
  );

  async function handleRestore(postId: string) {
    setLoading(postId);
    const result = await restorePostAction(postId);
    setLoading(null);
    if (!result.error) {
      router.refresh();
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce post ?")) return;
    setLoading(postId);
    const result = await deleteReportedPostAction(postId);
    setLoading(null);
    if (!result.error) {
      router.refresh();
    }
  }

  if (sortedPostGroups.length === 0) {
    return (
      <div className="rounded-[14px] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)]">
        <h2 className="mb-3 text-base font-semibold text-[var(--foreground)]">
          File de modération
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Aucun signalement en attente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] bg-white px-5 py-4 shadow-[0_1px_6px_rgba(160,130,90,0.06)]">
      <h2 className="mb-4 text-base font-semibold text-[var(--foreground)]">
        File de modération ({sortedPostGroups.length} {sortedPostGroups.length === 1 ? "post" : "posts"})
      </h2>

      <div className="space-y-3">
        {sortedPostGroups.map(({ post, reports: postReports }) => (
          <div
            key={post.id}
            className="rounded-xl border border-[var(--border)] overflow-hidden"
          >
            {/* Header with post info and report count */}
            <div className="px-4 py-3 bg-[var(--muted-background)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[var(--foreground)]">
                      {post.title}
                    </h3>
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                      {postReports.length}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    par {post.profiles?.display_name || "Inconnu"} — type:{" "}
                    {post.type}
                  </p>
                </div>
              </div>
            </div>

            {/* Individual reports */}
            <div className="divide-y divide-[var(--border)]">
              {postReports.map((report) => {
                const categoryInfo = REPORT_CATEGORIES.find(
                  (c) => c.value === report.category
                );
                return (
                  <div key={report.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-lg">{categoryInfo?.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-[var(--foreground)]">
                          {categoryInfo?.label}
                        </p>
                        {report.reason && (
                          <p className="text-xs text-[var(--muted-foreground)] mt-1">
                            {report.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Signalé par {report.profiles?.display_name || "Inconnu"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="px-4 py-3 bg-[var(--muted-background)] flex items-center justify-end gap-2">
              <button
                onClick={() => handleRestore(post.id)}
                disabled={loading === post.id}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                {loading === post.id ? "..." : "Restaurer"}
              </button>
              <button
                onClick={() => handleDelete(post.id)}
                disabled={loading === post.id}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {loading === post.id ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
