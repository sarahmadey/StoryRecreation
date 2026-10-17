"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lantern } from "./Art";
import type { Profile } from "@/lib/shared/types";

const NAV = [
  { href: "/", label: "Hall", icon: "🏛️" },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/create", label: "Create", icon: "✨" },
  { href: "/read", label: "Read to Me", icon: "🎧" },
];

export function TopBar({ profile }: { profile: Profile | null }) {
  const path = usePathname();
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="Lantern Library, home">
          <Lantern />
          <span className="brand-name">Lantern Library</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
              <span className="nav-icon" aria-hidden="true">
                {n.icon}
              </span>
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/who" className="who" title="Switch reader">
          {profile ? (
            <>
              <span className="avatar" style={{ ["--c" as string]: profile.color, ["--size" as string]: "34px" }}>
                {profile.avatar}
              </span>
              <span className="who-name">{profile.name}</span>
            </>
          ) : (
            <>
              <span className="avatar" style={{ ["--size" as string]: "34px" }}>
                🕯️
              </span>
              <span className="who-name">Who's here?</span>
            </>
          )}
        </Link>
        <Link href="/grownups" className="icon-btn" title="Grown-ups' corner" aria-label="Grown-ups' corner">
          🗝️
        </Link>
      </div>
    </header>
  );
}
