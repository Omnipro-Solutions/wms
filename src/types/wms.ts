// Core WMS domain types. All identifiers in English; UI copy lives in components.

// Umbrella status set used only for StatusBadge color mapping. Each entity also
// has its own status union (see ReturnStatus, PickingTaskStatus) and its own
// valid transitions in lib/state-machines.ts.
export type OperationalStatus =
  | "draft"
  | "pending"
  | "assigned"
  | "in_progress"
  | "partial"
  | "completed"
  | "cancelled"
  | "in_transit"
  | "on_hold"
  | "error"
  | "synced";

export type UnitOfMeasure = "unit" | "box" | "pallet";

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  type: "distribution_center" | "store";
}

export interface Store {
  id: string;
  code: string;
  name: string;
  city: string;
}

// Locations carry slotting attributes. `golden` marks the ergonomic
// "golden zone" (waist-to-shoulder height, close to dispatch/packing).
export interface StorageLocation {
  id: string;
  code: string;
  warehouseId: string;
  zone: string;
  type: "pick" | "reserve" | "quality_control" | "staging" | "returns";
  isPickFace: boolean;
  golden: boolean;
  accessibilityScore: number; // 0-100; higher = easier/faster to pick
  maxWeightKg: number;
  volumeCapacityM3: number;
  distanceToDispatchM: number; // meters from location to dispatch/packing
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  barcode: string;
  unitWeightKg: number;
  unitVolumeM3: number;
  trackBy: "none" | "lot" | "serial";
}

export interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  locationId: string;
  lot?: string;
  serial?: string;
  expirationDate?: string;
  onHandQuantity: number;
  reservedQuantity: number;
  holdQuantity: number;
  // availableQuantity is DERIVED via rules/inventory.ts, not stored.
  status: "available" | "reserved" | "on_hold" | "in_transit" | "expired" | "damaged";
}

// The audit log. Every receipt, putaway, pick, transfer, adjustment,
// hold, release, return or scrap appends one of these.
export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  fromLocationId?: string;
  toLocationId?: string;
  type:
    | "receipt"
    | "putaway"
    | "pick"
    | "transfer"
    | "adjustment"
    | "hold"
    | "release"
    | "return"
    | "scrap";
  quantity: number;
  lot?: string;
  serial?: string;
  referenceType:
    | "asn"
    | "transfer"
    | "return"
    | "commerce_order"
    | "replenishment"
    | "slotting"
    | "manual";
  referenceId: string;
  operatorName: string;
  createdAt: string;
}

export interface OrderLine {
  id: string;
  productId: string;
  requestedQuantity: number;
  pickedQuantity?: number;
  packedQuantity?: number;
}

export interface Asn {
  id: string;
  code: string;
  supplierName: string;
  appointmentDate: string;
  expectedQuantity: number;
  receivedQuantity: number;
  status: OperationalStatus;
  requiresQualityControl: boolean;
  crossDocking: boolean;
  productId: string;
  // Directed putaway suggestion comes from slotting (ABC class of product).
  suggestedPutawayLocationId?: string;
}

export interface TransferOrder {
  id: string;
  code: string;
  type: "dc_to_store" | "store_to_store" | "store_to_dc" | "dc_to_dc";
  originId: string;
  destinationId: string;
  status: OperationalStatus;
  createdAt: string;
  estimatedArrivalDate: string;
  routeId?: string;
  items: OrderLine[];
}

export type ReturnStatus =
  | "requested"
  | "received_at_store"
  | "in_transit_to_dc"
  | "received_at_dc"
  | "under_validation"
  | "sent_to_quality_control"
  | "reentered"
  | "sent_to_repair"
  | "sent_to_scrap"
  | "rejected"
  | "closed";

export interface ReturnOrder {
  id: string;
  rmaCode: string;
  customerName: string;
  type:
    | "customer_to_store"
    | "customer_store_to_dc"
    | "store_to_dc"
    | "store_to_store"
    | "dc_to_supplier";
  originId: string;
  destinationId: string;
  status: ReturnStatus;
  reasonId: string; // references a Reason (context: "return")
  disposition: "restock" | "scrap" | "quality_control" | "repair" | "rejected";
  items: OrderLine[];
}

export interface CommerceOrder {
  id: string;
  orderNumber: string;
  channel: "ecommerce" | "marketplace" | "pos" | "b2b" | "app";
  customerName: string;
  status: OperationalStatus;
  createdAt: string;
  promisedDeliveryDate: string;
  fulfillmentType:
    | "ship_from_dc"
    | "ship_from_store"
    | "pickup_in_store"
    | "put_to_store"
    | "cross_docking";
  items: OrderLine[];
}

export type PickingTaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "partially_picked"
  | "partial_with_shortage"
  | "partial_approved"
  | "partial_rejected"
  | "completed"
  | "with_issue";

export interface PickingTask {
  id: string;
  code: string;
  orderId: string;
  productId: string;
  locationId: string;
  requestedQuantity: number;
  pickedQuantity: number;
  // Pending balance kept for missing items so picking can be retried later.
  pendingQuantity: number;
  status: PickingTaskStatus;
  operatorName?: string;
  priority: "low" | "medium" | "high";
  partialReasonId?: string; // references a Reason (context: "partial_picking")
  issueReason?: string;
}

