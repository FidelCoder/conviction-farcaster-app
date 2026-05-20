import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { MiniAppReady } from "../components/MiniAppReady";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conviction Markets",
  description: "Farcaster surface for real Conviction Markets data.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link className="brand" href="/">
            Conviction Markets
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/markets">Markets</Link>
          </nav>
        </header>
        <MiniAppReady />
        {children}
      </body>
    </html>
  );
}
