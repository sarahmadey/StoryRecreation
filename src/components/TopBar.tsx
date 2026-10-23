"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Emblem, Wordmark } from "./Art";
import type { Profile } from "@/lib/shared/types";

const NAV = [
  { href: "/", label: "Hall", icon: "🏛️" },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/create", label: "Create", icon: "✨" },
  { href: "/read", label: "Read to Me", icon: "🎧" },
];

/** `profile` is undefined for a moment while it's found out: the reader's place is kept, empty. */
export function TopBar({ profile }: { profile: Profile | null | undefined }) {
  const path = usePathname();
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const links = NAV.map((n) => (
    <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
      <span className="nav-icon" aria-hidden="true">
        {n.icon}
      </span>
      {n.label}
    </Link>
  ));
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="Storyhollow, home">
            <Emblem size={50} />
            <Wordmark height={40} className="brand-wordmark" />
          </Link>
          <nav className="nav" aria-label="Main">
            {links}
          </nav>
          <Link href="/who" className="who" title="Switch reader">
            {profile === undefined ? (
              <span className="avatar" style={{ ["--size" as string]: "34px" }} aria-hidden="true" />
            ) : profile ? (
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
      {/* On phones the menu docks at the bottom of the screen. It sits outside the
          header because the header's blur would trap a fixed bar inside it on iPhones. */}
      <nav className="nav nav-dock" aria-label="Main">
        {links}
      </nav>
    </>
  );
}
