import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "../components/AppHeader";
import { MiniAppReady } from "../components/MiniAppReady";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conviction Markets",
  description: "Prediction-market margin desk for conviction trades.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        <MiniAppReady />
        {children}
      </body>
    </html>
  );
}
