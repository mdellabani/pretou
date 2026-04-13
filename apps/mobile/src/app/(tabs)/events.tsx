import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { CalendarDays, MapPin } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { getPostsByType } from "@rural-community-platform/shared";
import type { Post } from "@rural-community-platform/shared";

export default function EventsScreen() {
  const { profile } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [events, setEvents] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!profile?.commune_id) return;
    const { data } = await getPostsByType(supabase, profile.commune_id, "evenement");
    if (data) {
      const now = new Date().toISOString();
      const upcoming = (data as Post[]).filter(
        (e) => !e.event_date || e.event_date >= now
      );
      setEvents(upcoming);
    }
  }, [profile?.commune_id]);

  useEffect(() => {
    loadEvents().then(() => setLoading(false));
  }, [loadEvents]);

  async function onRefresh() {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Date à définir";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/post/${item.id}`)}
          activeOpacity={0.7}
        >
          {/* Date + time row */}
          <View style={[styles.dateRow, { backgroundColor: theme.pinBg }]}>
            <CalendarDays size={14} color={theme.primary} />
            <Text style={[styles.dateText, { color: theme.primary }]}>
              {formatDate(item.event_date)}
              {item.event_date ? ` · ${formatTime(item.event_date)}` : ""}
            </Text>
          </View>

          <Text style={styles.title}>{item.title}</Text>

          {item.event_location && (
            <View style={styles.locationRow}>
              <MapPin size={13} color={theme.muted} />
              <Text style={[styles.location, { color: theme.primary }]}>
                {item.event_location}
              </Text>
            </View>
          )}

          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.author, { color: theme.muted }]}>
              {item.profiles?.display_name ?? "Anonyme"}
            </Text>
            {item.rsvps && item.rsvps.filter((r) => r.status === "going").length > 0 && (
              <Text style={[styles.rsvpCount, { color: theme.primary }]}>
                {item.rsvps.filter((r) => r.status === "going").length} participant
                {item.rsvps.filter((r) => r.status === "going").length > 1 ? "s" : ""}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: theme.muted }]}>
            Aucun événement à venir.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyContainer: { flex: 1 },
  loadingText: { fontFamily: "DMSans_500Medium", fontSize: 16, color: "#a1a1aa" },
  emptyText: { fontFamily: "DMSans_500Medium", fontSize: 16, textAlign: "center" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0e8da",
    shadowColor: "#8a7850",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  dateText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
  },
  title: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: "#2E2118",
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  location: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
  },
  body: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: "#907B64",
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  author: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
  },
  rsvpCount: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
  },
});
