import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { AppHeader } from "../components/AppHeader";
import { MiniAppReady } from "../components/MiniAppReady";
import "./globals.css";

const appUrl = "https://convictionmarkets.xyz";
const appName = "Conviction Markets";
const productDescription =
  "Conviction Markets is a leveraged prediction market platform for event trading, market discovery, margin trading, and vault liquidity yield.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Conviction Markets | Leveraged Prediction Markets",
    template: "%s | Conviction Markets",
  },
  description: productDescription,
  applicationName: appName,
  authors: [{ name: appName, url: appUrl }],
  creator: appName,
  publisher: appName,
  category: "finance",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "leveraged prediction markets",
    "prediction markets",
    "prediction market margin",
    "prediction market leverage",
    "crypto prediction markets",
    "sports prediction markets",
    "event markets",
    "event trading",
    "geopolitics prediction markets",
    "prediction market odds",
    "margin trading",
    "vault yield",
    "liquidity vaults",
    "Polymarket leverage",
    "Polymarket margin",
    "Conviction Markets",
    "conviction markets",
    "Conviction Markets prediction markets",
    "prediction market trading",
    "leveraged event markets",
    "margin trading prediction markets",
  ],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/logo/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/logo/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "llms-txt": appUrl + "/llms.txt",
  },
  openGraph: {
    title: "Conviction Markets | Leveraged Prediction Markets",
    description: productDescription,
    url: appUrl,
    siteName: appName,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/logo/conviction-markets-3d-black-bg.png",
        width: 1600,
        height: 900,
        alt: "Conviction Markets logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Conviction Markets | Leveraged Prediction Markets",
    description: productDescription,
    images: ["/logo/conviction-markets-3d-black-bg.png"],
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
  "@graph": [
    {
      "@type": "Organization",
      "@id": appUrl + "/#organization",
      name: appName,
      url: appUrl,
      logo: appUrl + "/logo/conviction-markets-landscape-light.png",
      description:
        "Conviction Markets builds vault-backed leverage for prediction market traders and yield opportunities for liquidity providers.",
      sameAs: [
        "https://x.com/VictionMarkets",
        "https://t.me/+KYjXR2Tz2P4xMGY0",
      ],
    },
    {
      "@type": "WebSite",
      "@id": appUrl + "/#website",
      name: appName,
      url: appUrl,
      description: productDescription,
      publisher: {
        "@id": appUrl + "/#organization",
      },
      potentialAction: {
        "@type": "SearchAction",
        target: appUrl + "/markets?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      "@id": appUrl + "/#app",
      name: appName,
      alternateName: [
        "Conviction",
        "Conviction Markets App",
        "Conviction Markets prediction markets",
        "Conviction margin trading",
      ],
      url: appUrl,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: productDescription,
      keywords:
        "Conviction Markets, leveraged prediction markets, prediction markets, prediction market margin, margin trading, event trading, event markets, liquidity vaults, vault yield, crypto prediction markets, sports prediction markets",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "FAQPage",
      "@id": appUrl + "/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Conviction Markets?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Conviction Markets is a leveraged marketplace for prediction markets. Traders can get more exposure to event markets using vault-backed liquidity.",
          },
        },
        {
          "@type": "Question",
          name: "How do liquidity providers earn on Conviction Markets?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Liquidity providers supply capital to vaults and earn yield from margin activity on the platform.",
          },
        },
        {
          "@type": "Question",
          name: "Is Conviction Markets a prediction markets platform?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Conviction Markets helps users discover event markets, review rules and odds, discuss market news, and use vault-backed margin tools for more exposure when the rails are available.",
          },
        },
        {
          "@type": "Question",
          name: "How is Conviction Markets different from a regular prediction market?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Conviction adds a margin desk, vault liquidity, portfolio tracking, .viction identity, and a social Market Pulse layer around prediction market data.",
          },
        },
      ],
    },
  ],
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
        <Script src="https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
