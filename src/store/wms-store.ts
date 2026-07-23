import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { idbStorage } from '@/lib/idb-storage.client'
import * as seed from '@/data/seed'
import {
  agingDays,
  applyAdjustment,
  applyHold,
  applyInternalMoveDrop,
  applyInternalMovePick,
  applyReceipt,
  applyRelease,
  applyReserve,
  applyScrap,
  availableStock,
  isLowRotation,
} from '@/lib/rules/inventory'
import {
  canTransition,
  asnTransitions,
  commerceTransitions,
  cyclicCountTransitions,
  pickingTaskTransitions,
  waveTransitions,
  transferTransitions,
  returnTransitions,
  legTransitions,
  internalMoveTransitions,
  dockAppointmentTransitions,
} from '@/lib/state-machines'
import {
  APPOINTMENT_TYPE_LABELS,
  hasDockConflict,
  isDockCompatible,
  isWithinOperatingHours,
  isWorkingDay,
} from '@/lib/rules/yard'
import {
  abcByProduct,
  selectCycleCountSchedule,
  selectReplenishmentNeeds,
  selectStoreReplenishmentNeeds,
  selectSlottingRecommendations,
  selectSlottingImpact,
  selectAffinityRecommendations,
  misplacedAClassItems,
} from './selectors'
import type { SlottingRecommendation, SlottingSnapshot } from '@/types/wms'
import type {
  Asn,
  BatchTask,
  OperationalStatus,
  Carrier,
  CarrierRateQuote,
  ClusterTask,
  CommerceOrder,
  CrossDockTask,
  CyclicCountLine,
  CyclicCountMethod,
  CyclicCountPlan,
  Dock,
  DockAppointment,
  DockAppointmentType,
  DockStatus,
  IntegrationConnection,
  InternalMoveTask,
  InternalMoveType,
  InventoryAdjustmentRequest,
  InventoryItem,
  LoadManifest,
  OrderLine,
  SapRoute,
  SapRouteStatus,
  DeliveryWindow,
  Operator,
  PackingBoxType,
  PackingOrder,
  PackingRule,
  PickingTask,
  PickingWave,
  Product,
  ProductDemandStat,
  PurchaseOrder,
  PutToStoreTask,
  RackType,
  Reason,
  ReentryBatch,
  ReentryLine,
  RepairTicket,
  RepairTicketLine,
  ReplenishmentTask,
  StoreReplenishmentPolicy,
  StoreReplenishmentTask,
  ScrapLine,
  ScrapRecord,
  ReturnInspection,
  ReturnItemInspection,
  ReturnOrder,
  Shipment,
  SlottingRule,
  StockMovement,
  StorageLocation,
  TransferLeg,
  TransferLegLineReceipt,
  TransferLegStatus,
  TransferOrder,
  UnitOfMeasure,
  Warehouse,
  WmsLabel,
  WmsSettings,
  WavelessOrder,
} from '@/types/wms'
import { deriveOtifStatus } from '@/lib/rules/shipping'
import { canCrossDock } from '@/lib/rules/crossdock'
import { isGoldenEligible } from '@/lib/rules/locations'
import { toBaseQty } from '@/lib/rules/uom'
import { nextReturnStatus, TERMINAL_RETURN_STATUSES } from '@/lib/returns'

let movementCounter = seed.stockMovements.length

// Shared error shown by every returns action when the module is frozen (see /returns-settings).
const RETURNS_FROZEN_MSG = 'Devoluciones en modo congelado. No se permiten operaciones.'

// Shared error shown by every replenishment action when the module is frozen (see /replenishment-settings).
const REPLENISHMENT_FROZEN_MSG = 'Reabastecimiento en modo congelado. No se permiten operaciones.'

// Shared error shown by every cycle count action when the module is frozen (see /cycle-count-settings).
const CYCLE_COUNT_FROZEN_MSG = 'Conteo cíclico en modo congelado. No se permiten operaciones.'

// Shared error shown by every yard/dock action when the module is frozen (see /yard-settings).
const YARD_FROZEN_MSG = 'Patio y muelles en modo congelado. No se permiten operaciones.'

// Shared error shown by every picking action when the module is frozen (see /picking-settings).
const PICKING_FROZEN_MSG = 'Picking en modo congelado. No se permiten operaciones.'

// Shared error shown by every packing action when the module is frozen (see /packing-settings).
const PACKING_FROZEN_MSG = 'Packing en modo congelado. No se permiten operaciones.'

// Shipping module (#7) — guarda de gobierno, ver /shipping-settings.
const SHIPPING_FROZEN_MSG = 'Despacho en modo congelado. No se permiten operaciones.'

const nextMovementId = (): string => {
  movementCounter += 1
  return `mv-${movementCounter}`
}

let internalMoveCounter = seed.internalMoves.length

// Sequential id + human-readable code (MI-001) for a new internal move task.
const nextInternalMoveRef = (): { id: string; code: string } => {
  internalMoveCounter += 1
  return {
    id: `mi-${internalMoveCounter}`,
    code: `MI-${String(internalMoveCounter).padStart(3, '0')}`,
  }
}

let dockAppointmentCounter = seed.dockAppointments.length

// Sequential id + human-readable code (CITA-001) for a new dock appointment.
const nextDockAppointmentRef = (): { id: string; code: string } => {
  dockAppointmentCounter += 1
  return {
    id: `apt-${dockAppointmentCounter}`,
    code: `CITA-${String(dockAppointmentCounter).padStart(3, '0')}`,
  }
}

// Internal moves are location changes within a node; they log as putaway. The
// reference type keeps the origin queryable (slotting vs replenishment vs manual).
const internalMoveReferenceType = (moveType: InternalMoveType): StockMovement['referenceType'] => {
  if (moveType === 'reslotting') return 'slotting'
  if (moveType === 'replenishment') return 'replenishment'
  return 'manual'
}

// Bulk layout generator input — one call materialises aisles × racks × levels ×
// positions worth of StorageLocation records for a warehouse zone.
export interface LayoutGenerationSpec {
  warehouseId: string
  zone: string
  type: StorageLocation['type']
  rackTypeId?: string
  aisles: number
  racksPerAisle: number
  levelsPerRack: number
  positionsPerLevel: number
  isPickFace: boolean
  maxWeightKg: number
  maxVolumeM3: number
  baseDistanceToDispatchM: number
  baseAccessibilityScore: number
}

export interface WmsState {
  warehouses: Warehouse[]
  locations: StorageLocation[]
  rackTypes: RackType[]
  products: Product[]
  demandStats: ProductDemandStat[]
  inventoryItems: InventoryItem[]
  stockMovements: StockMovement[]
  purchaseOrders: PurchaseOrder[]
  asnRecords: Asn[]
  transfers: TransferOrder[]
  returnOrders: ReturnOrder[]
  returnInspections: ReturnInspection[]
  reentryBatches: ReentryBatch[]
  scrapRecords: ScrapRecord[]
  repairTickets: RepairTicket[]
  commerceOrders: CommerceOrder[]
  pickingTasks: PickingTask[]
  pickingWaves: PickingWave[]
  batchTasks: BatchTask[]
  clusterTasks: ClusterTask[]
  putToStoreTasks: PutToStoreTask[]
  wavelessOrders: WavelessOrder[]
  packingOrders: PackingOrder[]
  packingBoxTypes: PackingBoxType[]
  packingRules: PackingRule[]
  shipments: Shipment[]
  loadManifests: LoadManifest[]
  sapRoutes: SapRoute[]
  labels: WmsLabel[]
  integrations: IntegrationConnection[]
  replenishmentTasks: ReplenishmentTask[]
  storeReplenishmentPolicies: StoreReplenishmentPolicy[]
  storeReplenishmentTasks: StoreReplenishmentTask[]
  internalMoves: InternalMoveTask[]
  crossDockTasks: CrossDockTask[]
  slottingSnapshots: SlottingSnapshot[]
  slottingRules: SlottingRule[]
  operators: Operator[]
  reasons: Reason[]
  carriers: Carrier[]
  settings: WmsSettings
  adjustmentRequests: InventoryAdjustmentRequest[]
  cyclicCountPlans: CyclicCountPlan[]
  cyclicCountLines: CyclicCountLine[]
  unitsOfMeasure: UnitOfMeasure[]
  docks: Dock[]
  dockAppointments: DockAppointment[]
  currentOperatorId: string | null

  // Sprint 6: operator session
  setCurrentOperator: (operatorId: string | null) => void

  // Purchase Orders
  confirmPurchaseOrder: (poId: string) => PurchaseOrder
  createReceptionFromPO: (
    poId: string,
    lines: { lineId: string; qty: number }[],
    appointmentDate: string,
    carrierId?: string,
    notes?: string,
    requiresQc?: boolean
  ) => Asn[]

  // Actions (more added per module in later phases)
  reserveInventory: (orderId: string) => CommerceOrder
  markReadyForPickup: (orderId: string, operatorName: string) => CommerceOrder
  confirmPickup: (orderId: string, operatorName: string) => CommerceOrder
  holdInventory: (itemId: string, qty: number, operatorName: string, reasonId?: string) => void
  releaseInventory: (itemId: string, qty: number, operatorName: string) => void
  holdByLot: (lot: string, warehouseId: string, operatorName: string, reasonId?: string) => void
  holdByLocation: (locationId: string, operatorName: string, reasonId?: string) => void
  markDamaged: (itemId: string, qty: number, operatorName: string, reasonId?: string) => void
  releaseExpiredReservations: (operatorName: string) => number
  // Receiving
  confirmArrival: (asnId: string) => Asn
  receiveAsn: (
    asnId: string,
    receivedQty: number,
    operatorName: string,
    damagedQty?: number,
    serials?: string[],
    uomId?: string
  ) => Asn
  printReceiptLabel: (labelId: string) => WmsLabel
  closeAsnWithDiscrepancy: (asnId: string, closeReason: string, operatorName: string) => Asn
  putawayItem: (asnId: string, locationId: string, operatorName: string) => void
  // Labor module (#9) — stamps the operator assigned to a putaway before putawayItem() executes it.
  assignPutaway: (asnId: string, operatorName: string, operatorId?: string) => void
  approveQc: (asnId: string, operatorName: string) => void
  rejectQc: (asnId: string, operatorName: string) => void
  // Inventory
  adjustInventory: (
    itemId: string,
    countedQty: number,
    operatorName: string,
    uomId?: string
  ) => void
  relocateInventory: (itemId: string, toLocationId: string, operatorName: string) => void
  // Picking
  startPicking: (taskId: string, operatorName: string, operatorId?: string) => PickingTask
  completePick: (
    taskId: string,
    pickedQty: number,
    reasonId?: string,
    capturedSerial?: string,
    uomId?: string
  ) => PickingTask
  approvePart: (taskId: string) => PickingTask
  rejectPart: (taskId: string) => PickingTask
  reportIssue: (
    taskId: string,
    reasonId: string,
    note: string,
    photoDataUrl?: string,
    substituteProductId?: string
  ) => PickingTask
  resolveIssue: (taskId: string) => PickingTask
  // Waves
  releaseWave: (waveId: string) => PickingWave
  createWave: (data: Omit<PickingWave, 'id' | 'createdAt' | 'status'>) => PickingWave
  // Batch picking
  startBatchTask: (batchId: string, operatorName: string) => BatchTask
  completeBatchTask: (batchId: string, pickedQty: number) => BatchTask
  // Cluster picking
  startClusterTask: (clusterId: string, operatorName: string) => ClusterTask
  depositToSlot: (clusterId: string, orderId: string, productId: string, qty: number) => ClusterTask
  completeClusterTask: (clusterId: string) => ClusterTask
  // Put-to-store
  startPutToStore: (taskId: string, operatorName: string) => PutToStoreTask
  distributeToStore: (taskId: string, storeId: string, qty: number) => PutToStoreTask
  completePutToStore: (taskId: string) => PutToStoreTask
  // Waveless
  createWavelessOrder: (orderId: string, priority: WavelessOrder['priority']) => WavelessOrder
  startWavelessOrder: (wavelessId: string, operatorName: string) => WavelessOrder
  // Packing
  startPacking: (packingOrderId: string, packerName: string) => PackingOrder
  scanItem: (packingOrderId: string, productId: string, qty: number) => PackingOrder
  completePacking: (packingOrderId: string, scannedItems: number) => PackingOrder
  applyPackingRule: (packingOrderId: string, ruleId: string) => PackingOrder
  removePackingRule: (packingOrderId: string, ruleId: string) => PackingOrder
  selectBox: (packingOrderId: string, boxTypeId: string) => PackingOrder
  generateLabel: (packingOrderId: string) => PackingOrder
  sendToShipping: (packingOrderId: string) => PackingOrder
  // Packing rules admin
  createPackingRule: (data: Omit<PackingRule, 'id'>) => PackingRule
  updatePackingRule: (id: string, data: Partial<Omit<PackingRule, 'id'>>) => PackingRule
  togglePackingRule: (ruleId: string) => PackingRule
  deletePackingRule: (ruleId: string) => void
  // Packing box types admin
  createPackingBox: (data: Omit<PackingBoxType, 'id'>) => PackingBoxType
  updatePackingBox: (id: string, data: Partial<Omit<PackingBoxType, 'id'>>) => PackingBoxType
  deletePackingBox: (id: string) => void
  // Shipping
  shipOrder: (
    shipmentId: string,
    operatorName: string,
    ownFleet?: { driverName: string; vehiclePlate: string }
  ) => Shipment
  createShipment: (
    data: Omit<Shipment, 'id' | 'status' | 'trackingNumber' | 'shippedAt' | 'deliveredAt'>,
    quote: CarrierRateQuote
  ) => Shipment
  deliverShipment: (shipmentId: string) => Shipment
  verifyShipmentLoad: (
    shipmentId: string,
    verifiedPackages: number,
    operatorName: string
  ) => Shipment
  applyRateQuote: (shipmentId: string, quote: CarrierRateQuote) => Shipment
  // Manifests
  createManifest: (data: {
    sapRouteId: string
    manifestDate: string
    orderIds: string[]
    transferIds: string[]
    returnIds: string[]
  }) => LoadManifest
  addDocumentToManifest: (
    manifestId: string,
    type: 'order' | 'transfer' | 'return',
    docId: string,
    stopSequence: number
  ) => LoadManifest
  closeManifest: (manifestId: string) => LoadManifest
  dispatchManifest: (manifestId: string) => LoadManifest
  // Transfers
  advanceTransfer: (transferId: string, operatorName: string) => TransferOrder
  dispatchLeg: (transferId: string, legId: string, operatorName: string) => TransferOrder
  receiveLeg: (
    transferId: string,
    legId: string,
    operatorName: string,
    notes?: string,
    lineReceipts?: TransferLegLineReceipt[]
  ) => TransferOrder
  createTransferOrder: (payload: {
    legs: Array<{ originId: string; destinationId: string; estimatedArrivalDate: string }>
    items: OrderLine[]
    operatorName: string
  }) => TransferOrder
  // Returns
  createReturn: (data: {
    customerName: string
    type: ReturnOrder['type']
    originId: string
    destinationId: string
    reasonId: string
    dispatchDate?: string
    items: { productId: string; requestedQuantity: number }[]
  }) => ReturnOrder
  advanceReturn: (returnId: string, operatorName: string) => ReturnOrder
  rejectReturn: (returnId: string, operatorName: string, note?: string) => ReturnOrder
  inspectReturn: (
    returnId: string,
    inspectorName: string,
    items: ReturnItemInspection[],
    notes: string
  ) => ReturnInspection
  setReturnDisposition: (returnId: string, disposition: ReturnOrder['disposition']) => ReturnOrder
  executeReentry: (returnId: string, lines: ReentryLine[], operatorName: string) => ReentryBatch
  executeScrap: (
    returnId: string,
    lines: ScrapLine[],
    disposalMethod: ScrapRecord['disposalMethod'],
    operatorName: string,
    referenceDoc?: string,
    notes?: string
  ) => ScrapRecord
  createRepairTicket: (
    returnId: string,
    vendorName: string,
    repairType: RepairTicket['repairType'],
    lines: RepairTicketLine[],
    expectedReturnDate: string,
    operatorName: string
  ) => RepairTicket
  receiveRepairReturn: (
    ticketId: string,
    outcome: RepairTicket['outcome'],
    finalCostUsd: number,
    outcomeNotes: string,
    targetLocationId?: string
  ) => RepairTicket
  // Replenishment (intra-warehouse: reserve → pick face)
  startReplenishment: (taskId: string, operatorName: string, operatorId?: string) => ReplenishmentTask
  completeReplenishment: (taskId: string) => ReplenishmentTask
  generateReplenishmentTasks: () => ReplenishmentTask[]
  // Store (retail) replenishment: DC → store
  generateStoreReplenishmentTasks: () => StoreReplenishmentTask[]
  startStoreReplenishment: (taskId: string, operatorName: string) => StoreReplenishmentTask
  completeStoreReplenishment: (taskId: string) => StoreReplenishmentTask
  upsertStoreReplenishmentPolicy: (
    policy: Omit<StoreReplenishmentPolicy, 'id'> & { id?: string }
  ) => StoreReplenishmentPolicy
  removeStoreReplenishmentPolicy: (id: string) => void
  toggleStoreReplenishmentPolicy: (id: string) => void
  // Internal moves (movimientos internos intra-almacén, confirmación en dos pasos)
  createInternalMove: (payload: {
    warehouseId: string
    moveType: InternalMoveType
    productId: string
    fromLocationId: string
    toLocationId: string
    quantity: number
    lot?: string
    serial?: string
    reasonId?: string
    operatorName?: string
  }) => InternalMoveTask
  assignMove: (taskId: string, operatorName: string) => InternalMoveTask
  confirmPickFromSource: (taskId: string, operatorName?: string) => InternalMoveTask
  confirmDropToDest: (taskId: string, operatorName?: string) => InternalMoveTask
  cancelMove: (taskId: string) => InternalMoveTask
  // Slotting batch
  relocateAll: (recs: SlottingRecommendation[], operatorName: string) => number
  captureSlottingSnapshot: (label: string) => SlottingSnapshot
  // Slotting rules (gobierno de ubicaciones)
  createSlottingRule: (data: Omit<SlottingRule, 'id'>) => SlottingRule
  updateSlottingRule: (id: string, data: Partial<Omit<SlottingRule, 'id'>>) => SlottingRule
  toggleSlottingRule: (id: string) => SlottingRule
  deleteSlottingRule: (id: string) => void
  // Admin — Operators
  createOperator: (data: Omit<Operator, 'id'>) => Operator
  updateOperator: (id: string, data: Partial<Omit<Operator, 'id'>>) => Operator
  toggleOperator: (id: string) => Operator
  // Admin — Reasons
  createReason: (data: Omit<Reason, 'id'>) => Reason
  updateReason: (id: string, data: Partial<Omit<Reason, 'id'>>) => Reason
  toggleReason: (id: string) => Reason
  // Admin — Carriers
  createCarrier: (data: Omit<Carrier, 'id'>) => Carrier
  updateCarrier: (id: string, data: Partial<Omit<Carrier, 'id'>>) => Carrier
  toggleCarrier: (id: string) => Carrier
  // Admin — Settings
  updateSettings: (data: Partial<WmsSettings>) => WmsSettings
  // Inventory — Adjustment requests (#56)
  requestAdjustment: (
    itemId: string,
    countedQty: number,
    operatorName: string,
    reasonId?: string
  ) => InventoryAdjustmentRequest
  approveAdjustment: (requestId: string, reviewerName: string) => InventoryAdjustmentRequest
  rejectAdjustment: (
    requestId: string,
    reviewerName: string,
    note: string
  ) => InventoryAdjustmentRequest
  // Cycle count module (#13) — plans generate their lines up front (snapshot of
  // on-hand at creation time); recordCycleCountLine captures the floor count per
  // line; completeCyclicCount feeds discrepancies through the existing adjustment
  // engine (requestAdjustment) so approval + IRA stay governed in one place.
  createCyclicCount: (data: {
    name: string
    method: CyclicCountMethod
    filterValue: string
    warehouseId: string
    scheduledDate: string
    assignedOperatorName?: string
    blindCount?: boolean
    auto?: boolean
  }) => CyclicCountPlan
  startCyclicCount: (planId: string) => CyclicCountPlan
  recordCycleCountLine: (
    lineId: string,
    countedQty: number,
    operatorName: string
  ) => CyclicCountLine
  completeCyclicCount: (planId: string, reviewerName: string) => CyclicCountPlan
  cancelCyclicCount: (planId: string) => CyclicCountPlan
  generateSuggestedCycleCounts: () => CyclicCountPlan[]
  // Admin — Warehouses
  createWarehouse: (data: Omit<Warehouse, 'id'>) => Warehouse
  updateWarehouse: (id: string, data: Partial<Omit<Warehouse, 'id'>>) => Warehouse
  // Admin — Locations & warehouse structure (#4)
  createLocation: (data: Omit<StorageLocation, 'id'>) => StorageLocation
  updateLocation: (id: string, data: Partial<Omit<StorageLocation, 'id'>>) => StorageLocation
  deleteLocation: (id: string) => void
  blockLocation: (id: string, reasonId?: string) => StorageLocation
  unblockLocation: (id: string) => StorageLocation
  // Bulk layout generator — creates every position for a zone/aisle/rack/level grid.
  generateLocations: (spec: LayoutGenerationSpec) => StorageLocation[]
  // Re-derives the golden flag on every pick location from the configured thresholds.
  reclassifyGoldenZones: () => { updated: number; goldenCount: number }
  // Rack / estiba types (tipo de estiba según rack y producto)
  createRackType: (data: Omit<RackType, 'id'>) => RackType
  updateRackType: (id: string, data: Partial<Omit<RackType, 'id'>>) => RackType
  toggleRackType: (id: string) => RackType
  // Admin — Products
  createProduct: (data: Omit<Product, 'id'>) => Product
  updateProduct: (id: string, data: Partial<Omit<Product, 'id'>>) => Product
  // Admin — Units of Measure (#3)
  createUom: (data: Omit<UnitOfMeasure, 'id'>) => UnitOfMeasure
  updateUom: (id: string, data: Partial<Omit<UnitOfMeasure, 'id'>>) => UnitOfMeasure
  toggleUom: (id: string) => UnitOfMeasure
  // Cross-dock (Sprint 9)
  createCrossDockTask: (
    asnId: string,
    commerceOrderId: string,
    quantity: number,
    stagingLocationId: string,
    operatorName: string
  ) => void
  completeCrossDockTask: (taskId: string, operatorName: string) => void
  // Sprint 8: Despacho y transporte (F-85, F-82, F-91)
  updateSapRouteStatus: (id: string, status: SapRouteStatus) => void
  updateAsnAppointment: (
    id: string,
    data: { dockId?: string; timeSlot?: string; carrierConfirmed?: boolean }
  ) => void
  updateWarehouseDeliveryWindows: (id: string, windows: DeliveryWindow[]) => void
  // Yard / Dock management (#8)
  createDock: (data: Omit<Dock, 'id'>) => Dock
  updateDock: (id: string, data: Partial<Omit<Dock, 'id'>>) => Dock
  setDockStatus: (id: string, status: DockStatus) => Dock
  createDockAppointment: (payload: {
    warehouseId: string
    dockId?: string
    type: DockAppointmentType
    asnId?: string
    manifestId?: string
    carrierName?: string
    driverName?: string
    vehiclePlate?: string
    scheduledStart: string
    scheduledEnd: string
    notes?: string
  }) => DockAppointment
  assignDock: (appointmentId: string, dockId: string) => DockAppointment
  checkInAppointment: (
    appointmentId: string,
    data?: { driverName?: string; vehiclePlate?: string }
  ) => DockAppointment
  startAppointment: (appointmentId: string) => DockAppointment
  completeAppointment: (appointmentId: string) => DockAppointment
  markAppointmentNoShow: (appointmentId: string) => DockAppointment
  cancelAppointment: (appointmentId: string) => DockAppointment
}

