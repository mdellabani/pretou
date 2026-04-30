import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Pin } from "lucide-react-native";
import {
  POST_TYPE_COLORS,
  POST_TYPE_LABELS,
  type PostType,
} from "@pretou/shared";
import { useTheme } from "@/lib/theme-context";

type Row = {
  id: string;
  title: string;
  type: PostType;
  created_at: string;
  is_pinned: boolean;
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)}sem`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "2-digit",
  });
}

export function MyPostsPanel({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const theme = useTheme();

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.pinBg }]}>
          <Text style={styles.emptyIconText}>📝</Text>
        </View>
        <Text style={styles.emptyTitle}>Aucune publication</Text>
        <Text style={[styles.emptySub, { color: theme.muted }]}>
          Vous n'avez encore rien publié.{"\n"}Touchez « Publier » pour commencer.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {rows.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={() => router.push(`/post/${item.id}`)}
          activeOpacity={0.6}
        >
          <View
            style={[
              styles.typeChip,
              { backgroundColor: POST_TYPE_COLORS[item.type] + "20" },
            ]}
          >
            <Text
              style={[styles.typeText, { color: POST_TYPE_COLORS[item.type] }]}
            >
              {POST_TYPE_LABELS[item.type]}
            </Text>
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              {item.is_pinned && (
                <Pin
                  size={12}
                  color={theme.primary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <Text style={[styles.meta, { color: theme.muted }]}>
              {formatRelative(item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
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
  titleRow: { flexDirection: "row", alignItems: "center" },
  title: {
    flex: 1,
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
