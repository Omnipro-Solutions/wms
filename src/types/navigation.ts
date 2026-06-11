import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export interface NavGroup {
  title: string;
  icon: LucideIcon;
  isActive?: boolean;
  items: NavItem[];
}
