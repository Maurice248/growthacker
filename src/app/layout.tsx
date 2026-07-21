import React from "react";
import { Karla, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
  adjustFontFallback: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
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
    <html lang="en" className={`${karla.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <body style={{ fontFamily: "var(--font-sans)" }} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
