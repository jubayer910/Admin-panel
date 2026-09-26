import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SIDE_COOKIE, THEME_COOKIE, themeFrom } from "./prefs";
import { Shell } from "./Shell";

export const metadata: Metadata = {
  title: "Admin panel · open-source demo",
  description:
    "An admin panel for a portfolio site, drawn in engraved line art with a light and dark theme. Open source; this demo runs on made-up data in your browser.",
};

/**
 * The admin. The theme and the sidebar's width are read here, from their
 * cookies, so the first paint is already right; everything else is drawn in
 * the browser (./Shell.tsx), where the demo's database lives.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  return (
    <Shell theme={themeFrom(jar.get(THEME_COOKIE)?.value)} collapsed={jar.get(SIDE_COOKIE)?.value === "collapsed"}>
      {children}
    </Shell>
  );
}
