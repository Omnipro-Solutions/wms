// Core WMS domain types. All identifiers in English; UI copy lives in components.

// Umbrella status set used only for StatusBadge color mapping. Each entity also
// has its own status union (see ReturnStatus, PickingTaskStatus) and its own
// valid transitions in lib/state-machines.ts.
export type OperationalStatus =
  | 'draft'
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'partial'
  | 'partial_received'
  | 'completed'
  | 'putaway_done'
  | 'cancelled'
  | 'in_transit'
  | 'on_hold'
  | 'error'
  | 'synced'
  | 'short_received'
  | 'ready_for_pickup'  // BOPIS/Ship-from-Store: prepared, awaiting customer
  | 'labels_pending'
  | 'putaway_ready'

// Sprint 4: Unit of Measure entity. Every Product has a baseUomId (the
// smallest countable unit) plus optional conversion rules to larger units.
export interface UnitOfMeasure {
  id: string
  code: string       // e.g. 'UND', 'CAJ', 'PAL'
  name: string       // e.g. 'Unidad', 'Caja', 'Pallet'
  abbreviation: string // e.g. 'und', 'caj', 'pal'
  active: boolean
}

// One conversion rule: qty units of this UoM = factor × base UoM.
// E.g.: 1 Caja = 12 Unidades → { fromUomId: 'uom-caj', toUomId: 'uom-und', factor: 12 }
export interface UomConversion {
  fromUomId: string
  toUomId: string
  factor: number // fromUomId × factor = toUomId quantity
}

export interface DeliveryWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=domingo, 1=lunes, …, 6=sábado
  openTime: string  // 'HH:mm' — hora apertura recepción
  closeTime: string // 'HH:mm' — hora cierre recepción
}

export type TransitWarehouseRole = 'hub' | 'cross_dock' | 'consolidation'

export type TransferLegStatus = 'pending' | 'in_transit' | 'received' | 'cancelled'

export interface Warehouse {
  id: string
  code: string
  name: string
  city: string
  type: 'distribution_center' | 'store' | 'transit'
  deliveryWindows?: DeliveryWindow[]
  transitRole?: TransitWarehouseRole
  maxTransitDays?: number
}

export interface Store {
  id: string
  code: string
  name: string
  city: string
}

// Locations carry slotting attributes. `golden` marks the ergonomic
// "golden zone" (waist-to-shoulder height, close to dispatch/packing).
export interface StorageLocation {
  id: string
  code: string
  barcode: string  // ej. "LOC-A-A0101" — escaneado por lector bluetooth en picking
  warehouseId: string
  zone: string
  type: 'pick' | 'reserve' | 'quality_control' | 'staging' | 'returns'
  isPickFace: boolean
  golden: boolean
  isBlocked: boolean // blocked locations reject new putaway/pick operations
  accessibilityScore: number // 0-100; higher = easier/faster to pick
  maxWeightKg: number
  volumeCapacityM3: number
  maxVolumeM3: number // max volume this slot holds (0 = unlimited)
  distanceToDispatchM: number // meters from location to dispatch/packing
  routeCode?: string // staging zone de una ruta SAP, ej. "sap-rt-001"
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  barcode: string
  unitWeightKg: number
  unitVolumeM3: number
  trackBy: 'none' | 'lot' | 'serial'
  imageUrl?: string
  // Sprint 4: base unit for stock quantities (e.g. 'uom-und').
  // All onHandQuantity values are stored in this base unit.
  baseUomId?: string
  // Conversion rules for receiving/picking in larger units (e.g. boxes, pallets).
  uomConversions?: UomConversion[]
  // Sprint 9: rotation and expiration handling
  rotationStrategy?: 'fifo' | 'fefo' | 'lifo'
  expirationPolicy?: {
    categoryMatch: string // e.g. 'lacteos', 'frutas' — matches product.category
    alertDays: number // days before expiry to flag
    blockAfterExpiry: boolean // if true, blocks picking of expired items
  }
  // Replenishment stock limits (replaces derived proxy from demand stats)
  minStockUnits?: number // if set, overrides selector's demand-based minStock
  maxStockUnits?: number // if set, overrides selector's demand-based maxStock
}

export interface InventoryItem {
  id: string
  productId: string
  warehouseId: string
  locationId: string
  lot?: string
  serial?: string
  expirationDate?: string
  onHandQuantity: number
  reservedQuantity: number
  holdQuantity: number
  holdReasonId?: string // references a Reason (context: 'hold')
  // availableQuantity is DERIVED via rules/inventory.ts, not stored.
  status: 'available' | 'reserved' | 'on_hold' | 'in_transit' | 'expired' | 'damaged'
}

