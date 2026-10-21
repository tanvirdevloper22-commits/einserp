"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

export default function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon name={icon} />
      {label}
    </Link>
  );
}
