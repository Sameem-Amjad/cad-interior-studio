import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Studio PoC — CAD to walkable 3D interior",
  description:
    "Proof of concept: drop a building file, walk through it, design the interior, let AI style it. No account needed.",
};

export const viewport: Viewport = { themeColor: "#0f1115", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
