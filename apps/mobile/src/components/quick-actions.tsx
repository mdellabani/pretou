import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Megaphone, HeartHandshake, Calendar, Star } from "lucide-react-native";
import { POST_TYPE_COLORS } from "@/constants/colors";

type QuickActionsProps = {
  activeFilter: string | null;
  onFilter: (filter: string | null) => void;
};

const ACTIONS = [
  { key: "annonce", label: "Annonces", icon: Megaphone, color: POST_TYPE_COLORS.annonce },
  { key: "entraide", label: "Entraide", icon: HeartHandshake, color: POST_TYPE_COLORS.entraide },
  { key: "evenement", label: "Événements", icon: Calendar, color: POST_TYPE_COLORS.evenement },
  { key: "favoris", label: "Favoris", icon: Star, color: "#C8900A" },
] as const;

export function QuickActions({ activeFilter, onFilter }: QuickActionsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {ACTIONS.map((action) => {
        const isActive = activeFilter === action.key;
        const Icon = action.icon;
        return (
          <TouchableOpacity
            key={action.key}
            style={[styles.chip, isActive && styles.chipActive]}
            activeOpacity={0.7}
            onPress={() => onFilter(isActive ? null : action.key)}
          >
            <View style={[styles.iconBox, { backgroundColor: action.color + "18" }]}>
              <Icon size={16} color={action.color} />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive: {
    borderWidth: 1.5,
    borderColor: "#D35230",
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: "#3f3f46",
  },
  labelActive: {
    fontFamily: "DMSans_600SemiBold",
    color: "#18181b",
  },
});
