# WMS Functionalities

## 1. Operational Dashboard

The dashboard provides a general overview of the warehouse and logistics operation.

### Functionalities

- View pending orders.
- View orders in picking.
- View partial picking cases.
- View active picking waves.
- View pending inbound receipts.
- View returns in transit.
- View available inventory.
- View inventory on hold.
- View active SAP routes.
- View active load manifests.
- View estimated OTIF performance.
- View critical operational alerts.
- View productivity indicators.
- View fulfillment status by channel.

---

## 2. Inbound / Inventory Receiving

This module manages the entry of merchandise into the distribution center or store.

### Functionalities

- Manage ASN records.
- Register receiving appointments.
- Receive inventory fully or partially.
- Validate expected quantities versus received quantities.
- Register quantity discrepancies.
- Send received items to quality control.
- Perform quality control checks.
- Support cross-docking flows.
- Generate putaway tasks.
- Confirm final storage location.
- Register receiving exceptions.
- Track receiving status.
- Associate received inventory with lots, serials, and expiration dates.

### Covers

- ASN.
- Appointments.
- Cross-docking.
- Quality control.
- Putaway.

---

## 3. Inventory Management

This module allows users to consult, control, and manage warehouse and store inventory.

### Functionalities

- Search inventory by SKU.
- Search inventory by product.
- Search inventory by location.
- Search inventory by warehouse or store.
- Manage lots.
- Manage serial numbers.
- Manage expiration dates.
- View available inventory.
- View reserved inventory.
- View inventory on hold.
- View inventory in transit.
- Place inventory on hold.
- Release inventory from hold.
- Register internal inventory movements.
- Perform inventory adjustments.
- Track inventory by SKU.
- Track inventory by lot.
- Track inventory by serial.
- Track inventory by location.
- Track inventory by warehouse or store.

### Covers

- Locations.
- Lots.
- Serials.
- Expiration dates.
- Holds.

---

## 4. Slotting

This module optimizes product placement inside the warehouse.

### Functionalities

- Classify products using ABC analysis.
- Classify products using XYZ analysis.
- Analyze product rotation.
- Analyze picking frequency.
- Identify high-demand products.
- Suggest optimal storage locations.
- Suggest optimal picking locations.
- Recommend product relocation.
- Optimize picking zones.
- Support replenishment strategies.
- Create relocation tasks.
- Compare current location versus suggested location.
- Monitor slotting recommendation status.

### Covers

- Location optimization.
- ABC/XYZ classification.
- Replenishment support.

---

## 5. Replenishment

This module ensures inventory availability in picking locations, stores, and operational zones.

### Functionalities

- Define minimum stock levels.
- Define maximum stock levels.
- Calculate suggested replenishment quantities.
- Generate low-stock alerts.
- Suggest replenishment tasks.
- Replenish from reserve location to picking location.
- Replenish from distribution center to store.
- Prioritize replenishment tasks.
- Assign replenishment tasks to operators.
- Confirm replenishment completion.
- Track replenishment task status.
- Register replenishment discrepancies.
- Support replenishment based on slotting recommendations.

---

## 6. Transfers

This module manages inventory movements between warehouses, stores, and internal locations.

### Transfer Types

- Distribution center to store.
- Store to store.
- Store to distribution center.
- Distribution center to distribution center.

### Functionalities

- Create transfer requests.
- Validate inventory availability.
- Reserve inventory for transfer.
- Generate picking tasks for transfers.
- Confirm transfer picking.
- Confirm outbound transit.
- Control outbound transit status.
- Control inbound transit status.
- Receive transfer partially.
- Receive transfer completely.
- Register transfer discrepancies.
- Associate transfers with SAP routes.
- Associate transfers with load manifests.
- Track transfer lifecycle.
- Cancel transfer requests.
- View transfer items and quantities.

### Suggested Statuses

- Draft.
- Pending approval.
- Pending picking.
- In picking.
- Ready for dispatch.
- In outbound transit.
- In inbound transit.
- Partially received.
- Fully received.
- Cancelled.

