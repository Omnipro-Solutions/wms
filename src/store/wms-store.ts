import { create } from "zustand";
import * as seed from "@/data/seed";
import {
  applyAdjustment,
  applyHold,
  applyReceipt,
  applyRelease,
  applyReserve,
  availableStock,
} from "@/lib/rules/inventory";
import { canTransition, asnTransitions, commerceTransitions } from "@/lib/state-machines";
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

const nextMovementId = (): string => {
  movementCounter += 1;
  return `mv-${movementCounter}`;
};

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
  // Receiving
  receiveAsn: (asnId: string, receivedQty: number, operatorName: string) => Asn;
  putawayItem: (asnId: string, locationId: string, operatorName: string) => void;
  // Inventory
  adjustInventory: (itemId: string, countedQty: number, operatorName: string) => void;
  relocateInventory: (itemId: string, toLocationId: string, operatorName: string) => void;
}

const recordMovement = (
  partial: Omit<StockMovement, "id" | "createdAt">
): StockMovement => ({
  ...partial,
  id: nextMovementId(),
  createdAt: seed.seedTimestamp,
});

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
        recordMovement({
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
        recordMovement({
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
        recordMovement({
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

  receiveAsn: (asnId, receivedQty, operatorName) => {
    const state = get();
    const asn = state.asnRecords.find((a) => a.id === asnId);
    if (!asn) throw new Error("ASN not found");
    const canReceive =
      asn.status === "in_progress" ||
      asn.status === "partial" ||
      canTransition(asnTransitions, asn.status, "in_progress");
    if (!canReceive) throw new Error(`No se puede recibir desde el estado ${asn.status}`);
    if (receivedQty <= 0) throw new Error("quantity must be positive");

    // Find or create inventory item in staging/QC location
    const targetLocationId = asn.requiresQualityControl ? "loc-qc" : "loc-stageout";
    const existingItemIdx = state.inventoryItems.findIndex(
      (i) => i.productId === asn.productId && i.warehouseId === "wh-bog" && i.locationId === targetLocationId
    );

    const newTotal = asn.receivedQuantity + receivedQty;
    const finalStatus = newTotal >= asn.expectedQuantity ? "completed" : "partial";
    const updatedAsn: Asn = { ...asn, receivedQuantity: newTotal, status: finalStatus };

    let updatedItems = [...state.inventoryItems];
    if (existingItemIdx >= 0) {
      const existing = updatedItems[existingItemIdx];
      updatedItems[existingItemIdx] = {
        ...existing,
        ...applyReceipt(existing, receivedQty),
      };
    } else {
      updatedItems = [
        ...updatedItems,
        {
          id: `inv-new-${asnId}`,
          productId: asn.productId,
          warehouseId: "wh-bog",
          locationId: targetLocationId,
          onHandQuantity: receivedQty,
          reservedQuantity: 0,
          holdQuantity: 0,
          status: asn.requiresQualityControl ? ("on_hold" as const) : ("available" as const),
        },
      ];
    }

    const movement = recordMovement({
      productId: asn.productId,
      warehouseId: "wh-bog",
      toLocationId: targetLocationId,
      type: "receipt",
      quantity: receivedQty,
      referenceType: "asn",
      referenceId: asnId,
      operatorName,
    });

    set({
      asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsn : a)),
      inventoryItems: updatedItems,
      stockMovements: [...state.stockMovements, movement],
    });
    return updatedAsn;
  },

  putawayItem: (asnId, locationId, operatorName) => {
    const state = get();
    const asn = state.asnRecords.find((a) => a.id === asnId);
    if (!asn) throw new Error("ASN not found");

    // Find inventory in staging/QC for this ASN's product
    const stagingLocationId = asn.requiresQualityControl ? "loc-qc" : "loc-stageout";
    const stagingItemIdx = state.inventoryItems.findIndex(
      (i) =>
        i.productId === asn.productId &&
        i.warehouseId === "wh-bog" &&
        i.locationId === stagingLocationId
    );
    if (stagingItemIdx === -1) throw new Error("No hay stock en staging/QC para este ASN");

    const stagingItem = state.inventoryItems[stagingItemIdx];
    const qtyToMove = stagingItem.onHandQuantity;

    // Move from staging to destination
    let updatedItems = [...state.inventoryItems];
    updatedItems[stagingItemIdx] = { ...stagingItem, onHandQuantity: 0 };

    // Merge or create at destination
    const destIdx = updatedItems.findIndex(
      (i) => i.productId === asn.productId && i.warehouseId === "wh-bog" && i.locationId === locationId
    );
    if (destIdx >= 0) {
      updatedItems[destIdx] = {
        ...updatedItems[destIdx],
        ...applyReceipt(updatedItems[destIdx], qtyToMove),
        status: "available",
      };
    } else {
      updatedItems = [
        ...updatedItems,
        {
          id: `inv-pa-${asnId}`,
          productId: asn.productId,
          warehouseId: "wh-bog",
          locationId,
          onHandQuantity: qtyToMove,
          reservedQuantity: 0,
          holdQuantity: 0,
          status: "available",
        },
      ];
    }

    const movement = recordMovement({
      productId: asn.productId,
      warehouseId: "wh-bog",
      fromLocationId: stagingLocationId,
      toLocationId: locationId,
      type: "putaway",
      quantity: qtyToMove,
      referenceType: "asn",
      referenceId: asnId,
      operatorName,
    });

    set({
      inventoryItems: updatedItems,
      stockMovements: [...state.stockMovements, movement],
    });
  },

  adjustInventory: (itemId, countedQty, operatorName) => {
    const state = get();
    const item = state.inventoryItems.find((i) => i.id === itemId);
    if (!item) throw new Error("inventory item not found");
    const delta = countedQty - item.onHandQuantity;
    const adjusted = applyAdjustment(item, countedQty);
    set({
      inventoryItems: state.inventoryItems.map((i) =>
        i.id === itemId ? { ...i, ...adjusted } : i
      ),
      stockMovements: [
        ...state.stockMovements,
        recordMovement({
          productId: item.productId,
          warehouseId: item.warehouseId,
          fromLocationId: item.locationId,
          toLocationId: item.locationId,
          type: "adjustment",
          quantity: Math.abs(delta),
          referenceType: "manual",
          referenceId: itemId,
          operatorName,
        }),
      ],
    });
  },

  relocateInventory: (itemId, toLocationId, operatorName) => {
    const state = get();
    const item = state.inventoryItems.find((i) => i.id === itemId);
    if (!item) throw new Error("inventory item not found");
    const qty = item.onHandQuantity;

    let updatedItems = state.inventoryItems.map((i) =>
      i.id === itemId ? { ...i, locationId: toLocationId } : i
    );

    // Merge with existing item at destination if present
    const existingDestIdx = updatedItems.findIndex(
      (i) => i.productId === item.productId && i.locationId === toLocationId && i.id !== itemId
    );
    if (existingDestIdx >= 0) {
      const dest = updatedItems[existingDestIdx];
      updatedItems[existingDestIdx] = {
        ...dest,
        onHandQuantity: dest.onHandQuantity + qty,
      };
      updatedItems = updatedItems.filter((i) => i.id !== itemId);
    }

    const movement = recordMovement({
      productId: item.productId,
      warehouseId: item.warehouseId,
      fromLocationId: item.locationId,
      toLocationId,
      type: "putaway",
      quantity: qty,
      referenceType: "slotting",
      referenceId: itemId,
      operatorName,
    });

    set({
      inventoryItems: updatedItems,
      stockMovements: [...state.stockMovements, movement],
    });
  },
}));
