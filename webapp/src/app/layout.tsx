import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarif Hotspot - Buy WiFi Vouchers",
  description: "Purchase internet access vouchers for Tarif Hotspot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
