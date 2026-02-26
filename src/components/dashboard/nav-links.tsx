"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, Settings, Users } from "lucide-react";

type Props = {
  orgSlug: string;
};

const links = (orgSlug: string) => [
  { href: `/${orgSlug}/audit`,    label: "Audit",        icon: null },
  { href: `/${orgSlug}/closures`, label: "Clôtures",     icon: <Scale   className="w-3.5 h-3.5" /> },
  { href: `/${orgSlug}/members`,  label: "Équipe",        icon: <Users   className="w-3.5 h-3.5" /> },
  { href: `/${orgSlug}/settings`, label: "Paramètres",   icon: <Settings className="w-3.5 h-3.5" /> },
];

export default function NavLinks({ orgSlug }: Props) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-3 text-xs font-medium">
      {links(orgSlug).map(({ href, label, icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-1 transition-colors ${
              isActive
                ? "text-white font-semibold"
                : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {icon}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