---

## 7. Returns / Reverse Logistics

This module manages customer, store, and distribution center returns.

### Return Flows

- Customer to store.
- Customer to store to distribution center.
- Store to distribution center.
- Store to store.
- Distribution center to supplier.

### Functionalities

- Create RMA records.
- Register return reason.
- Receive returns at store.
- Receive returns at distribution center.
- Control outbound transit.
- Control inbound transit.
- Validate returned items physically.
- Validate return documentation.
- Perform quality inspection.
- Re-enter valid products into inventory.
- Send products to repair.
- Send products to scrap.
- Reject returns.
- Register evidence.
- Close return process.
- Track the full return lifecycle.
- Associate returns with routes and manifests.

### Covers

- RMA.
- Validation.
- Inventory re-entry.
- Scrap.

### Suggested Statuses

- Requested.
- Received at store.
- In transit to distribution center.
- Received at distribution center.
- Under validation.
- Sent to quality control.
- Re-entered into inventory.
- Sent to repair.
- Sent to scrap.
- Rejected.
- Closed.

---

## 8. Commerce / Orders

This module manages orders coming from commercial channels.

### Supported Channels

- Ecommerce.
- Marketplace.
- POS.
- B2B.
- Mobile app.
- Call center.

### Functionalities

- Receive orders from digital channels.
- Search and filter orders.
- Validate inventory availability.
- Reserve inventory.
- Assign fulfillment source.
- Define fulfillment type.
- Manage pending orders.
- Manage cancelled orders.
- Manage partially fulfilled orders.
- Send orders to picking.
- Track order status.
- Integrate with OMS, ecommerce, marketplace, or POS systems.
- Support order prioritization.
- Support order promise dates.

### Fulfillment Types

- Ship from distribution center.
- Ship from store.
- Pick up in store.
- Put-to-store.
- Cross-docking.

### Suggested Statuses

- New.
- Reserved.
- Pending picking.
- In picking.
- Partially picked.
- Packed.
- Dispatched.
- Delivered.
- Cancelled.

---

## 9. Picking & Fulfillment

This module manages the preparation of orders, transfers, and returns.

### Functionalities

- Create picking tasks.
- Assign picking tasks to operators.
- Support order-based picking.
- Support partial picking.
- Support wave picking.
- Support batch picking.
- Support zone picking.
- Support cluster picking.
- Support put-to-store picking.
- Support waveless picking.
- Confirm picked quantities.
- Register shortages.
- Register picking incidents.
- Support product substitution if allowed.
- Release unpicked inventory.
- Send completed picking tasks to packing.
- Track operator productivity.
- Track picking progress by order.
- Track picking progress by wave.

### Covers

- Wave picking.
- Waveless picking.
- Batch picking.
- Zone picking.
- Cluster picking.
- Put-to-store.

---

## 10. Partial Picking

This functionality allows the operation to prepare part of an order or transfer when full availability is not possible.

### Functionalities

- Identify available products.
- Identify missing products.
- Confirm partially picked quantities.
- Register reason for partial picking.
- Create picking incident.
- Update order or transfer status.
- Allow partial dispatch if business rules permit it.
- Keep pending balance for missing items.
- Retry picking later.
- Notify external systems about partial fulfillment.
- Prevent unauthorized over-picking.
- Track partial picking history.

### Suggested Statuses

- Pending.
- In picking.
- Partially picked.
- Partial with shortage.
- Partial approved.
- Partial rejected.
- Completed.

---

## 11. Wave Picking

This functionality groups orders or tasks to optimize warehouse picking execution.

### Functionalities

- Create picking waves.
- Group orders by warehouse zone.
- Group orders by route.
- Group orders by priority.
- Group orders by carrier.
- Group orders by dispatch window.
- Group orders by fulfillment type.
- Release picking waves.
- Pause picking waves.
- Close picking waves.
- Track wave progress.
- View included orders.
- View included items.
- View total quantities.
- Assign operators or teams.
- Register wave-level incidents.
- Measure wave productivity.

