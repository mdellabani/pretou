import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import {
  POST_TYPE_COLORS,
  POST_TYPE_LABELS,
  type PostType,
} from "@pretou/shared";
import { useTheme } from "@/lib/theme-context";

type RsvpPost = {
  id: string;
  title: string;
  type: PostType;
  event_date: string | null;
  event_location: string | null;
};
type Rsvp = {
  status: string;
  posts: RsvpPost | RsvpPost[] | null;
};

function firstOrSame<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function formatEventDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MyRsvpsPanel({ rows }: { rows: Rsvp[] }) {
  const router = useRouter();
  const theme = useTheme();

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.pinBg }]}>
          <Text style={styles.emptyIconText}>📅</Text>
        </View>
        <Text style={styles.emptyTitle}>Aucune participation</Text>
        <Text style={[styles.emptySub, { color: theme.muted }]}>
          Vos RSVP apparaîtront ici.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {rows.map((r, i) => {
        const post = firstOrSame(r.posts);
        if (!post) {
          return (
            <View key={i} style={styles.deletedRow}>
              <Text style={[styles.muted, { color: theme.muted }]}>
                Événement supprimé
              </Text>
            </View>
          );
        }
        const eventDate = formatEventDate(post.event_date);
        return (
          <TouchableOpacity
            key={i}
            style={styles.row}
            onPress={() => router.push(`/post/${post.id}`)}
            activeOpacity={0.6}
          >
            <View
              style={[
                styles.typeChip,
                { backgroundColor: POST_TYPE_COLORS[post.type] + "20" },
              ]}
            >
              <Text
                style={[styles.typeText, { color: POST_TYPE_COLORS[post.type] }]}
              >
                {POST_TYPE_LABELS[post.type]}
              </Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={2}>
                {post.title}
              </Text>
              {eventDate && (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {eventDate}
                </Text>
              )}
              {post.event_location && (
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {post.event_location}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0e0d0",
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 2,
  },
  typeText: { fontFamily: "DMSans_600SemiBold", fontSize: 11 },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: "#2a1a14",
    lineHeight: 18,
  },
  meta: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
  deletedRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  muted: { fontFamily: "DMSans_400Regular", fontSize: 14 },

  empty: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: { fontSize: 24 },
  emptyTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    color: "#2a1a14",
  },
  emptySub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
