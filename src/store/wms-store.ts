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
import {
  canTransition,
  asnTransitions,
  commerceTransitions,
  pickingTaskTransitions,
  waveTransitions,
  transferTransitions,
  returnTransitions,
} from "@/lib/state-machines";
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
  WmsLabel,
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
  labels: WmsLabel[];
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
  // Picking
  startPicking: (taskId: string, operatorName: string) => PickingTask;
  completePick: (taskId: string, pickedQty: number, reasonId?: string) => PickingTask;
  approvePart: (taskId: string) => PickingTask;
  rejectPart: (taskId: string) => PickingTask;
  // Waves
  releaseWave: (waveId: string) => PickingWave;
  // Packing
  completePacking: (packingOrderId: string, scannedItems: number) => PackingOrder;
  generateLabel: (packingOrderId: string) => PackingOrder;
  // Shipping
  shipOrder: (shipmentId: string, operatorName: string) => Shipment;
  // Transfers
  advanceTransfer: (transferId: string, operatorName: string) => TransferOrder;
  // Returns
  advanceReturn: (returnId: string, operatorName: string) => ReturnOrder;
  // Replenishment
  startReplenishment: (taskId: string, operatorName: string) => ReplenishmentTask;
  completeReplenishment: (taskId: string) => ReplenishmentTask;
  // Admin — Operators
  createOperator: (data: Omit<Operator, "id">) => Operator;
  updateOperator: (id: string, data: Partial<Omit<Operator, "id">>) => Operator;
  toggleOperator: (id: string) => Operator;
  // Admin — Reasons
  createReason: (data: Omit<Reason, "id">) => Reason;
  updateReason: (id: string, data: Partial<Omit<Reason, "id">>) => Reason;
  toggleReason: (id: string) => Reason;
  // Admin — Carriers
  createCarrier: (data: Omit<Carrier, "id">) => Carrier;
  updateCarrier: (id: string, data: Partial<Omit<Carrier, "id">>) => Carrier;
  toggleCarrier: (id: string) => Carrier;
  // Admin — Settings
  updateSettings: (data: Partial<WmsSettings>) => WmsSettings;
  // Admin — Warehouses
  createWarehouse: (data: Omit<Warehouse, "id">) => Warehouse;
  updateWarehouse: (id: string, data: Partial<Omit<Warehouse, "id">>) => Warehouse;
  // Admin — Locations
  createLocation: (data: Omit<StorageLocation, "id">) => StorageLocation;
  updateLocation: (id: string, data: Partial<Omit<StorageLocation, "id">>) => StorageLocation;
  // Admin — Products
  createProduct: (data: Omit<Product, "id">) => Product;
  updateProduct: (id: string, data: Partial<Omit<Product, "id">>) => Product;
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
  labels: seed.labels,
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

  // ─── Picking ──────────────────────────────────────────────────────────────

  startPicking: (taskId, operatorName) => {
    const state = get();
    const task = state.pickingTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("picking task not found");
    const canAssign = canTransition(pickingTaskTransitions, task.status, "assigned");
    const canStart = canTransition(pickingTaskTransitions, task.status, "in_progress");
    if (!canAssign && !canStart) {
      throw new Error(`No se puede iniciar tarea desde el estado ${task.status}`);
    }
    const nextStatus = task.status === "assigned" ? "in_progress" : "assigned";
    const updated: PickingTask = { ...task, status: nextStatus, operatorName };
    set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) });
    return updated;
  },

  completePick: (taskId, pickedQty, reasonId) => {
    const state = get();
    const task = state.pickingTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("picking task not found");
    if (!canTransition(pickingTaskTransitions, task.status, "completed") &&
        !canTransition(pickingTaskTransitions, task.status, "partially_picked")) {
      throw new Error(`No se puede completar tarea desde el estado ${task.status}`);
    }

    const clamped = Math.min(pickedQty, task.requestedQuantity);
    const isPartial = clamped < task.requestedQuantity;
    const nextStatus: PickingTask["status"] = isPartial
      ? (clamped === 0 ? "partial_with_shortage" : "partially_picked")
      : "completed";

    const updated: PickingTask = {
      ...task,
      pickedQuantity: clamped,
      pendingQuantity: task.requestedQuantity - clamped,
      status: nextStatus,
      ...(isPartial && reasonId ? { partialReasonId: reasonId } : {}),
    };

    // Deduct reserved inventory when picking completes
    const inventoryItem = state.inventoryItems.find(
      (i) => i.productId === task.productId && i.locationId === task.locationId
    );
    const updatedItems = inventoryItem
      ? state.inventoryItems.map((i) =>
          i.id === inventoryItem.id
            ? { ...i, onHandQuantity: Math.max(0, i.onHandQuantity - clamped), reservedQuantity: Math.max(0, i.reservedQuantity - clamped) }
            : i
        )
      : state.inventoryItems;

    const movement = recordMovement({
      productId: task.productId,
      warehouseId: "wh-bog",
      fromLocationId: task.locationId,
      type: "pick",
      quantity: clamped,
      referenceType: "commerce_order",
      referenceId: task.orderId,
      operatorName: task.operatorName ?? "Operador",
    });

    set({
      pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)),
      inventoryItems: updatedItems,
      stockMovements: [...state.stockMovements, movement],
    });
    return updated;
  },

  approvePart: (taskId) => {
    const state = get();
    const task = state.pickingTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("picking task not found");
    if (!canTransition(pickingTaskTransitions, task.status, "partial_approved")) {
      throw new Error(`No se puede aprobar parcial desde el estado ${task.status}`);
    }
    const updated: PickingTask = { ...task, status: "partial_approved" };
    set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) });
    return updated;
  },

  rejectPart: (taskId) => {
    const state = get();
    const task = state.pickingTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("picking task not found");
    if (!canTransition(pickingTaskTransitions, task.status, "partial_rejected")) {
      throw new Error(`No se puede rechazar parcial desde el estado ${task.status}`);
    }
    const updated: PickingTask = { ...task, status: "partial_rejected" };
    set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) });
    return updated;
  },

  // ─── Waves ────────────────────────────────────────────────────────────────

  releaseWave: (waveId) => {
    const state = get();
    const wave = state.pickingWaves.find((w) => w.id === waveId);
    if (!wave) throw new Error("picking wave not found");
    if (!canTransition(waveTransitions, wave.status, "in_progress")) {
      throw new Error(`No se puede liberar oleada desde el estado ${wave.status}`);
    }
    const updated: PickingWave = { ...wave, status: "in_progress" };
    set({ pickingWaves: state.pickingWaves.map((w) => (w.id === waveId ? updated : w)) });
    return updated;
  },

  // ─── Packing ──────────────────────────────────────────────────────────────

  completePacking: (packingOrderId, scannedItems) => {
    const state = get();
    const order = state.packingOrders.find((p) => p.id === packingOrderId);
    if (!order) throw new Error("packing order not found");
    const verificationStatus = scannedItems === order.expectedItems ? "verified" : "mismatch";
    const updated: PackingOrder = { ...order, scannedItems, verificationStatus };
    set({ packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)) });
    return updated;
  },

  generateLabel: (packingOrderId) => {
    const state = get();
    const order = state.packingOrders.find((p) => p.id === packingOrderId);
    if (!order) throw new Error("packing order not found");
    const updated: PackingOrder = { ...order, labelGenerated: true };
    set({ packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)) });
    return updated;
  },

  // ─── Shipping ─────────────────────────────────────────────────────────────

  shipOrder: (shipmentId) => {
    const state = get();
    const shipment = state.shipments.find((s) => s.id === shipmentId);
    if (!shipment) throw new Error("shipment not found");
    const updated: Shipment = {
      ...shipment,
      status: "in_transit",
      shippedAt: seed.seedTimestamp,
      trackingNumber: shipment.trackingNumber ?? `TRK-${shipmentId.toUpperCase()}`,
    };
    set({ shipments: state.shipments.map((s) => (s.id === shipmentId ? updated : s)) });
    return updated;
  },

  // ─── Transfers ────────────────────────────────────────────────────────────

  advanceTransfer: (transferId, operatorName) => {
    const state = get();
    const transfer = state.transfers.find((t) => t.id === transferId);
    if (!transfer) throw new Error("transfer not found");

    // Determine next logical status along the happy path
    const NEXT: Partial<Record<string, string>> = {
      draft: "pending",
      pending: "in_progress",
      in_progress: "in_transit",
      in_transit: "completed",
      partial: "completed",
    };
    const next = NEXT[transfer.status] as typeof transfer.status | undefined;
    if (!next || !canTransition(transferTransitions, transfer.status, next)) {
      throw new Error(`No se puede avanzar traslado desde el estado ${transfer.status}`);
    }

    const updated: TransferOrder = { ...transfer, status: next };
    const movements: StockMovement[] = [];

    if (next === "completed") {
      for (const line of transfer.items) {
        movements.push(
          recordMovement({
            productId: line.productId,
            warehouseId: transfer.originId,
            type: "transfer",
            quantity: line.requestedQuantity,
            referenceType: "transfer",
            referenceId: transferId,
            operatorName,
          })
        );
      }
    }

    set({
      transfers: state.transfers.map((t) => (t.id === transferId ? updated : t)),
      stockMovements: [...state.stockMovements, ...movements],
    });
    return updated;
  },

  // ─── Returns ──────────────────────────────────────────────────────────────

  advanceReturn: (returnId, operatorName) => {
    const state = get();
    const ret = state.returnOrders.find((r) => r.id === returnId);
    if (!ret) throw new Error("return order not found");

    const NEXT: Partial<Record<string, string>> = {
      requested: "received_at_store",
      received_at_store: "in_transit_to_dc",
      in_transit_to_dc: "received_at_dc",
      received_at_dc: "under_validation",
      under_validation: ret.disposition === "restock" ? "reentered"
        : ret.disposition === "scrap" ? "sent_to_scrap"
        : ret.disposition === "repair" ? "sent_to_repair"
        : "sent_to_quality_control",
      sent_to_quality_control: ret.disposition === "restock" ? "reentered" : "sent_to_scrap",
      sent_to_repair: "reentered",
      reentered: "closed",
      sent_to_scrap: "closed",
      rejected: "closed",
    };
    const next = NEXT[ret.status] as typeof ret.status | undefined;
    if (!next || !canTransition(returnTransitions, ret.status, next)) {
      throw new Error(`No se puede avanzar devolución desde el estado ${ret.status}`);
    }

    const updated: ReturnOrder = { ...ret, status: next };
    const movements: StockMovement[] = [];

    if (next === "reentered") {
      for (const line of ret.items) {
        movements.push(
          recordMovement({
            productId: line.productId,
            warehouseId: ret.destinationId,
            toLocationId: "loc-returns",
            type: "return",
            quantity: line.requestedQuantity,
            referenceType: "return",
            referenceId: returnId,
            operatorName,
          })
        );
      }
    }

    set({
      returnOrders: state.returnOrders.map((r) => (r.id === returnId ? updated : r)),
      stockMovements: [...state.stockMovements, ...movements],
    });
    return updated;
  },

  // ─── Replenishment ────────────────────────────────────────────────────────

  startReplenishment: (taskId, operatorName) => {
    const state = get();
    const task = state.replenishmentTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("replenishment task not found");
    if (task.status !== "pending") throw new Error(`No se puede iniciar desde el estado ${task.status}`);
    const updated: ReplenishmentTask = { ...task, status: "assigned", operatorName };
    set({ replenishmentTasks: state.replenishmentTasks.map((t) => (t.id === taskId ? updated : t)) });
    return updated;
  },

  completeReplenishment: (taskId) => {
    const state = get();
    const task = state.replenishmentTasks.find((t) => t.id === taskId);
    if (!task) throw new Error("replenishment task not found");
    if (task.status !== "assigned") throw new Error(`No se puede completar desde el estado ${task.status}`);

    // Move suggestedQuantity from origin to destination location
    const originIdx = state.inventoryItems.findIndex(
      (i) => i.productId === task.productId && i.locationId === task.originLocationId
    );
    if (originIdx === -1) throw new Error("No hay stock en la ubicación origen");

    const origin = state.inventoryItems[originIdx];
    const qty = Math.min(task.suggestedQuantity, origin.onHandQuantity);
    if (qty <= 0) throw new Error("Sin stock disponible para reponer");

    let updatedItems = state.inventoryItems.map((i, idx) =>
      idx === originIdx ? { ...i, onHandQuantity: i.onHandQuantity - qty } : i
    );

    const destIdx = updatedItems.findIndex(
      (i) => i.productId === task.productId && i.locationId === task.destinationLocationId
    );
    if (destIdx >= 0) {
      updatedItems[destIdx] = {
        ...updatedItems[destIdx],
        onHandQuantity: updatedItems[destIdx].onHandQuantity + qty,
      };
    } else {
      updatedItems = [
        ...updatedItems,
        {
          id: `inv-rp-${taskId}`,
          productId: task.productId,
          warehouseId: "wh-bog",
          locationId: task.destinationLocationId,
          onHandQuantity: qty,
          reservedQuantity: 0,
          holdQuantity: 0,
          status: "available",
        },
      ];
    }

    const updated: ReplenishmentTask = { ...task, status: "completed", currentStock: task.currentStock + qty };
    const movement = recordMovement({
      productId: task.productId,
      warehouseId: "wh-bog",
      fromLocationId: task.originLocationId,
      toLocationId: task.destinationLocationId,
      type: "putaway",
      quantity: qty,
      referenceType: "replenishment",
      referenceId: taskId,
      operatorName: task.operatorName ?? "Operador",
    });

    set({
      replenishmentTasks: state.replenishmentTasks.map((t) => (t.id === taskId ? updated : t)),
      inventoryItems: updatedItems,
      stockMovements: [...state.stockMovements, movement],
    });
    return updated;
  },

  // ─── Admin ────────────────────────────────────────────────────────────────

  createOperator: (data) => {
    const state = get();
    const created: Operator = { ...data, id: `op-${Date.now()}` };
    set({ operators: [...state.operators, created] });
    return created;
  },

  updateOperator: (id, data) => {
    const state = get();
    const op = state.operators.find((o) => o.id === id);
    if (!op) throw new Error("operator not found");
    const updated: Operator = { ...op, ...data };
    set({ operators: state.operators.map((o) => (o.id === id ? updated : o)) });
    return updated;
  },

  toggleOperator: (id) => {
    const state = get();
    const op = state.operators.find((o) => o.id === id);
    if (!op) throw new Error("operator not found");
    const updated: Operator = { ...op, active: !op.active };
    set({ operators: state.operators.map((o) => (o.id === id ? updated : o)) });
    return updated;
  },

  createReason: (data) => {
    const state = get();
    const created: Reason = { ...data, id: `rs-${Date.now()}` };
    set({ reasons: [...state.reasons, created] });
    return created;
  },

  updateReason: (id, data) => {
    const state = get();
    const reason = state.reasons.find((r) => r.id === id);
    if (!reason) throw new Error("reason not found");
    const updated: Reason = { ...reason, ...data };
    set({ reasons: state.reasons.map((r) => (r.id === id ? updated : r)) });
    return updated;
  },

  toggleReason: (id) => {
    const state = get();
    const reason = state.reasons.find((r) => r.id === id);
    if (!reason) throw new Error("reason not found");
    const updated: Reason = { ...reason, active: !reason.active };
    set({ reasons: state.reasons.map((r) => (r.id === id ? updated : r)) });
    return updated;
  },

  createCarrier: (data) => {
    const state = get();
    const created: Carrier = { ...data, id: `ca-${Date.now()}` };
    set({ carriers: [...state.carriers, created] });
    return created;
  },

  updateCarrier: (id, data) => {
    const state = get();
    const carrier = state.carriers.find((c) => c.id === id);
    if (!carrier) throw new Error("carrier not found");
    const updated: Carrier = { ...carrier, ...data };
    set({ carriers: state.carriers.map((c) => (c.id === id ? updated : c)) });
    return updated;
  },

  toggleCarrier: (id) => {
    const state = get();
    const carrier = state.carriers.find((c) => c.id === id);
    if (!carrier) throw new Error("carrier not found");
    const updated: Carrier = { ...carrier, active: !carrier.active };
    set({ carriers: state.carriers.map((c) => (c.id === id ? updated : c)) });
    return updated;
  },

  updateSettings: (data) => {
    const state = get();
    const updated: WmsSettings = { ...state.settings, ...data };
    set({ settings: updated });
    return updated;
  },

  createWarehouse: (data) => {
    const state = get();
    const created: Warehouse = { ...data, id: `wh-${Date.now()}` };
    set({ warehouses: [...state.warehouses, created] });
    return created;
  },

  updateWarehouse: (id, data) => {
    const state = get();
    const wh = state.warehouses.find((w) => w.id === id);
    if (!wh) throw new Error("warehouse not found");
    const updated: Warehouse = { ...wh, ...data };
    set({ warehouses: state.warehouses.map((w) => (w.id === id ? updated : w)) });
    return updated;
  },

  createLocation: (data) => {
    const state = get();
    const created: StorageLocation = { ...data, id: `loc-${Date.now()}` };
    set({ locations: [...state.locations, created] });
    return created;
  },

  updateLocation: (id, data) => {
    const state = get();
    const loc = state.locations.find((l) => l.id === id);
    if (!loc) throw new Error("location not found");
    const updated: StorageLocation = { ...loc, ...data };
    set({ locations: state.locations.map((l) => (l.id === id ? updated : l)) });
    return updated;
  },

  createProduct: (data) => {
    const state = get();
    const created: Product = { ...data, id: `p-${Date.now()}` };
    set({ products: [...state.products, created] });
    return created;
  },

  updateProduct: (id, data) => {
    const state = get();
    const product = state.products.find((p) => p.id === id);
    if (!product) throw new Error("product not found");
    const updated: Product = { ...product, ...data };
    set({ products: state.products.map((p) => (p.id === id ? updated : p)) });
    return updated;
  },
}));
