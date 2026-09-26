/** "© 2026. Maniruzzaman Jubayer" → "Maniruzzaman Jubayer" */
export function siteName(s: Record<string, string>): string {
  return s["footer.copyright"]?.replace(/^©\s*\d{4}\.?\s*/, "").trim() || "Maniruzzaman Jubayer";
}
