import React from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata = {
  title: "Growth Hackers",
  description:
    "Professional AI-powered advertising and marketing automation for property management. Managed campaigns, competitor analysis, and tenant growth automation.",
  icons: {
    icon: "/growth-hackers-logo.png",
    shortcut: "/growth-hackers-logo.png",
    apple: "/growth-hackers-logo.png",
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body style={{ fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif" }} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
