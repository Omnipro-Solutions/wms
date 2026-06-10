import { create } from "zustand";
import * as seed from "@/data/seed";
import {
  applyHold,
  applyRelease,
  applyReserve,
  availableStock,
} from "@/lib/rules/inventory";
import { canTransition, commerceTransitions } from "@/lib/state-machines";
import type {
  Asn,
  Carrier,
  CommerceOrder,
  IntegrationConnection,
  InventoryItem,
  LoadManifest,
  Operator,
  PackingOrder,
  PickingTask,
  PickingWave,
  Product,
  ProductDemandStat,
  Reason,
  ReplenishmentTask,
  ReturnOrder,
  SapRoute,
  Shipment,
  StockMovement,
  StorageLocation,
  TransferOrder,
  Warehouse,
  WmsSettings,
} from "@/types/wms";

let movementCounter = seed.stockMovements.length;
function nextMovementId(): string {
  movementCounter += 1;
  return `mv-${movementCounter}`;
}

export interface WmsState {
  warehouses: Warehouse[];
  locations: StorageLocation[];
  products: Product[];
  demandStats: ProductDemandStat[];
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  asnRecords: Asn[];
  transfers: TransferOrder[];
  returnOrders: ReturnOrder[];
  commerceOrders: CommerceOrder[];
  pickingTasks: PickingTask[];
  pickingWaves: PickingWave[];
  packingOrders: PackingOrder[];
  shipments: Shipment[];
  sapRoutes: SapRoute[];
  loadManifests: LoadManifest[];
  integrations: IntegrationConnection[];
  replenishmentTasks: ReplenishmentTask[];
  operators: Operator[];
  reasons: Reason[];
  carriers: Carrier[];
  settings: WmsSettings;

  // Actions (more added per module in later phases)
  reserveInventory: (orderId: string) => CommerceOrder;
  holdInventory: (itemId: string, qty: number, operatorName: string) => void;
  releaseInventory: (itemId: string, qty: number, operatorName: string) => void;
}

function recordMovement(
  state: WmsState,
  partial: Omit<StockMovement, "id" | "createdAt">
): StockMovement {
  return {
    ...partial,
    id: nextMovementId(),
    createdAt: seed.seedTimestamp,
  };
}

export const useWmsStore = create<WmsState>((set, get) => ({
  warehouses: seed.warehouses,
  locations: seed.locations,
  products: seed.products,
  demandStats: seed.demandStats,
  inventoryItems: seed.inventoryItems,
  stockMovements: seed.stockMovements,
  asnRecords: seed.asnRecords,
  transfers: seed.transfers,
  returnOrders: seed.returnOrders,
  commerceOrders: seed.commerceOrders,
  pickingTasks: seed.pickingTasks,
  pickingWaves: seed.pickingWaves,
  packingOrders: seed.packingOrders,
  shipments: seed.shipments,
  sapRoutes: seed.sapRoutes,
  loadManifests: seed.loadManifests,
  integrations: seed.integrations,
  replenishmentTasks: seed.replenishmentTasks,
  operators: seed.operators,
  reasons: seed.reasons,
  carriers: seed.carriers,
  settings: seed.settings,

  reserveInventory: (orderId) => {
    const state = get();
    const order = state.commerceOrders.find((o) => o.id === orderId);
    if (!order) throw new Error("order not found");
    if (!canTransition(commerceTransitions, order.status, "assigned")) {
      throw new Error(`No se puede reservar desde el estado ${order.status}`);
    }

    const items = [...state.inventoryItems];
    const movements: StockMovement[] = [];
    for (const line of order.items) {
      const idx = items.findIndex(
        (i) => i.productId === line.productId && availableStock(i) >= line.requestedQuantity
      );
      if (idx === -1) throw new Error(`Stock insuficiente para reservar ${line.productId}`);
      const reserved = applyReserve(items[idx], line.requestedQuantity);
      items[idx] = { ...items[idx], ...reserved };
      movements.push(
        recordMovement(state, {
          productId: line.productId,
          warehouseId: items[idx].warehouseId,
          type: "transfer",
          quantity: line.requestedQuantity,
          referenceType: "commerce_order",
          referenceId: orderId,
          operatorName: "Sistema",
        })
      );
    }

    const updatedOrder: CommerceOrder = { ...order, status: "assigned" };
    set({
      inventoryItems: items,
      stockMovements: [...state.stockMovements, ...movements],
      commerceOrders: state.commerceOrders.map((o) => (o.id === orderId ? updatedOrder : o)),
    });
    return updatedOrder;
  },

  holdInventory: (itemId, qty, operatorName) => {
    const state = get();
    const item = state.inventoryItems.find((i) => i.id === itemId);
    if (!item) throw new Error("inventory item not found");
    const held = applyHold(item, qty);
    set({
      inventoryItems: state.inventoryItems.map((i) =>
        i.id === itemId ? { ...i, ...held, status: "on_hold" } : i
      ),
      stockMovements: [
        ...state.stockMovements,
        recordMovement(state, {
          productId: item.productId,
          warehouseId: item.warehouseId,
          fromLocationId: item.locationId,
          type: "hold",
          quantity: qty,
          referenceType: "manual",
          referenceId: itemId,
          operatorName,
        }),
      ],
    });
  },

  releaseInventory: (itemId, qty, operatorName) => {
    const state = get();
    const item = state.inventoryItems.find((i) => i.id === itemId);
    if (!item) throw new Error("inventory item not found");
    const released = applyRelease(item, qty);
    set({
      inventoryItems: state.inventoryItems.map((i) =>
        i.id === itemId
          ? { ...i, ...released, status: released.holdQuantity > 0 ? "on_hold" : "available" }
          : i
      ),
      stockMovements: [
        ...state.stockMovements,
        recordMovement(state, {
          productId: item.productId,
          warehouseId: item.warehouseId,
          fromLocationId: item.locationId,
          type: "release",
          quantity: qty,
          referenceType: "manual",
          referenceId: itemId,
          operatorName,
        }),
      ],
    });
  },
}));
