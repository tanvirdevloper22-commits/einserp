"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: string };

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {items.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
            title={l.label}
          >
            <Icon name={l.icon} />
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
