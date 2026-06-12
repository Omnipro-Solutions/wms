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
  Settings,
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
      { label: 'Slotting', href: '/slotting' },
      { label: 'Abastecimiento', href: '/replenishment' },
    ],
  },
  {
    title: 'Operación',
    icon: ClipboardList,
    items: [
      { label: 'Traslados', href: '/transfers' },
      { label: 'Devoluciones', href: '/returns' },
      { label: 'Commerce', href: '/commerce' },
      { label: 'Tareas de picking', href: '/picking/tasks' },
      { label: 'Oleadas', href: '/picking/waves' },
      { label: 'Packing', href: '/packing' },
      { label: 'Etiquetas', href: '/labels' },
    ],
  },
  {
    title: 'Despacho',
    icon: Truck,
    items: [
      { label: 'Shipping', href: '/shipping' },
      { label: 'Rutas SAP', href: '/sap-routes' },
      { label: 'Manifiestos', href: '/load-manifests' },
    ],
  },
  {
    title: 'Sistema',
    icon: Settings,
    items: [
      { label: 'Integraciones', href: '/integrations', icon: Cable },
      { label: 'Reportes', href: '/reports', icon: BarChart3 },
      { label: 'Administración', href: '/admin', icon: Settings },
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
