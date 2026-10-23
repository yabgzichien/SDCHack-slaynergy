import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/AppShell";
import { ReleaseOverlay } from "@/components/ReleaseOverlay";
import { PageTransition } from "@/components/PageTransition";
import { CustomCursor } from "@/components/CustomCursor";

export const metadata: Metadata = {
  title: "Jobbery: find a future-proof job before your time runs out",
  description: "Jobbery helps young office workers who have just been laid off find a growing job that AI is unlikely to take soon, using forecasts tested against real data releases.",
  icons: { icon: "/cockatiel-ai-icon-v2.png", apple: "/cockatiel-ai-icon-v2.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "only light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Ranade is hosted by Fontshare; the other two requested families are hosted by Google Fonts. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <head>
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=ranade@400,500,600,700&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap" />
      </head>
      <body className="min-h-screen">
        <AppProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">Skip to content</a>
          <AppShell><PageTransition>{children}</PageTransition></AppShell>
          <ReleaseOverlay />
          <CustomCursor />
        </AppProvider>
      </body>
    </html>
  );
}