// The audit log. Every receipt, putaway, pick, transfer, adjustment,
// hold, release, return or scrap appends one of these.
export interface StockMovement {
  id: string
  productId: string
  warehouseId: string
  fromLocationId?: string
  toLocationId?: string
  type:
    | 'receipt'
    | 'putaway'
    | 'pick'
    | 'transfer'
    | 'adjustment'
    | 'hold'
    | 'release'
    | 'return'
    | 'scrap'
  quantity: number
  // UoM used at the moment of the transaction (base unit after conversion).
  uomId?: string
  lot?: string
  serial?: string
  referenceType:
    | 'asn'
    | 'transfer'
    | 'return'
    | 'commerce_order'
    | 'replenishment'
    | 'slotting'
    | 'manual'
  referenceId: string
  operatorName: string
  createdAt: string
}

export interface OrderLine {
  id: string
  productId: string
  requestedQuantity: number
  pickedQuantity?: number
  packedQuantity?: number
}

export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'partial' | 'received' | 'cancelled'

export interface PurchaseOrderLine {
  id: string
  productId: string
  orderedQty: number
  receivedQty: number
  unitCost: number
}

export interface PurchaseOrder {
  id: string
  code: string
  supplierId: string
  supplierName: string
  lines: PurchaseOrderLine[]
  status: PurchaseOrderStatus
  expectedDate: string
  carrierId?: string
  notes?: string
  createdAt: string
}

export interface Asn {
  id: string
  code: string
  supplierName: string
  appointmentDate: string
  expectedQuantity: number
  receivedQuantity: number
  // Units counted as damaged/rejected — tracked on ASN but not put to available stock.
  damagedQuantity: number
  status: OperationalStatus
  requiresQualityControl: boolean
  crossDocking: boolean
  productId: string
  // Directed putaway suggestion comes from slotting (ABC class of product).
  suggestedPutawayLocationId?: string
  // Populated when ASN is closed with short_received — reason for the discrepancy.
  closeReason?: string
  // Number of individual GR (Goods Receipt) deliveries registered against this ASN.
  deliveryCount: number
  // Link to originating purchase order (null for internal transfers / manual adjustments).
  purchaseOrderId?: string
  sourceType: 'purchase' | 'internal_transfer' | 'adjustment'
  // Notes added during reception (carrier reference, delivery note number, etc.)
  receptionNotes?: string
  dockId?: string           // muelle asignado, e.g. 'dock-1'
  timeSlot?: string         // ventana horaria, e.g. '08:00-10:00'
  carrierConfirmed?: boolean // transportista confirmó la cita
}

export interface TransferOrder {
  id: string
  code: string
  type: 'dc_to_store' | 'store_to_store' | 'store_to_dc' | 'dc_to_dc' | 'multi_leg'
  originId: string
  destinationId: string
  status: OperationalStatus
  createdAt: string
  estimatedArrivalDate: string
  routeId?: string
  items: OrderLine[]
  legs: TransferLeg[]
  isMultiLeg: boolean
  currentLegIndex: number
  assignedDriverId?: string
}

export interface TransferLeg {
  id: string
  sequence: number
  originId: string
  destinationId: string
  status: TransferLegStatus
  estimatedArrivalDate: string
  dispatchedAt?: string
  receivedAt?: string
  operatorName?: string
  notes?: string
}

// --- Cross-docking (Sprint 9 — #7) ---
export type CrossDockStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface CrossDockTask {
  id: string
  asnId: string
  commerceOrderId: string
  productId: string
  warehouseId: string
  quantity: number
  stagingLocationId: string   // where inbound stock temporarily lands
  status: CrossDockStatus
  assignedOperatorId?: string
  createdAt: string
  completedAt?: string
}

export type ReturnStatus =
  | 'requested'
  | 'received_at_store'
  | 'in_transit_to_dc'
  | 'received_at_dc'
  | 'under_validation'
  | 'sent_to_quality_control'
  | 'reentered'
  | 'sent_to_repair'
  | 'sent_to_scrap'
  | 'rejected'
  | 'closed'

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'defective'

export interface ReturnItemInspection {
  returnLineId: string // references OrderLine.id in ReturnOrder.items
  productId: string
  inspectedQuantity: number
  conditionRating: ItemCondition
  notes: string
  recommendedDisposition: 'restock' | 'repair' | 'scrap' | 'reject'
  serial?: string // captured during inspection for serialized products
  serialMatchesDispatch?: boolean // true if the serial was found in the original dispatch pick movement
}

