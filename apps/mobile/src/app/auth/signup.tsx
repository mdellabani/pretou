import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { signupSchema } from "@rural-community-platform/shared";

type CommuneItem = { id: string; name: string; slug: string; code_postal: string | null };

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [communes, setCommunes] = useState<CommuneItem[]>([]);
  const [selectedCommuneId, setSelectedCommuneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [communesLoading, setCommunesLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadCommunes();
  }, []);

  async function loadCommunes() {
    const { data, error } = await supabase
      .from("communes")
      .select("id, name, slug, code_postal")
      .order("name");
    if (error) {
      Alert.alert("Erreur", "Impossible de charger les communes");
    } else {
      setCommunes(data ?? []);
    }
    setCommunesLoading(false);
  }

  async function handleSignup() {
    const parsed = signupSchema.safeParse({
      email,
      password,
      display_name: displayName,
      commune_id: selectedCommuneId,
    });

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? "Données invalides";
      Alert.alert("Erreur", firstError);
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (authError) {
      setLoading(false);
      Alert.alert("Erreur", authError.message);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        display_name: parsed.data.display_name,
        commune_id: parsed.data.commune_id,
        role: "resident",
        status: "pending",
      });

      if (profileError) {
        setLoading(false);
        Alert.alert("Erreur", "Impossible de créer le profil");
        return;
      }
    }

    setLoading(false);
    Alert.alert(
      "Inscription réussie",
      "Votre compte a été créé. Un administrateur doit valider votre inscription avant que vous puissiez vous connecter.",
      [{ text: "OK", onPress: () => router.replace("/auth/login") }]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inscription</Text>
      <Text style={styles.subtitle}>Rejoignez votre commune</Text>

      <Text style={styles.label}>Nom d&apos;affichage</Text>
      <TextInput
        style={styles.input}
        placeholder="Votre nom"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="votre@email.fr"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Mot de passe</Text>
      <TextInput
        style={styles.input}
        placeholder="8 caractères minimum"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Text style={styles.label}>Votre commune</Text>
      {communesLoading ? (
        <ActivityIndicator style={styles.communeLoader} />
      ) : (
        <View style={styles.communeList}>
          {communes.map((commune) => (
            <TouchableOpacity
              key={commune.id}
              style={[
                styles.communeItem,
                selectedCommuneId === commune.id && styles.communeItemSelected,
              ]}
              onPress={() => setSelectedCommuneId(commune.id)}
            >
              <Text
                style={[
                  styles.communeName,
                  selectedCommuneId === commune.id && styles.communeNameSelected,
                ]}
              >
                {commune.name}
              </Text>
              {commune.code_postal && (
                <Text
                  style={[
                    styles.communeCode,
                    selectedCommuneId === commune.id && styles.communeCodeSelected,
                  ]}
                >
                  {commune.code_postal}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Inscription..." : "S'inscrire"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkContainer}
        onPress={() => router.push("/auth/login")}
      >
        <Text style={styles.link}>Déjà un compte ? Se connecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#71717a", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: "#3f3f46", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  communeLoader: { marginVertical: 16 },
  communeList: { gap: 8, marginTop: 4 },
  communeItem: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  communeItemSelected: {
    borderColor: "#18181b",
    backgroundColor: "#18181b",
  },
  communeName: { fontSize: 16, color: "#18181b" },
  communeNameSelected: { color: "#fff", fontWeight: "600" },
  communeCode: { fontSize: 14, color: "#a1a1aa" },
  communeCodeSelected: { color: "#d4d4d8" },
  button: {
    backgroundColor: "#18181b",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkContainer: { marginTop: 16, alignSelf: "center" },
  link: { color: "#18181b", fontSize: 14 },
});
