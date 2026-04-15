"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import {
  THEMES,
  type ThemeSlug,
  contrastRatioOnWhite,
  suggestAccessibleShade,
  isValidHexColor,
} from "@rural-community-platform/shared";
import { updateThemeAction, uploadLogoAction } from "@/app/admin/dashboard/theme-actions";

interface ThemeCustomizerProps {
  currentTheme: string;
  currentCustomColor: string | null;
  currentLogoUrl: string | null;
}

export function ThemeCustomizer({ currentTheme, currentCustomColor, currentLogoUrl }: ThemeCustomizerProps) {
  const router = useRouter();
  const [theme, setTheme] = useState(currentTheme);
  const [customColor, setCustomColor] = useState(currentCustomColor ?? "");
  const [contrastWarning, setContrastWarning] = useState<string | null>(null);
  const [suggestedColor, setSuggestedColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  function handleColorChange(hex: string) {
    setCustomColor(hex);
    if (hex && isValidHexColor(hex)) {
      const ratio = contrastRatioOnWhite(hex);
      if (ratio < 4.5) {
        setContrastWarning("Cette couleur manque de contraste avec le texte blanc. Essayez une teinte plus foncée.");
        setSuggestedColor(suggestAccessibleShade(hex));
      } else {
        setContrastWarning(null);
        setSuggestedColor(null);
      }
    } else {
      setContrastWarning(null);
      setSuggestedColor(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    await updateThemeAction(theme, customColor || null);
    setSaving(false);
    router.refresh();
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.set("logo", file);
    await uploadLogoAction(formData);
    setUploadingLogo(false);
    router.refresh();
  }

  return (
    <div className="rounded-[14px] border border-[#f0e8da] bg-white p-5 shadow-[0_2px_8px_rgba(140,120,80,0.08)]">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--theme-primary)" }}>
        Personnalisation
      </h2>

      {/* Theme picker */}
      <div className="mb-4">
        <label className="text-sm font-medium text-[var(--foreground)]">Thème de base</label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {(Object.entries(THEMES) as [ThemeSlug, typeof THEMES[ThemeSlug]][]).map(([slug, t]) => (
            <button
              key={slug}
              onClick={() => setTheme(slug)}
              className={`rounded-lg border-2 p-2 text-center text-xs font-medium transition-all ${
                theme === slug ? "border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/20" : "border-[#e8dfd0]"
              }`}
            >
              <div className="mx-auto mb-1 h-6 w-6 rounded-full" style={{ backgroundColor: t.primary }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom color */}
      <div className="mb-4">
        <label className="text-sm font-medium text-[var(--foreground)]">Couleur personnalisée (optionnel)</label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="color"
            value={customColor || "#000000"}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded border border-[#e8dfd0]"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => handleColorChange(e.target.value)}
            placeholder="#3B82F6"
            className="w-32 rounded-lg border border-[#e8dfd0] bg-[#fafaf9] px-3 py-2 text-sm font-mono"
          />
          {customColor && (
            <button onClick={() => { setCustomColor(""); setContrastWarning(null); setSuggestedColor(null); }}
              className="text-xs text-[var(--muted-foreground)] underline">
              Réinitialiser
            </button>
          )}
        </div>
        {contrastWarning && (
          <div className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            <p>{contrastWarning}</p>
            {suggestedColor && (
              <button onClick={() => handleColorChange(suggestedColor)}
                className="mt-1 font-medium underline">
                Utiliser {suggestedColor}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Logo upload */}
      <div className="mb-4">
        <label className="text-sm font-medium text-[var(--foreground)]">Logo de la commune</label>
        <div className="mt-2 flex items-center gap-4">
          {currentLogoUrl && (
            <img src={currentLogoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-contain border border-[#e8dfd0]" />
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e8dfd0] px-3 py-2 text-sm hover:bg-[#fafaf9]">
            <Upload size={14} />
            {uploadingLogo ? "Envoi..." : "Changer le logo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
          </label>
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: "var(--theme-primary)" }}>
        {saving ? "Enregistrement..." : "Enregistrer le thème"}
      </button>
    </div>
  );
}
