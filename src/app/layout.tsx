import type { Metadata } from "next";
import { Geist_Mono, Source_Sans_3, Syne } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth-provider";

const sourceSans3 = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" });
const syne        = Syne({ subsets: ["latin"], variable: "--font-display", weight: ["700", "800"] });
const geistMono   = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LottoGuard — Lottery Fraud Prevention",
  description: "Real-time scratch-off inventory tracking and fraud detection for Ohio Lottery retailers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", sourceSans3.variable, syne.variable, geistMono.variable, "font-sans")}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
