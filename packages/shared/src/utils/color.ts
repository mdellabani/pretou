// Convert hex to HSL
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Derive a full theme palette from a single primary hex color */
export function deriveThemeFromColor(hex: string): {
  primary: string;
  gradient: [string, string, string];
  background: string;
  muted: string;
  pinBg: string;
} {
  const [h, s, l] = hexToHsl(hex);
  return {
    primary: hex,
    gradient: [
      hslToHex(h, s, Math.max(l - 10, 10)),
      hex,
      hslToHex(h, s, Math.min(l + 15, 90)),
    ],
    background: hslToHex(h, Math.round(s * 0.3), 95),
    muted: hslToHex(h, Math.round(s * 0.5), 65),
    pinBg: hslToHex(h, Math.round(s * 0.3), 92),
  };
}

/**
 * Check WCAG AA contrast ratio of a color against white.
 * Returns the ratio (>= 4.5 passes AA for normal text).
 */
export function contrastRatioOnWhite(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // White luminance = 1.0
  return (1.05) / (luminance + 0.05);
}

/** Suggest a darker shade that passes WCAG AA (4.5:1) on white */
export function suggestAccessibleShade(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  for (let testL = l; testL >= 10; testL -= 5) {
    const candidate = hslToHex(h, s, testL);
    if (contrastRatioOnWhite(candidate) >= 4.5) return candidate;
  }
  return hslToHex(h, s, 20); // fallback to very dark
}

/** Validate hex color format */
export function isValidHexColor(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}
