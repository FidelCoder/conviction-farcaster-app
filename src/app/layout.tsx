import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "../components/AppHeader";
import { MiniAppReady } from "../components/MiniAppReady";
import "./globals.css";

const appUrl = "https://convictionmarkets.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Conviction Markets | Prediction Market Discovery and Margin",
    template: "%s | Conviction Markets",
  },
  description:
    "Browse prediction markets by topic and region, review event details, and request margin using Conviction vault liquidity.",
  applicationName: "Conviction Markets",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "prediction markets",
    "prediction market discovery",
    "crypto prediction markets",
    "sports prediction markets",
    "geopolitics prediction markets",
    "market odds",
    "margin trading",
    "Conviction Markets",
  ],
  openGraph: {
    title: "Conviction Markets",
    description:
      "A prediction market discovery and margin terminal for crypto, sports, geopolitics, culture, economics, and social events.",
    url: appUrl,
    siteName: "Conviction Markets",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conviction Markets",
    description:
      "Browse global prediction markets, review event rules, and request margin through Conviction vault liquidity.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Conviction Markets",
  url: appUrl,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Prediction market discovery and margin terminal for global event markets, wallet users, and liquidity vaults.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <div className="site-backdrop" aria-hidden="true" />
        <AppHeader />
        <MiniAppReady />
        {children}
      </body>
    </html>
  );
}
