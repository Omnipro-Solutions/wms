import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Cable,
  ClipboardList,
  Grid3x3,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  Package,
  PackageCheck,
  Route,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Undo2,
  Warehouse,
  Waves,
} from "lucide-react";
import type { NavGroup } from "@/types/navigation";

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "General",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "Entrada",
    items: [
      { label: "Recepción", href: "/receiving", icon: PackageCheck },
      { label: "Inventario", href: "/inventory", icon: Boxes },
      { label: "Slotting", href: "/slotting", icon: Grid3x3 },
      { label: "Abastecimiento", href: "/replenishment", icon: Warehouse },
    ],
  },
  {
    title: "Operación",
    items: [
      { label: "Traslados", href: "/transfers", icon: ArrowRightLeft },
      { label: "Devoluciones", href: "/returns", icon: Undo2 },
      { label: "Commerce", href: "/commerce", icon: ShoppingCart },
      { label: "Tareas de picking", href: "/picking/tasks", icon: ClipboardList },
      { label: "Oleadas", href: "/picking/waves", icon: Waves },
      { label: "Packing", href: "/packing", icon: Package },
      { label: "Etiquetas", href: "/labels", icon: Tags },
    ],
  },
  {
    title: "Despacho",
    items: [
      { label: "Shipping", href: "/shipping", icon: Truck },
      { label: "Rutas SAP", href: "/sap-routes", icon: Route },
      { label: "Manifiestos", href: "/load-manifests", icon: MapPinned },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Integraciones", href: "/integrations", icon: Cable },
      { label: "Reportes", href: "/reports", icon: BarChart3 },
      { label: "Administración", href: "/admin", icon: Settings },
    ],
  },
];

export const ALERTS_ICON = AlertTriangle;
export const TASKS_ICON = ListChecks;
