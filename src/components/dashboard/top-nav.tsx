"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Providers", href: "/dashboard/providers" },
  { label: "Clients", href: "/dashboard/clients" },
  { label: "Requests", href: "/dashboard/requests" },
  { label: "Settings", href: "/dashboard/settings" },
];

export function TopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-[#eaeaea] bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-bold text-black"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-xs text-white">
            H
          </span>
          HITLaaS
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "font-medium text-black"
                    : "text-[#666] hover:text-black"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-7 w-7 rounded-full"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eaeaea] text-xs font-medium text-[#666]">
              {session?.user?.name?.[0] || "?"}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-[#666] transition-colors hover:text-black"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
