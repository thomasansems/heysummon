"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { type CSSProperties, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  Users,
  Building2,
  ScrollText,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronUp,
  UserCog,
  Plug,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const mainNav = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
];

const providerNav = [
  { label: "Providers", href: "/dashboard/providers", icon: Users },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
];

const adminNav = [
  { label: "Requests", href: "/dashboard/requests", icon: Inbox },
  { label: "Users", href: "/dashboard/users", icon: UserCog },
  { label: "Audit Logs", href: "/dashboard/audit-logs", icon: ScrollText },
];

function NavGroup({
  items,
  label,
  pathname,
  badges,
}: {
  items: { label: string; href: string; icon: React.ElementType }[];
  label?: string;
  pathname: string;
  badges?: Record<string, number>;
}) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const badge = badges?.[item.href] ?? 0;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className="gap-2.5 px-3 text-sidebar-foreground/70 hover:bg-transparent hover:text-sidebar-foreground/70 active:bg-transparent active:text-sidebar-foreground/70 data-[state=open]:hover:bg-transparent data-[state=open]:hover:text-sidebar-foreground/70 data-[active]:bg-transparent data-[active]:text-sidebar-foreground data-[active]:shadow-none"
                >
                  <Link href={item.href}>
                  <item.icon className="menu-icon h-[15px] w-[15px] shrink-0 text-sidebar-foreground/55" />
                  <span className="text-sm">{item.label}</span>
                  {badge > 0 && (
                    <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {badge}
                    </span>
                  )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { open } = useSidebar();

  const [mounted, setMounted] = useState(false);
  const [pendingIpCount, setPendingIpCount] = useState(0);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/dashboard/pending-ip-count")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.count) setPendingIpCount(data.count); })
      .catch(() => {});
  }, []);

  const userName = session?.user?.name ?? "";
  const userImage = session?.user?.image ?? "";
  const initials = userName.slice(0, 2).toUpperCase() || "?";
  const sidebarStyle = {
    "--sidebar-width": "11rem",
    "--sidebar-width-icon": "3.25rem",
  } as CSSProperties;

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={sidebarStyle}>

      {/* {open && ( */}
        <SidebarHeader className="px-2 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 px-2.5 pt-2">
            <Image
              src="/hey-summon.png"
              alt="HeySummon logo"
              width={open ? 26 : 18}
              height={open ? 26 : 18}
              className={`${open ? "h-6 w-6" : "h-4 w-4"} shrink-0 ml--1.5 transition-all`}
              priority
            />
          </Link>
        </SidebarHeader>
      {/* )} */}

      {/* Nav */}
      <SidebarContent className="gap-0">
        <NavGroup items={mainNav} pathname={pathname} badges={pendingIpCount > 0 ? { "/dashboard": pendingIpCount } : undefined} />
        <NavGroup items={providerNav} pathname={pathname} />
        <NavGroup items={adminNav} pathname={pathname} />
      </SidebarContent>

      {/* User footer — suppress hydration warning because DropdownMenu (Base UI)
          generates IDs that differ between SSR and client hydration */}
      <SidebarFooter className="p-2" suppressHydrationWarning>
        <SidebarMenu suppressHydrationWarning>
          <SidebarMenuItem suppressHydrationWarning>
            {mounted && (
              <DropdownMenu>
                <SidebarMenuButton asChild className="h-10 gap-2.5">
                  <DropdownMenuTrigger>
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={userImage} alt={userName} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col overflow-hidden text-left">
                    <span className="truncate text-xs font-medium leading-tight">
                      {userName || "Account"}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground leading-tight">
                      {session?.user?.email ?? ""}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                </SidebarMenuButton>
                <DropdownMenuContent side="top" align="start" className="w-52">
                  <DropdownMenuItem
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? (
                      <Sun className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Moon className="mr-2 h-3.5 w-3.5" />
                    )}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="mr-2 h-3.5 w-3.5" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    variant="destructive"
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