export interface ReturnInspection {
  id: string
  returnOrderId: string
  inspectorName: string
  inspectedAt: string
  items: ReturnItemInspection[]
  overallResult: 'pass' | 'partial_pass' | 'fail'
  notes: string
}

export type RepairType = 'cosmetic' | 'functional' | 'warranty'

export type RepairTicketStatus =
  | 'open'
  | 'in_progress'
  | 'ready_to_receive'
  | 'received'
  | 'completed'
  | 'failed'

export interface RepairTicketLine {
  returnLineId: string
  productId: string
  quantity: number
  estimatedCostUsd: number
  repairNotes?: string
}

export interface RepairTicket {
  id: string
  returnOrderId: string
  vendorName: string
  repairType: RepairType
  lines: RepairTicketLine[]
  status: RepairTicketStatus
  operatorName: string
  createdAt: string
  expectedReturnDate: string
  receivedAt?: string
  finalCostUsd?: number
  outcome?: 'restock' | 'scrap'
  outcomeNotes?: string
}

export type ScrapMethod = 'incinerate' | 'landfill' | 'donate' | 'liquidate' | 'recycle'

export interface ScrapLine {
  returnLineId: string
  productId: string
  quantity: number
  reasonId: string // references Reason (context: 'scrap')
}

export interface ScrapRecord {
  id: string
  returnOrderId: string
  operatorName: string
  createdAt: string
  disposalMethod: ScrapMethod
  lines: ScrapLine[]
  referenceDoc?: string // guía, acta de baja, etc.
  notes?: string
}

export interface ReentryLine {
  returnLineId: string
  productId: string
  quantity: number
  targetLocationId: string
}

export interface ReentryBatch {
  id: string
  returnOrderId: string
  operatorName: string
  createdAt: string
  lines: ReentryLine[]
  status: 'pending' | 'executed'
}

export interface ReturnOrder {
  id: string
  rmaCode: string
  customerName: string
  type:
    | 'customer_to_store'
    | 'customer_store_to_dc'
    | 'store_to_dc'
    | 'store_to_store'
    | 'dc_to_supplier'
  originId: string
  destinationId: string
  status: ReturnStatus
  reasonId: string // references a Reason (context: "return")
  disposition: 'restock' | 'scrap' | 'quality_control' | 'repair' | 'rejected'
  items: OrderLine[]
  inspectionId?: string // references ReturnInspection.id once inspected
  createdAt: string
}

export interface CommerceOrder {
  id: string
  orderNumber: string
  channel: 'ecommerce' | 'marketplace' | 'pos' | 'b2b' | 'app'
  customerName: string
  status: OperationalStatus
  createdAt: string
  promisedDeliveryDate: string
  fulfillmentType:
    | 'ship_from_dc'
    | 'ship_from_store'
    | 'pickup_in_store'
    | 'put_to_store'
    | 'cross_docking'
  items: OrderLine[]
}

export type PickingTaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'partially_picked'
  | 'partial_with_shortage'
  | 'partial_approved'
  | 'partial_rejected'
  | 'completed'
  | 'with_issue'

export interface PickingTask {
  id: string
  code: string
  orderId: string
  productId: string
  locationId: string
  requestedQuantity: number
  pickedQuantity: number
  // Pending balance kept for missing items so picking can be retried later.
  pendingQuantity: number
  status: PickingTaskStatus
  operatorName?: string
  assignedOperatorId?: string
  priority: 'low' | 'medium' | 'high'
  partialReasonId?: string // references a Reason (context: "partial_picking")
  issueReason?: string
}

export interface PickingWave {
  id: string
  code: string
  name: string
  orderCount: number
  unitCount: number
  zone: string
  // How orders were grouped into this wave.
  groupBy: 'zone' | 'route' | 'priority' | 'carrier' | 'dispatch_window' | 'fulfillment_type'
  groupValue: string
  priority: 'low' | 'medium' | 'high'
  status: OperationalStatus
  assignedTeam?: string
  createdAt: string
  orderIds: string[]
}

export type PackingOrderStatus =
  | 'pending'
  | 'in_progress'
  | 'verified'
  | 'mismatch'
  | 'labelled'
  | 'dispatched'

export interface PackingBoxType {
  id: string
  code: string
  name: string
  maxWeightKg: number
  volumeM3: number
  dimensionsCm: string // e.g. "30x20x15"
}

