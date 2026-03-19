"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeLabels: Record<string, string> = {
  dashboard: "Overview",
  requests: "Requests",
  providers: "Providers",
  channels: "Channels",
  clients: "Clients",
  keys: "API Keys",
  "audit-logs": "Audit Logs",
  settings: "Settings",
};

export function PageHeader() {
  const pathname = usePathname();
  const segments = pathname.replace(/^\/dashboard\/?/, "").split("/").filter(Boolean);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4 bg-background">
      <SidebarTrigger className="-ml-1 h-8 w-8 mr-2" />
      <Breadcrumb>
        <BreadcrumbList>
          {segments.length === 0 ? (
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm font-medium">Overview</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              {segments.map((seg, i) => {
                const isLast = i === segments.length - 1;
                const href = "/dashboard/" + segments.slice(0, i + 1).join("/");
                const label = routeLabels[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
                return (
                  <span key={seg} className="flex items-center gap-1.5">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-sm font-medium">{label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={href} className="text-sm text-muted-foreground hover:text-foreground">
                          {label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                );
              })}
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
