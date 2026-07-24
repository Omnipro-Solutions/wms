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
  | 'ready_for_pickup' // BOPIS/Ship-from-Store: prepared, awaiting customer

// Sprint 4: Unit of Measure entity. Every Product has a baseUomId (the
// smallest countable unit) plus optional conversion rules to larger units.
export interface UnitOfMeasure {
  id: string
  code: string // e.g. 'UND', 'CAJ', 'PAL'
  name: string // e.g. 'Unidad', 'Caja', 'Pallet'
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
  openTime: string // 'HH:mm' — hora apertura recepción
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

export type LocationType = 'pick' | 'reserve' | 'quality_control' | 'staging' | 'returns'

// Physical rack / storage style a location belongs to. Drives which products
// can be slotted there ("tipo de estiba según rack y producto", módulo #4 estándar).
export type RackStorageStyle =
  | 'selective' // Rack selectivo (1 pallet de fondo, acceso directo)
  | 'drive_in' // Drive-in / compacto (alta densidad, LIFO)
  | 'push_back' // Push-back (varios pallets de fondo, LIFO)
  | 'cantilever' // Cantilever (cargas largas: perfiles, tubos)
  | 'floor' // Piso / bulk (apilado directo en suelo)
  | 'mezzanine' // Entrepiso / estantería de picking manual

export interface RackType {
  id: string
  code: string // ej. "SEL-STD"
  name: string
  storageStyle: RackStorageStyle
  levels: number // niveles verticales del rack
  maxWeightKgPerLevel: number
  maxPalletsPerLevel: number
  // Categorías de producto admitidas. Vacío = compatible con todas.
  compatibleCategories: string[]
  // Tipos de ubicación donde aplica este rack (pick/reserve/…).
  compatibleLocationTypes: LocationType[]
  active: boolean
  description?: string
}

// Locations carry slotting attributes. `golden` marks the ergonomic
// "golden zone" (waist-to-shoulder height, close to dispatch/packing).
export interface StorageLocation {
  id: string
  code: string
  barcode: string // ej. "LOC-A-A0101" — escaneado por lector bluetooth en picking
  warehouseId: string
  zone: string
  // Hierarchical layout model: almacén → zona → pasillo → rack → nivel → posición.
  // Optional so legacy/virtual slots (tránsito, recibo) can omit them.
  aisle?: string // pasillo, ej. "01"
  rack?: string // rack / módulo, ej. "A"
  level?: string // nivel / altura, ej. "1"
  position?: string // posición dentro del nivel, ej. "01"
  rackTypeId?: string // tipo de estiba (referencia RackType)
  type: LocationType
  isPickFace: boolean
  golden: boolean
  isBlocked: boolean // blocked locations reject new putaway/pick operations
  blockReasonId?: string // motivo tipificado del bloqueo (Reason context 'hold')
  accessibilityScore: number // 0-100; higher = easier/faster to pick
  maxWeightKg: number
  volumeCapacityM3: number
  maxVolumeM3: number // max volume this slot holds (0 = unlimited)
  distanceToDispatchM: number // meters from location to dispatch/packing
  routeCode?: string // staging zone de una ruta SAP, ej. "sap-rt-001"
  // Replenishment module (#11) — per-pick-face min/max override.
  // When set, takes precedence over the product-level and demand-based defaults
  // (see selectReplenishmentNeeds). Only meaningful for pick faces.
  minStockUnits?: number
  maxStockUnits?: number
  // Putaway module (#3) — restricciones siempre activas (no configurables), ver
  // lib/rules/putaway.ts:checkPutawayCompatibility. hazardApproved/allowsLotMixing
  // por defecto false/true respectivamente cuando están ausentes.
  hazardApproved?: boolean
  temperatureZone?: 'ambient' | 'refrigerated' | 'frozen'
  allowsLotMixing?: boolean
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
  // Putaway module (#3) — restricciones siempre activas de destino.
  isHazardous?: boolean
  requiresColdChain?: boolean
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
  // Raw fact, stamped once when stock first enters the system (receiveAsn) — powers
  // aging/low-rotation reporting. Not touched by relocation/putaway.
  receivedDate?: string
  // TTL for the current reservation on this item — see reserveInventory/releaseExpiredReservations.
  // Simplification: one expiry per item (latest reservation wins), not a per-order ledger.
  reservationExpiresAt?: string
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
  // Labor module (#9) — operator assigned to putaway before it's executed via putawayItem().
  // Display-only until putawayItem() runs; does not gate the action.
  assignedOperatorName?: string
  assignedOperatorId?: string
  // Populated when ASN is closed with short_received — reason for the discrepancy.
  closeReason?: string
  // Number of individual GR (Goods Receipt) deliveries registered against this ASN.
  deliveryCount: number
  // Link to originating purchase order (null for internal transfers / manual adjustments).
  purchaseOrderId?: string
  sourceType: 'purchase' | 'internal_transfer' | 'adjustment'
  // Notes added during reception (carrier reference, delivery note number, etc.)
  receptionNotes?: string
  dockId?: string // muelle asignado, e.g. 'dock-1'
  timeSlot?: string // ventana horaria, e.g. '08:00-10:00'
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
  // Reconciliación por línea capturada al recepcionar (vacío = recepción sin discrepancias).
  lineReceipts?: TransferLegLineReceipt[]
}

// Recepción a nivel de línea de un tramo, con captura de discrepancias contra lo despachado.
// receivedQty + damagedQty pueden sumar menos que requestedQty (faltante) o más (sobrante).
export interface TransferLegLineReceipt {
  productId: string
  requestedQty: number
  receivedQty: number // unidades sanas que entran a stock disponible en el destino
  damagedQty: number // unidades averiadas en tránsito (no entran a disponible)
  discrepancyReasonId?: string // Reason context 'transfer_discrepancy' cuando hay faltante/avería
}

// ─── Movimientos internos (intra-almacén) ───────────────────────────────────
// Motor unificado de "tareas de trabajo": todo movimiento que no cruza de nodo.
// El origen y el destino comparten warehouseId (invariante intra-almacén).
export type InternalMoveType =
  | 'putaway' // recepción → ubicación (flujo de recepción)
  | 'replenishment' // reserva → pick-face
  | 'reslotting' // reubicación por slotting
  | 'bin_to_bin' // ad-hoc manual
  | 'consolidation' // juntar SKU disperso en una sola ubicación
  | 'quarantine' // a ubicación de control de calidad (retención física)
  | 'housekeeping' // despeje de pasillo / staging

// FSM de dos pasos: pick en origen, drop en destino. Entre 'picked' y 'dropped'
// las unidades están "en movimiento" (fuera del origen, aún no en destino).
export type InternalMoveStatus = 'pending' | 'assigned' | 'picked' | 'dropped' | 'cancelled'

export interface InternalMoveTask {
  id: string
  code: string // legible, p. ej. MI-001
  warehouseId: string // mismo origen y destino ⇒ intra-almacén (invariante)
  moveType: InternalMoveType
  productId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  lot?: string
  serial?: string // arrastra trazabilidad a través del movimiento
  status: InternalMoveStatus
  reasonId?: string // Reason context 'internal_move'
  operatorName?: string
  createdAt: string
  pickedAt?: string
  droppedAt?: string
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
  stagingLocationId: string // where inbound stock temporarily lands
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

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'defective' | 'damaged'

// The four dispositions a single inspected line can be graded into.
export type ItemDisposition = 'restock' | 'repair' | 'scrap' | 'reject'

// Grading policy: maps an inspected condition rating to the disposition the
// system recommends by default. Consumed by the inspection dialog when
// WmsSettings.returnAutoDispositionEnabled is on. Configured in /returns-settings.
export interface ReturnGradingRule {
  condition: ItemCondition
  disposition: ItemDisposition
}

export interface ReturnItemInspection {
  returnLineId: string // references OrderLine.id in ReturnOrder.items
  productId: string
  inspectedQuantity: number
  conditionRating: ItemCondition
  notes: string
  recommendedDisposition: ItemDisposition
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
  // Original dispatch date — used to evaluate the return window (returnWindowDays).
  dispatchDate?: string
  // Stamped when the return reaches a terminal state (closed/rejected). Powers cycle-time KPI.
  closedAt?: string
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
  zone?: string // picking zone or wave zone
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
  // Exception handling (module #5 — Estándar tier).
  issueReasonId?: string // references a Reason (context: "picking_issue")
  issuePhotoUrl?: string // dataURL captured via <input type="file" capture="environment">
  substituteProductId?: string // product suggested as replacement when out of stock
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
  driverName?: string // flota propia — conductor asignado
  vehiclePlate?: string // flota propia — placa del vehículo (formato colombiano ABC-123)
  // Verificación de carga (#7 Estándar) — bultos confirmados físicamente antes del despacho.
  verifiedPackages?: number
  loadVerifiedAt?: string
  loadVerifiedBy?: string
  // Despacho parcial — bultos que quedaron pendientes por enviar en un despacho posterior.
  pendingPackages?: number
  partialDispatch?: boolean
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

// --- Yard / Dock management (#8) — Gestión de patio y muelles ---
// Coordinates dock assignment and arrival/departure appointments for inbound
// (ASN) and outbound (LoadManifest) traffic. Configured in /yard-settings.

export type DockType = 'inbound' | 'outbound' | 'mixed'
export type DockStatus = 'active' | 'blocked' | 'maintenance'

export interface Dock {
  id: string
  code: string // e.g. 'M-01'
  name: string
  warehouseId: string
  type: DockType
  status: DockStatus
  notes?: string
}

export type DockAppointmentType = 'inbound' | 'outbound'

// FSM: scheduled → arrived → in_progress → completed, with no_show/cancelled
// as terminal off-ramps. See lib/state-machines.ts (dockAppointmentTransitions).
export type DockAppointmentStatus =
  | 'scheduled'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled'

export interface DockAppointment {
  id: string
  code: string // e.g. 'CITA-001'
  warehouseId: string
  dockId?: string // asignado en Estándar; puede crearse sin muelle (ver assignDock)
  type: DockAppointmentType
  status: DockAppointmentStatus
  asnId?: string // referencia para citas inbound
  manifestId?: string // referencia para citas outbound
  carrierName?: string
  driverName?: string
  vehiclePlate?: string
  scheduledStart: string // ISO datetime
  scheduledEnd: string // ISO datetime
  arrivedAt?: string
  startedAt?: string
  completedAt?: string
  notes?: string
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

// Intra-warehouse replenishment: refill a pick face from a reserve location.
export interface ReplenishmentTask {
  id: string
  productId: string
  warehouseId?: string // warehouse the pick face belongs to (fallback: derived from destination)
  originLocationId: string
  destinationLocationId: string // a slotting-defined pick face
  currentStock: number
  minStock: number
  maxStock: number
  suggestedQuantity: number
  priority: 'low' | 'medium' | 'high'
  status: OperationalStatus
  operatorName?: string
  assignedOperatorId?: string
  createdAt?: string
  auto?: boolean // generated by the automatic engine vs. created manually
}

// --- Store (retail) replenishment (#11 Estándar) ---

// Min/max policy for a product at a retail store. Drives DC→store replenishment.
export interface StoreReplenishmentPolicy {
  id: string
  storeWarehouseId: string // a Warehouse of type 'store'
  productId: string
  minStock: number
  maxStock: number
  active: boolean
}

// A DC→store replenishment task: move stock from a distribution center to a
// store whose on-floor stock dropped below its policy minimum.
export interface StoreReplenishmentTask {
  id: string
  storeWarehouseId: string // destination store
  sourceWarehouseId: string // origin distribution center
  productId: string
  currentStock: number
  minStock: number
  maxStock: number
  suggestedQuantity: number
  priority: 'low' | 'medium' | 'high'
  status: OperationalStatus
  operatorName?: string
  createdAt: string
  auto: boolean // generated by the automatic engine vs. created manually
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
  routePickFrequency: number // 0-1: ratio picks en esta ruta / total picks
  currentDistanceToStagingM: number
  candidateDistanceToStagingM: number
  distanceGainM: number
  totalDistanceSavedM: number // distanceGainM × pickingFrequency del producto
  score: number // 0-100
}

// --- Slotting rules (configurable placement directives) ---
//
// A slotting rule is a business directive that OVERRIDES the ABC/XYZ-derived
// ideal tier for the products it matches. It is the "gobierno" layer on top of
// the pure algorithm: e.g. "electrónica de alto valor siempre en golden" or
// "cargas pesadas fuera de golden aunque sean clase A". Rules are edited in
// Configuración → Slotting and take effect live on /slotting.

export type SlottingTier = 'golden' | 'standard' | 'remote'

// How a rule decides whether a product is in scope.
export type SlottingRuleMatchType =
  | 'category' // product.category === value
  | 'abcClass' // computed ABC class === value ('A' | 'B' | 'C')
  | 'weightAboveKg' // product.unitWeightKg >= Number(value)
  | 'trackBy' // product.trackBy === value ('none' | 'lot' | 'serial')

// What a rule DOES to the products it matches. Two flavours:
//  · soft  → 'preferTier' nudges the ideal tier used by the scoring engine.
//  · hard  → the rest are constraints: a candidate location that violates any of
//            them is discarded (it can never be recommended for this product).
// Kinds map to attributes that already exist on StorageLocation / RackType, so
// no data migration is needed (Fase 1). Cold-chain / temperature is Fase 2.
export type SlottingDirectiveKind =
  | 'preferTier' // soft: preferred SlottingTier
  | 'requireLocationType' // hard: StorageLocation.type must equal value
  | 'requireZone' // hard: StorageLocation.zone must equal value
  | 'requireGolden' // hard: location must be a golden pick face
  | 'forbidGolden' // hard: location must NOT be golden
  | 'maxLevel' // hard: StorageLocation.level (numeric) must be <= value
  | 'requireRackCompatible' // hard: rack↔producto compatibility (checkRackCompatibility)

export type SlottingDirective =
  | { kind: 'preferTier'; tier: SlottingTier }
  | { kind: 'requireLocationType'; locationType: LocationType }
  | { kind: 'requireZone'; zone: string }
  | { kind: 'requireGolden' }
  | { kind: 'forbidGolden' }
  | { kind: 'maxLevel'; level: number }
  | { kind: 'requireRackCompatible' }

export interface SlottingRule {
  id: string
  code: string
  name: string
  description?: string
  matchType: SlottingRuleMatchType
  matchValue: string // interpreted per matchType (category name, 'A', '50', 'serial'…)
  directives: SlottingDirective[] // soft preference + hard constraints applied to matches
  priority: number // higher wins for the soft tier when several active rules match
  active: boolean
}

// --- Putaway rules (motor paralelo e independiente de SlottingRule) ---
//
// Mismo shape que SlottingRule (matchType + directives + priority), declarado por
// separado a propósito: gobierna DÓNDE ATERRIZA la mercancía recién recibida, no
// dónde debería reubicarse stock ya existente (eso es SlottingRule). Ajustar una
// regla de slotting nunca debe cambiar el comportamiento de putaway, y viceversa.
// Las funciones de evaluación de lib/rules/slotting.ts (activeMatchingRules,
// candidateAllowedByRules, resolvePreferredTier) son genéricas sobre la forma de
// las directivas, así que lib/rules/putaway.ts las reutiliza vía un cast interno
// en vez de duplicar la lógica de matching.

export type PutawayRuleMatchType = 'category' | 'abcClass' | 'weightAboveKg' | 'trackBy'

export type PutawayDirectiveKind =
  | 'preferTier'
  | 'requireLocationType'
  | 'requireZone'
  | 'requireGolden'
  | 'forbidGolden'
  | 'maxLevel'
  | 'requireRackCompatible'

export type PutawayDirective =
  | { kind: 'preferTier'; tier: SlottingTier }
  | { kind: 'requireLocationType'; locationType: LocationType }
  | { kind: 'requireZone'; zone: string }
  | { kind: 'requireGolden' }
  | { kind: 'forbidGolden' }
  | { kind: 'maxLevel'; level: number }
  | { kind: 'requireRackCompatible' }

export interface PutawayRule {
  id: string
  code: string
  name: string
  description?: string
  matchType: PutawayRuleMatchType
  matchValue: string
  directives: PutawayDirective[]
  priority: number
  active: boolean
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
  context:
    | 'return'
    | 'partial_picking'
    | 'adjustment'
    | 'scrap'
    | 'hold'
    | 'internal_move' // movimientos internos ad-hoc (bin-to-bin, consolidación, cuarentena…)
    | 'transfer_discrepancy' // short / over / damaged al recepcionar un traslado
    | 'picking_issue' // incidencia reportada durante picking (sin stock, dañado, ubicación vacía…)
  active: boolean
}

export type CarrierZone = {
  code: string // e.g. "Z1", "Z2"
  label: string // e.g. "Bogotá ciudad"
  cities: string[] // cities belonging to this zone
}

// Modalidad de transporte — flota propia, tercero, courier o última milla.
export type CarrierModality = 'own' | 'third_party' | 'courier' | 'last_mile'

export interface Carrier {
  id: string
  code: string
  name: string
  logoUrl?: string
  active: boolean
  apiIntegration: boolean // true when carrier has live API rate lookup
  modalityType?: CarrierModality
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
  maxHours: number // max hours from order creation to completion
  alertAtPercent: number // alert when elapsed > maxHours * (alertAtPercent/100)
  label: string // Spanish display name
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
  stockAlertThreshold: number // available units <= this triggers critical stock alert
  expirationAlertDays: number // items expiring within N days trigger expiration alert
  // Sprint 7: SLA configs
  slaConfigs: SlaConfig[]
  // Inventory module — Estándar tier: reservations with TTL + aging/low-rotation alerts
  reservationTtlHours: number // hours a commerce-order reservation holds stock before it's eligible for release
  agingLowRotationDays: number // days on hand without movement before an item is flagged low-rotation
  // Inventory alerts (stock crítico + vencimiento) — notification channel, config only (no real send in MVP)
  inventoryAlertNotificationType: 'none' | 'email'
  inventoryAlertNotificationEmail?: string
  // Locations module (#4) — golden-zone definition + layout governance.
  // A location is golden-eligible when dist ≤ goldenMaxDistanceM AND accesibilidad ≥ goldenMinAccessibility.
  goldenMaxDistanceM: number
  goldenMinAccessibility: number
  // Ocupación ≥ este % dispara la alerta de sobreocupación en /locations.
  locationHighUtilizationPct: number
  // Si está activo, bloquear una ubicación exige que esté vacía (gobierno del layout).
  blockRequiresEmptyLocation: boolean
  // Returns module (#12) — reverse-logistics governance. Configured in /returns-settings.
  // Congela todas las operaciones de devoluciones (avanzar, inspeccionar, reingresar, dar de baja…).
  returnsFreezeActive: boolean
  // Días máximos desde el despacho original para aceptar una devolución (ventana RMA).
  returnWindowDays: number
  // Si está activo, la inspección exige que el serial devuelto exista en el historial de despacho.
  returnRequireSerialValidation: boolean
  // Si está activo, la inspección pre-llena la disposición recomendada según returnGradingPolicy.
  returnAutoDispositionEnabled: boolean
  // Ubicación destino por defecto para reingreso al inventario y retornos de taller.
  returnDefaultLocationId: string
  // Matriz de calificación → disposición (grading policy) usada por la auto-disposición.
  returnGradingPolicy: ReturnGradingRule[]
  // Replenishment module (#11) — configured in /replenishment-settings.
  // Congela toda la operación de reabastecimiento (generar, iniciar, completar tareas).
  replenishmentFreezeActive: boolean
  // Umbrales de prioridad como fracción del mínimo (0–1):
  //   stock/min < high   → prioridad ALTA
  //   stock/min < medium → prioridad MEDIA   (medium debe ser > high)
  //   min > stock ≥ min×medium → prioridad BAJA
  // replenishmentHighFactor ya existe arriba (default 0.5).
  replenishmentMediumFactor: number // e.g. 0.8 of min stock
  // Min/max por defecto cuando un SKU/ubicación no tiene límites explícitos ni datos de demanda.
  replenishmentDefaultMinUnits: number
  replenishmentDefaultMaxUnits: number
  // Si está activo, las tareas de reposición a tiendas se generan automáticamente
  // (retail). El CD origen por defecto es replenishmentStoreSourceWarehouseId.
  replenishmentAutoStoreEnabled: boolean
  replenishmentStoreSourceWarehouseId: string // CD que surte a las tiendas
  // Cycle count module (#13) — configured in /cycle-count-settings.
  // Congela crear/iniciar/registrar/completar/cancelar planes de conteo.
  cycleCountFreezeActive: boolean
  // Valor por defecto del switch "conteo ciego" al crear un plan nuevo (el operario no
  // ve la cantidad esperada del sistema mientras cuenta — buena práctica anti-sesgo).
  cycleCountBlindCountDefault: boolean
  // % de variación por encima del cual una línea se resalta como "fuera de tolerancia".
  // Solo gobierna el resaltado visual — la aprobación real sigue usando
  // adjustmentApprovalThreshold (unidades) vía el motor de ajustes existente.
  cycleCountVarianceTolerancePct: number
  // Frecuencia de conteo (días) por clase ABC — a más rotación, más frecuente.
  cycleCountFrequencyDaysA: number
  cycleCountFrequencyDaysB: number
  cycleCountFrequencyDaysC: number
  // Si está activo, /cycle-count-settings y /cycle-count pueden generar planes
  // sugeridos automáticamente para las combinaciones almacén×clase ABC vencidas.
  cycleCountAutoSuggestEnabled: boolean
  // Yard/Dock module (#8) — patio y muelles. Configured in /yard-settings.
  // Congela crear/asignar muelle/avanzar (llegó, iniciar, completar, no-show, cancelar) citas.
  yardFreezeActive: boolean
  // Ventana operativa del patio — citas fuera de este rango se rechazan al crearlas.
  yardOperatingHoursStart: string // 'HH:mm'
  yardOperatingHoursEnd: string // 'HH:mm'
  // Días de la semana en que opera el patio (0=domingo … 6=sábado).
  yardWorkingDays: number[]
  // Duración por defecto (minutos) al proponer una ventana horaria nueva.
  yardDefaultSlotMinutes: number
  // Minutos tras la hora agendada, sin llegada registrada, para marcar la cita "en riesgo".
  yardLateThresholdMinutes: number
  // Si está activo, permite agendar/asignar más de una cita activa sobre el mismo muelle
  // en horarios que se solapan (excepción a la validación de conflicto de agenda).
  yardAllowOverbooking: boolean
  // Labor module (#9) — task queue, productivity, interleaving. Configured in /labor-settings.
  // Si está activo, la cola agrupa tareas de distinto tipo del mismo operario dentro de laborInterleavingMaxDistanceM.
  laborInterleavingEnabled: boolean
  laborInterleavingMaxDistanceM: number
  // Meta usada solo para colorear KPIs en /labor (Productividad) — sin lógica de incentivos.
  laborTargetUnitsPerHour: number
  // Picking module (#5) — configured in /picking-settings.
  // Congela iniciar/completar/aprobar/rechazar picks, waves, batch, cluster,
  // put-to-store, waveless y reporte/resolución de incidencias.
  pickingFreezeActive: boolean
  // SLA de despacho → prioridad sugerida al crear tarea/oleada/orden waveless.
  // horas restantes < Urgent → 'high'; < Warning → 'medium'; resto → 'low'.
  pickingSlaUrgentHours: number
  pickingSlaWarningHours: number
  // Umbral sugerido (no forzado) para agrupar órdenes en wave vs. dejarlas waveless.
  pickingWaveMinOrders: number
  // Mínimo de órdenes del mismo producto+ubicación para considerar candidato de batch.
  pickingBatchMinOrders: number
  // Techo operativo de un cluster (número de contenedores simultáneos).
  pickingClusterMaxContainers: number
  // Gobierna el dialog de reporte de incidencia.
  pickingRequireIssuePhoto: boolean
  pickingAllowSubstitution: boolean
  // Catálogo independiente de zonas de picking (pick-and-pass), desacoplado de
  // StorageLocation.zone para permitir renombrar/reordenar sin tocar ubicaciones.
  pickingZones: PickingZoneConfig[]
  // Packing module (#6) — embalaje. Configured in /packing-settings.
  // Congela iniciar/escanear/completar/aplicar reglas/seleccionar caja/generar etiqueta/enviar a despacho.
  packingFreezeActive: boolean
  // Cartonización: margen de seguridad (fracción) que se reserva sobre el peso/volumen
  // de la caja al sugerirla — 0.1 = usar solo el 90% de la capacidad nominal.
  packingBoxSafetyMargin: number
  // Si está activo, /packing sugiere caja automáticamente por peso+volumen (suggestBox).
  packingAutoBoxSuggestion: boolean
  // Verificación de contenido: si está activo, exige escaneo 1:1 (esperado === escaneado)
  // antes de poder completar el packing.
  packingRequireFullScan: boolean
  // Si está activo, se puede completar un packing con discrepancia (mismatch) registrando
  // un motivo; si está inactivo, el mismatch bloquea el cierre.
  packingAllowMismatch: boolean
  // Si está activo, la etiqueta de envío se genera automáticamente al verificar el packing.
  packingAutoGenerateLabel: boolean
  // Shipping module (#7) — despacho y transporte. Configured in /shipping-settings.
  // Congela despachar/entregar/cotizar/consolidar/crear y despachar manifiestos.
  shippingFreezeActive: boolean
  // Rate shopping: si está activo, /shipping preselecciona automáticamente la cotización
  // más barata al abrir el comparador de tarifas.
  shippingAutoRateShop: boolean
  // Criterio de orden por defecto del rate shopping: menor costo o menor tiempo de tránsito.
  shippingRateStrategy: 'cheapest' | 'fastest'
  // Sobrecosto máximo (fracción) tolerado sobre la tarifa más barata al elegir por servicio.
  // 0.15 = se acepta pagar hasta 15% más que la opción más económica.
  shippingMaxCostOverBestPct: number
  // Verificación de carga: exige confirmar bultos (y series) antes de despachar.
  shippingRequireLoadVerification: boolean
  // Si está activo, permite despachar un envío con menos bultos de los esperados,
  // dejando el saldo pendiente (despacho parcial). Si está inactivo, bloquea.
  shippingAllowPartialDispatch: boolean
  // Modalidades de transporte habilitadas para cotizar y despachar.
  shippingEnabledModalities: CarrierModality[]
  // Días de holgura sobre la fecha prometida antes de marcar un envío "en riesgo" (OTIF).
  shippingOtifAtRiskDays: number
  // Meta de cumplimiento OTIF (%) — referencia para los KPIs del módulo.
  shippingOtifTargetPct: number
  // Si está activo, los envíos con el mismo destino se sugieren para consolidar en una ruta.
  shippingConsolidateByDestination: boolean
  // Putaway module (#3) — almacenamiento y putaway. Configured in /putaway-settings.
  // Congela putawayItem/assignPutaway. Las reglas (PutawayRule) y sus CRUD NO se congelan.
  putawayFreezeActive: boolean
}

export interface PickingZoneConfig {
  id: string
  name: string
  sequenceOrder: number // orden de paso en pick-and-pass, ascendente
  active: boolean
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

// --- Cyclic count plan (Sprint 2 — #54; expanded for module #13) ---

export type CyclicCountStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type CyclicCountMethod = 'by_zone' | 'by_category' | 'by_abc' | 'by_rotation'

export interface CyclicCountPlan {
  id: string
  code: string
  name: string
  method: CyclicCountMethod
  filterValue: string // zone code, category name, ABC class, or 'alta'/'baja' rotation
  warehouseId: string
  locationIds: string[]
  assignedOperatorName?: string
  scheduledDate: string // ISO date
  status: CyclicCountStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  // Progress is tracked per count LINE (product×location×lot), not per location —
  // one location can hold several SKUs/lots, each counted independently (RF capture).
  totalItems: number
  countedItems: number
  blindCount: boolean // operator doesn't see the expected quantity while counting
  auto: boolean // generated by the ABC-frequency scheduler vs. created manually
}

// One row per InventoryItem included in a plan, snapshotted when the plan is created.
// expectedQuantity is the system on-hand at that moment; countedQuantity/variance are
// filled in during floor counting (recordCycleCountLine). Undefined countedQuantity
// means the line hasn't been counted yet.
export interface CyclicCountLine {
  id: string
  planId: string
  inventoryItemId: string
  productId: string
  warehouseId: string
  locationId: string
  lot?: string
  serial?: string
  expectedQuantity: number
  countedQuantity?: number
  variance?: number // countedQuantity - expectedQuantity
  countedAt?: string
  countedBy?: string
  // Set when completeCyclicCount() creates an InventoryAdjustmentRequest for this line.
  adjustmentRequestId?: string
}

// --- Labor Management domain (#9) — read-only projection, never persisted ---

export type LaborSourceType = 'picking' | 'putaway' | 'replenishment'

export interface LaborQueueItem {
  id: string // id of the source task/ASN
  sourceType: LaborSourceType
  code: string // human-visible reference: PickingTask.code, Asn.code, or ReplenishmentTask.id
  productId?: string
  locationId: string
  zone?: string
  priority: 'low' | 'medium' | 'high'
  status: string // raw status from the source record (renders fine via existing StatusBadge)
  operatorName?: string
  suggestedRouteId?: string // set when suggestInterleavedRoutes() groups this item with others
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
  code: string // e.g. 'SAP-RT-001'
  name: string // e.g. 'Ruta Bogotá Norte'
  originId: string // warehouseId del CD origen
  destinationIds: string[] // warehouseIds de tiendas destino
  carrierName: string
  driverName: string
  truckPlate: string // formato colombiano 'ABC-123'
  routeDate: string // ISO date 'YYYY-MM-DD'
  currentLoadKg: number
  capacityKg: number
  status: SapRouteStatus
}
