"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { loadMorePosts } from "./load-more-action";
import type { Post } from "@rural-community-platform/shared";

interface FeedContentProps {
  initialPosts: Post[];
  pinnedPosts: Post[];
  communeId: string;
  types: string[];
  dateFilter: string;
}

export function FeedContent({
  initialPosts,
  pinnedPosts,
  communeId,
  types,
  dateFilter,
}: FeedContentProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length >= 20);
  }, [initialPosts]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || posts.length === 0) return;
    setLoading(true);
    const cursor = posts[posts.length - 1].created_at;
    const newPosts = await loadMorePosts(communeId, cursor, types, dateFilter);
    if (newPosts.length < 20) setHasMore(false);
    setPosts((prev) => [...prev, ...newPosts]);
    setLoading(false);
  }, [loading, hasMore, posts, communeId, types, dateFilter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-4">
      {pinnedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loading && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Chargement...
            </p>
          )}
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
          Aucune publication plus ancienne.
        </p>
      )}
      {pinnedPosts.length === 0 && posts.length === 0 && (
        <p className="py-8 text-center text-[var(--muted-foreground)]">
          Aucune publication pour cette sélection.
        </p>
      )}
    </div>
  );
}
