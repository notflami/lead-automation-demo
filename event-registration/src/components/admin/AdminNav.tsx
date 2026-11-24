"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/settings", label: "Event settings" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4" aria-label="Admin">
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-[3px] px-3 py-3 text-[15px] font-medium ${
              active ? "border-saffron text-linen" : "border-transparent text-linen/65 hover:text-linen"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