const recordMovement = (partial: Omit<StockMovement, 'id' | 'createdAt'>): StockMovement => ({
  ...partial,
  id: nextMovementId(),
  createdAt: seed.seedTimestamp,
})

// Resolves which InventoryItems a cycle count plan covers, given its method/filter.
// Shared by createCyclicCount (manual plans) and generateSuggestedCycleCounts (ABC scheduler).
const resolveCyclicCountItems = (
  state: WmsState,
  method: CyclicCountMethod,
  filterValue: string,
  warehouseId: string
): InventoryItem[] => {
  const items = state.inventoryItems.filter(
    (i) => i.warehouseId === warehouseId && i.onHandQuantity > 0 && i.status !== 'in_transit'
  )
  if (method === 'by_zone') {
    const zoneLocationIds = new Set(
      state.locations
        .filter((l) => l.warehouseId === warehouseId && l.zone === filterValue)
        .map((l) => l.id)
    )
    return items.filter((i) => zoneLocationIds.has(i.locationId))
  }
  if (method === 'by_category') {
    const categoryProductIds = new Set(
      state.products.filter((p) => p.category === filterValue).map((p) => p.id)
    )
    return items.filter((i) => categoryProductIds.has(i.productId))
  }
  if (method === 'by_abc') {
    const abc = abcByProduct(state)
    return items.filter((i) => (abc[i.productId] ?? 'C') === filterValue)
  }
  // by_rotation: 'alta' | 'baja', mirrors the /inventory Antigüedad tab's low-rotation rule.
  const wantLowRotation = filterValue === 'baja'
  return items.filter(
    (i) => isLowRotation(agingDays(i), state.settings.agingLowRotationDays) === wantLowRotation
  )
}

// Seed state factory — called only when localStorage has no prior session data.
const buildSeedState = () => ({
  warehouses: seed.warehouses,
  locations: seed.locations,
  rackTypes: seed.rackTypes,
  products: seed.products,
  demandStats: seed.demandStats,
  inventoryItems: seed.inventoryItems,
  stockMovements: seed.stockMovements,
  purchaseOrders: seed.purchaseOrders,
  asnRecords: [...seed.asnRecords, seed.demoAsnInbound, seed.demoAsn2],
  transfers: seed.transfers,
  returnOrders: [...seed.returnOrders, seed.demoReturnOrder, seed.demoReturnOrder2],
  returnInspections: seed.returnInspections,
  reentryBatches: [] as ReentryBatch[],
  scrapRecords: [] as ScrapRecord[],
  repairTickets: [] as RepairTicket[],
  commerceOrders: [...seed.commerceOrders, ...seed.demoCommerceOrders],
  pickingTasks: [...seed.pickingTasks, ...seed.demoPickingTasks],
  pickingWaves: [...seed.pickingWaves, seed.demoPickingWave],
  batchTasks: seed.batchTasks,
  clusterTasks: seed.clusterTasks,
  putToStoreTasks: seed.putToStoreTasks,
  wavelessOrders: seed.wavelessOrders,
  packingOrders: [...seed.packingOrders, seed.demoPackingOrder, seed.demoPackingOrderMulti],
  packingBoxTypes: seed.packingBoxTypes,
  packingRules: seed.packingRules,
  shipments: seed.shipments,
  loadManifests: seed.loadManifests,
  sapRoutes: seed.sapRoutes,
  labels: seed.labels,
  integrations: seed.integrations,
  replenishmentTasks: seed.replenishmentTasks,
  storeReplenishmentPolicies: seed.storeReplenishmentPolicies,
  storeReplenishmentTasks: seed.storeReplenishmentTasks,
  internalMoves: seed.internalMoves,
  crossDockTasks: [] as CrossDockTask[],
  slottingSnapshots: [] as SlottingSnapshot[],
  slottingRules: seed.slottingRules,
  operators: seed.operators,
  reasons: seed.reasons,
  carriers: seed.carriers,
  settings: seed.settings,
  adjustmentRequests: seed.demoAdjustmentRequests,
  cyclicCountPlans: seed.demoCyclicCountPlans,
  cyclicCountLines: seed.demoCyclicCountLines,
  unitsOfMeasure: seed.unitsOfMeasure,
  docks: seed.docks,
  dockAppointments: seed.dockAppointments,
  currentOperatorId: 'op-0' as string | null,
})

// Exported so the Admin page can trigger a full demo reset.
// Awaits the async IndexedDB clear before reloading so the fresh seed loads clean.
export const resetStore = async () => {
  if (typeof window === 'undefined') return
  await useWmsStore.persist.clearStorage()
  window.location.reload()
}

