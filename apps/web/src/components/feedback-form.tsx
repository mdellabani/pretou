"use client";

import { useState } from "react";
import {
  type FeedbackType,
  type FeedbackFormData,
  DEFAULT_BUG_CATEGORIES,
  DEFAULT_FEATURE_CATEGORIES,
} from "@/lib/feedback-config";

interface FeedbackFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function FeedbackForm({ onClose, onSuccess }: FeedbackFormProps) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const categories = type === "bug" ? DEFAULT_BUG_CATEGORIES : DEFAULT_FEATURE_CATEGORIES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const data: FeedbackFormData = {
      type,
      category: category || categories[0],
      title,
      description,
    };

    const context = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      appVersion: "1.0.0",
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, context }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors de l'envoi");
      }

      setSuccess(true);
      onSuccess?.();
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg font-medium">Merci !</p>
        <p className="text-sm text-muted-foreground mt-1">Votre retour a bien été envoyé.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("bug")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${type === "bug" ? "bg-red-600 text-white" : "border border-[#e8dfd0] text-[var(--muted-foreground)] hover:border-red-300"}`}
        >
          Signaler un bug
        </button>
        <button
          type="button"
          onClick={() => setType("feature")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${type === "feature" ? "bg-[var(--theme-primary,#18181b)] text-white" : "border border-[#e8dfd0] text-[var(--muted-foreground)] hover:border-[var(--theme-primary)]"}`}
        >
          Suggestion
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Catégorie</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-md border border-[#e8dfd0] bg-white px-3 py-2 text-sm"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Titre</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Résumé court"
          required
          className="w-full rounded-md border border-[#e8dfd0] bg-white px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "bug" ? "Que s'est-il passé ? Qu'attendiez-vous ?" : "Décrivez la fonctionnalité et son utilité"}
          required
          rows={4}
          className="w-full rounded-md border border-[#e8dfd0] bg-white px-3 py-2 text-sm resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm border border-[#e8dfd0] hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={submitting} className="rounded-md px-4 py-2 text-sm bg-[var(--theme-primary,#18181b)] text-white hover:opacity-90 disabled:opacity-50 transition-colors">
          {submitting ? "Envoi..." : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
