"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/markets", label: "Markets" },
  { href: "/margin-desk", label: "Margin" },
  { href: "/activity", label: "Activity" },
  { href: "/me/notifications", label: "Notifications" },
  { href: "/me/settings", label: "Settings" },
  { href: "/social", label: "Social" },
  { href: "/leaderboard", label: "Leaders" },
  { href: "/docs", label: "Docs" },
  { href: "/me/profile", label: "Profile" },
];

const terminalRoutePrefixes = [
  "/activity",
  "/docs",
  "/leaderboard",
  "/margin",
  "/margin-desk",
  "/markets",
  "/me",
  "/social",
  "/support",
  "/vaults",
];

export function AppHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showEmailBanner, setShowEmailBanner] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissedEmailBanner = sessionStorage.getItem("email-banner-dismissed");

    if (!dismissedEmailBanner) {
      const timer = setTimeout(() => {
        setShowEmailBanner(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  if (
    pathname === "/" ||
    terminalRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
  ) {
    return null;
  }

  return (
    <header className="app-header">
      <Link aria-label="Conviction Markets home" className="brand brand--image" href="/">
        <Image
          alt="Conviction Markets"
          height={120}
          priority
          src="/logo/conviction-markets-header.png"
          width={620}
        />
      </Link>

      {showEmailBanner ? (
        <div className="email-banner">
          <p>
            Set your email for position notifications and updates.
            <Link href="/me/profile" onClick={() => setShowEmailBanner(false)}>
              Add email
            </Link>
          </p>
          <button
            aria-label="Dismiss email prompt"
            className="email-banner-close"
            onClick={() => {
              setShowEmailBanner(false);
              sessionStorage.setItem("email-banner-dismissed", "true");
            }}
            type="button"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      ) : null}

      <div className="app-menu">
        <button
          aria-controls="primary-menu"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          className={isOpen ? "menu-toggle open" : "menu-toggle"}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={isOpen ? "app-nav-panel open" : "app-nav-panel"} id="primary-menu">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link aria-current={isActive ? "page" : undefined} href={item.href} key={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
