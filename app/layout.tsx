import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ascent — Health Dashboard",
  description: "Live health metrics powered by Whoop. Recovery, sleep, strain, and workout data.",
  metadataBase: new URL("https://ascent.matthewjamesschmidt.com"),
  openGraph: {
    title: "Ascent — Health Dashboard",
    description: "Live health metrics powered by Whoop.",
    url: "https://ascent.matthewjamesschmidt.com",
    siteName: "Ascent",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