export type PackingRuleTrigger =
  | 'fragile'
  | 'liquid'
  | 'heavy'
  | 'oversized'
  | 'hazmat'
  | 'cold_chain'
  | 'high_value'

export interface PackingRule {
  id: string
  code: string
  name: string
  trigger: PackingRuleTrigger
  description: string
  requiresDoublePacking: boolean
  requiresBubbleWrap: boolean
  requiresDryIce: boolean
  requiresVoidFill: boolean
  labelNote: string
  active: boolean
}

export interface PackingOrderItem {
  productId: string
  productName: string
  requestedQuantity: number
  scannedQuantity: number
  lot?: string
  serial?: string
}

export interface PackingOrder {
  id: string
  orderId: string
  orderNumber?: string
  customerName: string
  channel?: CommerceOrder['channel']
  status: PackingOrderStatus
  expectedItems: number
  scannedItems: number
  verificationStatus: 'pending' | 'verified' | 'mismatch'
  suggestedBox: string
  boxTypeId?: string
  weightKg: number
  volumeM3: number
  appliedRuleIds: string[]
  labelGenerated: boolean
  labelCode?: string
  packerName?: string
  items?: PackingOrderItem[]
  createdAt: string
  verifiedAt?: string
}

export interface WmsLabel {
  id: string
  code: string
  type: 'product' | 'location' | 'box' | 'pallet' | 'shipping' | 'return' | 'receipt'
  reference: string
  status: OperationalStatus
  createdAt: string
  createdBy: string
  // Only for type === 'receipt'
  asnId?: string
  lot?: string
  expirationDate?: string
  receivedQty?: number
  poNumber?: string
}

export type CarrierServiceLevel = 'same_day' | 'next_day' | 'two_day' | 'ground' | 'economy'

export interface CarrierService {
  serviceLevel: CarrierServiceLevel
  label: string // Spanish UI label e.g. "Mismo día"
  baseCostUsd: number // base rate before weight surcharge
  costPerKgUsd: number // variable rate per kg
  maxWeightKg: number
  transitDays: number // calendar days from dispatch to delivery
  availableZones: string[] // zone codes where this service is offered
}

export interface CarrierRateQuote {
  carrierId: string
  carrierName: string
  serviceLevel: CarrierServiceLevel
  serviceLabel: string
  quotedCostUsd: number
  estimatedTransitDays: number
  estimatedDeliveryDate: string // ISO date string
}

export interface Shipment {
  id: string
  orderId: string
  carrierId?: string // references Carrier.id
  customerName: string
  carrierName: string
  sapRouteId?: string
  serviceLevel?: CarrierServiceLevel
  quotedCostUsd?: number
  destinationCity?: string
  destinationZone?: string // carrier zone code used for rate calculation
  promisedDate?: string // ISO date — committed delivery date to customer
  estimatedDeliveryDate?: string // ISO date — carrier estimated delivery
  status: OperationalStatus
  shippedAt?: string
  deliveredAt?: string
  packageCount: number
  weightKg: number
  trackingNumber?: string
  otifStatus: 'on_time' | 'at_risk' | 'late'
}

export interface ManifestStop {
  id: string
  sequence: number
  destinationId: string
  orderIds: string[]
  transferIds: string[]
  returnIds: string[]
}

export interface LoadManifest {
  id: string
  code: string
  sapRouteId: string
  truckPlate: string
  driverName: string
  carrierName: string
  manifestDate: string
  status: OperationalStatus
  orderIds: string[]
  transferIds: string[]
  returnIds: string[]
  totalUnits: number
  totalPackages: number
  totalWeightKg: number
  totalVolumeM3: number
  stops: ManifestStop[]
  assignedDriverId?: string
}

export interface IntegrationConnection {
  id: string
  name: string
  type: 'sap' | 'ecommerce' | 'marketplace' | 'carrier' | 'erp' | 'oms' | 'pos' | 'supplier'
  status: 'active' | 'inactive' | 'error' | 'pending_configuration'
  lastSyncAt?: string
  lastError?: string
  processedMessages: number
}

export interface ReplenishmentTask {
  id: string
  productId: string
  originLocationId: string
  destinationLocationId: string // a slotting-defined pick face
  currentStock: number
  minStock: number
  maxStock: number
  suggestedQuantity: number
  priority: 'low' | 'medium' | 'high'
  status: OperationalStatus
  operatorName?: string
}

// --- Batch picking ---

