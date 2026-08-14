import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "ReplyReady — Three ways forward",
    description: "Turn the difficult email you have been avoiding into three clear, ready-to-send replies.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "ReplyReady — Three ways forward",
      description: "One difficult email in. Three clear decisions out.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1728, height: 904, alt: "ReplyReady — Three ways forward. None of them blank." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ReplyReady — Three ways forward",
      description: "One difficult email in. Three clear decisions out.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
