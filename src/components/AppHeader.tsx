"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/markets", label: "Markets" },
  { href: "/margin", label: "Margin" },
  { href: "/me", label: "Activity" },
  { href: "/social", label: "Social" },
  { href: "/leaderboard", label: "Leaders" },
];

export function AppHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (pathname === "/") {
    return null;
  }

  return (
    <header className="app-header">
      <Link className="brand" href="/">
        Conviction Markets
      </Link>

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