// A BatchTask groups multiple PickingTasks for the same product/location so a
// single picker can collect items for N orders in one trip.
export interface BatchTask {
  id: string
  code: string
  productId: string
  locationId: string
  // IDs of the individual PickingTasks consolidated in this batch.
  pickingTaskIds: string[]
  // Total units to collect in one trip (sum of requestedQuantity across tasks).
  totalRequestedQuantity: number
  totalPickedQuantity: number
  status: 'pending' | 'in_progress' | 'completed' | 'partial'
  operatorName?: string
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}

// --- Cluster picking ---

// A ClusterSlot is one container (tote/bin) within a cluster, mapped to one order.
export interface ClusterSlot {
  orderId: string
  orderNumber: string
  containerLabel: string // e.g. "Bin A", "Bin B"
  items: { productId: string; requested: number; deposited: number }[]
  completed: boolean
}

// A ClusterTask assigns a picker to carry N containers and fill them while
// walking a single route through the warehouse.
export interface ClusterTask {
  id: string
  code: string
  operatorName?: string
  slots: ClusterSlot[]
  // Ordered list of location IDs the picker visits.
  route: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'partial'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}

// --- Put-to-store distribution ---

// After bulk picking for a put-to-store wave, quantities are distributed
// per destination store.
export interface PutToStoreAllocation {
  storeId: string
  storeName: string
  requestedQuantity: number
  distributedQuantity: number
}

export interface PutToStoreTask {
  id: string
  code: string
  // The commerce order that originated the put-to-store requirement.
  orderId: string
  productId: string
  // Total quantity picked before distribution.
  totalPickedQuantity: number
  allocations: PutToStoreAllocation[]
  status: 'pending' | 'in_progress' | 'completed' | 'partial'
  operatorName?: string
  createdAt: string
}

// --- Waveless ---

// Flags an order for immediate (waveless) picking without grouping into a wave.
// The orderId points to a CommerceOrder; tasks are generated on demand.
export interface WavelessOrder {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  channel: CommerceOrder['channel']
  fulfillmentType: CommerceOrder['fulfillmentType']
  // IDs of the PickingTasks auto-generated for this order.
  pickingTaskIds: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'partial'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}

// --- Slotting domain ---

export type AbcClass = 'A' | 'B' | 'C'
export type XyzClass = 'X' | 'Y' | 'Z'

// Demand history used to CALCULATE ABC/XYZ. Lives in seed so it is derived.
export interface ProductDemandStat {
  productId: string
  unitsSold: number
  pickingFrequency: number // picks per period
  demandSamples: number[] // per-period demand, used for XYZ variability
}

// A slotting recommendation is COMPUTED (see lib/rules/slotting.ts).
export interface SlottingRecommendation {
  id: string
  productId: string
  abcClass: AbcClass
  xyzClass: XyzClass
  currentLocationId: string
  suggestedLocationId: string
  rotationRate: number
  unitsSold: number
  pickingFrequency: number
  score: number // 0-100
  estimatedDistanceSavedM: number
  estimatedTimeSavedSeconds: number
  recommendation: string // human-readable Spanish explanation
}

// Route-based slotting recommendation optimized for SAP staging zones.
export interface RouteSlottingRecommendation {
  productId: string
  routeCode: string
  routeLabel: string
  currentLocationId: string
  candidateLocationId: string
  routePickFrequency: number   // 0-1: ratio picks en esta ruta / total picks
  currentDistanceToStagingM: number
  candidateDistanceToStagingM: number
  distanceGainM: number
  totalDistanceSavedM: number  // distanceGainM × pickingFrequency del producto
  score: number                // 0-100
}

// --- Administration domain ---

export interface Operator {
  id: string
  code: string
  name: string
  email?: string
  passwordHash?: string
  role: 'picker' | 'packer' | 'receiver' | 'driver' | 'supervisor'
  active: boolean
}

export interface Reason {
  id: string
  code: string
  label: string // Spanish label shown in the UI
  context: 'return' | 'partial_picking' | 'adjustment' | 'scrap' | 'hold'
  active: boolean
}

export type CarrierZone = {
  code: string // e.g. "Z1", "Z2"
  label: string // e.g. "Bogotá ciudad"
  cities: string[] // cities belonging to this zone
}

export interface Carrier {
  id: string
  code: string
  name: string
  logoUrl?: string
  active: boolean
  apiIntegration: boolean // true when carrier has live API rate lookup
  modalityType?: 'own' | 'third_party' | 'courier' | 'last_mile'
  services: CarrierService[]
  zones: CarrierZone[]
  contactEmail?: string
  contactPhone?: string
}

