"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Building2,
  Inbox,
  Key,
  FileText,
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Requests", href: "/dashboard/requests", icon: Inbox },
  { label: "Channels", href: "/dashboard/channels", icon: MessageSquare },
  { label: "Providers", href: "/dashboard/providers", icon: Users },
  { label: "Clients", href: "/dashboard/clients", icon: Building2 },
  { label: "API Keys", href: "/dashboard/keys", icon: Key },
  { label: "Audit Logs", href: "/dashboard/audit-logs", icon: FileText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  const userName = session?.user?.name ?? "";
  const userImage = session?.user?.image ?? "";
  const initials = userName.slice(0, 2).toUpperCase() || "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}
        >
          <span className="text-sidebar-foreground text-lg leading-none">
            heySummon
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
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
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <SidebarMenuButton
                render={<DropdownMenuTrigger />}
                className="h-10"
              >
                  <Avatar className="h-6 w-6 shrink-0" size="sm">
                    <AvatarImage src={userImage} alt={userName} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col overflow-hidden text-left">
                    <span className="truncate text-sm font-medium leading-tight">
                      {userName || "Account"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground leading-tight">
                      {session?.user?.email ?? ""}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              </SidebarMenuButton>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  variant="destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
