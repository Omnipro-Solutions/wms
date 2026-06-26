import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "WMS",
  brand: "Omni.pro",
  version: packageJson.version,
  copyright: `© ${currentYear} Omni.pro. Todos los derechos reservados.`,
  meta: {
    title: "WMS by Omni.pro — Warehouse Management System",
    description:
      "Sistema de gestión de almacenes para centros de distribución y tiendas. Cubre el ciclo completo: recepción, inventario, picking, packing, despacho y devoluciones.",
  },
};
