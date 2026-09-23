import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tarif Hotspot — WiFi vouchers",
    template: "%s · Tarif Hotspot",
  },
  description:
    "Buy WiFi access vouchers for Tarif Hotspot. Choose a plan, pay, redeem on the captive portal.",
  applicationName: "Tarif Hotspot",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${ui.variable} ${mono.variable}`}>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-cyan-500 focus:text-slate-950 focus:px-3 focus:py-2 focus:rounded"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
