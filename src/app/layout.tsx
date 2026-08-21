import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExpertBot Live — بوت تداول Expert Option الآلي",
  description:
    "بوت تداول آلي يتصل بمنصة Expert Option الحقيقية عبر WebSocket. يدعم استراتيجيات Alligator و RSI و MA Cross و Trend مع مارتنغال.",
  keywords: [
    "Expert Option",
    "تداول آلي",
    "بوت",
    "binary options",
    "Alligator",
    "RSI",
    "Martingale",
  ],
  authors: [{ name: "ExpertBot Live" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
