"use client";

import { Warehouse } from "lucide-react";
import { NAV_GROUPS } from "@/lib/constants";
import { SidebarNavItem } from "./sidebar-nav-item";

export function AppSidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Warehouse className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">WMS Omni</p>
          <p className="text-xs text-muted-foreground">Gestión de bodega</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarNavItem key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
