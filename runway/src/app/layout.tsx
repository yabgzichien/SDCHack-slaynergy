import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { TopBar } from "@/components/TopBar";
import { ReleaseOverlay } from "@/components/ReleaseOverlay";
import { ChangesPanel } from "@/components/ChangesPanel";
import Link from "next/link";
import { PageTransition } from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Runway: find a future-proof job before your time runs out",
  description: "Runway helps young office workers who have just been laid off find a growing job that AI is unlikely to take soon, using forecasts tested against real data releases.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">Skip to content</a>
          <TopBar />
          <ChangesPanel />
          <main id="main" className="mx-auto max-w-5xl px-4 py-6 sm:py-10"><PageTransition>{children}</PageTransition></main>
          <ReleaseOverlay />
          <footer className="mx-auto max-w-5xl border-t border-line px-4 py-6 text-sm text-muted">
            <p>Estimates, not predictions of certainty. You choose; a counsellor reviews and approves. Points only, never money. Forecasters shown are simulated demo data.</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/trust" className="underline">How we keep this honest (fairness check, log, data sources)</Link>
              <span>SDC Hackathon 2026 · Domain 1 · Apache-2.0</span>
            </p>
          </footer>
        </AppProvider>
      </body>
    </html>
  );
}
