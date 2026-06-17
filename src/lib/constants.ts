import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Cable,
  ClipboardList,
  Grid3x3,
  // LayoutDashboard,
  ListChecks,
  MapPinned,
  Package,
  PackageCheck,
  Route,
  ShoppingCart,
  Tags,
  Truck,
  Undo2,
  Warehouse,
  Waves,
} from 'lucide-react'
import type { NavGroup } from '@/types/navigation'

export const NAV_GROUPS: NavGroup[] = [
  // {
  //   title: "General",
  //   icon: LayoutDashboard,
  //   isActive: true,
  //   items: [
  //     { label: "Dashboard", href: "/" },
  //   ],
  // },
  {
    title: 'Entrada',
    icon: PackageCheck,
    items: [
      { label: 'Recepción', href: '/receiving' },
      { label: 'Inventario', href: '/inventory' },
      { label: 'Trazabilidad lotes', href: '/inventory/lot-trace' },
      { label: 'Ubicaciones', href: '/locations' },
      { label: 'Slotting', href: '/slotting' },
    ],
  },
  {
    title: 'Operación',
    icon: ClipboardList,
    items: [
      { label: 'Traslados', href: '/transfers' },
      { label: 'Devoluciones', href: '/returns' },
      { label: 'Commerce', href: '/commerce' },
      { label: 'Picking', href: '/picking', icon: ClipboardList },
      { label: 'Packing', href: '/packing' },
      { label: 'Etiquetas', href: '/labels' },
    ],
  },
  {
    title: 'Despacho',
    icon: Truck,
    items: [
      { label: 'Shipping', href: '/shipping' },
      { label: 'Manifiestos', href: '/load-manifests' },
    ],
  },
  {
    title: 'Sistema',
    icon: BarChart3,
    items: [
      { label: 'Integraciones', href: '/integrations', icon: Cable },
      { label: 'Reportes', href: '/reports', icon: BarChart3 },
    ],
  },
]

export const ALERTS_ICON = AlertTriangle
export const TASKS_ICON = ListChecks

// Individual icons kept for direct use elsewhere
export {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Cable,
  Grid3x3,
  MapPinned,
  Package,
  Route,
  ShoppingCart,
  Tags,
  Undo2,
  Warehouse,
  Waves,
}
