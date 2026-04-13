import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PostCard } from "@/components/post-card";
import { getPosts, getEpciPosts } from "@rural-community-platform/shared";
import type { Post } from "@rural-community-platform/shared";

export default function FeedScreen() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"commune" | "epci">("commune");

  const loadPosts = useCallback(async () => {
    if (!profile?.commune_id) return;

    const { data } =
      scope === "epci" && profile.communes?.epci_id
        ? await getEpciPosts(supabase, profile.communes.epci_id)
        : await getPosts(supabase, profile.commune_id);

    if (data) setPosts(data as Post[]);
  }, [profile?.commune_id, profile?.communes?.epci_id, scope]);

  useEffect(() => {
    loadPosts().then(() => setLoading(false));
  }, [loadPosts]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.commune_id) return;

    const channel = supabase
      .channel("posts-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `commune_id=eq.${profile.commune_id}`,
        },
        () => {
          loadPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.commune_id, loadPosts]);

  async function onRefresh() {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            onPress={() => setScope("commune")}
            style={[styles.toggleButton, scope === "commune" && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, scope === "commune" && styles.toggleTextActive]}>
              Ma commune
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setScope("epci")}
            style={[styles.toggleButton, scope === "epci" && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, scope === "epci" && styles.toggleTextActive]}>
              Intercommunalité
            </Text>
          </TouchableOpacity>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucune publication pour le moment.</Text>
          <Text style={styles.emptySubtext}>
            Soyez le premier a publier dans votre commune !
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyContainer: { flex: 1 },
  loadingText: { fontSize: 16, color: "#71717a" },
  emptyText: { fontSize: 16, color: "#71717a", textAlign: "center" },
  emptySubtext: { fontSize: 14, color: "#a1a1aa", textAlign: "center", marginTop: 4 },
  toggleContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f4f4f5",
  },
  toggleButtonActive: {
    backgroundColor: "#18181b",
  },
  toggleText: {
    fontSize: 14,
    color: "#71717a",
  },
  toggleTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
