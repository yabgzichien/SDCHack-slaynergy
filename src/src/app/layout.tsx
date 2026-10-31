import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/AppShell";
import { ReleaseOverlay } from "@/components/ReleaseOverlay";
import { PageTransition } from "@/components/PageTransition";
import { SkipLink } from "@/components/SkipLink";
import { CustomCursor } from "@/components/CustomCursor";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Jobbery: find a future-proof job before your time runs out",
  description: "Jobbery helps fresh graduates and everyone in the workforce explore growing jobs, develop relevant skills and plan their next career step, using forecasts tested against real data releases.",
  icons: { icon: "/icon-48.png", apple: "/apple-icon-180.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "only light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable}`}>
      <body className="min-h-screen">
        <I18nProvider><AppProvider>
          <SkipLink />
          <AppShell><PageTransition>{children}</PageTransition></AppShell>
          <ReleaseOverlay />
          <CustomCursor />
        </AppProvider></I18nProvider>
      </body>
    </html>
  );
}
