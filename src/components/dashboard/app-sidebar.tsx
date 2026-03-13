"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
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
  SidebarSeparator,
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
  { label: "Requests", href: "/dashboard/requests", icon: Inbox },
];

const providerNav = [
  { label: "Providers", href: "/dashboard/providers", icon: Users },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
];

const adminNav = [
  { label: "Audit Logs", href: "/dashboard/audit-logs", icon: ScrollText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function NavGroup({
  items,
  label,
  pathname,
}: {
  items: { label: string; href: string; icon: React.ElementType }[];
  label?: string;
  pathname: string;
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
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive}
                  tooltip={item.label}
                  className="gap-2.5"
                >
                  <item.icon className="h-[15px] w-[15px] shrink-0" />
                  <span className="text-sm">{item.label}</span>
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
  useEffect(() => setMounted(true), []);

  const userName = session?.user?.name ?? "";
  const userImage = session?.user?.image ?? "";
  const initials = userName.slice(0, 2).toUpperCase() || "?";

  return (
    <Sidebar collapsible="icon">

      {open && (
        <SidebarHeader className="border-b border-sidebar-border px-2 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-2 px-1">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              HeySummon
            </span>
          </Link>
        </SidebarHeader>
      )}

      {/* Nav */}
      <SidebarContent className="gap-0">
        <NavGroup items={mainNav} pathname={pathname} />
        <SidebarSeparator className="mx-3 my-1" />
        <NavGroup items={providerNav} label="Providers" pathname={pathname} />
        <SidebarSeparator className="mx-3 my-1" />
        <NavGroup items={adminNav} label="Admin" pathname={pathname} />
      </SidebarContent>

      {/* User footer — suppress hydration warning because DropdownMenu (Base UI)
          generates IDs that differ between SSR and client hydration */}
      <SidebarFooter className="border-t border-sidebar-border p-2" suppressHydrationWarning>
        <SidebarMenu suppressHydrationWarning>
          <SidebarMenuItem suppressHydrationWarning>
            {mounted && (
              <DropdownMenu>
                <SidebarMenuButton render={<DropdownMenuTrigger />} className="h-10 gap-2.5">
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
    </Sidebar>
  );
}