### Suggested Statuses

- Draft.
- Released.
- In progress.
- Paused.
- Partial.
- Closed.
- Cancelled.

---

## 12. Packing

This module validates, packs, and prepares merchandise for dispatch.

### Functionalities

- Receive products from picking.
- Verify scanned products.
- Validate scanned products against the order.
- Validate item quantities.
- Apply packing rules.
- Suggest box type.
- Register package weight.
- Register package volume.
- Generate box labels.
- Generate shipping labels.
- Confirm packing completion.
- Send packed orders to staging or dispatch.
- Register packing discrepancies.
- Support multiple packages per order.

### Covers

- Packing rules.
- Verification.
- Label generation.

---

## 13. Labels

This module generates, consults, and reprints operational labels.

### Label Types

- Product label.
- Location label.
- Box label.
- Pallet label.
- Shipping label.
- Return label.
- Transfer label.
- Manifest label.

### Functionalities

- Generate labels.
- Reprint labels.
- Search generated labels.
- Associate labels with orders.
- Associate labels with products.
- Associate labels with locations.
- Associate labels with boxes.
- Associate labels with pallets.
- Associate labels with returns.
- Show label preview.
- Generate barcode representation.
- Generate QR representation if required.
- Track label generation history.

---

## 14. Shipping / Dispatch

This module manages merchandise leaving the warehouse or store.

### Functionalities

- Manage orders ready for dispatch.
- Assign carrier.
- Associate dispatch with SAP route.
- Associate dispatch with load manifest.
- Validate number of packages.
- Validate weight.
- Validate volume.
- Confirm dispatch.
- Generate tracking number.
- Track delivery status.
- Measure OTIF.
- Manage dispatch exceptions.
- Close dispatch process.
- Support carrier selection.
- Support rate shopping if required.

### Covers

- Carriers.
- Rate shopping.
- Manifest.
- OTIF.

---

## 15. SAP Routes

This module consults and synchronizes routes created in SAP.

### Functionalities

- Consult routes created in SAP.
- Synchronize SAP routes with WMS.
- Associate orders with SAP routes.
- Associate transfers with SAP routes.
- Associate returns with SAP routes.
- View route origin.
- View route destinations.
- View assigned carrier.
- View assigned truck.
- View assigned driver.
- View truck capacity.
- View current truck occupancy.
- Control route status.
- Send route updates to SAP.
- Register route exceptions.

### Suggested Statuses

- Created in SAP.
- Synchronized.
- Planned.
- Loading.
- In transit.
- Closed.
- With exception.

---

## 16. Load Route / Load Manifest

This module controls everything that will be loaded onto a truck.

### Functionalities

- Create load manifest.
- Associate manifest with SAP route.
- Associate truck.
- Associate driver.
- Associate carrier.
- Add orders to manifest.
- Add transfers to manifest.
- Add returns to manifest.
- View included orders.
- View included transfers.
- View included returns.
- View included items.
- View loaded quantities.
- View destinations.
- View delivery sequence.
- Calculate total units.
- Calculate total packages.
- Calculate total weight.
- Calculate total volume.
- Validate truck capacity.
- Confirm loading.
- Close manifest.
- Print manifest.
- Report loading discrepancies.
- Prevent loading unauthorized items.

---

## 17. Orders and Items Loaded by the WMS

This is a transversal functionality used by dispatch and load manifest modules.

### Functionalities

- Show order number.
- Show customer.
- Show destination.
- Show sales channel.
- Show SKU.
- Show product name.
- Show requested quantity.
- Show picked quantity.
- Show packed quantity.
- Show loaded quantity.
- Show number of packages.
- Show weight.
- Show volume.
- Show delivery sequence.
- Show associated route.
- Show order status.
- Show loading status.
- Validate that the order was picked.
- Validate that the order was packed.
- Validate that the order was assigned to a route.
- Validate that the order was loaded.
- Validate that unauthorized items are not loaded.
- Validate that required items are not missing before closing the truck.

