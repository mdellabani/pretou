import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Pressable, StyleSheet, Alert, Platform,
} from "react-native";
import Constants from "expo-constants";
import { useTheme } from "@/lib/theme-context";
import { type FeedbackType, type FeedbackFormData, DEFAULT_BUG_CATEGORIES, DEFAULT_FEATURE_CATEGORIES } from "@/lib/feedback-config";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "";

interface FeedbackSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function FeedbackSheet({ visible, onClose }: FeedbackSheetProps) {
  const theme = useTheme();
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categories = type === "bug" ? DEFAULT_BUG_CATEGORIES : DEFAULT_FEATURE_CATEGORIES;

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Erreur", "Le titre et la description sont requis");
      return;
    }
    setSubmitting(true);

    const data: FeedbackFormData = { type, category: categories[0], title, description };
    const context = {
      url: "mobile-app",
      userAgent: `${Platform.OS} ${Platform.Version}`,
      appVersion: Constants.expoConfig?.version ?? "1.0.0",
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${WEB_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, context }),
      });
      if (!res.ok) throw new Error("Failed to submit");

      Alert.alert("Merci !", "Votre retour a bien été envoyé.");
      onClose();
      setTitle("");
      setDescription("");
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le retour. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Votre retour</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeButton, type === "bug" && { backgroundColor: "#dc2626" }]}
              onPress={() => setType("bug")}
            >
              <Text style={[styles.typeText, type === "bug" && styles.typeTextActive]}>Signaler un bug</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === "feature" && { backgroundColor: theme.primary }]}
              onPress={() => setType("feature")}
            >
              <Text style={[styles.typeText, type === "feature" && styles.typeTextActive]}>Suggestion</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Titre</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Résumé court" placeholderTextColor="#a1a1aa" />
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={type === "bug" ? "Que s'est-il passé ?" : "Décrivez la fonctionnalité souhaitée"}
            placeholderTextColor="#a1a1aa"
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.primary }, submitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{submitting ? "Envoi..." : "Envoyer"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e4e4e7",
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8da",
  },
  headerTitle: { fontFamily: "DMSans_600SemiBold", fontSize: 16 },
  closeButton: { fontSize: 18, color: "#a1a1aa", padding: 4 },
  body: { padding: 20 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
  },
  typeText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#71717a" },
  typeTextActive: { color: "#fff", fontFamily: "DMSans_600SemiBold" },
  label: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#52525b", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e8dfd0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: "#18181b",
    backgroundColor: "#fff",
  },
  textarea: { height: 100, textAlignVertical: "top" },
  submitButton: {
    marginTop: 20,
    marginBottom: 32,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  submitText: { fontFamily: "DMSans_600SemiBold", color: "#fff", fontSize: 15 },
});