// Sprint 7: SLA configuration per channel/fulfillment type
export interface SlaConfig {
  id: string
  channel: CommerceOrder['channel'] | 'all'
  fulfillmentType: CommerceOrder['fulfillmentType'] | 'all'
  maxHours: number          // max hours from order creation to completion
  alertAtPercent: number    // alert when elapsed > maxHours * (alertAtPercent/100)
  label: string             // Spanish display name
}

export interface WmsSettings {
  abcThresholdA: number // cumulative share, e.g. 0.8
  abcThresholdB: number // cumulative share, e.g. 0.95
  xyzCvX: number // e.g. 0.5
  xyzCvY: number // e.g. 1.0
  replenishmentHighFactor: number // e.g. 0.5 of min stock
  simulatedLatencyMs: number
  // Sprint 2: inventory control
  inventoryFreezeActive: boolean
  adjustmentApprovalThreshold: number // units delta above which supervisor approval is required
  // Sprint 6: configurable alerts
  stockAlertThreshold: number    // available units <= this triggers critical stock alert
  expirationAlertDays: number    // items expiring within N days trigger expiration alert
  // Sprint 7: SLA configs
  slaConfigs: SlaConfig[]
}

// --- Inventory adjustment requests (Sprint 2 — #56) ---

export type AdjustmentRequestStatus = 'pending_approval' | 'approved' | 'rejected'

export interface InventoryAdjustmentRequest {
  id: string
  inventoryItemId: string
  productId: string
  warehouseId: string
  locationId: string
  currentQty: number
  countedQty: number
  delta: number // countedQty - currentQty (can be negative)
  reasonId?: string
  operatorName: string
  requestedAt: string // ISO timestamp
  status: AdjustmentRequestStatus
  reviewedBy?: string
  reviewedAt?: string
  rejectionNote?: string
}

// --- Cyclic count plan (Sprint 2 — #54) ---

export type CyclicCountStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type CyclicCountMethod = 'by_zone' | 'by_abc' | 'by_rotation'

export interface CyclicCountPlan {
  id: string
  code: string
  name: string
  method: CyclicCountMethod
  filterValue: string // zone code, ABC class, or rotation threshold
  warehouseId: string
  locationIds: string[]
  assignedOperatorName?: string
  scheduledDate: string // ISO date
  status: CyclicCountStatus
  createdAt: string
  completedAt?: string
  totalLocations: number
  countedLocations: number
}

// --- Reports domain (derived aggregations, NOT stored entities) ---

export interface ProductivityRow {
  operatorName: string
  picksCompleted: number
  unitsPicked: number
  partialCount: number
  issueCount: number
}

export interface DiscrepancyRow {
  referenceType: 'asn' | 'picking'
  referenceCode: string
  expected: number
  actual: number
  difference: number
}

export interface InventoryReportRow {
  warehouseId: string
  abcClass: AbcClass
  totalOnHand: number
  totalReserved: number
  totalHold: number
  totalAvailable: number
}

// --- Slotting KPI snapshot ---

// Point-in-time capture of slotting health metrics.
// Appended each time the user clicks "Capturar estado" on the slotting page.
export interface SlottingSnapshot {
  id: string
  capturedAt: string // ISO timestamp
  label: string // user-provided or auto-generated (e.g. "Después de reubicación masiva")
  misplacedAClassCount: number
  relocationsAvailable: number
  totalDistanceSavedM: number
  totalTimeSavedMin: number
  aToGoldenCount: number // A-class items that ARE in golden zone
  czInGoldenCount: number // CZ items still occupying golden zone
  pendingReplenishment: number
  affinityPairsNeedingAction: number
}

// Sprint 8: SAP Routes (F-85)
export type SapRouteStatus =
  | 'pending'
  | 'in_progress'
  | 'in_transit'
  | 'completed'
  | 'synced'
  | 'error'

export interface SapRoute {
  id: string
  code: string             // e.g. 'SAP-RT-001'
  name: string             // e.g. 'Ruta Bogotá Norte'
  originId: string         // warehouseId del CD origen
  destinationIds: string[] // warehouseIds de tiendas destino
  carrierName: string
  driverName: string
  truckPlate: string       // formato colombiano 'ABC-123'
  routeDate: string        // ISO date 'YYYY-MM-DD'
  currentLoadKg: number
  capacityKg: number
  status: SapRouteStatus
}
