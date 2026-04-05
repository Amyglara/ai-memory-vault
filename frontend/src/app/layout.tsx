import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "TrustGate — Decentralized Escrow & Arbitration Protocol",
  description:
    "Trust-backed escrow and AI-powered arbitration on 0G Network. Create escrows, submit evidence, and resolve disputes with trust-score-weighted arbitrator voting.",
  keywords: ["0G", "escrow", "arbitration", "decentralized", "trust", "blockchain", "AI"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {/* Ambient background orbs */}
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />

        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
