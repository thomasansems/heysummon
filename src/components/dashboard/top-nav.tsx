"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Users", href: "/dashboard/providers" },
  { label: "Channels", href: "/dashboard/channels" },
  { label: "Clients", href: "/dashboard/clients" },
  { label: "Requests", href: "/dashboard/requests" },
  { label: "Audit Logs", href: "/dashboard/audit-logs" },
  { label: "Settings", href: "/dashboard/settings" },
];

// How many items to show before "More" at each breakpoint
const VISIBLE_ITEMS_MOBILE = 3;
const VISIBLE_ITEMS_TABLET = 5;

export function TopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(navItems.length);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) setVisibleCount(VISIBLE_ITEMS_MOBILE);
      else if (w < 1024) setVisibleCount(VISIBLE_ITEMS_TABLET);
      else setVisibleCount(navItems.length);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visible = navItems.slice(0, visibleCount);
  const overflow = navItems.slice(visibleCount);

  return (
    <header className="sticky top-0 z-50 border-b border-[#eaeaea] bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-bold text-black"
        >
          <span style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 700, fontSize: '1.15rem' }}>heySummon</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {visible.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1.5 text-xs sm:text-sm sm:px-3 transition-colors whitespace-nowrap ${
                  isActive
                    ? "font-medium text-black"
                    : "text-[#666] hover:text-black"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {overflow.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`rounded-md px-2 py-1.5 text-xs sm:text-sm sm:px-3 transition-colors whitespace-nowrap ${
                  overflow.some((item) => pathname.startsWith(item.href))
                    ? "font-medium text-black"
                    : "text-[#666] hover:text-black"
                }`}
              >
                More ▾
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[160px] rounded-lg border border-[#eaeaea] bg-white py-1 shadow-lg z-50">
                  {overflow.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          isActive
                            ? "font-medium text-black bg-[#f5f5f5]"
                            : "text-[#666] hover:text-black hover:bg-[#fafafa]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
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
            className="hidden sm:block text-sm text-[#666] transition-colors hover:text-black"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
