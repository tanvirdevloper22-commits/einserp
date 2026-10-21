"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

export default function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="nav" aria-label="Main">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