---

## 18. Third-Party Integrations

This module connects the WMS with external systems.

### Possible Integrations

- SAP.
- ERP.
- OMS.
- Ecommerce.
- Marketplace.
- POS.
- TMS.
- Carriers.
- External suppliers.
- Billing systems.
- Tracking systems.

### Functionalities

- Synchronize SAP routes.
- Synchronize orders.
- Synchronize inventory.
- Synchronize dispatches.
- Synchronize returns.
- Send operational statuses.
- Receive external confirmations.
- Manage integration errors.
- Retry failed messages.
- View integration logs.
- Monitor processed messages.
- Monitor external service status.
- Activate integrations.
- Deactivate integrations.
- Track last synchronization date.

### Suggested Statuses

- Active.
- Inactive.
- Error.
- Pending configuration.
- Synchronizing.
- Degraded.

---

## 19. Reports and Traceability

This module supports operational analysis, auditability, and control.

### Functionalities

- Trace by order.
- Trace by SKU.
- Trace by lot.
- Trace by serial.
- Trace by location.
- Trace by transfer.
- Trace by return.
- Trace by route.
- Trace by manifest.
- Generate discrepancy reports.
- Generate productivity reports.
- Generate OTIF reports.
- Generate inventory on hold reports.
- Generate expired inventory reports.
- Generate incident reports.
- Export reports if required.

---

## 20. Operational Administration

This module manages operational catalogs and business rules.

### Functionalities

- Manage distribution centers.
- Manage stores.
- Manage warehouse locations.
- Manage products.
- Manage SKUs.
- Manage carriers.
- Manage operators.
- Configure picking rules.
- Configure packing rules.
- Configure replenishment rules.
- Configure return reasons.
- Configure hold reasons.
- Configure operational statuses.
- Configure fulfillment rules.
- Configure route and manifest rules.

---

# Summary by Module

| Module | Main Functionalities |
|---|---|
| Dashboard | KPIs, alerts, operational overview |
| Inbound / Receiving | ASN, appointments, receiving, QC, cross-docking, putaway |
| Inventory Management | Locations, lots, serials, expiration dates, holds |
| Slotting | ABC/XYZ, location optimization, rotation, replenishment support |
| Replenishment | Min/max stock, suggested quantities, replenishment tasks |
| Transfers | DC-store, store-store, store-DC, outbound/inbound transit |
| Returns | RMA, customer-store, store-DC, validation, re-entry, scrap |
| Commerce | Orders, channels, reservations, fulfillment |
| Picking & Fulfillment | Partial picking, waves, batch, zone, cluster, put-to-store |
| Packing | Verification, packing rules, weight, volume, labels |
| Labels | Product, location, box, pallet, shipping, return labels |
| Shipping / Dispatch | Carriers, routes, tracking, OTIF |
| SAP Routes | Route synchronization, orders, transfers, returns |
| Load Manifest | Orders, items, quantities, truck, route, delivery sequence |
| Third-Party Integrations | SAP, ecommerce, OMS, POS, carriers, logs |
| Reports | Traceability, productivity, discrepancies, inventory, OTIF |
| Administration | Catalogs, rules, operators, reasons, configurations |

---

# MVP Priority Recommendation

## Phase 1: Core MVP

- Dashboard.
- Inventory receiving.
- Inventory management.
- Transfers.
- Returns.
- Commerce orders.
- Picking tasks.
- Partial picking.
- Wave picking.
- Labels.
- Load manifest.

## Phase 2: Operational Expansion

- Packing.
- Shipping.
- SAP routes.
- Replenishment.
- Third-party integrations.
- Basic reports.

## Phase 3: Optimization

- Slotting.
- Advanced replenishment.
- Rate shopping.
- Advanced OTIF.
- Advanced traceability.
- Operational administration.