export interface PickingWave {
  id: string;
  code: string;
  name: string;
  orderCount: number;
  unitCount: number;
  zone: string;
  // How orders were grouped into this wave.
  groupBy: "zone" | "route" | "priority" | "carrier" | "dispatch_window" | "fulfillment_type";
  groupValue: string;
  priority: "low" | "medium" | "high";
  status: OperationalStatus;
  assignedTeam?: string;
  createdAt: string;
  orderIds: string[];
}

export interface PackingOrder {
  id: string;
  orderId: string;
  customerName: string;
  expectedItems: number;
  scannedItems: number;
  verificationStatus: "pending" | "verified" | "mismatch";
  suggestedBox: string;
  weightKg: number;
  volumeM3: number;
  labelGenerated: boolean;
}

export interface WmsLabel {
  id: string;
  code: string;
  type: "product" | "location" | "box" | "pallet" | "shipping" | "return";
  reference: string;
  status: OperationalStatus;
  createdAt: string;
  createdBy: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  customerName: string;
  carrierName: string;
  sapRouteId?: string;
  status: OperationalStatus;
  shippedAt?: string;
  packageCount: number;
  weightKg: number;
  trackingNumber?: string;
  otifStatus: "on_time" | "at_risk" | "late";
}

export interface SapRoute {
  id: string;
  code: string;
  name: string;
  originId: string;
  destinationIds: string[];
  carrierName: string;
  routeDate: string;
  status: OperationalStatus;
  truckPlate: string;
  driverName: string;
  capacityKg: number;
  currentLoadKg: number;
}

export interface ManifestStop {
  id: string;
  sequence: number;
  destinationId: string;
  orderIds: string[];
  transferIds: string[];
  returnIds: string[];
}

export interface LoadManifest {
  id: string;
  code: string;
  sapRouteId: string;
  truckPlate: string;
  driverName: string;
  carrierName: string;
  manifestDate: string;
  status: OperationalStatus;
  orderIds: string[];
  transferIds: string[];
  returnIds: string[];
  totalUnits: number;
  totalPackages: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  stops: ManifestStop[];
}

export interface IntegrationConnection {
  id: string;
  name: string;
  type:
    | "sap"
    | "ecommerce"
    | "marketplace"
    | "carrier"
    | "erp"
    | "oms"
    | "pos"
    | "supplier";
  status: "active" | "inactive" | "error" | "pending_configuration";
  lastSyncAt?: string;
  lastError?: string;
  processedMessages: number;
}

export interface ReplenishmentTask {
  id: string;
  productId: string;
  originLocationId: string;
  destinationLocationId: string; // a slotting-defined pick face
  currentStock: number;
  minStock: number;
  maxStock: number;
  suggestedQuantity: number;
  priority: "low" | "medium" | "high";
  status: OperationalStatus;
  operatorName?: string;
}

// --- Slotting domain ---

export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";

// Demand history used to CALCULATE ABC/XYZ. Lives in seed so it is derived.
export interface ProductDemandStat {
  productId: string;
  unitsSold: number;
  pickingFrequency: number; // picks per period
  demandSamples: number[]; // per-period demand, used for XYZ variability
}

// A slotting recommendation is COMPUTED (see lib/rules/slotting.ts).
export interface SlottingRecommendation {
  id: string;
  productId: string;
  abcClass: AbcClass;
  xyzClass: XyzClass;
  currentLocationId: string;
  suggestedLocationId: string;
  rotationRate: number;
  unitsSold: number;
  pickingFrequency: number;
  score: number; // 0-100
  estimatedDistanceSavedM: number;
  estimatedTimeSavedSeconds: number;
  recommendation: string; // human-readable Spanish explanation
}

// --- Administration domain ---

export interface Operator {
  id: string;
  code: string;
  name: string;
  role: "picker" | "packer" | "receiver" | "driver" | "supervisor";
  active: boolean;
}

export interface Reason {
  id: string;
  code: string;
  label: string; // Spanish label shown in the UI
  context: "return" | "partial_picking" | "adjustment" | "scrap" | "hold";
  active: boolean;
}

export interface Carrier {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface WmsSettings {
  abcThresholdA: number; // cumulative share, e.g. 0.8
  abcThresholdB: number; // cumulative share, e.g. 0.95
  xyzCvX: number; // e.g. 0.5
  xyzCvY: number; // e.g. 1.0
  replenishmentHighFactor: number; // e.g. 0.5 of min stock
  simulatedLatencyMs: number;
}

// --- Reports domain (derived aggregations, NOT stored entities) ---

export interface ProductivityRow {
  operatorName: string;
  picksCompleted: number;
  unitsPicked: number;
  partialCount: number;
  issueCount: number;
}

export interface DiscrepancyRow {
  referenceType: "asn" | "picking";
  referenceCode: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface InventoryReportRow {
  warehouseId: string;
  abcClass: AbcClass;
  totalOnHand: number;
  totalReserved: number;
  totalHold: number;
  totalAvailable: number;
}
