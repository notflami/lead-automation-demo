import type { Metadata, Viewport } from "next";
import "@fontsource/yeseva-one/latin-400.css";
import "@fontsource/yeseva-one/latin-ext-400.css";
import "@fontsource-variable/commissioner/wght.css";
import "./globals.css";
import { siteUrl } from "@/lib/env";
import { getLocale } from "@/lib/locale";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const base = siteUrl();
  try {
    const s = await getSettings();
    const description = s.tagline || s.about_text.slice(0, 160);
    return {
      metadataBase: new URL(base),
      title: { default: s.event_name, template: `%s | ${s.event_name}` },
      description,
      openGraph: { title: s.event_name, description, type: "website", url: base },
      twitter: { card: "summary_large_image", title: s.event_name, description },
    };
  } catch {
    return { metadataBase: new URL(base), title: "Event registration" };
  }
}

export const viewport: Viewport = {
  themeColor: "#1a1d42",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