export const useWmsStore = create<WmsState>()(
  persist(
    (set, get) => ({
      ...buildSeedState(),

      confirmPurchaseOrder: (poId) => {
        const state = get()
        const po = state.purchaseOrders.find((p) => p.id === poId)
        if (!po) throw new Error('Purchase order not found')
        if (po.status !== 'draft')
          throw new Error(`No se puede confirmar desde el estado ${po.status}`)
        const updated: PurchaseOrder = { ...po, status: 'confirmed' }
        set({ purchaseOrders: state.purchaseOrders.map((p) => (p.id === poId ? updated : p)) })
        return updated
      },

      createReceptionFromPO: (
        poId,
        lines,
        appointmentDate,
        carrierId,
        notes,
        requiresQc = false
      ) => {
        const state = get()
        const po = state.purchaseOrders.find((p) => p.id === poId)
        if (!po) throw new Error('Purchase order not found')
        if (po.status === 'draft') throw new Error('Confirma la PO antes de crear una recepción')
        if (po.status === 'received' || po.status === 'cancelled') {
          throw new Error(`No se puede crear recepción desde el estado ${po.status}`)
        }

        const newAsns: Asn[] = []
        const asnCounter = state.asnRecords.length

        lines.forEach((entry, idx) => {
          if (entry.qty <= 0) return
          const poLine = po.lines.find((l) => l.id === entry.lineId)
          if (!poLine) return
          const product = state.products.find((p) => p.id === poLine.productId)
          const code = `ASN-${appointmentDate.slice(2, 4)}${appointmentDate.slice(5, 7)}-${String(asnCounter + idx + 1).padStart(3, '0')}`
          newAsns.push({
            id: `asn-new-${poId}-${entry.lineId}`,
            code,
            supplierName: po.supplierName,
            appointmentDate,
            expectedQuantity: entry.qty,
            receivedQuantity: 0,
            damagedQuantity: 0,
            status: 'pending',
            requiresQualityControl: requiresQc,
            crossDocking: false,
            productId: poLine.productId,
            deliveryCount: 0,
            purchaseOrderId: poId,
            sourceType: 'purchase',
            receptionNotes: notes,
            ...(product ? {} : {}),
          })
        })

        if (newAsns.length === 0)
          throw new Error('Selecciona al menos una línea con cantidad mayor a 0')

        // Update PO lines receivedQty and recalculate PO status
        const updatedLines = po.lines.map((l) => {
          const entry = lines.find((e) => e.lineId === l.id)
          if (!entry) return l
          return { ...l, receivedQty: l.receivedQty + entry.qty }
        })
        const totalOrdered = updatedLines.reduce((s, l) => s + l.orderedQty, 0)
        const totalReceived = updatedLines.reduce((s, l) => s + l.receivedQty, 0)
        const newPoStatus: PurchaseOrder['status'] =
          totalReceived === 0 ? 'confirmed' : totalReceived >= totalOrdered ? 'received' : 'partial'
        const updatedPo: PurchaseOrder = {
          ...po,
          lines: updatedLines,
          status: newPoStatus,
          ...(carrierId ? { carrierId } : {}),
        }

        set({
          purchaseOrders: state.purchaseOrders.map((p) => (p.id === poId ? updatedPo : p)),
          asnRecords: [...state.asnRecords, ...newAsns],
        })
        return newAsns
      },

      reserveInventory: (orderId) => {
        const state = get()
        const order = state.commerceOrders.find((o) => o.id === orderId)
        if (!order) throw new Error('order not found')
        if (!canTransition(commerceTransitions, order.status, 'assigned')) {
          throw new Error(`No se puede reservar desde el estado ${order.status}`)
        }

        const items = [...state.inventoryItems]
        const movements: StockMovement[] = []
        const reservationExpiresAt = new Date(
          Date.now() + state.settings.reservationTtlHours * 60 * 60 * 1000
        ).toISOString()
        for (const line of order.items) {
          const idx = items.findIndex(
            (i) => i.productId === line.productId && availableStock(i) >= line.requestedQuantity
          )
          if (idx === -1) throw new Error(`Stock insuficiente para reservar ${line.productId}`)
          const reserved = applyReserve(items[idx], line.requestedQuantity)
          // Simplification: TTL tracked per item (latest reservation wins), not per order —
          // see releaseExpiredReservations. Fine for a single-item demo; a real ATP ledger
          // would track TTL per reservation line.
          items[idx] = { ...items[idx], ...reserved, reservationExpiresAt }
          movements.push(
            recordMovement({
              productId: line.productId,
              warehouseId: items[idx].warehouseId,
              type: 'transfer',
              quantity: line.requestedQuantity,
              referenceType: 'commerce_order',
              referenceId: orderId,
              operatorName: 'Sistema',
            })
          )
        }

        const updatedOrder: CommerceOrder = { ...order, status: 'assigned' }
        set({
          inventoryItems: items,
          stockMovements: [...state.stockMovements, ...movements],
          commerceOrders: state.commerceOrders.map((o) => (o.id === orderId ? updatedOrder : o)),
        })
        return updatedOrder
      },

      markReadyForPickup: (orderId, operatorName) => {
        const state = get()
        const order = state.commerceOrders.find((o) => o.id === orderId)
        if (!order) throw new Error('order not found')
        if (!canTransition(commerceTransitions, order.status, 'ready_for_pickup')) {
          throw new Error(`No se puede marcar listo para recoger desde el estado ${order.status}`)
        }
        const updated: CommerceOrder = { ...order, status: 'ready_for_pickup' }
        set({ commerceOrders: state.commerceOrders.map((o) => (o.id === orderId ? updated : o)) })
        return updated
      },

      confirmPickup: (orderId, operatorName) => {
        const state = get()
        const order = state.commerceOrders.find((o) => o.id === orderId)
        if (!order) throw new Error('order not found')
        if (!canTransition(commerceTransitions, order.status, 'completed')) {
          throw new Error(`No se puede confirmar recogida desde el estado ${order.status}`)
        }
        const updated: CommerceOrder = { ...order, status: 'completed' }
        set({ commerceOrders: state.commerceOrders.map((o) => (o.id === orderId ? updated : o)) })
        return updated
      },

      holdInventory: (itemId, qty, operatorName, reasonId) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten bloqueos.')
        const item = state.inventoryItems.find((i) => i.id === itemId)
        if (!item) throw new Error('inventory item not found')
        const held = applyHold(item, qty)
        set({
          inventoryItems: state.inventoryItems.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  ...held,
                  status: 'on_hold',
                  ...(reasonId ? { holdReasonId: reasonId } : {}),
                }
              : i
          ),
          stockMovements: [
            ...state.stockMovements,
            recordMovement({
              productId: item.productId,
              warehouseId: item.warehouseId,
              fromLocationId: item.locationId,
              type: 'hold',
              quantity: qty,
              referenceType: 'manual',
              referenceId: itemId,
              operatorName,
            }),
          ],
        })
      },

      markDamaged: (itemId, qty, operatorName, reasonId) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten bloqueos.')
        const item = state.inventoryItems.find((i) => i.id === itemId)
        if (!item) throw new Error('inventory item not found')
        const held = applyHold(item, qty)
        set({
          inventoryItems: state.inventoryItems.map((i) =>
            i.id === itemId
              ? { ...i, ...held, status: 'damaged', holdReasonId: reasonId ?? 'rs-8' }
              : i
          ),
          stockMovements: [
            ...state.stockMovements,
            recordMovement({
              productId: item.productId,
              warehouseId: item.warehouseId,
              fromLocationId: item.locationId,
              type: 'hold',
              quantity: qty,
              referenceType: 'manual',
              referenceId: itemId,
              operatorName,
            }),
          ],
        })
      },

      holdByLot: (lot, warehouseId, operatorName, reasonId) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten bloqueos.')
        const targetIds = new Set(
          state.inventoryItems
            .filter((i) => i.lot === lot && i.warehouseId === warehouseId && i.status !== 'on_hold')
            .map((i) => i.id)
        )
        if (targetIds.size === 0) throw new Error('No hay ítems disponibles para ese lote')
        const movements: StockMovement[] = []
        const updatedItems = state.inventoryItems.map((i) => {
          if (!targetIds.has(i.id)) return i
          const avail = availableStock(i)
          if (avail <= 0) return i
          movements.push(
            recordMovement({
              productId: i.productId,
              warehouseId: i.warehouseId,
              fromLocationId: i.locationId,
              type: 'hold',
              quantity: avail,
              lot: i.lot,
              referenceType: 'manual',
              referenceId: `lot-${lot}`,
              operatorName,
            })
          )
          return {
            ...i,
            holdQuantity: i.holdQuantity + avail,
            status: 'on_hold' as const,
            ...(reasonId ? { holdReasonId: reasonId } : {}),
          }
        })
        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
        })
      },

      holdByLocation: (locationId, operatorName, reasonId) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten bloqueos.')
        const targetIds = new Set(
          state.inventoryItems
            .filter((i) => i.locationId === locationId && i.status !== 'on_hold')
            .map((i) => i.id)
        )
        if (targetIds.size === 0) throw new Error('No hay ítems disponibles en esa ubicación')
        const movements: StockMovement[] = []
        const updatedItems = state.inventoryItems.map((i) => {
          if (!targetIds.has(i.id)) return i
          const avail = availableStock(i)
          if (avail <= 0) return i
          movements.push(
            recordMovement({
              productId: i.productId,
              warehouseId: i.warehouseId,
              fromLocationId: i.locationId,
              type: 'hold',
              quantity: avail,
              lot: i.lot,
              serial: i.serial,
              referenceType: 'manual',
              referenceId: `loc-${locationId}`,
              operatorName,
            })
          )
          return {
            ...i,
            holdQuantity: i.holdQuantity + avail,
            status: 'on_hold' as const,
            ...(reasonId ? { holdReasonId: reasonId } : {}),
          }
        })
        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
        })
      },

      releaseInventory: (itemId, qty, operatorName) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten liberaciones.')
        const item = state.inventoryItems.find((i) => i.id === itemId)
        if (!item) throw new Error('inventory item not found')
        const released = applyRelease(item, qty)
        const isFullyReleased = released.holdQuantity === 0
        set({
          inventoryItems: state.inventoryItems.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  ...released,
                  status: released.holdQuantity > 0 ? i.status : 'available',
                  ...(isFullyReleased ? { holdReasonId: undefined } : {}),
                }
              : i
          ),
          stockMovements: [
            ...state.stockMovements,
            recordMovement({
              productId: item.productId,
              warehouseId: item.warehouseId,
              fromLocationId: item.locationId,
              type: 'release',
              quantity: qty,
              referenceType: 'manual',
              referenceId: itemId,
              operatorName,
            }),
          ],
        })
      },

      // TTL sweep: releases reservations that outlived settings.reservationTtlHours (Estándar —
      // "Reservas con TTL"). Not freeze-guarded — it's a passive cleanup, not a new commitment.
      releaseExpiredReservations: (operatorName) => {
        const state = get()
        const now = Date.now()
        const expired = state.inventoryItems.filter(
          (i) =>
            i.reservedQuantity > 0 &&
            i.reservationExpiresAt &&
            new Date(i.reservationExpiresAt).getTime() < now
        )
        if (expired.length === 0) return 0

        const movements: StockMovement[] = expired.map((item) =>
          recordMovement({
            productId: item.productId,
            warehouseId: item.warehouseId,
            fromLocationId: item.locationId,
            type: 'release',
            quantity: item.reservedQuantity,
            lot: item.lot,
            serial: item.serial,
            referenceType: 'commerce_order',
            referenceId: 'ttl-sweep',
            operatorName,
          })
        )
        const expiredIds = new Set(expired.map((i) => i.id))
        set({
          inventoryItems: state.inventoryItems.map((i) =>
            expiredIds.has(i.id)
              ? { ...i, reservedQuantity: 0, reservationExpiresAt: undefined }
              : i
          ),
          stockMovements: [...state.stockMovements, ...movements],
        })
        return expired.length
      },

      confirmArrival: (asnId) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')
        if (!canTransition(asnTransitions, asn.status, 'in_progress'))
          throw new Error(`No se puede confirmar llegada desde el estado ${asn.status}`)
        const updated: Asn = { ...asn, status: 'in_progress' }
        set({ asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updated : a)) })
        return updated
      },

      receiveAsn: (asnId, receivedQty, operatorName, damagedQty = 0, serials, uomId) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')
        const canReceive =
          asn.status === 'in_progress' ||
          asn.status === 'partial' ||
          canTransition(asnTransitions, asn.status, 'in_progress')
        if (!canReceive) throw new Error(`No se puede recibir desde el estado ${asn.status}`)
        if (receivedQty <= 0 && damagedQty <= 0) throw new Error('Ingresa una cantidad válida.')

        const product = state.products.find((p) => p.id === asn.productId)
        const requiresSerial = product?.trackBy === 'serial'

        // UoM conversion: if a non-base uomId is provided, convert qty to base units before stocking
        const baseUomId = product?.baseUomId
        const effectiveQty =
          uomId && baseUomId && uomId !== baseUomId && product?.uomConversions?.length
            ? toBaseQty(receivedQty, uomId, baseUomId, product.uomConversions)
            : receivedQty

        // Validate serials when product requires tracking (use raw receivedQty — serial count is per physical unit, not converted)
        if (requiresSerial && receivedQty > 0) {
          if (!serials || serials.length === 0)
            throw new Error('Este producto requiere captura de número de serie en recepción')
          if (serials.length !== receivedQty)
            throw new Error(
              `Se esperan ${receivedQty} números de serie (se recibieron ${serials.length})`
            )
          const trimmed = serials.map((s) => s.trim())
          if (new Set(trimmed).size !== trimmed.length)
            throw new Error('Hay números de serie duplicados en esta entrega')
        }

        // goodQty = base-unit quantity going to stock; damagedQty stays in input units
        const goodQty = effectiveQty
        const totalCounted = goodQty + damagedQty

        // Find or create inventory item in staging/QC location
        const targetLocationId = asn.requiresQualityControl ? 'loc-qc' : 'loc-stageout'

        const newTotal = asn.receivedQuantity + totalCounted
        const newDamaged = asn.damagedQuantity + damagedQty

        const effectiveStatus = asn.status === 'pending' ? 'in_progress' : asn.status
        const outboundStatus = newTotal >= asn.expectedQuantity ? 'completed' : 'partial'
        // partial is always reachable from in_progress/partial; completed is too per FSM
        // This guard catches edge cases (cancelled, short_received hitting the action)
        if (!canTransition(asnTransitions, effectiveStatus, outboundStatus)) {
          throw new Error(`No se puede avanzar a ${outboundStatus} desde el estado ${asn.status}`)
        }

        const updatedAsn: Asn = {
          ...asn,
          receivedQuantity: newTotal,
          damagedQuantity: newDamaged,
          deliveryCount: asn.deliveryCount + 1,
          status: outboundStatus,
        }

        // Only goodQty enters available/hold stock — damaged units are tracked on the ASN but not stocked.
        let updatedItems = [...state.inventoryItems]
        const movements: StockMovement[] = []

        if (goodQty > 0) {
          if (requiresSerial && serials && serials.length > 0) {
            // For serialized products: one InventoryItem per serial number
            for (const serial of serials.map((s) => s.trim())) {
              updatedItems = [
                ...updatedItems,
                {
                  id: `inv-rcv-${asnId}-${serial.replace(/\s/g, '_')}`,
                  productId: asn.productId,
                  warehouseId: 'wh-bog',
                  locationId: targetLocationId,
                  serial,
                  onHandQuantity: 1,
                  reservedQuantity: 0,
                  holdQuantity: 0,
                  status: asn.requiresQualityControl
                    ? ('on_hold' as const)
                    : ('available' as const),
                  receivedDate: new Date().toISOString(),
                },
              ]
              movements.push(
                recordMovement({
                  productId: asn.productId,
                  warehouseId: 'wh-bog',
                  toLocationId: targetLocationId,
                  type: 'receipt',
                  quantity: 1,
                  serial,
                  uomId: baseUomId,
                  referenceType: 'asn',
                  referenceId: asnId,
                  operatorName,
                })
              )
            }
          } else {
            // Non-serialized: merge into single item at staging
            const existingItemIdx = updatedItems.findIndex(
              (i) =>
                i.productId === asn.productId &&
                i.warehouseId === 'wh-bog' &&
                i.locationId === targetLocationId &&
                !i.serial
            )
            if (existingItemIdx >= 0) {
              updatedItems[existingItemIdx] = {
                ...updatedItems[existingItemIdx],
                ...applyReceipt(updatedItems[existingItemIdx], goodQty),
              }
            } else {
              updatedItems = [
                ...updatedItems,
                {
                  id: `inv-new-${asnId}`,
                  productId: asn.productId,
                  warehouseId: 'wh-bog',
                  locationId: targetLocationId,
                  onHandQuantity: goodQty,
                  reservedQuantity: 0,
                  holdQuantity: 0,
                  status: asn.requiresQualityControl
                    ? ('on_hold' as const)
                    : ('available' as const),
                  receivedDate: new Date().toISOString(),
                },
              ]
            }
            movements.push(
              recordMovement({
                productId: asn.productId,
                warehouseId: 'wh-bog',
                toLocationId: targetLocationId,
                type: 'receipt',
                quantity: goodQty,
                uomId: baseUomId,
                referenceType: 'asn',
                referenceId: asnId,
                operatorName,
              })
            )
          }
        }

        // Generate receipt labels — one per serial for serialized products, one otherwise
        const receiptLabels: WmsLabel[] = []
        const labelSeq = state.labels.length
        if (requiresSerial && serials && serials.length > 0) {
          serials
            .map((s) => s.trim())
            .forEach((serial, i) => {
              const seq = labelSeq + i + 1
              receiptLabels.push({
                id: `lb-rcpt-${asnId}-${serial.replace(/\s/g, '_')}`,
                code: `LBL-RCP-${String(seq).padStart(4, '0')}`,
                type: 'receipt',
                reference: asnId,
                status: 'pending',
                createdAt: new Date().toISOString(),
                createdBy: operatorName,
                asnId,
                receivedQty: 1,
                poNumber: asn.purchaseOrderId,
              })
            })
        } else {
          const seq = labelSeq + 1
          receiptLabels.push({
            id: `lb-rcpt-${asnId}-line-${state.labels.length + 1}`,
            code: `LBL-RCP-${String(seq).padStart(4, '0')}`,
            type: 'receipt',
            reference: asnId,
            status: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: operatorName,
            asnId,
            receivedQty: goodQty,
            poNumber: asn.purchaseOrderId,
          })
        }

        set({
          asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsn : a)),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
          labels: [...state.labels, ...receiptLabels],
        })
        return updatedAsn
      },

      printReceiptLabel: (labelId) => {
        const state = get()
        const label = state.labels.find((l) => l.id === labelId)
        if (!label) throw new Error('Label no encontrada')
        if (label.type !== 'receipt') throw new Error('Solo se pueden imprimir receipt labels aquí')

        const updated: WmsLabel = { ...label, status: 'completed' }
        const updatedLabels = state.labels.map((l) => (l.id === labelId ? updated : l))

        set({ labels: updatedLabels })
        return updated
      },

      closeAsnWithDiscrepancy: (asnId, closeReason, operatorName) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')
        if (!canTransition(asnTransitions, asn.status, 'short_received')) {
          throw new Error(`No se puede cerrar con diferencia desde el estado ${asn.status}`)
        }
        const updatedAsn: Asn = { ...asn, status: 'short_received', closeReason }
        const movement = recordMovement({
          productId: asn.productId,
          warehouseId: 'wh-bog',
          type: 'adjustment',
          quantity: asn.expectedQuantity - asn.receivedQuantity,
          referenceType: 'asn',
          referenceId: asnId,
          operatorName,
        })
        set({
          asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsn : a)),
          stockMovements: [...state.stockMovements, movement],
        })
        return updatedAsn
      },

      putawayItem: (asnId, locationId, operatorName) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')
        if (!canTransition(asnTransitions, asn.status, 'putaway_done'))
          throw new Error(`No se puede hacer putaway desde el estado ${asn.status}`)

        const product = state.products.find((p) => p.id === asn.productId)
        const isSerialTracked = product?.trackBy === 'serial'

        // After QC approval, stock moves from loc-qc → loc-stageout, so always check
        // loc-stageout first; fall back to loc-qc for ASNs mid-QC (not yet approved).
        const stagingCandidates = asn.requiresQualityControl
          ? ['loc-stageout', 'loc-qc']
          : ['loc-stageout']

        let updatedItems = [...state.inventoryItems]
        const movements: StockMovement[] = []

        if (isSerialTracked) {
          // Move all serialized items individually from staging to destination
          const stagingSerialItems = updatedItems.filter(
            (i) =>
              i.productId === asn.productId &&
              i.warehouseId === 'wh-bog' &&
              stagingCandidates.includes(i.locationId) &&
              i.serial &&
              i.onHandQuantity > 0
          )
          if (stagingSerialItems.length === 0)
            throw new Error('No hay stock serializado en staging/QC para este ASN')

          for (const item of stagingSerialItems) {
            const idx = updatedItems.findIndex((i) => i.id === item.id)
            updatedItems[idx] = { ...updatedItems[idx], locationId, status: 'available' }
            movements.push(
              recordMovement({
                productId: asn.productId,
                warehouseId: 'wh-bog',
                fromLocationId: item.locationId,
                toLocationId: locationId,
                type: 'putaway',
                quantity: 1,
                serial: item.serial,
                referenceType: 'asn',
                referenceId: asnId,
                operatorName,
              })
            )
          }
        } else {
          const stagingItemIdx = updatedItems.findIndex(
            (i) =>
              i.productId === asn.productId &&
              i.warehouseId === 'wh-bog' &&
              stagingCandidates.includes(i.locationId) &&
              i.onHandQuantity > 0
          )
          if (stagingItemIdx === -1) throw new Error('No hay stock en staging/QC para este ASN')

          const stagingItem = updatedItems[stagingItemIdx]
          const qtyToMove = stagingItem.onHandQuantity
          updatedItems[stagingItemIdx] = { ...stagingItem, onHandQuantity: 0 }

          const destIdx = updatedItems.findIndex(
            (i) =>
              i.productId === asn.productId &&
              i.warehouseId === 'wh-bog' &&
              i.locationId === locationId &&
              !i.serial
          )
          if (destIdx >= 0) {
            updatedItems[destIdx] = {
              ...updatedItems[destIdx],
              ...applyReceipt(updatedItems[destIdx], qtyToMove),
              status: 'available',
            }
          } else {
            updatedItems = [
              ...updatedItems,
              {
                id: `inv-pa-${asnId}`,
                productId: asn.productId,
                warehouseId: 'wh-bog',
                locationId,
                onHandQuantity: qtyToMove,
                reservedQuantity: 0,
                holdQuantity: 0,
                status: 'available',
              },
            ]
          }
          movements.push(
            recordMovement({
              productId: asn.productId,
              warehouseId: 'wh-bog',
              fromLocationId: stagingItem.locationId,
              toLocationId: locationId,
              type: 'putaway',
              quantity: qtyToMove,
              referenceType: 'asn',
              referenceId: asnId,
              operatorName,
            })
          )
        }

        const updatedAsn: Asn = { ...asn, status: 'putaway_done' }

        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
          asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsn : a)),
        })
      },

      assignPutaway: (asnId, operatorName, operatorId) => {
        set((state) => ({
          asnRecords: state.asnRecords.map((a) =>
            a.id === asnId
              ? { ...a, assignedOperatorName: operatorName, assignedOperatorId: operatorId ?? a.assignedOperatorId }
              : a
          ),
        }))
      },

      approveQc: (asnId, operatorName) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')

        const qcItemIdx = state.inventoryItems.findIndex(
          (i) =>
            i.productId === asn.productId &&
            i.warehouseId === 'wh-bog' &&
            i.locationId === 'loc-qc' &&
            i.onHandQuantity > 0
        )
        if (qcItemIdx === -1) throw new Error('No hay stock en zona QC para este ASN')

        const qcItem = state.inventoryItems[qcItemIdx]
        const qtyToMove = qcItem.onHandQuantity

        let updatedItems = [...state.inventoryItems]
        updatedItems[qcItemIdx] = {
          ...qcItem,
          onHandQuantity: 0,
          holdQuantity: 0,
          status: 'available',
        }

        const destIdx = updatedItems.findIndex(
          (i) =>
            i.productId === asn.productId &&
            i.warehouseId === 'wh-bog' &&
            i.locationId === 'loc-stageout'
        )
        if (destIdx >= 0) {
          updatedItems[destIdx] = {
            ...updatedItems[destIdx],
            ...applyReceipt(updatedItems[destIdx], qtyToMove),
            status: 'available',
          }
        } else {
          updatedItems = [
            ...updatedItems,
            {
              id: `inv-qc-approved-${asnId}`,
              productId: asn.productId,
              warehouseId: 'wh-bog',
              locationId: 'loc-stageout',
              onHandQuantity: qtyToMove,
              reservedQuantity: 0,
              holdQuantity: 0,
              status: 'available',
            },
          ]
        }

        const movement = recordMovement({
          productId: asn.productId,
          warehouseId: 'wh-bog',
          fromLocationId: 'loc-qc',
          toLocationId: 'loc-stageout',
          type: 'putaway',
          quantity: qtyToMove,
          referenceType: 'asn',
          referenceId: asnId,
          operatorName,
        })

        const updatedAsn: Asn = { ...asn, status: 'completed' }

        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, movement],
          asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsn : a)),
        })
      },

      rejectQc: (asnId, operatorName) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN not found')

        const movement = recordMovement({
          productId: asn.productId,
          warehouseId: 'wh-bog',
          fromLocationId: 'loc-qc',
          toLocationId: 'loc-qc',
          type: 'adjustment',
          quantity: 0,
          referenceType: 'asn',
          referenceId: asnId,
          operatorName,
        })

        const updatedAsn: Asn = { ...asn, status: 'cancelled' }

        set({
          asnRecords: state.asnRecords.map((a) => (a.id === asnId ? updatedAsn : a)),
          stockMovements: [...state.stockMovements, movement],
        })
      },

      adjustInventory: (itemId, countedQty, operatorName, uomId) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error(
            'Inventario en modo congelado. Use requestAdjustment cuando el freeze esté activo.'
          )
        const item = state.inventoryItems.find((i) => i.id === itemId)
        if (!item) throw new Error('inventory item not found')
        const product = state.products.find((p) => p.id === item.productId)
        const baseUomId = product?.baseUomId
        const effectiveQty =
          uomId && baseUomId && uomId !== baseUomId && product?.uomConversions?.length
            ? toBaseQty(countedQty, uomId, baseUomId, product.uomConversions)
            : countedQty
        const delta = effectiveQty - item.onHandQuantity
        const adjusted = applyAdjustment(item, effectiveQty)
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
              type: 'adjustment',
              quantity: Math.abs(delta),
              uomId: baseUomId,
              referenceType: 'manual',
              referenceId: itemId,
              operatorName,
            }),
          ],
        })
      },

      relocateInventory: (itemId, toLocationId, operatorName) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten reubicaciones.')
        const item = state.inventoryItems.find((i) => i.id === itemId)
        if (!item) throw new Error('inventory item not found')
        const qty = item.onHandQuantity

        let updatedItems = state.inventoryItems.map((i) =>
          i.id === itemId ? { ...i, locationId: toLocationId } : i
        )

        // Merge with existing item at destination if present
        const existingDestIdx = updatedItems.findIndex(
          (i) => i.productId === item.productId && i.locationId === toLocationId && i.id !== itemId
        )
        if (existingDestIdx >= 0) {
          const dest = updatedItems[existingDestIdx]
          updatedItems[existingDestIdx] = {
            ...dest,
            onHandQuantity: dest.onHandQuantity + qty,
          }
          updatedItems = updatedItems.filter((i) => i.id !== itemId)
        }

        const movement = recordMovement({
          productId: item.productId,
          warehouseId: item.warehouseId,
          fromLocationId: item.locationId,
          toLocationId,
          type: 'putaway',
          quantity: qty,
          lot: item.lot,
          serial: item.serial,
          referenceType: 'slotting',
          referenceId: itemId,
          operatorName,
        })

        // Unifica la reubicación por slotting bajo el motor de movimientos internos:
        // queda registrada (como reslotting ya completado) en la misma cola/historial.
        const now = new Date().toISOString()
        const { id: moveId, code } = nextInternalMoveRef()
        const reslotTask: InternalMoveTask = {
          id: moveId,
          code,
          warehouseId: item.warehouseId,
          moveType: 'reslotting',
          productId: item.productId,
          fromLocationId: item.locationId,
          toLocationId,
          quantity: qty,
          lot: item.lot,
          serial: item.serial,
          status: 'dropped',
          operatorName,
          createdAt: now,
          pickedAt: now,
          droppedAt: now,
        }

        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, movement],
          internalMoves: [...state.internalMoves, reslotTask],
        })
      },

      // ─── Picking ──────────────────────────────────────────────────────────────

      startPicking: (taskId, operatorName, operatorId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.pickingTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('picking task not found')
        const canAssign = canTransition(pickingTaskTransitions, task.status, 'assigned')
        const canStart = canTransition(pickingTaskTransitions, task.status, 'in_progress')
        if (!canAssign && !canStart) {
          throw new Error(`No se puede iniciar tarea desde el estado ${task.status}`)
        }
        const nextStatus = task.status === 'assigned' ? 'in_progress' : 'assigned'
        const updated: PickingTask = {
          ...task,
          status: nextStatus,
          operatorName,
          assignedOperatorId: operatorId ?? task.assignedOperatorId,
        }
        set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      completePick: (taskId, pickedQty, reasonId, capturedSerial, uomId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.pickingTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('picking task not found')
        if (
          !canTransition(pickingTaskTransitions, task.status, 'completed') &&
          !canTransition(pickingTaskTransitions, task.status, 'partially_picked')
        ) {
          throw new Error(`No se puede completar tarea desde el estado ${task.status}`)
        }

        // Validate serial capture when the product requires it
        const product = state.products.find((p) => p.id === task.productId)
        if (product?.trackBy === 'serial' && pickedQty > 0 && !capturedSerial?.trim()) {
          throw new Error('Este producto requiere captura de serial')
        }

        // Validate captured serial matches inventory when provided
        if (capturedSerial?.trim()) {
          const serialItem = state.inventoryItems.find(
            (i) => i.productId === task.productId && i.serial === capturedSerial.trim()
          )
          if (!serialItem) throw new Error(`Serial "${capturedSerial}" no encontrado en inventario`)
        }

        // UoM conversion: convert picked qty to base units before deducting stock
        const baseUomId = product?.baseUomId
        const effectivePickedQty =
          uomId && baseUomId && uomId !== baseUomId && product?.uomConversions?.length
            ? toBaseQty(pickedQty, uomId, baseUomId, product.uomConversions)
            : pickedQty

        const clamped = Math.min(effectivePickedQty, task.requestedQuantity)
        const isPartial = clamped < task.requestedQuantity
        const nextStatus: PickingTask['status'] = isPartial
          ? clamped === 0
            ? 'partial_with_shortage'
            : 'partially_picked'
          : 'completed'

        const updated: PickingTask = {
          ...task,
          pickedQuantity: clamped,
          pendingQuantity: task.requestedQuantity - clamped,
          status: nextStatus,
          ...(isPartial && reasonId ? { partialReasonId: reasonId } : {}),
        }

        // Deduct reserved inventory when picking completes
        const inventoryItem = state.inventoryItems.find(
          (i) =>
            i.productId === task.productId &&
            i.locationId === task.locationId &&
            (!capturedSerial?.trim() || i.serial === capturedSerial.trim())
        )
        const updatedItems = inventoryItem
          ? state.inventoryItems.map((i) =>
              i.id === inventoryItem.id
                ? {
                    ...i,
                    onHandQuantity: Math.max(0, i.onHandQuantity - clamped),
                    reservedQuantity: Math.max(0, i.reservedQuantity - clamped),
                  }
                : i
            )
          : state.inventoryItems

        const movement = recordMovement({
          productId: task.productId,
          warehouseId: 'wh-bog',
          fromLocationId: task.locationId,
          type: 'pick',
          quantity: clamped,
          serial: capturedSerial?.trim() || undefined,
          uomId: baseUomId,
          referenceType: 'commerce_order',
          referenceId: task.orderId,
          operatorName: task.operatorName ?? 'Operador',
        })

        set({
          pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, movement],
        })
        return updated
      },

      approvePart: (taskId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.pickingTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('picking task not found')
        if (!canTransition(pickingTaskTransitions, task.status, 'partial_approved')) {
          throw new Error(`No se puede aprobar parcial desde el estado ${task.status}`)
        }
        const updated: PickingTask = { ...task, status: 'partial_approved' }
        set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      rejectPart: (taskId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.pickingTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('picking task not found')
        if (!canTransition(pickingTaskTransitions, task.status, 'partial_rejected')) {
          throw new Error(`No se puede rechazar parcial desde el estado ${task.status}`)
        }
        const updated: PickingTask = { ...task, status: 'partial_rejected' }
        set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      reportIssue: (taskId, reasonId, note, photoDataUrl, substituteProductId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.pickingTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('picking task not found')
        if (!canTransition(pickingTaskTransitions, task.status, 'with_issue')) {
          throw new Error(`No se puede reportar incidencia desde el estado ${task.status}`)
        }
        if (state.settings.pickingRequireIssuePhoto && !photoDataUrl) {
          throw new Error('Este almacén exige foto para reportar una incidencia')
        }
        const updated: PickingTask = {
          ...task,
          status: 'with_issue',
          issueReasonId: reasonId,
          issueReason: note,
          ...(photoDataUrl ? { issuePhotoUrl: photoDataUrl } : {}),
          ...(substituteProductId ? { substituteProductId } : {}),
        }
        set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      resolveIssue: (taskId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.pickingTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('picking task not found')
        if (!canTransition(pickingTaskTransitions, task.status, 'in_progress')) {
          throw new Error(`No se puede resolver incidencia desde el estado ${task.status}`)
        }
        const updated: PickingTask = { ...task, status: 'in_progress' }
        set({ pickingTasks: state.pickingTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      // ─── Waves ────────────────────────────────────────────────────────────────

      releaseWave: (waveId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const wave = state.pickingWaves.find((w) => w.id === waveId)
        if (!wave) throw new Error('picking wave not found')
        if (!canTransition(waveTransitions, wave.status, 'in_progress')) {
          throw new Error(`No se puede liberar oleada desde el estado ${wave.status}`)
        }
        const updated: PickingWave = { ...wave, status: 'in_progress' }
        set({ pickingWaves: state.pickingWaves.map((w) => (w.id === waveId ? updated : w)) })
        return updated
      },

      createWave: (data) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const id = `wv-${state.pickingWaves.length + 1}-new`
        const created: PickingWave = {
          ...data,
          id,
          status: 'draft',
          createdAt: seed.seedTimestamp,
        }
        set({ pickingWaves: [...state.pickingWaves, created] })
        return created
      },

      // ─── Batch picking ────────────────────────────────────────────────────────

      startBatchTask: (batchId, operatorName) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const batch = state.batchTasks.find((b) => b.id === batchId)
        if (!batch) throw new Error('batch task not found')
        if (batch.status !== 'pending')
          throw new Error(`No se puede iniciar desde el estado ${batch.status}`)
        const updated: BatchTask = { ...batch, status: 'in_progress', operatorName }
        set({ batchTasks: state.batchTasks.map((b) => (b.id === batchId ? updated : b)) })
        return updated
      },

      completeBatchTask: (batchId, pickedQty) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const batch = state.batchTasks.find((b) => b.id === batchId)
        if (!batch) throw new Error('batch task not found')
        if (batch.status !== 'in_progress')
          throw new Error(`No se puede completar desde el estado ${batch.status}`)
        const clamped = Math.min(pickedQty, batch.totalRequestedQuantity)
        const isPartial = clamped < batch.totalRequestedQuantity
        const nextStatus: BatchTask['status'] = isPartial ? 'partial' : 'completed'

        const updated: BatchTask = { ...batch, totalPickedQuantity: clamped, status: nextStatus }

        // Deduct inventory for the collected quantity
        const inventoryItem = state.inventoryItems.find(
          (i) => i.productId === batch.productId && i.locationId === batch.locationId
        )
        const updatedItems = inventoryItem
          ? state.inventoryItems.map((i) =>
              i.id === inventoryItem.id
                ? {
                    ...i,
                    onHandQuantity: Math.max(0, i.onHandQuantity - clamped),
                    reservedQuantity: Math.max(0, i.reservedQuantity - clamped),
                  }
                : i
            )
          : state.inventoryItems

        const movement = recordMovement({
          productId: batch.productId,
          warehouseId: 'wh-bog',
          fromLocationId: batch.locationId,
          type: 'pick',
          quantity: clamped,
          referenceType: 'manual',
          referenceId: batchId,
          operatorName: batch.operatorName ?? 'Operador',
        })

        set({
          batchTasks: state.batchTasks.map((b) => (b.id === batchId ? updated : b)),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, movement],
        })
        return updated
      },

      // ─── Cluster picking ──────────────────────────────────────────────────────

      startClusterTask: (clusterId, operatorName) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const cluster = state.clusterTasks.find((c) => c.id === clusterId)
        if (!cluster) throw new Error('cluster task not found')
        if (cluster.status !== 'pending')
          throw new Error(`No se puede iniciar desde el estado ${cluster.status}`)
        const updated: ClusterTask = { ...cluster, status: 'in_progress', operatorName }
        set({ clusterTasks: state.clusterTasks.map((c) => (c.id === clusterId ? updated : c)) })
        return updated
      },

      depositToSlot: (clusterId, orderId, productId, qty) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const cluster = state.clusterTasks.find((c) => c.id === clusterId)
        if (!cluster) throw new Error('cluster task not found')
        if (cluster.status !== 'in_progress') throw new Error('El cluster no está en progreso')

        const updatedSlots = cluster.slots.map((slot) => {
          if (slot.orderId !== orderId) return slot
          const updatedItems = slot.items.map((item) => {
            if (item.productId !== productId) return item
            const newDeposited = Math.min(item.deposited + qty, item.requested)
            return { ...item, deposited: newDeposited }
          })
          const allDone = updatedItems.every((i) => i.deposited >= i.requested)
          return { ...slot, items: updatedItems, completed: allDone }
        })

        const allSlotsComplete = updatedSlots.every((s) => s.completed)
        const updated: ClusterTask = {
          ...cluster,
          slots: updatedSlots,
          status: allSlotsComplete ? 'completed' : 'in_progress',
        }
        set({ clusterTasks: state.clusterTasks.map((c) => (c.id === clusterId ? updated : c)) })
        return updated
      },

      completeClusterTask: (clusterId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const cluster = state.clusterTasks.find((c) => c.id === clusterId)
        if (!cluster) throw new Error('cluster task not found')
        const allComplete = cluster.slots.every((s) => s.completed)
        const status: ClusterTask['status'] = allComplete ? 'completed' : 'partial'
        const updated: ClusterTask = { ...cluster, status }
        set({ clusterTasks: state.clusterTasks.map((c) => (c.id === clusterId ? updated : c)) })
        return updated
      },

      // ─── Put-to-store ─────────────────────────────────────────────────────────

      startPutToStore: (taskId, operatorName) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.putToStoreTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('put-to-store task not found')
        if (task.status !== 'pending')
          throw new Error(`No se puede iniciar desde el estado ${task.status}`)
        const updated: PutToStoreTask = { ...task, status: 'in_progress', operatorName }
        set({ putToStoreTasks: state.putToStoreTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      distributeToStore: (taskId, storeId, qty) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.putToStoreTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('put-to-store task not found')
        if (task.status !== 'in_progress') throw new Error('La tarea no está en progreso')

        const updatedAllocations = task.allocations.map((a) => {
          if (a.storeId !== storeId) return a
          const newQty = Math.min(a.distributedQuantity + qty, a.requestedQuantity)
          return { ...a, distributedQuantity: newQty }
        })

        const allDistributed = updatedAllocations.every(
          (a) => a.distributedQuantity >= a.requestedQuantity
        )
        const updated: PutToStoreTask = {
          ...task,
          allocations: updatedAllocations,
          status: allDistributed ? 'completed' : 'in_progress',
        }
        set({ putToStoreTasks: state.putToStoreTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      completePutToStore: (taskId) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const task = state.putToStoreTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('put-to-store task not found')
        const allDone = task.allocations.every((a) => a.distributedQuantity >= a.requestedQuantity)
        const updated: PutToStoreTask = { ...task, status: allDone ? 'completed' : 'partial' }
        set({ putToStoreTasks: state.putToStoreTasks.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      // ─── Waveless ─────────────────────────────────────────────────────────────

      createWavelessOrder: (orderId, priority) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const order = state.commerceOrders.find((o) => o.id === orderId)
        if (!order) throw new Error('commerce order not found')

        // Auto-generate picking tasks for each order line
        const baseIdx = state.pickingTasks.length
        const newTasks: PickingTask[] = order.items.map((line, i) => {
          const invItem = state.inventoryItems.find(
            (inv) => inv.productId === line.productId && inv.status === 'available'
          )
          return {
            id: `pt-wl-${orderId}-${i}`,
            code: `PICK-WL-${String(baseIdx + i + 1).padStart(3, '0')}`,
            orderId,
            productId: line.productId,
            locationId: invItem?.locationId ?? 'loc-stageout',
            requestedQuantity: line.requestedQuantity,
            pickedQuantity: 0,
            pendingQuantity: line.requestedQuantity,
            status: 'pending',
            priority,
          }
        })

        const wlId = `wl-${state.wavelessOrders.length + 1}`
        const waveless: WavelessOrder = {
          id: wlId,
          orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          channel: order.channel,
          fulfillmentType: order.fulfillmentType,
          pickingTaskIds: newTasks.map((t) => t.id),
          status: 'pending',
          priority,
          createdAt: seed.seedTimestamp,
        }

        set({
          wavelessOrders: [...state.wavelessOrders, waveless],
          pickingTasks: [...state.pickingTasks, ...newTasks],
        })
        return waveless
      },

      startWavelessOrder: (wavelessId, operatorName) => {
        const state = get()
        if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_MSG)
        const wl = state.wavelessOrders.find((w) => w.id === wavelessId)
        if (!wl) throw new Error('waveless order not found')
        if (wl.status !== 'pending')
          throw new Error(`No se puede iniciar desde el estado ${wl.status}`)
        const updated: WavelessOrder = { ...wl, status: 'in_progress' }
        // Also start the associated picking tasks
        const updatedTasks = state.pickingTasks.map((t) =>
          wl.pickingTaskIds.includes(t.id) && t.status === 'pending'
            ? { ...t, status: 'assigned' as const, operatorName }
            : t
        )
        set({
          wavelessOrders: state.wavelessOrders.map((w) => (w.id === wavelessId ? updated : w)),
          pickingTasks: updatedTasks,
        })
        return updated
      },

      // ─── Packing ──────────────────────────────────────────────────────────────

      startPacking: (packingOrderId, packerName) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        if (order.status !== 'pending')
          throw new Error(`No se puede iniciar desde el estado ${order.status}`)
        const updated: PackingOrder = { ...order, status: 'in_progress', packerName }
        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
        })
        return updated
      },

      scanItem: (packingOrderId, productId, qty) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        if (order.status !== 'in_progress') throw new Error('El packing no está en progreso')
        const line = order.items?.find((i) => i.productId === productId)
        if (!line) throw new Error('línea de producto no encontrada')
        const updatedItems = order.items!.map((i) =>
          i.productId === productId
            ? { ...i, scannedQuantity: Math.min(i.scannedQuantity + qty, i.requestedQuantity) }
            : i
        )
        const scannedItems = updatedItems.reduce((sum, i) => sum + i.scannedQuantity, 0)
        const vStatus = updatedItems.every((i) => i.scannedQuantity === i.requestedQuantity)
          ? 'verified'
          : 'pending'
        const updated: PackingOrder = {
          ...order,
          items: updatedItems,
          scannedItems,
          verificationStatus: vStatus,
        }
        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
        })
        return updated
      },

      completePacking: (packingOrderId, scannedItems) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        const vStatus = scannedItems === order.expectedItems ? 'verified' : 'mismatch'
        // Verification policy (see /packing-settings): a mismatch may be blocked outright.
        if (
          vStatus === 'mismatch' &&
          (state.settings.packingRequireFullScan || !state.settings.packingAllowMismatch)
        ) {
          throw new Error(
            'Verificación incompleta: faltan ítems por escanear y la configuración no permite cerrar con discrepancia.'
          )
        }
        const nextStatus: PackingOrder['status'] = vStatus === 'verified' ? 'verified' : 'mismatch'
        const updated: PackingOrder = {
          ...order,
          scannedItems,
          verificationStatus: vStatus,
          status: nextStatus,
          verifiedAt: seed.seedTimestamp,
        }

        // Emit a StockMovement per serialized item so serial trace is complete at packing stage
        const serialMovements: StockMovement[] = (order.items ?? [])
          .filter((item) => !!item.serial)
          .map((item) =>
            recordMovement({
              productId: item.productId,
              warehouseId: 'wh-bog',
              type: 'pick',
              quantity: item.scannedQuantity || item.requestedQuantity,
              serial: item.serial,
              referenceType: 'commerce_order',
              referenceId: order.orderId,
              operatorName: order.packerName ?? 'Packer',
            })
          )

        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
          ...(serialMovements.length > 0
            ? { stockMovements: [...state.stockMovements, ...serialMovements] }
            : {}),
        })
        // Verification policy (see /packing-settings): optionally auto-generate the
        // shipping label the moment the packing verifies, skipping the manual step.
        if (vStatus === 'verified' && state.settings.packingAutoGenerateLabel) {
          return get().generateLabel(packingOrderId)
        }
        return updated
      },

      applyPackingRule: (packingOrderId, ruleId) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        const rule = state.packingRules.find((r) => r.id === ruleId)
        if (!rule) throw new Error('packing rule not found')
        if (order.appliedRuleIds.includes(ruleId)) return order
        const updated: PackingOrder = {
          ...order,
          appliedRuleIds: [...order.appliedRuleIds, ruleId],
        }
        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
        })
        return updated
      },

      removePackingRule: (packingOrderId, ruleId) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        const updated: PackingOrder = {
          ...order,
          appliedRuleIds: order.appliedRuleIds.filter((id) => id !== ruleId),
        }
        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
        })
        return updated
      },

      selectBox: (packingOrderId, boxTypeId) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        const box = state.packingBoxTypes.find((b) => b.id === boxTypeId)
        if (!box) throw new Error('box type not found')
        const updated: PackingOrder = { ...order, boxTypeId, suggestedBox: box.name }
        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
        })
        return updated
      },

      generateLabel: (packingOrderId) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        if (order.verificationStatus !== 'verified')
          throw new Error('Solo se puede generar etiqueta para packing verificado')
        const seq = state.labels.length + 1
        const labelCode = `LBL-SHP-${String(seq).padStart(4, '0')}`
        const newLabel: WmsLabel = {
          id: `lb-new-${packingOrderId}`,
          code: labelCode,
          type: 'shipping',
          reference: order.orderId,
          status: 'completed',
          createdAt: seed.seedTimestamp,
          createdBy: order.packerName ?? 'Sistema',
        }
        const updated: PackingOrder = {
          ...order,
          labelGenerated: true,
          labelCode,
          status: 'labelled',
        }
        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
          labels: [...state.labels, newLabel],
        })
        return updated
      },

      sendToShipping: (packingOrderId) => {
        const state = get()
        if (state.settings.packingFreezeActive) throw new Error(PACKING_FROZEN_MSG)
        const order = state.packingOrders.find((p) => p.id === packingOrderId)
        if (!order) throw new Error('packing order not found')
        if (!order.labelGenerated) throw new Error('Genera la etiqueta antes de enviar a despacho')
        const updated: PackingOrder = { ...order, status: 'dispatched' }
        set({
          packingOrders: state.packingOrders.map((p) => (p.id === packingOrderId ? updated : p)),
        })
        return updated
      },

      createPackingRule: (data) => {
        const state = get()
        const code = data.code.trim().toUpperCase()
        if (state.packingRules.some((r) => r.code === code))
          throw new Error(`Ya existe una regla con el código "${code}"`)
        const created: PackingRule = { ...data, code, id: `pr-${Date.now()}` }
        set({ packingRules: [...state.packingRules, created] })
        return created
      },

      updatePackingRule: (id, data) => {
        const state = get()
        const rule = state.packingRules.find((r) => r.id === id)
        if (!rule) throw new Error('packing rule not found')
        if (data.code) {
          const code = data.code.trim().toUpperCase()
          if (state.packingRules.some((r) => r.code === code && r.id !== id))
            throw new Error(`Ya existe una regla con el código "${code}"`)
          data = { ...data, code }
        }
        const updated: PackingRule = { ...rule, ...data }
        set({ packingRules: state.packingRules.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      togglePackingRule: (ruleId) => {
        const state = get()
        const rule = state.packingRules.find((r) => r.id === ruleId)
        if (!rule) throw new Error('packing rule not found')
        const updated: PackingRule = { ...rule, active: !rule.active }
        set({ packingRules: state.packingRules.map((r) => (r.id === ruleId ? updated : r)) })
        return updated
      },

      deletePackingRule: (ruleId) => {
        const state = get()
        set({ packingRules: state.packingRules.filter((r) => r.id !== ruleId) })
      },

      createPackingBox: (data) => {
        const state = get()
        const code = data.code.trim().toUpperCase()
        if (state.packingBoxTypes.some((b) => b.code === code))
          throw new Error(`Ya existe una caja con el código "${code}"`)
        const created: PackingBoxType = { ...data, code, id: `box-${Date.now()}` }
        set({ packingBoxTypes: [...state.packingBoxTypes, created] })
        return created
      },

      updatePackingBox: (id, data) => {
        const state = get()
        const box = state.packingBoxTypes.find((b) => b.id === id)
        if (!box) throw new Error('box type not found')
        if (data.code) {
          const code = data.code.trim().toUpperCase()
          if (state.packingBoxTypes.some((b) => b.code === code && b.id !== id))
            throw new Error(`Ya existe una caja con el código "${code}"`)
          data = { ...data, code }
        }
        const updated: PackingBoxType = { ...box, ...data }
        set({ packingBoxTypes: state.packingBoxTypes.map((b) => (b.id === id ? updated : b)) })
        return updated
      },

      deletePackingBox: (id) => {
        const state = get()
        set({ packingBoxTypes: state.packingBoxTypes.filter((b) => b.id !== id) })
      },

      // ─── Shipping ─────────────────────────────────────────────────────────────

      shipOrder: (shipmentId, _operatorName, ownFleet) => {
        const state = get()
        if (state.settings.shippingFreezeActive) throw new Error(SHIPPING_FROZEN_MSG)
        const shipment = state.shipments.find((s) => s.id === shipmentId)
        if (!shipment) throw new Error('shipment not found')
        if (shipment.status !== 'pending') {
          throw new Error(`No se puede despachar envío desde el estado ${shipment.status}`)
        }

        // Modalidad deshabilitada en configuración → no se puede despachar por ese medio.
        const carrier = state.carriers.find((c) => c.id === shipment.carrierId)
        const enabled = state.settings.shippingEnabledModalities
        if (carrier?.modalityType && enabled?.length && !enabled.includes(carrier.modalityType)) {
          throw new Error(
            `La modalidad "${carrier.modalityType}" está deshabilitada en la configuración de despacho.`
          )
        }

        // Verificación de carga (#7 Estándar): sin bultos confirmados no sale el envío.
        const verified = shipment.verifiedPackages ?? 0
        if (state.settings.shippingRequireLoadVerification && verified <= 0) {
          throw new Error(
            'Verificación de carga pendiente: confirma los bultos antes de despachar.'
          )
        }

        // Despacho parcial: faltan bultos → sólo pasa si la política lo permite.
        const missing = state.settings.shippingRequireLoadVerification
          ? Math.max(0, shipment.packageCount - verified)
          : 0
        if (missing > 0 && !state.settings.shippingAllowPartialDispatch) {
          throw new Error(
            `Carga incompleta: faltan ${missing} bulto(s) y la configuración no permite despacho parcial.`
          )
        }

        const updated: Shipment = {
          ...shipment,
          status: 'in_transit',
          shippedAt: seed.seedTimestamp,
          trackingNumber: shipment.trackingNumber ?? `TRK-${shipmentId.toUpperCase()}`,
          ...(missing > 0 ? { partialDispatch: true, pendingPackages: missing } : {}),
          ...(ownFleet
            ? { driverName: ownFleet.driverName, vehiclePlate: ownFleet.vehiclePlate }
            : {}),
        }
        set({ shipments: state.shipments.map((s) => (s.id === shipmentId ? updated : s)) })
        return updated
      },

      // Confirma físicamente los bultos cargados antes del despacho.
      verifyShipmentLoad: (shipmentId, verifiedPackages, operatorName) => {
        const state = get()
        if (state.settings.shippingFreezeActive) throw new Error(SHIPPING_FROZEN_MSG)
        const shipment = state.shipments.find((s) => s.id === shipmentId)
        if (!shipment) throw new Error('shipment not found')
        if (shipment.status !== 'pending')
          throw new Error('Sólo se puede verificar la carga de envíos pendientes')
        if (verifiedPackages < 0) throw new Error('La cantidad verificada no puede ser negativa')
        if (verifiedPackages > shipment.packageCount)
          throw new Error(
            `No se pueden verificar ${verifiedPackages} bultos: el envío sólo tiene ${shipment.packageCount}.`
          )

        const updated: Shipment = {
          ...shipment,
          verifiedPackages,
          loadVerifiedAt: seed.seedTimestamp,
          loadVerifiedBy: operatorName,
        }
        set({ shipments: state.shipments.map((s) => (s.id === shipmentId ? updated : s)) })
        return updated
      },

      // Aplica una cotización de rate shopping al envío (transportadora, servicio, costo, ETA).
      applyRateQuote: (shipmentId, quote) => {
        const state = get()
        if (state.settings.shippingFreezeActive) throw new Error(SHIPPING_FROZEN_MSG)
        const shipment = state.shipments.find((s) => s.id === shipmentId)
        if (!shipment) throw new Error('shipment not found')
        if (shipment.status !== 'pending')
          throw new Error('Sólo se puede recotizar un envío pendiente de despacho')

        const updated: Shipment = {
          ...shipment,
          carrierId: quote.carrierId,
          carrierName: quote.carrierName,
          serviceLevel: quote.serviceLevel,
          quotedCostUsd: quote.quotedCostUsd,
          estimatedDeliveryDate: quote.estimatedDeliveryDate,
          otifStatus: shipment.promisedDate
            ? deriveOtifStatus(
                shipment.promisedDate,
                quote.estimatedDeliveryDate,
                state.settings.shippingOtifAtRiskDays
              )
            : shipment.otifStatus,
        }
        set({ shipments: state.shipments.map((s) => (s.id === shipmentId ? updated : s)) })
        return updated
      },

      createShipment: (data, quote) => {
        const id = `sh-${Date.now()}`
        const created: Shipment = {
          ...data,
          id,
          carrierId: quote.carrierId,
          carrierName: quote.carrierName,
          serviceLevel: quote.serviceLevel,
          quotedCostUsd: quote.quotedCostUsd,
          estimatedDeliveryDate: quote.estimatedDeliveryDate,
          status: 'pending',
        }
        set({ shipments: [...get().shipments, created] })
        return created
      },

      deliverShipment: (shipmentId) => {
        const state = get()
        if (state.settings.shippingFreezeActive) throw new Error(SHIPPING_FROZEN_MSG)
        const shipment = state.shipments.find((s) => s.id === shipmentId)
        if (!shipment) throw new Error('shipment not found')
        if (shipment.status !== 'in_transit')
          throw new Error('Solo se pueden entregar envíos en tránsito')
        const updated: Shipment = {
          ...shipment,
          status: 'completed',
          deliveredAt: seed.seedTimestamp,
        }
        set({ shipments: state.shipments.map((s) => (s.id === shipmentId ? updated : s)) })
        return updated
      },

      // ─── Manifests ────────────────────────────────────────────────────────────

      createManifest: (data) => {
        const state = get()
        if (state.settings.shippingFreezeActive) throw new Error(SHIPPING_FROZEN_MSG)

        const id = `mf-${Date.now()}`
        const code = `MAN-${new Date().toISOString().slice(2, 7).replace('-', '')}-${String(state.loadManifests.length + 1).padStart(3, '0')}`

        const created: LoadManifest = {
          id,
          code,
          manifestDate: data.manifestDate,
          status: 'pending',
          orderIds: data.orderIds,
          transferIds: data.transferIds,
          returnIds: data.returnIds,
          totalUnits: 0,
          totalPackages: data.orderIds.length + data.transferIds.length,
          totalWeightKg: 0,
          totalVolumeM3: 0,
          sapRouteId: data.sapRouteId,
          truckPlate: '',
          driverName: '',
          carrierName: '',
          stops: [],
        }
        set({ loadManifests: [...state.loadManifests, created] })
        return created
      },

      addDocumentToManifest: (manifestId, type, docId, stopSequence) => {
        const state = get()
        const manifest = state.loadManifests.find((m) => m.id === manifestId)
        if (!manifest) throw new Error('Manifiesto no encontrado')
        if (manifest.status === 'completed') throw new Error('El manifiesto ya está cerrado')

        const updatedStops = manifest.stops.map((stop) => {
          if (stop.sequence !== stopSequence) return stop
          return {
            ...stop,
            orderIds: type === 'order' ? [...stop.orderIds, docId] : stop.orderIds,
            transferIds: type === 'transfer' ? [...stop.transferIds, docId] : stop.transferIds,
            returnIds: type === 'return' ? [...stop.returnIds, docId] : stop.returnIds,
          }
        })

        const updatedManifest: LoadManifest = {
          ...manifest,
          orderIds: type === 'order' ? [...manifest.orderIds, docId] : manifest.orderIds,
          transferIds:
            type === 'transfer' ? [...manifest.transferIds, docId] : manifest.transferIds,
          returnIds: type === 'return' ? [...manifest.returnIds, docId] : manifest.returnIds,
          totalPackages: manifest.totalPackages + 1,
          stops: updatedStops,
        }
        set({
          loadManifests: state.loadManifests.map((m) =>
            m.id === manifestId ? updatedManifest : m
          ),
        })
        return updatedManifest
      },

      closeManifest: (manifestId) => {
        const state = get()
        const manifest = state.loadManifests.find((m) => m.id === manifestId)
        if (!manifest) throw new Error('Manifiesto no encontrado')
        if (manifest.status === 'completed') throw new Error('El manifiesto ya está cerrado')
        const updated: LoadManifest = { ...manifest, status: 'completed' }
        set({ loadManifests: state.loadManifests.map((m) => (m.id === manifestId ? updated : m)) })
        return updated
      },

      dispatchManifest: (manifestId) => {
        const state = get()
        if (state.settings.shippingFreezeActive) throw new Error(SHIPPING_FROZEN_MSG)
        const manifest = state.loadManifests.find((m) => m.id === manifestId)
        if (!manifest) throw new Error('Manifiesto no encontrado')
        if (manifest.status !== 'pending' && manifest.status !== 'in_progress')
          throw new Error('Solo se pueden despachar manifiestos pendientes o en preparación')
        const updated: LoadManifest = { ...manifest, status: 'in_progress' }
        set({ loadManifests: state.loadManifests.map((m) => (m.id === manifestId ? updated : m)) })
        return updated
      },

      // ─── Transfers ────────────────────────────────────────────────────────────

      advanceTransfer: (transferId, operatorName) => {
        const state = get()
        const transfer = state.transfers.find((t) => t.id === transferId)
        if (!transfer) throw new Error('transfer not found')

        const currentLeg = transfer.legs[transfer.currentLegIndex]
        if (!currentLeg) throw new Error('No hay tramo activo')

        if (currentLeg.status === 'pending') {
          return get().dispatchLeg(transferId, currentLeg.id, operatorName)
        }
        if (currentLeg.status === 'in_transit') {
          return get().receiveLeg(transferId, currentLeg.id, operatorName)
        }

        throw new Error(
          `No se puede avanzar traslado desde el estado del tramo ${currentLeg.status}`
        )
      },

      dispatchLeg: (transferId, legId, operatorName) => {
        const state = get()
        const transfer = state.transfers.find((t) => t.id === transferId)
        if (!transfer) throw new Error('Traslado no encontrado')

        const legIdx = transfer.legs.findIndex((l) => l.id === legId)
        if (legIdx === -1) throw new Error('Tramo no encontrado')

        const leg = transfer.legs[legIdx]
        if (!legTransitions[leg.status]?.includes('in_transit')) {
          throw new Error(`No se puede despachar desde el estado ${leg.status}`)
        }

        const now = new Date().toISOString()

        // ── Inventario: saca el stock del origen y lo pone "en tránsito" ────────────
        // Cada línea despachada descuenta stock disponible en la bodega origen del
        // tramo (FIFO por id, sin dejar negativos) y materializa un InventoryItem con
        // status 'in_transit' ligado a este tramo. Esto es lo que hace que /inventory
        // muestre la mercancía como "En tránsito" de forma automática — sin sembrar
        // fotos estáticas. Al recepcionar el tramo (receiveLeg) se consume de nuevo.
        let updatedItems = [...state.inventoryItems]
        const movements: StockMovement[] = []

        for (const line of transfer.items) {
          let remaining = line.requestedQuantity
          updatedItems = updatedItems.map((i) => {
            if (remaining <= 0) return i
            if (i.warehouseId !== leg.originId || i.productId !== line.productId) return i
            const take = Math.min(availableStock(i), remaining)
            if (take <= 0) return i
            remaining -= take
            return { ...i, onHandQuantity: i.onHandQuantity - take }
          })

          const transitId = `inv-transit-${legId}-${line.productId}`
          const transitIdx = updatedItems.findIndex((i) => i.id === transitId)
          if (transitIdx >= 0) {
            updatedItems[transitIdx] = {
              ...updatedItems[transitIdx],
              onHandQuantity: updatedItems[transitIdx].onHandQuantity + line.requestedQuantity,
            }
          } else {
            updatedItems = [
              ...updatedItems,
              {
                id: transitId,
                productId: line.productId,
                warehouseId: leg.destinationId,
                locationId: 'loc-transit',
                onHandQuantity: line.requestedQuantity,
                reservedQuantity: 0,
                holdQuantity: 0,
                status: 'in_transit' as const,
              },
            ]
          }

          movements.push(
            recordMovement({
              productId: line.productId,
              warehouseId: leg.originId,
              fromLocationId: 'loc-stageout',
              toLocationId: 'loc-transit',
              type: 'transfer',
              quantity: line.requestedQuantity,
              referenceType: 'transfer',
              referenceId: transferId,
              operatorName,
            })
          )
        }

        const updatedLeg: TransferLeg = {
          ...leg,
          status: 'in_transit',
          dispatchedAt: now,
          operatorName,
        }

        const updatedLegs = transfer.legs.map((l) => (l.id === legId ? updatedLeg : l))
        const orderStatus: OperationalStatus = [
          'draft',
          'pending',
          'in_progress',
          'partial_received',
        ].includes(transfer.status)
          ? 'in_transit'
          : transfer.status

        const updatedTransfer: TransferOrder = {
          ...transfer,
          legs: updatedLegs,
          status: orderStatus,
        }

        set({
          transfers: state.transfers.map((t) => (t.id === transferId ? updatedTransfer : t)),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
        })

        return updatedTransfer
      },

      receiveLeg: (transferId, legId, operatorName, notes, lineReceipts) => {
        const state = get()
        const transfer = state.transfers.find((t) => t.id === transferId)
        if (!transfer) throw new Error('Traslado no encontrado')

        const legIdx = transfer.legs.findIndex((l) => l.id === legId)
        if (legIdx === -1) throw new Error('Tramo no encontrado')

        const leg = transfer.legs[legIdx]
        if (!legTransitions[leg.status]?.includes('received')) {
          throw new Error(`No se puede recepcionar desde el estado ${leg.status}`)
        }

        const now = new Date().toISOString()
        // Reconciliación por línea: si el recepcionista captura cantidades, se usan para
        // aterrizar solo lo sano (receivedQty) y registrar la avería/faltante como merma.
        // Sin lineReceipts, se conserva el comportamiento previo (aterriza todo lo despachado).
        const receiptByProduct = new Map<string, TransferLegLineReceipt>(
          (lineReceipts ?? []).map((r) => [r.productId, r])
        )
        const updatedLeg: TransferLeg = {
          ...leg,
          status: 'received',
          receivedAt: now,
          operatorName,
          notes,
          lineReceipts: lineReceipts && lineReceipts.length > 0 ? lineReceipts : leg.lineReceipts,
        }

        const updatedLegs = transfer.legs.map((l) => (l.id === legId ? updatedLeg : l))
        const isLastLeg = legIdx === transfer.legs.length - 1
        const newCurrentLegIndex = isLastLeg ? transfer.currentLegIndex : legIdx + 1
        const newOrderStatus: OperationalStatus = isLastLeg ? 'completed' : 'partial_received'

        // ── Inventario: aterriza el stock "en tránsito" como disponible en el destino ─
        // Consume los registros in_transit creados al despachar (inv-transit-<tramo>-*)
        // y deja la mercancía disponible en la bodega destino, en el muelle de recibo.
        // En un tramo intermedio esto deja el stock en la bodega transitoria, listo para
        // re-despacharse; en el tramo final completa el traslado.
        // NOTA MVP: la posición en tránsito se agrega por producto y no arrastra lote/serie
        // individual — la continuidad lote/serie a través del tránsito queda pendiente.
        let updatedItems = [...state.inventoryItems]
        const movements: StockMovement[] = []

        for (const line of transfer.items) {
          const transitId = `inv-transit-${legId}-${line.productId}`
          const transitIdx = updatedItems.findIndex((i) => i.id === transitId)
          const dispatchedQty =
            transitIdx >= 0 ? updatedItems[transitIdx].onHandQuantity : line.requestedQuantity

          if (transitIdx >= 0) updatedItems = updatedItems.filter((i) => i.id !== transitId)

          const receipt = receiptByProduct.get(line.productId)
          // Unidades sanas que entran a stock disponible; avería no aterriza (merma).
          const soundQty = receipt ? Math.max(0, receipt.receivedQty) : dispatchedQty
          const damagedQty = receipt ? Math.max(0, receipt.damagedQty) : 0

          if (soundQty > 0) {
            const destIdx = updatedItems.findIndex(
              (i) =>
                i.warehouseId === leg.destinationId &&
                i.productId === line.productId &&
                i.locationId === 'loc-recibo' &&
                i.status === 'available'
            )
            if (destIdx >= 0) {
              updatedItems[destIdx] = {
                ...updatedItems[destIdx],
                onHandQuantity: updatedItems[destIdx].onHandQuantity + soundQty,
              }
            } else {
              updatedItems = [
                ...updatedItems,
                {
                  id: `inv-arr-${legId}-${line.productId}`,
                  productId: line.productId,
                  warehouseId: leg.destinationId,
                  locationId: 'loc-recibo',
                  onHandQuantity: soundQty,
                  reservedQuantity: 0,
                  holdQuantity: 0,
                  status: 'available' as const,
                  receivedDate: now,
                },
              ]
            }

            movements.push(
              recordMovement({
                productId: line.productId,
                warehouseId: leg.destinationId,
                fromLocationId: 'loc-transit',
                toLocationId: 'loc-recibo',
                type: 'transfer',
                quantity: soundQty,
                referenceType: 'transfer',
                referenceId: transferId,
                operatorName,
              })
            )
          }

          // Avería en tránsito: no entra a disponible; se registra como merma (scrap) trazable.
          if (damagedQty > 0) {
            movements.push(
              recordMovement({
                productId: line.productId,
                warehouseId: leg.destinationId,
                fromLocationId: 'loc-transit',
                toLocationId: 'loc-recibo',
                type: 'scrap',
                quantity: damagedQty,
                referenceType: 'transfer',
                referenceId: transferId,
                operatorName,
              })
            )
          }
        }

        const updatedTransfer: TransferOrder = {
          ...transfer,
          legs: updatedLegs,
          currentLegIndex: newCurrentLegIndex,
          status: newOrderStatus,
        }

        set({
          transfers: state.transfers.map((t) => (t.id === transferId ? updatedTransfer : t)),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
        })

        return updatedTransfer
      },

      createTransferOrder: (payload) => {
        const state = get()
        const id = `tr-${Date.now()}`
        const now = new Date().toISOString()

        const legs: TransferLeg[] = payload.legs.map((l, i) => ({
          id: `leg-${id}-${i + 1}`,
          sequence: i + 1,
          originId: l.originId,
          destinationId: l.destinationId,
          status: 'pending' as TransferLegStatus,
          estimatedArrivalDate: l.estimatedArrivalDate,
        }))

        const firstLeg = legs[0]
        const lastLeg = legs[legs.length - 1]
        const isMultiLeg = legs.length > 1

        const transfer: TransferOrder = {
          id,
          code: `TR-${now.slice(2, 7).replace('-', '')}-${String(state.transfers.length + 1).padStart(3, '0')}`,
          type: isMultiLeg ? 'multi_leg' : 'dc_to_store',
          originId: firstLeg.originId,
          destinationId: lastLeg.destinationId,
          status: 'draft',
          createdAt: now,
          estimatedArrivalDate: lastLeg.estimatedArrivalDate,
          items: payload.items,
          legs,
          isMultiLeg,
          currentLegIndex: 0,
        }

        set({ transfers: [...state.transfers, transfer] })
        return transfer
      },

      // ─── Returns ──────────────────────────────────────────────────────────────

      createReturn: (data) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        if (data.items.length === 0) throw new Error('Agrega al menos un ítem a la devolución')
        if (data.items.some((i) => i.requestedQuantity <= 0)) {
          throw new Error('Las cantidades deben ser mayores a cero')
        }

        // RMA code: RMA-YYMM-NNN, sequential within the current session.
        const now = new Date(seed.seedTimestamp)
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const seq = String(state.returnOrders.length + 1).padStart(3, '0')

        const created: ReturnOrder = {
          id: `ret-${Date.now()}`,
          rmaCode: `RMA-${yy}${mm}-${seq}`,
          customerName: data.customerName,
          type: data.type,
          originId: data.originId,
          destinationId: data.destinationId,
          status: 'requested',
          reasonId: data.reasonId,
          // New returns start without a decision — QC is the safe default until inspected.
          disposition: 'quality_control',
          items: data.items.map((i, idx) => ({
            id: `retl-${Date.now()}-${idx}`,
            productId: i.productId,
            requestedQuantity: i.requestedQuantity,
          })),
          createdAt: seed.seedTimestamp,
          ...(data.dispatchDate ? { dispatchDate: data.dispatchDate } : {}),
        }
        set({ returnOrders: [...state.returnOrders, created] })
        return created
      },

      advanceReturn: (returnId, operatorName) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ret = state.returnOrders.find((r) => r.id === returnId)
        if (!ret) throw new Error('return order not found')

        // Single source of truth for the next FSM step (shared with the UI).
        const next = nextReturnStatus(ret)
        if (!next || !canTransition(returnTransitions, ret.status, next)) {
          throw new Error(`No se puede avanzar devolución desde el estado ${ret.status}`)
        }

        const updated: ReturnOrder = {
          ...ret,
          status: next,
          // Stamp lifecycle end when we reach a terminal state — powers cycle-time KPI.
          ...(TERMINAL_RETURN_STATUSES.has(next) ? { closedAt: seed.seedTimestamp } : {}),
        }
        const movements: StockMovement[] = []

        if (next === 'reentered') {
          for (const line of ret.items) {
            movements.push(
              recordMovement({
                productId: line.productId,
                warehouseId: ret.destinationId,
                toLocationId: 'loc-returns',
                type: 'return',
                quantity: line.requestedQuantity,
                referenceType: 'return',
                referenceId: returnId,
                operatorName,
              })
            )
          }
        }

        set({
          returnOrders: state.returnOrders.map((r) => (r.id === returnId ? updated : r)),
          stockMovements: [...state.stockMovements, ...movements],
        })
        return updated
      },

      rejectReturn: (returnId, operatorName, note) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ret = state.returnOrders.find((r) => r.id === returnId)
        if (!ret) throw new Error('return order not found')
        if (!canTransition(returnTransitions, ret.status, 'rejected')) {
          throw new Error(`No se puede rechazar una devolución en estado ${ret.status}`)
        }
        void operatorName
        void note
        const updated: ReturnOrder = {
          ...ret,
          status: 'rejected',
          disposition: 'rejected',
          closedAt: seed.seedTimestamp,
        }
        set({ returnOrders: state.returnOrders.map((r) => (r.id === returnId ? updated : r)) })
        return updated
      },

      inspectReturn: (returnId, inspectorName, items, notes) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ret = state.returnOrders.find((r) => r.id === returnId)
        if (!ret) throw new Error('return order not found')
        if (ret.status !== 'under_validation') {
          throw new Error(`Solo se puede inspeccionar desde el estado under_validation`)
        }

        // For each inspection item that includes a serial, verify it was actually
        // dispatched — i.e. there's a 'pick' StockMovement for that productId + serial.
        const enrichedItems = items.map((item) => {
          if (!item.serial) return item
          const dispatchedSerials = new Set(
            state.stockMovements
              .filter((mv) => mv.type === 'pick' && mv.productId === item.productId && mv.serial)
              .map((mv) => mv.serial as string)
          )
          return {
            ...item,
            serialMatchesDispatch: dispatchedSerials.has(item.serial),
          }
        })

        // When serial validation is enforced (WmsSettings.returnRequireSerialValidation),
        // a serial that isn't found in the dispatch history blocks the inspection — the
        // returned unit cannot be proven to be one we actually shipped.
        if (state.settings.returnRequireSerialValidation) {
          const unmatched = enrichedItems.filter(
            (i) => i.serial && i.serialMatchesDispatch === false
          )
          if (unmatched.length > 0) {
            throw new Error(
              `Validación de serie activa: ${unmatched
                .map((i) => i.serial)
                .join(
                  ', '
                )} no figura(n) en el historial de despacho. Corrige el serial o desactiva la validación en Configuración → Devoluciones.`
            )
          }
        }

        const overallResult: ReturnInspection['overallResult'] = enrichedItems.every(
          (i) => i.conditionRating !== 'defective'
        )
          ? 'pass'
          : enrichedItems.some((i) => i.conditionRating !== 'defective')
            ? 'partial_pass'
            : 'fail'

        const inspection: ReturnInspection = {
          id: `ri-${state.returnInspections.length + 1}`,
          returnOrderId: returnId,
          inspectorName,
          inspectedAt: seed.seedTimestamp,
          items: enrichedItems,
          overallResult,
          notes,
        }

        const updatedReturn: ReturnOrder = { ...ret, inspectionId: inspection.id }

        set({
          returnInspections: [...state.returnInspections, inspection],
          returnOrders: state.returnOrders.map((r) => (r.id === returnId ? updatedReturn : r)),
        })
        return inspection
      },

      setReturnDisposition: (returnId, disposition) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ret = state.returnOrders.find((r) => r.id === returnId)
        if (!ret) throw new Error('return order not found')
        if (ret.status !== 'under_validation') {
          throw new Error(`Solo se puede cambiar disposición desde el estado under_validation`)
        }
        const updated: ReturnOrder = { ...ret, disposition }
        set({ returnOrders: state.returnOrders.map((r) => (r.id === returnId ? updated : r)) })
        return updated
      },

      executeReentry: (returnId, lines, operatorName) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ret = state.returnOrders.find((r) => r.id === returnId)
        if (!ret) throw new Error('return order not found')
        if (ret.status !== 'reentered') {
          throw new Error(`Solo se puede reingresar desde el estado reentered`)
        }
        if (lines.length === 0) throw new Error('Selecciona al menos un ítem para reingresar')

        let updatedItems = [...state.inventoryItems]
        const movements: StockMovement[] = []

        for (const line of lines) {
          if (line.quantity <= 0) continue

          // Remove from returns zone (loc-returns) if stock exists there
          const returnsIdx = updatedItems.findIndex(
            (i) =>
              i.productId === line.productId &&
              i.locationId === 'loc-returns' &&
              i.warehouseId === ret.destinationId
          )
          if (returnsIdx >= 0) {
            const item = updatedItems[returnsIdx]
            const deduct = Math.min(line.quantity, item.onHandQuantity)
            updatedItems[returnsIdx] = {
              ...item,
              onHandQuantity: Math.max(0, item.onHandQuantity - deduct),
            }
          }

          // Add to target location — merge with existing item or create new
          const destIdx = updatedItems.findIndex(
            (i) =>
              i.productId === line.productId &&
              i.locationId === line.targetLocationId &&
              i.warehouseId === ret.destinationId
          )
          if (destIdx >= 0) {
            updatedItems[destIdx] = {
              ...updatedItems[destIdx],
              onHandQuantity: updatedItems[destIdx].onHandQuantity + line.quantity,
              status: 'available',
            }
          } else {
            updatedItems = [
              ...updatedItems,
              {
                id: `inv-re-${returnId}-${line.productId}`,
                productId: line.productId,
                warehouseId: ret.destinationId,
                locationId: line.targetLocationId,
                onHandQuantity: line.quantity,
                reservedQuantity: 0,
                holdQuantity: 0,
                status: 'available' as const,
              },
            ]
          }

          movements.push(
            recordMovement({
              productId: line.productId,
              warehouseId: ret.destinationId,
              fromLocationId: 'loc-returns',
              toLocationId: line.targetLocationId,
              type: 'return',
              quantity: line.quantity,
              referenceType: 'return',
              referenceId: returnId,
              operatorName,
            })
          )
        }

        const batch: ReentryBatch = {
          id: `rb-${state.reentryBatches.length + 1}`,
          returnOrderId: returnId,
          operatorName,
          createdAt: seed.seedTimestamp,
          lines,
          status: 'executed',
        }

        // Advance return to closed
        const updatedReturn: ReturnOrder = {
          ...ret,
          status: 'closed',
          closedAt: seed.seedTimestamp,
        }

        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
          reentryBatches: [...state.reentryBatches, batch],
          returnOrders: state.returnOrders.map((r) => (r.id === returnId ? updatedReturn : r)),
        })
        return batch
      },

      executeScrap: (returnId, lines, disposalMethod, operatorName, referenceDoc, notes) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ret = state.returnOrders.find((r) => r.id === returnId)
        if (!ret) throw new Error('return order not found')
        if (ret.status !== 'sent_to_scrap') {
          throw new Error(`Solo se puede dar de baja desde el estado sent_to_scrap`)
        }
        if (lines.length === 0) throw new Error('Selecciona al menos un ítem para dar de baja')

        const updatedItems = [...state.inventoryItems]
        const movements: StockMovement[] = []

        for (const line of lines) {
          if (line.quantity <= 0) continue

          // Find stock in returns zone for this product
          const returnsIdx = updatedItems.findIndex(
            (i) =>
              i.productId === line.productId &&
              i.locationId === 'loc-returns' &&
              i.warehouseId === ret.destinationId
          )

          if (returnsIdx >= 0) {
            const item = updatedItems[returnsIdx]
            const deduct = Math.min(line.quantity, item.onHandQuantity)
            if (deduct > 0) {
              updatedItems[returnsIdx] = {
                ...item,
                ...applyScrap(item, deduct),
              }
            }
          }

          movements.push(
            recordMovement({
              productId: line.productId,
              warehouseId: ret.destinationId,
              fromLocationId: 'loc-returns',
              type: 'scrap',
              quantity: line.quantity,
              referenceType: 'return',
              referenceId: returnId,
              operatorName,
            })
          )
        }

        const record: ScrapRecord = {
          id: `sc-${state.scrapRecords.length + 1}`,
          returnOrderId: returnId,
          operatorName,
          createdAt: seed.seedTimestamp,
          disposalMethod,
          lines,
          ...(referenceDoc ? { referenceDoc } : {}),
          ...(notes ? { notes } : {}),
        }

        const updatedReturn: ReturnOrder = {
          ...ret,
          status: 'closed',
          closedAt: seed.seedTimestamp,
        }

        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
          scrapRecords: [...state.scrapRecords, record],
          returnOrders: state.returnOrders.map((r) => (r.id === returnId ? updatedReturn : r)),
        })
        return record
      },

      createRepairTicket: (
        returnId,
        vendorName,
        repairType,
        lines,
        expectedReturnDate,
        operatorName
      ) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ret = state.returnOrders.find((r) => r.id === returnId)
        if (!ret) throw new Error('return order not found')
        if (ret.status !== 'sent_to_repair') {
          throw new Error(`Solo se puede crear ticket de reparación desde el estado sent_to_repair`)
        }
        if (lines.length === 0) throw new Error('Agrega al menos un ítem al ticket')
        if (!vendorName.trim()) throw new Error('Ingresa el nombre del taller / proveedor')

        const ticket: RepairTicket = {
          id: `rpr-${state.repairTickets.length + 1}`,
          returnOrderId: returnId,
          vendorName: vendorName.trim(),
          repairType,
          lines,
          status: 'open',
          operatorName,
          createdAt: seed.seedTimestamp,
          expectedReturnDate,
        }

        set({ repairTickets: [...state.repairTickets, ticket] })
        return ticket
      },

      receiveRepairReturn: (ticketId, outcome, finalCostUsd, outcomeNotes, targetLocationId) => {
        const state = get()
        if (state.settings.returnsFreezeActive) throw new Error(RETURNS_FROZEN_MSG)
        const ticket = state.repairTickets.find((t) => t.id === ticketId)
        if (!ticket) throw new Error('repair ticket not found')
        if (ticket.status === 'completed' || ticket.status === 'failed') {
          throw new Error(`El ticket ya está cerrado (${ticket.status})`)
        }

        const ret = state.returnOrders.find((r) => r.id === ticket.returnOrderId)
        if (!ret) throw new Error('return order not found')

        const updatedTicket: RepairTicket = {
          ...ticket,
          status: outcome === 'restock' ? 'completed' : 'failed',
          outcome,
          finalCostUsd,
          outcomeNotes,
          receivedAt: seed.seedTimestamp,
        }

        let updatedItems = [...state.inventoryItems]
        const movements: StockMovement[] = []

        if (outcome === 'restock' && targetLocationId) {
          // Repaired items go directly to target pick location
          for (const line of ticket.lines) {
            const destIdx = updatedItems.findIndex(
              (i) =>
                i.productId === line.productId &&
                i.locationId === targetLocationId &&
                i.warehouseId === ret.destinationId
            )
            if (destIdx >= 0) {
              updatedItems[destIdx] = {
                ...updatedItems[destIdx],
                onHandQuantity: updatedItems[destIdx].onHandQuantity + line.quantity,
                status: 'available',
              }
            } else {
              updatedItems = [
                ...updatedItems,
                {
                  id: `inv-rpr-${ticketId}-${line.productId}`,
                  productId: line.productId,
                  warehouseId: ret.destinationId,
                  locationId: targetLocationId,
                  onHandQuantity: line.quantity,
                  reservedQuantity: 0,
                  holdQuantity: 0,
                  status: 'available' as const,
                },
              ]
            }
            movements.push(
              recordMovement({
                productId: line.productId,
                warehouseId: ret.destinationId,
                toLocationId: targetLocationId,
                type: 'return',
                quantity: line.quantity,
                referenceType: 'return',
                referenceId: ticket.returnOrderId,
                operatorName: ticket.operatorName,
              })
            )
          }
        } else if (outcome === 'scrap') {
          // Repair failed — items come back damaged, record scrap movement
          for (const line of ticket.lines) {
            // Deduct from loc-returns if stock exists there
            const returnsIdx = updatedItems.findIndex(
              (i) =>
                i.productId === line.productId &&
                i.locationId === 'loc-returns' &&
                i.warehouseId === ret.destinationId
            )
            if (returnsIdx >= 0) {
              const item = updatedItems[returnsIdx]
              const deduct = Math.min(line.quantity, item.onHandQuantity)
              if (deduct > 0) {
                updatedItems[returnsIdx] = { ...item, ...applyScrap(item, deduct) }
              }
            }
            movements.push(
              recordMovement({
                productId: line.productId,
                warehouseId: ret.destinationId,
                fromLocationId: 'loc-returns',
                type: 'scrap',
                quantity: line.quantity,
                referenceType: 'return',
                referenceId: ticket.returnOrderId,
                operatorName: ticket.operatorName,
              })
            )
          }
        }

        // Advance the RMA status
        const nextReturnStatus: ReturnOrder['status'] =
          outcome === 'restock' ? 'reentered' : 'sent_to_scrap'
        const updatedReturn: ReturnOrder = { ...ret, status: nextReturnStatus }

        set({
          repairTickets: state.repairTickets.map((t) => (t.id === ticketId ? updatedTicket : t)),
          returnOrders: state.returnOrders.map((r) => (r.id === ret.id ? updatedReturn : r)),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, ...movements],
        })
        return updatedTicket
      },

      // ─── Replenishment (intra-warehouse: reserve → pick face) ───────────────────

      startReplenishment: (taskId, operatorName, operatorId) => {
        const state = get()
        if (state.settings.replenishmentFreezeActive) throw new Error(REPLENISHMENT_FROZEN_MSG)
        const task = state.replenishmentTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('replenishment task not found')
        if (task.status !== 'pending')
          throw new Error(`No se puede iniciar desde el estado ${task.status}`)
        const updated: ReplenishmentTask = {
          ...task,
          status: 'assigned',
          operatorName,
          assignedOperatorId: operatorId ?? task.assignedOperatorId,
        }
        set({
          replenishmentTasks: state.replenishmentTasks.map((t) => (t.id === taskId ? updated : t)),
        })
        return updated
      },

      completeReplenishment: (taskId) => {
        const state = get()
        if (state.settings.replenishmentFreezeActive) throw new Error(REPLENISHMENT_FROZEN_MSG)
        const task = state.replenishmentTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('replenishment task not found')
        if (task.status !== 'assigned')
          throw new Error(`No se puede completar desde el estado ${task.status}`)

        // Move suggestedQuantity from origin to destination location
        const originIdx = state.inventoryItems.findIndex(
          (i) => i.productId === task.productId && i.locationId === task.originLocationId
        )
        if (originIdx === -1) throw new Error('No hay stock en la ubicación origen')

        const origin = state.inventoryItems[originIdx]
        const qty = Math.min(task.suggestedQuantity, origin.onHandQuantity)
        if (qty <= 0) throw new Error('Sin stock disponible para reponer')

        // Warehouse is the pick face's, not a hardcoded DC — keeps multi-warehouse correct.
        const destLoc = state.locations.find((l) => l.id === task.destinationLocationId)
        const warehouseId = task.warehouseId ?? destLoc?.warehouseId ?? origin.warehouseId

        let updatedItems = state.inventoryItems.map((i, idx) =>
          idx === originIdx ? { ...i, onHandQuantity: i.onHandQuantity - qty } : i
        )

        const destIdx = updatedItems.findIndex(
          (i) => i.productId === task.productId && i.locationId === task.destinationLocationId
        )
        if (destIdx >= 0) {
          updatedItems[destIdx] = {
            ...updatedItems[destIdx],
            onHandQuantity: updatedItems[destIdx].onHandQuantity + qty,
          }
        } else {
          updatedItems = [
            ...updatedItems,
            {
              id: `inv-rp-${taskId}`,
              productId: task.productId,
              warehouseId,
              locationId: task.destinationLocationId,
              onHandQuantity: qty,
              reservedQuantity: 0,
              holdQuantity: 0,
              status: 'available',
            },
          ]
        }

        const updated: ReplenishmentTask = {
          ...task,
          status: 'completed',
          currentStock: task.currentStock + qty,
        }
        const movement = recordMovement({
          productId: task.productId,
          warehouseId,
          fromLocationId: task.originLocationId,
          toLocationId: task.destinationLocationId,
          type: 'putaway',
          quantity: qty,
          referenceType: 'replenishment',
          referenceId: taskId,
          operatorName: task.operatorName ?? 'Operador',
        })

        set({
          replenishmentTasks: state.replenishmentTasks.map((t) => (t.id === taskId ? updated : t)),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, movement],
        })
        return updated
      },

      generateReplenishmentTasks: () => {
        const state = get()
        if (state.settings.replenishmentFreezeActive) throw new Error(REPLENISHMENT_FROZEN_MSG)
        const needs = selectReplenishmentNeeds(state)
        if (needs.length === 0) return []

        const now = new Date().toISOString()
        const baseIdx = state.replenishmentTasks.length
        const newTasks: ReplenishmentTask[] = needs.map((need, i) => {
          const pickFace = state.locations.find((l) => l.id === need.pickFaceLocationId)
          return {
            id: `rp-gen-${baseIdx + i + 1}`,
            productId: need.productId,
            warehouseId: pickFace?.warehouseId,
            originLocationId: need.reserveLocationId,
            destinationLocationId: need.pickFaceLocationId,
            currentStock: need.currentStock,
            minStock: need.minStock,
            maxStock: need.maxStock,
            suggestedQuantity: need.suggestedQuantity,
            priority: need.priority,
            status: 'pending',
            createdAt: now,
            auto: false,
          }
        })

        set({ replenishmentTasks: [...state.replenishmentTasks, ...newTasks] })
        return newTasks
      },

      // ─── Store (retail) replenishment: DC → store ───────────────────────────────

      generateStoreReplenishmentTasks: () => {
        const state = get()
        if (state.settings.replenishmentFreezeActive) throw new Error(REPLENISHMENT_FROZEN_MSG)
        const needs = selectStoreReplenishmentNeeds(state).filter((n) => !n.hasActiveTask)
        if (needs.length === 0) return []

        const now = new Date().toISOString()
        const baseIdx = state.storeReplenishmentTasks.length
        const newTasks: StoreReplenishmentTask[] = needs.map((need, i) => ({
          id: `srp-gen-${baseIdx + i + 1}`,
          storeWarehouseId: need.storeWarehouseId,
          sourceWarehouseId: need.sourceWarehouseId,
          productId: need.productId,
          currentStock: need.currentStock,
          minStock: need.minStock,
          maxStock: need.maxStock,
          suggestedQuantity: need.suggestedQuantity,
          priority: need.priority,
          status: 'pending',
          createdAt: now,
          auto: state.settings.replenishmentAutoStoreEnabled,
        }))

        set({ storeReplenishmentTasks: [...state.storeReplenishmentTasks, ...newTasks] })
        return newTasks
      },

      startStoreReplenishment: (taskId, operatorName) => {
        const state = get()
        if (state.settings.replenishmentFreezeActive) throw new Error(REPLENISHMENT_FROZEN_MSG)
        const task = state.storeReplenishmentTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('store replenishment task not found')
        if (task.status !== 'pending')
          throw new Error(`No se puede iniciar desde el estado ${task.status}`)
        const updated: StoreReplenishmentTask = { ...task, status: 'in_transit', operatorName }
        set({
          storeReplenishmentTasks: state.storeReplenishmentTasks.map((t) =>
            t.id === taskId ? updated : t
          ),
        })
        return updated
      },

      completeStoreReplenishment: (taskId) => {
        const state = get()
        if (state.settings.replenishmentFreezeActive) throw new Error(REPLENISHMENT_FROZEN_MSG)
        const task = state.storeReplenishmentTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('store replenishment task not found')
        if (task.status !== 'in_transit')
          throw new Error(`No se puede completar desde el estado ${task.status}`)

        // Pull from the source DC (any available position for the product).
        const originIdx = state.inventoryItems.findIndex(
          (i) =>
            i.warehouseId === task.sourceWarehouseId &&
            i.productId === task.productId &&
            i.status === 'available' &&
            i.onHandQuantity - i.reservedQuantity - i.holdQuantity > 0
        )
        if (originIdx === -1) throw new Error('El CD origen no tiene stock disponible para surtir')

        const origin = state.inventoryItems[originIdx]
        const originAvailable =
          origin.onHandQuantity - origin.reservedQuantity - origin.holdQuantity
        const qty = Math.min(task.suggestedQuantity, originAvailable)
        if (qty <= 0) throw new Error('Sin stock disponible en el CD origen')

        // A store keeps its stock in its sales-floor pick face (loc-floor-<store>).
        const storeFloor = state.locations.find(
          (l) => l.warehouseId === task.storeWarehouseId && l.isPickFace && !l.isBlocked
        )
        const destLocationId = storeFloor?.id ?? `loc-floor-${task.storeWarehouseId}`

        let updatedItems = state.inventoryItems.map((i, idx) =>
          idx === originIdx ? { ...i, onHandQuantity: i.onHandQuantity - qty } : i
        )

        const destIdx = updatedItems.findIndex(
          (i) => i.warehouseId === task.storeWarehouseId && i.productId === task.productId
        )
        if (destIdx >= 0) {
          updatedItems[destIdx] = {
            ...updatedItems[destIdx],
            onHandQuantity: updatedItems[destIdx].onHandQuantity + qty,
          }
        } else {
          updatedItems = [
            ...updatedItems,
            {
              id: `inv-srp-${taskId}`,
              productId: task.productId,
              warehouseId: task.storeWarehouseId,
              locationId: destLocationId,
              onHandQuantity: qty,
              reservedQuantity: 0,
              holdQuantity: 0,
              status: 'available',
            },
          ]
        }

        // Two audit entries: out of the DC and into the store (transfer semantics).
        const movementOut = recordMovement({
          productId: task.productId,
          warehouseId: task.sourceWarehouseId,
          fromLocationId: origin.locationId,
          type: 'transfer',
          quantity: qty,
          referenceType: 'replenishment',
          referenceId: taskId,
          operatorName: task.operatorName ?? 'Operador',
        })
        const movementIn = recordMovement({
          productId: task.productId,
          warehouseId: task.storeWarehouseId,
          toLocationId: destLocationId,
          type: 'transfer',
          quantity: qty,
          referenceType: 'replenishment',
          referenceId: taskId,
          operatorName: task.operatorName ?? 'Operador',
        })

        const updated: StoreReplenishmentTask = {
          ...task,
          status: 'completed',
          currentStock: task.currentStock + qty,
        }

        set({
          storeReplenishmentTasks: state.storeReplenishmentTasks.map((t) =>
            t.id === taskId ? updated : t
          ),
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, movementOut, movementIn],
        })
        return updated
      },

      upsertStoreReplenishmentPolicy: (policy) => {
        const state = get()
        const existing = policy.id
          ? state.storeReplenishmentPolicies.find((p) => p.id === policy.id)
          : undefined
        const resolved: StoreReplenishmentPolicy = {
          id:
            existing?.id ??
            `srp-pol-${state.storeReplenishmentPolicies.length + 1}-${policy.productId}`,
          storeWarehouseId: policy.storeWarehouseId,
          productId: policy.productId,
          minStock: policy.minStock,
          maxStock: policy.maxStock,
          active: policy.active,
        }
        set({
          storeReplenishmentPolicies: existing
            ? state.storeReplenishmentPolicies.map((p) => (p.id === resolved.id ? resolved : p))
            : [...state.storeReplenishmentPolicies, resolved],
        })
        return resolved
      },

      removeStoreReplenishmentPolicy: (id) => {
        const state = get()
        set({
          storeReplenishmentPolicies: state.storeReplenishmentPolicies.filter((p) => p.id !== id),
        })
      },

      toggleStoreReplenishmentPolicy: (id) => {
        const state = get()
        set({
          storeReplenishmentPolicies: state.storeReplenishmentPolicies.map((p) =>
            p.id === id ? { ...p, active: !p.active } : p
          ),
        })
      },

      // ─── Internal moves (movimientos internos intra-almacén) ────────────────────
      // Motor unificado de tareas de trabajo con confirmación en dos pasos:
      // create → assign → pick (sale del origen) → drop (aterriza en destino).

      createInternalMove: (payload) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten movimientos internos.')
        if (payload.quantity <= 0) throw new Error('La cantidad debe ser positiva')
        if (payload.fromLocationId === payload.toLocationId)
          throw new Error('El origen y el destino deben ser ubicaciones distintas')

        // Invariante intra-almacén: origen y destino deben pertenecer al mismo nodo.
        const fromLoc = state.locations.find((l) => l.id === payload.fromLocationId)
        const toLoc = state.locations.find((l) => l.id === payload.toLocationId)
        if (fromLoc && toLoc && fromLoc.warehouseId !== toLoc.warehouseId)
          throw new Error(
            'Un movimiento entre bodegas distintas es un traslado, no un movimiento interno'
          )

        // Debe haber disponible suficiente en el origen al momento de crear la tarea.
        const source = state.inventoryItems.find(
          (i) =>
            i.productId === payload.productId &&
            i.locationId === payload.fromLocationId &&
            i.warehouseId === payload.warehouseId &&
            (payload.lot ? i.lot === payload.lot : true) &&
            (payload.serial ? i.serial === payload.serial : true)
        )
        if (!source) throw new Error('No hay stock del producto en la ubicación origen')
        if (payload.quantity > availableStock(source))
          throw new Error('La cantidad supera el stock disponible en el origen')

        const { id, code } = nextInternalMoveRef()
        const task: InternalMoveTask = {
          id,
          code,
          warehouseId: payload.warehouseId,
          moveType: payload.moveType,
          productId: payload.productId,
          fromLocationId: payload.fromLocationId,
          toLocationId: payload.toLocationId,
          quantity: payload.quantity,
          lot: payload.lot ?? source.lot,
          serial: payload.serial ?? source.serial,
          status: payload.operatorName ? 'assigned' : 'pending',
          reasonId: payload.reasonId,
          operatorName: payload.operatorName,
          createdAt: new Date().toISOString(),
        }

        set({ internalMoves: [...state.internalMoves, task] })
        return task
      },

      assignMove: (taskId, operatorName) => {
        const state = get()
        const task = state.internalMoves.find((t) => t.id === taskId)
        if (!task) throw new Error('Movimiento interno no encontrado')
        if (!canTransition(internalMoveTransitions, task.status, 'assigned'))
          throw new Error(`No se puede asignar desde el estado ${task.status}`)
        const updated: InternalMoveTask = { ...task, status: 'assigned', operatorName }
        set({ internalMoves: state.internalMoves.map((t) => (t.id === taskId ? updated : t)) })
        return updated
      },

      confirmPickFromSource: (taskId, operatorName) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten movimientos internos.')
        const task = state.internalMoves.find((t) => t.id === taskId)
        if (!task) throw new Error('Movimiento interno no encontrado')
        if (!canTransition(internalMoveTransitions, task.status, 'picked'))
          throw new Error(`No se puede recoger desde el estado ${task.status}`)

        const srcIdx = state.inventoryItems.findIndex(
          (i) =>
            i.productId === task.productId &&
            i.locationId === task.fromLocationId &&
            i.warehouseId === task.warehouseId &&
            (task.lot ? i.lot === task.lot : true) &&
            (task.serial ? i.serial === task.serial : true)
        )
        if (srcIdx === -1) throw new Error('No hay stock en la ubicación origen')
        const source = state.inventoryItems[srcIdx]
        const moved = applyInternalMovePick(source, task.quantity)

        // Retira las unidades del origen; deja "en movimiento" sobre la tarea hasta el drop.
        // Descarta el registro origen si queda totalmente vacío.
        const drained =
          moved.onHandQuantity === 0 && source.reservedQuantity === 0 && source.holdQuantity === 0
        const updatedItems = drained
          ? state.inventoryItems.filter((_, idx) => idx !== srcIdx)
          : state.inventoryItems.map((i, idx) => (idx === srcIdx ? { ...i, ...moved } : i))

        const updated: InternalMoveTask = {
          ...task,
          status: 'picked',
          operatorName: operatorName ?? task.operatorName,
          pickedAt: new Date().toISOString(),
        }

        set({
          inventoryItems: updatedItems,
          internalMoves: state.internalMoves.map((t) => (t.id === taskId ? updated : t)),
        })
        return updated
      },

      confirmDropToDest: (taskId, operatorName) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten movimientos internos.')
        const task = state.internalMoves.find((t) => t.id === taskId)
        if (!task) throw new Error('Movimiento interno no encontrado')
        if (!canTransition(internalMoveTransitions, task.status, 'dropped'))
          throw new Error(`No se puede depositar desde el estado ${task.status}`)

        // Cuarentena: aterriza retenido en la ubicación QC; el resto entra disponible.
        const toQuarantine = task.moveType === 'quarantine'
        const landedStatus: InventoryItem['status'] = toQuarantine ? 'on_hold' : 'available'

        let updatedItems = [...state.inventoryItems]
        const destIdx = updatedItems.findIndex(
          (i) =>
            i.productId === task.productId &&
            i.locationId === task.toLocationId &&
            i.warehouseId === task.warehouseId &&
            (task.lot ? i.lot === task.lot : true) &&
            (task.serial ? i.serial === task.serial : true)
        )
        if (destIdx >= 0) {
          const dest = updatedItems[destIdx]
          updatedItems[destIdx] = {
            ...dest,
            ...applyInternalMoveDrop(dest, task.quantity),
            holdQuantity: toQuarantine ? dest.holdQuantity + task.quantity : dest.holdQuantity,
            status: toQuarantine ? 'on_hold' : dest.status,
            holdReasonId: toQuarantine ? (task.reasonId ?? dest.holdReasonId) : dest.holdReasonId,
          }
        } else {
          updatedItems = [
            ...updatedItems,
            {
              id: `inv-${task.id}`,
              productId: task.productId,
              warehouseId: task.warehouseId,
              locationId: task.toLocationId,
              lot: task.lot,
              serial: task.serial,
              onHandQuantity: task.quantity,
              reservedQuantity: 0,
              holdQuantity: toQuarantine ? task.quantity : 0,
              holdReasonId: toQuarantine ? task.reasonId : undefined,
              status: landedStatus,
            },
          ]
        }

        const movement = recordMovement({
          productId: task.productId,
          warehouseId: task.warehouseId,
          fromLocationId: task.fromLocationId,
          toLocationId: task.toLocationId,
          type: 'putaway',
          quantity: task.quantity,
          lot: task.lot,
          serial: task.serial,
          referenceType: internalMoveReferenceType(task.moveType),
          referenceId: task.id,
          operatorName: operatorName ?? task.operatorName ?? 'Operador',
        })

        const updated: InternalMoveTask = {
          ...task,
          status: 'dropped',
          operatorName: operatorName ?? task.operatorName,
          droppedAt: new Date().toISOString(),
        }

        set({
          inventoryItems: updatedItems,
          stockMovements: [...state.stockMovements, movement],
          internalMoves: state.internalMoves.map((t) => (t.id === taskId ? updated : t)),
        })
        return updated
      },

      cancelMove: (taskId) => {
        const state = get()
        const task = state.internalMoves.find((t) => t.id === taskId)
        if (!task) throw new Error('Movimiento interno no encontrado')
        if (!canTransition(internalMoveTransitions, task.status, 'cancelled'))
          throw new Error(`No se puede cancelar desde el estado ${task.status}`)

        let updatedItems = state.inventoryItems
        // Si ya se recogió, las unidades están "en movimiento": devuélvelas al origen.
        if (task.status === 'picked') {
          const srcIdx = updatedItems.findIndex(
            (i) =>
              i.productId === task.productId &&
              i.locationId === task.fromLocationId &&
              i.warehouseId === task.warehouseId &&
              (task.lot ? i.lot === task.lot : true) &&
              (task.serial ? i.serial === task.serial : true)
          )
          if (srcIdx >= 0) {
            updatedItems = updatedItems.map((i, idx) =>
              idx === srcIdx ? { ...i, ...applyReceipt(i, task.quantity) } : i
            )
          } else {
            updatedItems = [
              ...updatedItems,
              {
                id: `inv-${task.id}-back`,
                productId: task.productId,
                warehouseId: task.warehouseId,
                locationId: task.fromLocationId,
                lot: task.lot,
                serial: task.serial,
                onHandQuantity: task.quantity,
                reservedQuantity: 0,
                holdQuantity: 0,
                status: 'available',
              },
            ]
          }
        }

        const updated: InternalMoveTask = { ...task, status: 'cancelled' }
        set({
          inventoryItems: updatedItems,
          internalMoves: state.internalMoves.map((t) => (t.id === taskId ? updated : t)),
        })
        return updated
      },

      relocateAll: (recs, operatorName) => {
        const state = get()
        let items = [...state.inventoryItems]
        const movements: StockMovement[] = []
        let count = 0

        for (const rec of recs) {
          const srcIdx = items.findIndex(
            (i) => i.productId === rec.productId && i.locationId === rec.currentLocationId
          )
          if (srcIdx === -1) continue

          const src = items[srcIdx]
          const qty = src.onHandQuantity
          const toLocationId = rec.suggestedLocationId

          // Vaciar origen
          items[srcIdx] = { ...src, onHandQuantity: 0 }

          // Fusionar o crear en destino
          const destIdx = items.findIndex(
            (i) => i.productId === rec.productId && i.locationId === toLocationId && i.id !== src.id
          )
          if (destIdx >= 0) {
            items[destIdx] = {
              ...items[destIdx],
              onHandQuantity: items[destIdx].onHandQuantity + qty,
            }
            items = items.filter((i) => i.id !== src.id)
          } else {
            items[srcIdx] = { ...items[srcIdx], locationId: toLocationId }
          }

          movements.push(
            recordMovement({
              productId: rec.productId,
              warehouseId: src.warehouseId,
              fromLocationId: rec.currentLocationId,
              toLocationId,
              type: 'putaway',
              quantity: qty,
              referenceType: 'slotting',
              referenceId: rec.id,
              operatorName,
            })
          )
          count++
        }

        set({ inventoryItems: items, stockMovements: [...state.stockMovements, ...movements] })
        return count
      },

      captureSlottingSnapshot: (label) => {
        const state = get()
        const recs = selectSlottingRecommendations(state)
        const impact = selectSlottingImpact(state, recs)
        const misplaced = misplacedAClassItems(state)
        const affinityRecs = selectAffinityRecommendations(state)
        const pendingReplenishment = state.replenishmentTasks.filter(
          (t) => t.status === 'pending' || t.status === 'assigned'
        ).length

        const snapshot: SlottingSnapshot = {
          id: `snap-${state.slottingSnapshots.length + 1}`,
          capturedAt: seed.seedTimestamp,
          label,
          misplacedAClassCount: misplaced.length,
          relocationsAvailable: recs.length,
          totalDistanceSavedM: impact.totalDistanceSavedM,
          totalTimeSavedMin: impact.totalTimeSavedMin,
          aToGoldenCount: impact.aClassToGoldenCount,
          czInGoldenCount: impact.czOutOfGoldenCount,
          pendingReplenishment,
          affinityPairsNeedingAction: affinityRecs.filter((r) => !r.isAlreadyClose).length,
        }

        set({ slottingSnapshots: [...state.slottingSnapshots, snapshot] })
        return snapshot
      },

      // ─── Slotting rules ─────────────────────────────────────────────────────────

      createSlottingRule: (data) => {
        const state = get()
        const created: SlottingRule = { ...data, id: `slr-${Date.now()}` }
        set({ slottingRules: [...state.slottingRules, created] })
        return created
      },

      updateSlottingRule: (id, data) => {
        const state = get()
        const rule = state.slottingRules.find((r) => r.id === id)
        if (!rule) throw new Error('slotting rule not found')
        const updated: SlottingRule = { ...rule, ...data }
        set({ slottingRules: state.slottingRules.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      toggleSlottingRule: (id) => {
        const state = get()
        const rule = state.slottingRules.find((r) => r.id === id)
        if (!rule) throw new Error('slotting rule not found')
        const updated: SlottingRule = { ...rule, active: !rule.active }
        set({ slottingRules: state.slottingRules.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      deleteSlottingRule: (id) => {
        const state = get()
        set({ slottingRules: state.slottingRules.filter((r) => r.id !== id) })
      },

      // ─── Admin ────────────────────────────────────────────────────────────────

      createOperator: (data) => {
        const state = get()
        const created: Operator = { ...data, id: `op-${Date.now()}` }
        set({ operators: [...state.operators, created] })
        return created
      },

      updateOperator: (id, data) => {
        const state = get()
        const op = state.operators.find((o) => o.id === id)
        if (!op) throw new Error('operator not found')
        const updated: Operator = { ...op, ...data }
        set({ operators: state.operators.map((o) => (o.id === id ? updated : o)) })
        return updated
      },

      toggleOperator: (id) => {
        const state = get()
        const op = state.operators.find((o) => o.id === id)
        if (!op) throw new Error('operator not found')
        const updated: Operator = { ...op, active: !op.active }
        set({ operators: state.operators.map((o) => (o.id === id ? updated : o)) })
        return updated
      },

      createReason: (data) => {
        const state = get()
        const created: Reason = { ...data, id: `rs-${Date.now()}` }
        set({ reasons: [...state.reasons, created] })
        return created
      },

      updateReason: (id, data) => {
        const state = get()
        const reason = state.reasons.find((r) => r.id === id)
        if (!reason) throw new Error('reason not found')
        const updated: Reason = { ...reason, ...data }
        set({ reasons: state.reasons.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      toggleReason: (id) => {
        const state = get()
        const reason = state.reasons.find((r) => r.id === id)
        if (!reason) throw new Error('reason not found')
        const updated: Reason = { ...reason, active: !reason.active }
        set({ reasons: state.reasons.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      createCarrier: (data) => {
        const state = get()
        const created: Carrier = { ...data, id: `ca-${Date.now()}` }
        set({ carriers: [...state.carriers, created] })
        return created
      },

      updateCarrier: (id, data) => {
        const state = get()
        const carrier = state.carriers.find((c) => c.id === id)
        if (!carrier) throw new Error('carrier not found')
        const updated: Carrier = { ...carrier, ...data }
        set({ carriers: state.carriers.map((c) => (c.id === id ? updated : c)) })
        return updated
      },

      toggleCarrier: (id) => {
        const state = get()
        const carrier = state.carriers.find((c) => c.id === id)
        if (!carrier) throw new Error('carrier not found')
        const updated: Carrier = { ...carrier, active: !carrier.active }
        set({ carriers: state.carriers.map((c) => (c.id === id ? updated : c)) })
        return updated
      },

      updateSettings: (data) => {
        const state = get()
        const updated: WmsSettings = { ...state.settings, ...data }
        set({ settings: updated })
        return updated
      },

      // ── Adjustment requests (#56) ────────────────────────────────────────────

      requestAdjustment: (itemId, countedQty, operatorName, reasonId) => {
        const state = get()
        const item = state.inventoryItems.find((i) => i.id === itemId)
        if (!item) throw new Error('inventory item not found')
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten ajustes.')
        const delta = countedQty - item.onHandQuantity
        const absDelta = Math.abs(delta)
        const threshold = state.settings.adjustmentApprovalThreshold

        // Below threshold — apply immediately (same as old adjustInventory)
        if (absDelta <= threshold) {
          const adjusted = applyAdjustment(item, countedQty)
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
                type: 'adjustment',
                quantity: absDelta,
                referenceType: 'manual',
                referenceId: itemId,
                operatorName,
              }),
            ],
          })
          const instant: InventoryAdjustmentRequest = {
            id: `adj-${Date.now()}`,
            inventoryItemId: itemId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            locationId: item.locationId,
            currentQty: item.onHandQuantity,
            countedQty,
            delta,
            reasonId,
            operatorName,
            requestedAt: new Date().toISOString(),
            status: 'approved',
            reviewedBy: 'sistema',
            reviewedAt: new Date().toISOString(),
          }
          set({ adjustmentRequests: [...get().adjustmentRequests, instant] })
          return instant
        }

        // Above threshold — create pending request
        const request: InventoryAdjustmentRequest = {
          id: `adj-${Date.now()}`,
          inventoryItemId: itemId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          locationId: item.locationId,
          currentQty: item.onHandQuantity,
          countedQty,
          delta,
          reasonId,
          operatorName,
          requestedAt: new Date().toISOString(),
          status: 'pending_approval',
        }
        set({ adjustmentRequests: [...state.adjustmentRequests, request] })
        return request
      },

      approveAdjustment: (requestId, reviewerName) => {
        const state = get()
        if (state.settings.inventoryFreezeActive)
          throw new Error('Inventario en modo congelado. No se permiten ajustes.')
        const req = state.adjustmentRequests.find((r) => r.id === requestId)
        if (!req) throw new Error('adjustment request not found')
        if (req.status !== 'pending_approval') throw new Error('La solicitud ya fue procesada')
        const item = state.inventoryItems.find((i) => i.id === req.inventoryItemId)
        if (!item) throw new Error('inventory item not found')

        const adjusted = applyAdjustment(item, req.countedQty)
        const updated: InventoryAdjustmentRequest = {
          ...req,
          status: 'approved',
          reviewedBy: reviewerName,
          reviewedAt: new Date().toISOString(),
        }
        set({
          adjustmentRequests: state.adjustmentRequests.map((r) =>
            r.id === requestId ? updated : r
          ),
          inventoryItems: state.inventoryItems.map((i) =>
            i.id === req.inventoryItemId ? { ...i, ...adjusted } : i
          ),
          stockMovements: [
            ...state.stockMovements,
            recordMovement({
              productId: item.productId,
              warehouseId: item.warehouseId,
              fromLocationId: item.locationId,
              toLocationId: item.locationId,
              type: 'adjustment',
              quantity: Math.abs(req.delta),
              referenceType: 'manual',
              referenceId: req.inventoryItemId,
              operatorName: reviewerName,
            }),
          ],
        })
        return updated
      },

      rejectAdjustment: (requestId, reviewerName, note) => {
        const state = get()
        const req = state.adjustmentRequests.find((r) => r.id === requestId)
        if (!req) throw new Error('adjustment request not found')
        if (req.status !== 'pending_approval') throw new Error('La solicitud ya fue procesada')
        const updated: InventoryAdjustmentRequest = {
          ...req,
          status: 'rejected',
          reviewedBy: reviewerName,
          reviewedAt: new Date().toISOString(),
          rejectionNote: note,
        }
        set({
          adjustmentRequests: state.adjustmentRequests.map((r) =>
            r.id === requestId ? updated : r
          ),
        })
        return updated
      },

      // ── Cyclic count plans (#13, extends #54) ────────────────────────────────
      // Plans generate their CyclicCountLines up front (one per matching InventoryItem,
      // snapshotting the on-hand qty at creation time). Completing a plan feeds every
      // counted line with a variance through the existing adjustment engine
      // (requestAdjustment) instead of a second, parallel approval mechanism.

      createCyclicCount: (data) => {
        const state = get()
        if (state.settings.cycleCountFreezeActive) throw new Error(CYCLE_COUNT_FROZEN_MSG)
        const items = resolveCyclicCountItems(
          state,
          data.method,
          data.filterValue,
          data.warehouseId
        )
        if (items.length === 0) {
          throw new Error(
            'No hay inventario que coincida con este filtro en el almacén seleccionado'
          )
        }

        const idx = state.cyclicCountPlans.length + 1
        const planId = `cc-${Date.now()}`
        const plan: CyclicCountPlan = {
          id: planId,
          code: `CC-${String(idx).padStart(3, '0')}`,
          name: data.name,
          method: data.method,
          filterValue: data.filterValue,
          warehouseId: data.warehouseId,
          locationIds: Array.from(new Set(items.map((i) => i.locationId))),
          assignedOperatorName: data.assignedOperatorName,
          scheduledDate: data.scheduledDate,
          status: 'pending',
          createdAt: new Date().toISOString(),
          totalItems: items.length,
          countedItems: 0,
          blindCount: data.blindCount ?? state.settings.cycleCountBlindCountDefault,
          auto: data.auto ?? false,
        }
        const lines: CyclicCountLine[] = items.map((item, i) => ({
          id: `${planId}-l${i + 1}`,
          planId,
          inventoryItemId: item.id,
          productId: item.productId,
          warehouseId: item.warehouseId,
          locationId: item.locationId,
          lot: item.lot,
          serial: item.serial,
          expectedQuantity: item.onHandQuantity,
        }))
        set({
          cyclicCountPlans: [...state.cyclicCountPlans, plan],
          cyclicCountLines: [...state.cyclicCountLines, ...lines],
        })
        return plan
      },

      startCyclicCount: (planId) => {
        const state = get()
        if (state.settings.cycleCountFreezeActive) throw new Error(CYCLE_COUNT_FROZEN_MSG)
        const plan = state.cyclicCountPlans.find((p) => p.id === planId)
        if (!plan) throw new Error('cyclic count plan not found')
        if (!canTransition(cyclicCountTransitions, plan.status, 'in_progress')) {
          throw new Error('El plan no está en estado pendiente')
        }
        const updated: CyclicCountPlan = {
          ...plan,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        }
        set({
          cyclicCountPlans: state.cyclicCountPlans.map((p) => (p.id === planId ? updated : p)),
        })
        return updated
      },

      recordCycleCountLine: (lineId, countedQty, operatorName) => {
        const state = get()
        if (state.settings.cycleCountFreezeActive) throw new Error(CYCLE_COUNT_FROZEN_MSG)
        if (countedQty < 0) throw new Error('La cantidad contada no puede ser negativa')
        const line = state.cyclicCountLines.find((l) => l.id === lineId)
        if (!line) throw new Error('cyclic count line not found')
        const plan = state.cyclicCountPlans.find((p) => p.id === line.planId)
        if (!plan || plan.status !== 'in_progress') {
          throw new Error('El plan de este conteo no está en progreso')
        }
        const wasCounted = line.countedQuantity !== undefined
        const updated: CyclicCountLine = {
          ...line,
          countedQuantity: countedQty,
          variance: countedQty - line.expectedQuantity,
          countedAt: new Date().toISOString(),
          countedBy: operatorName,
        }
        set({
          cyclicCountLines: state.cyclicCountLines.map((l) => (l.id === lineId ? updated : l)),
          cyclicCountPlans: wasCounted
            ? state.cyclicCountPlans
            : state.cyclicCountPlans.map((p) =>
                p.id === plan.id ? { ...p, countedItems: p.countedItems + 1 } : p
              ),
        })
        return updated
      },

      completeCyclicCount: (planId, reviewerName) => {
        const state = get()
        if (state.settings.cycleCountFreezeActive) throw new Error(CYCLE_COUNT_FROZEN_MSG)
        const plan = state.cyclicCountPlans.find((p) => p.id === planId)
        if (!plan) throw new Error('cyclic count plan not found')
        if (!canTransition(cyclicCountTransitions, plan.status, 'completed')) {
          throw new Error('El plan no está en progreso')
        }
        const reasonId = state.reasons.find((r) => r.code === 'ADJ-CONTEO')?.id
        const planLines = state.cyclicCountLines.filter((l) => l.planId === planId)

        for (const line of planLines) {
          if (line.countedQuantity === undefined || line.variance === 0) continue
          const request = get().requestAdjustment(
            line.inventoryItemId,
            line.countedQuantity,
            reviewerName,
            reasonId
          )
          set((s) => ({
            cyclicCountLines: s.cyclicCountLines.map((l) =>
              l.id === line.id ? { ...l, adjustmentRequestId: request.id } : l
            ),
          }))
        }

        const updated: CyclicCountPlan = {
          ...plan,
          status: 'completed',
          completedAt: new Date().toISOString(),
        }
        set({
          cyclicCountPlans: get().cyclicCountPlans.map((p) => (p.id === planId ? updated : p)),
        })
        return updated
      },

      cancelCyclicCount: (planId) => {
        const state = get()
        if (state.settings.cycleCountFreezeActive) throw new Error(CYCLE_COUNT_FROZEN_MSG)
        const plan = state.cyclicCountPlans.find((p) => p.id === planId)
        if (!plan) throw new Error('cyclic count plan not found')
        if (!canTransition(cyclicCountTransitions, plan.status, 'cancelled')) {
          throw new Error('No se puede cancelar un plan completado')
        }
        const updated: CyclicCountPlan = { ...plan, status: 'cancelled' }
        set({
          cyclicCountPlans: state.cyclicCountPlans.map((p) => (p.id === planId ? updated : p)),
        })
        return updated
      },

      // ABC-frequency scheduler (Estándar): one auto plan per warehouse×class overdue
      // combination, skipping any that already has an active (pending/in_progress) auto plan.
      generateSuggestedCycleCounts: () => {
        const state = get()
        if (state.settings.cycleCountFreezeActive) throw new Error(CYCLE_COUNT_FROZEN_MSG)
        const overdue = selectCycleCountSchedule(state)
        const groups = new Map<string, { warehouseId: string; abcClass: string }>()
        for (const entry of overdue) {
          groups.set(`${entry.warehouseId}__${entry.abcClass}`, {
            warehouseId: entry.warehouseId,
            abcClass: entry.abcClass,
          })
        }

        const created: CyclicCountPlan[] = []
        for (const { warehouseId, abcClass } of groups.values()) {
          const hasActivePlan = get().cyclicCountPlans.some(
            (p) =>
              p.warehouseId === warehouseId &&
              p.method === 'by_abc' &&
              p.filterValue === abcClass &&
              (p.status === 'pending' || p.status === 'in_progress')
          )
          if (hasActivePlan) continue
          try {
            const plan = get().createCyclicCount({
              name: `Conteo sugerido — clase ${abcClass}`,
              method: 'by_abc',
              filterValue: abcClass,
              warehouseId,
              scheduledDate: new Date().toISOString().slice(0, 10),
              auto: true,
            })
            created.push(plan)
          } catch {
            // No matching stock for this warehouse×class combo (e.g. already fully counted) — skip it.
          }
        }
        return created
      },

      createWarehouse: (data) => {
        const state = get()
        const created: Warehouse = { ...data, id: `wh-${Date.now()}` }
        set({ warehouses: [...state.warehouses, created] })
        return created
      },

      updateWarehouse: (id, data) => {
        const state = get()
        const wh = state.warehouses.find((w) => w.id === id)
        if (!wh) throw new Error('warehouse not found')
        const updated: Warehouse = { ...wh, ...data }
        set({ warehouses: state.warehouses.map((w) => (w.id === id ? updated : w)) })
        return updated
      },

      createLocation: (data) => {
        const state = get()
        if (state.locations.some((l) => l.code.toLowerCase() === data.code.trim().toLowerCase())) {
          throw new Error(`Ya existe una ubicación con el código ${data.code}`)
        }
        const created: StorageLocation = { ...data, id: `loc-${Date.now()}` }
        set({ locations: [...state.locations, created] })
        return created
      },

      updateLocation: (id, data) => {
        const state = get()
        const loc = state.locations.find((l) => l.id === id)
        if (!loc) throw new Error('location not found')
        if (
          data.code &&
          state.locations.some(
            (l) => l.id !== id && l.code.toLowerCase() === data.code!.trim().toLowerCase()
          )
        ) {
          throw new Error(`Ya existe una ubicación con el código ${data.code}`)
        }
        const updated: StorageLocation = { ...loc, ...data }
        set({ locations: state.locations.map((l) => (l.id === id ? updated : l)) })
        return updated
      },

      deleteLocation: (id) => {
        const state = get()
        const loc = state.locations.find((l) => l.id === id)
        if (!loc) throw new Error('location not found')
        const stock = state.inventoryItems.some((i) => i.locationId === id && i.onHandQuantity > 0)
        if (stock) throw new Error('No se puede eliminar una ubicación con stock. Vacíala primero.')
        set({ locations: state.locations.filter((l) => l.id !== id) })
      },

      blockLocation: (id, reasonId) => {
        const state = get()
        const loc = state.locations.find((l) => l.id === id)
        if (!loc) throw new Error('location not found')
        if (state.settings.blockRequiresEmptyLocation) {
          const stock = state.inventoryItems.some(
            (i) => i.locationId === id && i.onHandQuantity > 0
          )
          if (stock) {
            throw new Error(
              'La configuración exige que la ubicación esté vacía antes de bloquearla. Reubica el stock primero.'
            )
          }
        }
        const updated: StorageLocation = { ...loc, isBlocked: true, blockReasonId: reasonId }
        set({ locations: state.locations.map((l) => (l.id === id ? updated : l)) })
        return updated
      },

      unblockLocation: (id) => {
        const state = get()
        const loc = state.locations.find((l) => l.id === id)
        if (!loc) throw new Error('location not found')
        const updated: StorageLocation = { ...loc, isBlocked: false, blockReasonId: undefined }
        set({ locations: state.locations.map((l) => (l.id === id ? updated : l)) })
        return updated
      },

      generateLocations: (spec) => {
        const state = get()
        const existingCodes = new Set(state.locations.map((l) => l.code.toLowerCase()))
        const created: StorageLocation[] = []
        const pad = (n: number) => String(n).padStart(2, '0')
        let seq = 0

        for (let a = 1; a <= spec.aisles; a++) {
          for (let r = 1; r <= spec.racksPerAisle; r++) {
            for (let lvl = 1; lvl <= spec.levelsPerRack; lvl++) {
              for (let p = 1; p <= spec.positionsPerLevel; p++) {
                const aisle = pad(a)
                const rack = String.fromCharCode(64 + r) // 1→A, 2→B…
                const level = String(lvl)
                const position = pad(p)
                const code = `${spec.zone}-${aisle}-${rack}-${level}-${position}`
                if (existingCodes.has(code.toLowerCase())) continue
                existingCodes.add(code.toLowerCase())
                seq++
                // Higher levels and deeper aisles are less accessible / farther away.
                const accessibilityScore = Math.max(
                  0,
                  Math.min(100, spec.baseAccessibilityScore - (lvl - 1) * 12 - (a - 1) * 4)
                )
                const distanceToDispatchM = spec.baseDistanceToDispatchM + (a - 1) * 6 + (r - 1) * 2
                created.push({
                  id: `loc-gen-${Date.now()}-${seq}`,
                  code,
                  barcode: `LOC-${spec.zone}-${aisle}${rack}${level}${position}`,
                  warehouseId: spec.warehouseId,
                  zone: spec.zone,
                  aisle,
                  rack,
                  level,
                  position,
                  rackTypeId: spec.rackTypeId,
                  type: spec.type,
                  isPickFace: spec.isPickFace,
                  golden: false,
                  isBlocked: false,
                  accessibilityScore,
                  maxWeightKg: spec.maxWeightKg,
                  volumeCapacityM3: spec.maxVolumeM3,
                  maxVolumeM3: spec.maxVolumeM3,
                  distanceToDispatchM,
                })
              }
            }
          }
        }

        if (created.length === 0) return []
        set({ locations: [...state.locations, ...created] })
        return created
      },

      reclassifyGoldenZones: () => {
        const state = get()
        let updated = 0
        const locations = state.locations.map((l) => {
          const eligible = isGoldenEligible(l, state.settings)
          if (eligible !== l.golden) {
            updated++
            return { ...l, golden: eligible }
          }
          return l
        })
        set({ locations })
        return { updated, goldenCount: locations.filter((l) => l.golden).length }
      },

      createRackType: (data) => {
        const state = get()
        const created: RackType = { ...data, id: `rack-${Date.now()}` }
        set({ rackTypes: [...state.rackTypes, created] })
        return created
      },

      updateRackType: (id, data) => {
        const state = get()
        const rack = state.rackTypes.find((r) => r.id === id)
        if (!rack) throw new Error('rack type not found')
        const updated: RackType = { ...rack, ...data }
        set({ rackTypes: state.rackTypes.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      toggleRackType: (id) => {
        const state = get()
        const rack = state.rackTypes.find((r) => r.id === id)
        if (!rack) throw new Error('rack type not found')
        const updated: RackType = { ...rack, active: !rack.active }
        set({ rackTypes: state.rackTypes.map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      createProduct: (data) => {
        const state = get()
        const created: Product = { ...data, id: `p-${Date.now()}` }
        set({ products: [...state.products, created] })
        return created
      },

      updateProduct: (id, data) => {
        const state = get()
        const product = state.products.find((p) => p.id === id)
        if (!product) throw new Error('product not found')
        const updated: Product = { ...product, ...data }
        set({ products: state.products.map((p) => (p.id === id ? updated : p)) })
        return updated
      },

      // Admin — Units of Measure (#3)
      createUom: (data) => {
        const state = get()
        const created: UnitOfMeasure = { ...data, id: `uom-${Date.now()}` }
        set({ unitsOfMeasure: [...state.unitsOfMeasure, created] })
        return created
      },

      updateUom: (id, data) => {
        const state = get()
        const uom = state.unitsOfMeasure.find((u) => u.id === id)
        if (!uom) throw new Error('unit of measure not found')
        const updated: UnitOfMeasure = { ...uom, ...data }
        set({ unitsOfMeasure: state.unitsOfMeasure.map((u) => (u.id === id ? updated : u)) })
        return updated
      },

      toggleUom: (id) => {
        const state = get()
        const uom = state.unitsOfMeasure.find((u) => u.id === id)
        if (!uom) throw new Error('unit of measure not found')
        const updated: UnitOfMeasure = { ...uom, active: !uom.active }
        set({ unitsOfMeasure: state.unitsOfMeasure.map((u) => (u.id === id ? updated : u)) })
        return updated
      },

      setCurrentOperator: (operatorId) => set({ currentOperatorId: operatorId }),

      // Cross-dock (Sprint 9)
      createCrossDockTask: (asnId, commerceOrderId, quantity, stagingLocationId, operatorName) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === asnId)
        if (!asn) throw new Error('ASN no encontrado')
        if (!canCrossDock(asn)) throw new Error('ASN no elegible para cross-docking')
        const warehouseId = asn.suggestedPutawayLocationId
          ? (state.locations.find((l) => l.id === asn.suggestedPutawayLocationId)?.warehouseId ??
            'wh-bog')
          : 'wh-bog' // ponytail: fallback until Asn gains a warehouseId field
        const task: CrossDockTask = {
          id: `cdtask-${Date.now()}`,
          asnId,
          commerceOrderId,
          productId: asn.productId,
          warehouseId,
          quantity,
          stagingLocationId,
          status: 'pending',
          assignedOperatorId: operatorName,
          createdAt: new Date().toISOString(),
        }
        set({ crossDockTasks: [...state.crossDockTasks, task] })
      },

      completeCrossDockTask: (taskId, operatorName) => {
        const state = get()
        const task = state.crossDockTasks.find((t) => t.id === taskId)
        if (!task) throw new Error('Tarea cross-dock no encontrada')
        if (task.status === 'completed') throw new Error('Tarea ya completada')
        const updatedTasks = state.crossDockTasks.map((t) =>
          t.id === taskId
            ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
            : t
        )
        const updatedOrders = state.commerceOrders.map((o) => {
          if (o.id !== task.commerceOrderId) return o
          const updatedItems = o.items.map((i) =>
            i.productId === task.productId
              ? {
                  ...i,
                  pickedQuantity: Math.min(
                    i.requestedQuantity,
                    (i.pickedQuantity ?? 0) + task.quantity
                  ),
                }
              : i
          )
          return { ...o, items: updatedItems }
        })
        const movement = recordMovement({
          productId: task.productId,
          warehouseId: task.warehouseId,
          fromLocationId: task.stagingLocationId,
          type: 'pick',
          quantity: task.quantity,
          referenceType: 'commerce_order',
          referenceId: task.commerceOrderId,
          operatorName,
        })
        const updatedInventory = state.inventoryItems.map((i) =>
          i.productId === task.productId && i.locationId === task.stagingLocationId
            ? { ...i, onHandQuantity: Math.max(0, i.onHandQuantity - task.quantity) }
            : i
        )
        set({
          crossDockTasks: updatedTasks,
          commerceOrders: updatedOrders,
          stockMovements: [...state.stockMovements, movement],
          inventoryItems: updatedInventory,
        })
      },

      updateSapRouteStatus: (id, status) => {
        const state = get()
        const route = state.sapRoutes.find((r) => r.id === id)
        if (!route) return
        set({ sapRoutes: state.sapRoutes.map((r) => (r.id === id ? { ...r, status } : r)) })
      },

      updateAsnAppointment: (id, data) => {
        const state = get()
        const asn = state.asnRecords.find((a) => a.id === id)
        if (!asn) return
        const updated = { ...asn, ...data }
        set({ asnRecords: state.asnRecords.map((a) => (a.id === id ? updated : a)) })
      },

      updateWarehouseDeliveryWindows: (id, windows) => {
        const state = get()
        const wh = state.warehouses.find((w) => w.id === id)
        if (!wh) return
        set({
          warehouses: state.warehouses.map((w) =>
            w.id === id ? { ...w, deliveryWindows: windows } : w
          ),
        })
      },

      // Yard / Dock management (#8)
      createDock: (data) => {
        const state = get()
        const created: Dock = { ...data, id: `dock-${Date.now()}` }
        set({ docks: [...state.docks, created] })
        return created
      },

      updateDock: (id, data) => {
        const state = get()
        const dock = state.docks.find((d) => d.id === id)
        if (!dock) throw new Error('Muelle no encontrado')
        const updated: Dock = { ...dock, ...data }
        set({ docks: state.docks.map((d) => (d.id === id ? updated : d)) })
        return updated
      },

      setDockStatus: (id, status) => {
        const state = get()
        const dock = state.docks.find((d) => d.id === id)
        if (!dock) throw new Error('Muelle no encontrado')
        if (status !== 'active') {
          const hasActiveAppointment = state.dockAppointments.some(
            (a) => a.dockId === id && (a.status === 'arrived' || a.status === 'in_progress')
          )
          if (hasActiveAppointment)
            throw new Error('No se puede bloquear un muelle con una cita en curso')
        }
        const updated: Dock = { ...dock, status }
        set({ docks: state.docks.map((d) => (d.id === id ? updated : d)) })
        return updated
      },

      createDockAppointment: (payload) => {
        const state = get()
        if (state.settings.yardFreezeActive) throw new Error(YARD_FROZEN_MSG)
        if (payload.scheduledEnd <= payload.scheduledStart)
          throw new Error('La hora de fin debe ser posterior a la de inicio')
        if (!isWithinOperatingHours(payload.scheduledStart, payload.scheduledEnd, state.settings))
          throw new Error(
            `La cita debe estar dentro del horario operativo (${state.settings.yardOperatingHoursStart}–${state.settings.yardOperatingHoursEnd})`
          )
        if (!isWorkingDay(payload.scheduledStart, state.settings.yardWorkingDays))
          throw new Error('El patio no opera ese día de la semana')

        if (payload.dockId) {
          const dock = state.docks.find((d) => d.id === payload.dockId)
          if (!dock) throw new Error('Muelle no encontrado')
          if (dock.warehouseId !== payload.warehouseId)
            throw new Error('El muelle no pertenece a la bodega seleccionada')
          if (dock.status !== 'active') throw new Error('El muelle no está activo')
          if (!isDockCompatible(dock, payload.type))
            throw new Error(
              `El muelle ${dock.name} no admite citas de tipo ${APPOINTMENT_TYPE_LABELS[payload.type]}`
            )
          if (
            !state.settings.yardAllowOverbooking &&
            hasDockConflict(
              state.dockAppointments,
              payload.dockId,
              payload.scheduledStart,
              payload.scheduledEnd
            )
          )
            throw new Error('El muelle ya tiene una cita activa que se solapa con ese horario')
        }

        const { id, code } = nextDockAppointmentRef()
        const appointment: DockAppointment = {
          id,
          code,
          warehouseId: payload.warehouseId,
          dockId: payload.dockId,
          type: payload.type,
          status: 'scheduled',
          asnId: payload.asnId,
          manifestId: payload.manifestId,
          carrierName: payload.carrierName,
          driverName: payload.driverName,
          vehiclePlate: payload.vehiclePlate,
          scheduledStart: payload.scheduledStart,
          scheduledEnd: payload.scheduledEnd,
          notes: payload.notes,
        }
        set({ dockAppointments: [...state.dockAppointments, appointment] })
        return appointment
      },

      assignDock: (appointmentId, dockId) => {
        const state = get()
        if (state.settings.yardFreezeActive) throw new Error(YARD_FROZEN_MSG)
        const appointment = state.dockAppointments.find((a) => a.id === appointmentId)
        if (!appointment) throw new Error('Cita no encontrada')
        if (appointment.status !== 'scheduled' && appointment.status !== 'arrived')
          throw new Error(`No se puede asignar muelle desde el estado ${appointment.status}`)
        const dock = state.docks.find((d) => d.id === dockId)
        if (!dock) throw new Error('Muelle no encontrado')
        if (dock.warehouseId !== appointment.warehouseId)
          throw new Error('El muelle no pertenece a la bodega de la cita')
        if (dock.status !== 'active') throw new Error('El muelle no está activo')
        if (!isDockCompatible(dock, appointment.type))
          throw new Error(
            `El muelle ${dock.name} no admite citas de tipo ${APPOINTMENT_TYPE_LABELS[appointment.type]}`
          )
        if (
          !state.settings.yardAllowOverbooking &&
          hasDockConflict(
            state.dockAppointments,
            dockId,
            appointment.scheduledStart,
            appointment.scheduledEnd,
            appointment.id
          )
        )
          throw new Error('El muelle ya tiene una cita activa que se solapa con ese horario')

        const updated: DockAppointment = { ...appointment, dockId }
        set({
          dockAppointments: state.dockAppointments.map((a) =>
            a.id === appointmentId ? updated : a
          ),
        })
        return updated
      },

      checkInAppointment: (appointmentId, data) => {
        const state = get()
        if (state.settings.yardFreezeActive) throw new Error(YARD_FROZEN_MSG)
        const appointment = state.dockAppointments.find((a) => a.id === appointmentId)
        if (!appointment) throw new Error('Cita no encontrada')
        if (!canTransition(dockAppointmentTransitions, appointment.status, 'arrived'))
          throw new Error(`No se puede registrar la llegada desde el estado ${appointment.status}`)
        const updated: DockAppointment = {
          ...appointment,
          status: 'arrived',
          arrivedAt: new Date().toISOString(),
          driverName: data?.driverName ?? appointment.driverName,
          vehiclePlate: data?.vehiclePlate ?? appointment.vehiclePlate,
        }
        set({
          dockAppointments: state.dockAppointments.map((a) =>
            a.id === appointmentId ? updated : a
          ),
        })
        return updated
      },

      startAppointment: (appointmentId) => {
        const state = get()
        if (state.settings.yardFreezeActive) throw new Error(YARD_FROZEN_MSG)
        const appointment = state.dockAppointments.find((a) => a.id === appointmentId)
        if (!appointment) throw new Error('Cita no encontrada')
        if (!canTransition(dockAppointmentTransitions, appointment.status, 'in_progress'))
          throw new Error(`No se puede iniciar desde el estado ${appointment.status}`)
        if (!appointment.dockId) throw new Error('Asigna un muelle antes de iniciar la cita')
        const updated: DockAppointment = {
          ...appointment,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        }
        set({
          dockAppointments: state.dockAppointments.map((a) =>
            a.id === appointmentId ? updated : a
          ),
        })
        return updated
      },

      completeAppointment: (appointmentId) => {
        const state = get()
        if (state.settings.yardFreezeActive) throw new Error(YARD_FROZEN_MSG)
        const appointment = state.dockAppointments.find((a) => a.id === appointmentId)
        if (!appointment) throw new Error('Cita no encontrada')
        if (!canTransition(dockAppointmentTransitions, appointment.status, 'completed'))
          throw new Error(`No se puede completar desde el estado ${appointment.status}`)
        const updated: DockAppointment = {
          ...appointment,
          status: 'completed',
          completedAt: new Date().toISOString(),
        }
        set({
          dockAppointments: state.dockAppointments.map((a) =>
            a.id === appointmentId ? updated : a
          ),
        })
        return updated
      },

      markAppointmentNoShow: (appointmentId) => {
        const state = get()
        if (state.settings.yardFreezeActive) throw new Error(YARD_FROZEN_MSG)
        const appointment = state.dockAppointments.find((a) => a.id === appointmentId)
        if (!appointment) throw new Error('Cita no encontrada')
        if (!canTransition(dockAppointmentTransitions, appointment.status, 'no_show'))
          throw new Error(`No se puede marcar no-show desde el estado ${appointment.status}`)
        const updated: DockAppointment = { ...appointment, status: 'no_show' }
        set({
          dockAppointments: state.dockAppointments.map((a) =>
            a.id === appointmentId ? updated : a
          ),
        })
        return updated
      },

      cancelAppointment: (appointmentId) => {
        const state = get()
        if (state.settings.yardFreezeActive) throw new Error(YARD_FROZEN_MSG)
        const appointment = state.dockAppointments.find((a) => a.id === appointmentId)
        if (!appointment) throw new Error('Cita no encontrada')
        if (!canTransition(dockAppointmentTransitions, appointment.status, 'cancelled'))
          throw new Error(`No se puede cancelar desde el estado ${appointment.status}`)
        const updated: DockAppointment = { ...appointment, status: 'cancelled' }
        set({
          dockAppointments: state.dockAppointments.map((a) =>
            a.id === appointmentId ? updated : a
          ),
        })
        return updated
      },
    }),
    {
      name: 'wms-store-v3',
      storage: createJSONStorage(() => idbStorage),
      // Persist the full domain state (every non-function slice) so a reload
      // preserves demo progress. Functions (the 75+ actions) are dropped — they
      // always come fresh from create().
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([, value]) => typeof value !== 'function')
        ) as Partial<WmsState>,
      // Bump `version` whenever the seed changes materially: a mismatch discards
      // the old persisted data and reseeds clean. Within the same version, demo
      // progress survives reloads.
      // v2: warehouse-structure module (#4) — rackTypes slice, location hierarchy
      // fields and golden-zone/layout settings added to the seed.
      // v3: slotting module (#10) — slottingRules slice (configurable placement
      // directives) added to the seed.
      // v4: slotting rules Fase 1 — rule action moved from a single `targetTier`
      // to a `directives[]` array (soft preferTier + hard constraints).
      // v5: slotting demo data — heavy-capacity pick-faces (PICK-HEAVY-01 golden,
      // STD-HEAVY-01 standard) so línea blanca pesada participa en las recomendaciones.
      // v6: replenishment module (#11) — store min/max policies + store tasks slices,
      // per-pick-face and per-SKU min/max, store sales-floor locations + stock, and
      // replenishment governance settings added to the seed.
      // v7: cycle count module (#13) — cyclicCountLines slice, CyclicCountPlan
      // reshaped (totalItems/countedItems, blindCount, auto, startedAt), and
      // cycle-count governance settings + demo plans/lines/adjustment added to the seed.
      // v8: yard/dock module (#8) — docks + dockAppointments slices, and yard
      // governance settings (operating hours, working days, overbooking) added to the seed.
      version: 8,
      migrate: () => buildSeedState() as Partial<WmsState>,
    }
  )
)
