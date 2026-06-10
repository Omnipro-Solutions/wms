"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./app-sidebar";

export function AppHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="size-5" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <AppSidebar />
        </SheetContent>
      </Sheet>
      <div className="flex-1">
        <p className="text-sm font-medium">Operación logística</p>
      </div>
      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        OP
      </div>
    </header>
  );
}
