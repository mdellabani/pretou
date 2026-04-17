"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@rural-community-platform/shared";
import { createClient } from "@/lib/supabase/client";

type Comment = { id: string; [k: string]: unknown };

export function useRealtimeComments(postId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!postId) return;
    const supabase = createClient();
    const key = queryKeys.comments(postId);

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const c = payload.new as Comment;
            qc.setQueryData<Comment[]>(key, (old = []) => [c, ...old]);
          } else if (payload.eventType === "UPDATE") {
            const c = payload.new as Comment;
            qc.setQueryData<Comment[]>(key, (old = []) =>
              old.map((x) => (x.id === c.id ? { ...x, ...c } : x)),
            );
          } else if (payload.eventType === "DELETE") {
            const c = payload.old as { id: string };
            qc.setQueryData<Comment[]>(key, (old = []) => old.filter((x) => x.id !== c.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, qc]);
}
