import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "../components/AppHeader";
import { MiniAppReady } from "../components/MiniAppReady";
import "./globals.css";

const appUrl = "https://convictionmarkets.xyz";
const appName = "Conviction Markets";
const productDescription =
  "A leveraged prediction market platform where traders get more exposure to event markets and liquidity providers earn yield through vaults.";

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
      alternateName: ["Conviction", "Conviction Markets App"],
      url: appUrl,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: productDescription,
      keywords:
        "leveraged prediction markets, prediction market margin, event trading, liquidity vaults, vault yield",
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
        {children}
      </body>
    </html>
  );
}
