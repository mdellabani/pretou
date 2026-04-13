"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@rural-community-platform/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Commune = {
  id: string;
  name: string;
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchCommunes() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("communes")
        .select("id, name")
        .order("name");
      if (!error && data) {
        setCommunes(data);
      }
    }
    fetchCommunes();
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = signupSchema.safeParse({
      email,
      password,
      display_name: displayName,
      commune_id: communeId,
    });

    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Données invalides");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Erreur lors de la création du compte");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      display_name: displayName,
      commune_id: communeId,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/auth/pending");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Inscription</CardTitle>
          <CardDescription>Rejoignez votre commune</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="display_name">Nom affiché</Label>
              <Input
                id="display_name"
                type="text"
                placeholder="Jean Dupont"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jean@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="8 caractères minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="commune">Commune</Label>
              <Select value={communeId} onValueChange={setCommuneId} required>
                <SelectTrigger id="commune">
                  <SelectValue placeholder="Sélectionner votre commune" />
                </SelectTrigger>
                <SelectContent>
                  {communes.map((commune) => (
                    <SelectItem key={commune.id} value={commune.id}>
                      {commune.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Inscription..." : "S'inscrire"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Déjà inscrit ?{" "}
              <a href="/auth/login" className="underline text-foreground">
                Se connecter
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
