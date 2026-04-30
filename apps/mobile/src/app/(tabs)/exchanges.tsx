import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getMyPosts, getMyRsvps, type PostType } from "@pretou/shared";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { MyPostsPanel } from "@/components/my-posts-panel";
import { MyRsvpsPanel } from "@/components/my-rsvps-panel";

type PostRow = {
  id: string;
  title: string;
  type: PostType;
  created_at: string;
  is_pinned: boolean;
};
type RsvpRow = {
  status: string;
  posts:
    | {
        id: string;
        title: string;
        type: PostType;
        event_date: string | null;
        event_location: string | null;
      }
    | null;
};

export default function MonEspaceScreen() {
  const { profile } = useAuth();
  const theme = useTheme();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const userId = profile?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    const [postsRes, rsvpsRes] = await Promise.all([
      getMyPosts(supabase, userId),
      getMyRsvps(supabase, userId),
    ]);
    setPosts((postsRes.data ?? []) as PostRow[]);
    setRsvps((rsvpsRes.data ?? []) as RsvpRow[]);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.muted, { color: theme.muted }]}>Chargement…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.sectionTitle}>Mes publications</Text>
      <MyPostsPanel rows={posts} />

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
        Mes participations
      </Text>
      <MyRsvpsPanel rows={rsvps} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  muted: { fontFamily: "DMSans_400Regular", fontSize: 14 },
  sectionTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: "#2a1a14",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitleSpaced: { paddingTop: 24 },
});
