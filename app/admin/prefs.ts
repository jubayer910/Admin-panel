/* The admin's per-browser choices, kept in cookies so the server draws
   them and nothing jumps on load. A plain module: server components and
   the client switches both read these names. */

export const SIDE_COOKIE = "mx_admin_side";
export const THEME_COOKIE = "mx_admin_theme";

export type Theme = "light" | "dark" | "system";

/** light or dark when chosen, else the system's */
export function themeFrom(value: string | undefined): Theme {
  return value === "dark" || value === "light" ? value : "system";
}
