import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export function FeedbackFooter() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>A problem or an idea?</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Report a bug</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Suggest a feature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 8, padding: 16 },
  label: { fontSize: 12, color: "#6b7280" },
  row: { flexDirection: "row", gap: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6, backgroundColor: "#fff" },
  buttonText: { fontSize: 12, color: "#374151" },
});
