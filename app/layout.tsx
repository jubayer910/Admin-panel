import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin panel · open-source demo",
  description:
    "An admin panel for a portfolio site, drawn in engraved line art with a light and dark theme. Built by Maniruzzaman Jubayer.",
};

export const viewport: Viewport = {
  themeColor: "#f5f5f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        {children}
        {/* Vercel Web Analytics: page views of the demo, cookie-free */}
        <Analytics />
      </body>
    </html>
  );
}
