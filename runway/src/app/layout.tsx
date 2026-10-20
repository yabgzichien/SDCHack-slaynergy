import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/AppShell";
import { ReleaseOverlay } from "@/components/ReleaseOverlay";
import { PageTransition } from "@/components/PageTransition";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Runway: find a future-proof job before your time runs out",
  description: "Runway helps young office workers who have just been laid off find a growing job that AI is unlikely to take soon, using forecasts tested against real data releases.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen">
        <AppProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">Skip to content</a>
          <AppShell><PageTransition>{children}</PageTransition></AppShell>
          <ReleaseOverlay />
        </AppProvider>
      </body>
    </html>
  );
}
