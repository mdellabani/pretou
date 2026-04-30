import { Stack } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme-context";
import { InboxPanel } from "@/components/inbox-panel";

export default function MessagesScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{ title: "Messages", headerBackTitle: "Retour" }}
      />
      <InboxPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
