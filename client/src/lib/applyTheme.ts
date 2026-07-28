import { BRAND } from "@shared/brand";
import { themeCssVars } from "@shared/theme";

/**
 * Applies the deployment's theme before first paint: sets the design-system
 * CSS variables on :root (inline styles win over both the light and dark
 * stylesheet blocks) and loads the theme's web fonts.
 */
export function applyTheme(): void {
  const theme = BRAND.theme;
  const root = document.documentElement;

  for (const [name, value] of Object.entries(themeCssVars(theme))) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = theme.key;
  root.dataset.themeMode = theme.mode;

  if (theme.fontsUrl) {
    const existing = document.querySelector<HTMLLinkElement>('link[data-theme-fonts]');
    if (existing?.href !== theme.fontsUrl) {
      existing?.remove();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = theme.fontsUrl;
      link.dataset.themeFonts = "true";
      document.head.appendChild(link);
    }
  }
}
