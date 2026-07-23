# Funcionalidades base de un WMS — Referencia de mercado

**Fecha:** 2026-07-14
**Propósito:** Catálogo de referencia de las funcionalidades que debe tener un WMS moderno, tomando como benchmark lo que ofrecen actualmente los líderes del mercado. Sirve como *checklist de producto* para priorizar el desarrollo.

---

## Cómo leer este documento

Cada módulo incluye:
- **Para qué sirve:** descripción funcional — qué es el módulo y cuál es su rol dentro del WMS.
- **Niveles de madurez** de sus funcionalidades:

| Nivel | Significado |
|---|---|
| 🟢 **Base** | Imprescindible. Sin esto no es un WMS productivo. |
| 🔵 **Estándar** | Lo que un cliente empresarial espera hoy por defecto. |
| 🟣 **Avanzado** | Diferenciador competitivo; lo que ofrecen los líderes premium. |

---

## Referentes del mercado (benchmark)

Vendedores considerados líderes/challengers en el espacio WMS (Gartner Magic Quadrant for WMS y equivalentes):

| Vendedor | Producto insignia | Fortaleza reconocida |
|---|---|---|
| **Manhattan Associates** | Manhattan Active® Warehouse Management | Slotting, labor management, orquestación, cloud-native versionless |
| **Blue Yonder** (ex JDA) | Blue Yonder WMS / Luminate | IA/ML, optimización de la cadena de suministro end-to-end |
| **SAP** | SAP EWM (Extended Warehouse Management) | Integración ERP profunda, control por procesos, MFS (automatización) |
| **Oracle** | Oracle Warehouse Management Cloud (ex LogFire) | Cloud-native SaaS, despliegue rápido, omnicanal |
| **Körber** (ex HighJump) | Körber WMS / K.Motion | Voice picking, flexibilidad, mercado medio |
| **Infor** | Infor WMS (ex SCE) | Visualización 3D del almacén, science-based slotting |
| **Softeon, Tecsys, Generix, Mecalux (Easy WMS), Reply (LEA)** | — | Nichos: 3PL billing, healthcare, retail, automatización |

> **Contexto Colombia/LATAM:** además de lo anterior, un WMS local debe integrarse con transportadoras nacionales (Servientrega, TCC, Coordinadora, Interrapidísimo, envía) y ERPs frecuentes (SAP, Siigo, World Office), soportar es-CO, COP y documentación DIAN a través del ERP.

---

## 1. Gestión de inventario (Inventory Control)

> **Para qué sirve:** Es el registro maestro y en tiempo real de las existencias: la verdad de *qué hay, dónde, en qué estado y en qué cantidad*. Es el núcleo del WMS — todos los demás procesos (reservar, pickear, reponer, despachar, devolver) leen y modifican este registro. Su función es garantizar que el stock del sistema refleje fielmente el físico y que nunca se prometa, mueva o despache algo que no existe o no está disponible.

🟢 **Base**
- Inventario en tiempo real por SKU, ubicación, lote, serie y estado.
- Múltiples estados de stock: disponible, reservado, en espera/hold, cuarentena, dañado, vencido, en tránsito.
- Unidad de medida múltiple y conversiones (unidad, caja, pallet).
- Cálculo de disponible = en mano − reservado − retenido (nunca almacenado).
- Libro de movimientos inmutable (audit trail): recepción, putaway, pick, traslado, ajuste, hold/release, devolución, scrap.
- Control de inventario negativo (impedir sobreventa).
- Bloqueo/retención selectiva (hold) por SKU, lote o ubicación sin afectar el disponible.

🔵 **Estándar**
- Reservas con TTL y ATP (Available-to-Promise) en tiempo real.
- Ajustes con niveles de aprobación y razones tipificadas.
- Congelamiento de operaciones para inventario general.
- Antigüedad de inventario (aging) y alertas por baja rotación.
- KPI de exactitud de inventario (IRA).

🟣 **Avanzado**
- Inventory optimization con IA (Blue Yonder): predicción de faltantes y sobrestock.
- Consignación con visibilidad diferenciada.
- Visibilidad de inventario en red (network inventory) multi-nodo.

---

## 2. Recepción (Inbound / Receiving)

> **Para qué sirve:** Es la puerta de entrada de la mercancía al almacén. Convierte lo que llega físicamente (contra una Orden de Compra o un ASN) en inventario del sistema, validando cantidades, lotes, vencimientos y números de serie. Su función es asegurar que solo entre lo correcto, registrado con exactitud desde el primer momento, y disparar los procesos posteriores de calidad (QC) y almacenamiento (putaway). Un error aquí contamina todo el inventario aguas abajo.

🟢 **Base**
- Recepción contra Orden de Compra (PO) y ASN (Advanced Shipping Notice).
- Recepción ciega, contra documento y por excepción.
- Captura de cantidad, lote y fecha de vencimiento.
- Registro de números de serie desde recepción (validación de conteo y duplicados).
- Manejo de discrepancias (short/over/damaged) con razones.

🔵 **Estándar**
- Programación y gestión de citas de recepción.
- Impresión de etiquetas de licencia/LPN (matrícula de pallet/caja) en recepción.
- Cross-docking (directo, indirecto, oportunístico).
- Control de calidad (QC) integrado en recepción con muestreo.

🟣 **Avanzado**
- Recepción dirigida por voz/RF con validación automática.
- ASN electrónico vía EDI (856) / API con el proveedor.
- Reglas de recepción configurables por proveedor/categoría.

---

## 3. Almacenamiento y Putaway

> **Para qué sirve:** Decide y ejecuta *dónde guardar* la mercancía recién recibida, moviéndola desde la zona de staging a su ubicación definitiva. Su función es colocar cada producto en la mejor ubicación posible según reglas (rotación ABC, peso, temperatura, capacidad, compatibilidad) para densificar el uso del espacio y acortar los futuros recorridos de picking. Un buen putaway es la base de un picking eficiente.

🟢 **Base**
- Putaway manual con validación de ubicación destino.
- Registro del movimiento con trazabilidad.

🔵 **Estándar**
- **Putaway dirigido por sistema** (system-directed): el WMS sugiere la ubicación óptima.
- Reglas de ubicación por zona, tipo de producto, ABC, capacidad de peso/volumen.
- Restricciones: temperatura, peligrosidad, compatibilidad de producto, mezcla de lotes.

🟣 **Avanzado**
- Putaway optimizado por proximidad y afinidad (co-storage).
- Directed putaway con "double-deep" y estrategias de densificación.
- Almacenamiento caótico/dinámico optimizado por algoritmo.

---

## 4. Ubicaciones y layout del almacén (Warehouse Structure)

> **Para qué sirve:** Es el modelo digital del almacén físico: define su estructura jerárquica y los atributos de cada posición. Su función es darle al WMS un mapa preciso sobre el cual dirigir todos los movimientos, aplicar reglas de almacenamiento y calcular rutas, distancias y capacidades. Sin un modelo de ubicaciones fiel, el sistema no puede dirigir putaway, picking ni slotting.

🟢 **Base**
- Modelo jerárquico: almacén → zona → pasillo → rack → nivel → posición.
- Tipos de ubicación: picking, reserva, cuarentena/QC, staging, devoluciones.
- Atributos: pick-face, golden zone, bloqueada, capacidad (peso/volumen), accesibilidad, distancia a despacho.

🔵 **Estándar**
- CRUD visual del layout; mapa del almacén.
- Bloqueo/desbloqueo de ubicaciones.
- Tipos de estiba según rack y producto.

🟣 **Avanzado**
- **Visualización 3D del almacén** (Infor).
- Gemelo digital / simulación de layout.
- Configuración low-code de zonas y reglas.

---

## 5. Picking / preparación de pedidos

> **Para qué sirve:** Es la extracción de los productos desde sus ubicaciones para cumplir los pedidos — el proceso que más mano de obra consume en un almacén y el que más impacta la productividad. Su función es guiar al operario para tomar los productos correctos, en las cantidades correctas, por la ruta más eficiente, validando cada extracción por escaneo. Los WMS líderes ofrecen múltiples estrategias de picking que coexisten y se eligen según el tipo de pedido y la carga.

🟢 **Base**
- Picking discreto (una orden a la vez).
- Validación por escaneo de ubicación, producto y (si aplica) serie/lote.
- Picking parcial con manejo de faltantes.

🔵 **Estándar** — metodologías múltiples:
- **Por oleadas (wave)** — agrupación por zona/ruta/ventana.
- **Sin oleada (waveless)** — flujo continuo.
- **Batch** — consolidación de picks del mismo SKU/ubicación de varias órdenes.
- **Cluster / multi-order** — un picker con N contenedores.
- **Zona** — pick-and-pass entre zonas.
- **Put-to-store** — pick masivo y distribución a tiendas.
- Optimización de ruta de picking (secuenciación por accesibilidad).
- Priorización por SLA / ventana de despacho / rush.
- Manejo de excepciones (sin stock, sustitución, incidencia con foto).

🟣 **Avanzado**
- **Order streaming / orquestación dinámica** (Manhattan Active): el sistema decide la mejor estrategia en tiempo real según carga y prioridad.
- Optimización de ruta tipo TSP / nearest-neighbor.
- Picking asistido por voz, pick-to-light, RFID, wearables.
- Goods-to-person (integración con AS/RS, AMR).

---

## 6. Packing / embalaje

> **Para qué sirve:** Prepara los productos ya pickeados para el envío: los verifica contra el pedido, los embala y los etiqueta. Su función es garantizar que lo que sale coincide exactamente con lo solicitado (última barrera de calidad antes del cliente), proteger el producto para el transporte y generar la etiqueta y documentación de despacho.

🟢 **Base**
- Verificación de contenido por escaneo (esperado vs. escaneado).
- Registro de peso/dimensiones del bulto.
- Generación de etiqueta de envío.

🔵 **Estándar**
- Sugerencia de caja/cartonización por volumen y peso.
- Motor de reglas de empaque (frágil, líquido, pesado, cadena de frío, alto valor).
- Packing list y documentación.

🟣 **Avanzado**
- Cartonization optimization (minimizar cajas y volumen dimensional).
- Empaque personalizado por canal/cliente (marca, inserts).
- Estaciones de packing automatizadas.

---

## 7. Despacho y transporte (Outbound / Shipping)

> **Para qué sirve:** Gestiona la salida de la mercancía del almacén hacia el cliente o la tienda. Su función es consolidar los bultos de cada envío, elegir la transportadora óptima (costo/servicio), generar guías y manifiestos, coordinar la carga y confirmar la entrega, midiendo el cumplimiento del servicio (OTIF). Es donde el almacén cumple —o incumple— la promesa hecha al cliente.

🟢 **Base**
- Consolidación de bultos por orden/envío.
- Generación de guía y manifiesto de carga.
- Confirmación de despacho.

🔵 **Estándar**
- **Rate shopping** entre transportadoras (costo por peso/zona/servicio).
- Verificación de carga antes del despacho (con serie).
- Despacho parcial con saldo pendiente.
- Rutas de reparto y consolidación por destino.
- Modalidades: flota propia, tercero, courier, last-mile.
- Tracking OTIF (On-Time In-Full).

🟣 **Avanzado**
- Integración nativa con TMS.
- **POD digital** (foto, firma, geolocalización).
- Carga de contenedores con volumetría / load planning.
- Ventanas de entrega por cliente/tienda.
- Parcel manifesting y compliance por carrier.

---

## 8. Gestión de patio y muelles (Yard / Dock Management)

> **Para qué sirve:** Coordina el flujo de vehículos y el uso de los muelles de carga/descarga. Su función es evitar los cuellos de botella en las puertas del almacén: programa citas de llegada/salida, asigna muelles y controla los tráileres en el patio, de modo que camiones y operación fluyan de forma ordenada y sin congestión. Conecta el mundo del transporte con el interior del almacén.

🟢 **Base**
- Gestión de muelles (docks): inbound/outbound/mixto, estado.
- Citas de llegada/salida asociadas a ASN/manifiesto.

🔵 **Estándar**
- Calendario de citas con restricciones de horario.
- Estados FSM: agendada → llegó → en proceso → completada / no-show.
- Asignación de muelle a cita.

🟣 **Avanzado**
- Yard Management System (YMS) completo: control de tráileres en patio, gate in/out.
- Dock scheduling optimizado por carga de trabajo.

---

## 9. Gestión de tareas y mano de obra (Labor Management — LMS)

> **Para qué sirve:** Mide, asigna y optimiza el trabajo humano del almacén. Su función es distribuir las tareas de forma eficiente entre los operarios, medir su productividad (idealmente contra estándares de ingeniería) y dar visibilidad de desempeño para planear personal, calcular incentivos y detectar cuellos de botella. Es el módulo que convierte el WMS en una herramienta de gestión operativa, no solo de ejecución. Diferenciador clave de Manhattan y Blue Yonder.

🟢 **Base**
- Asignación de tareas a operarios.
- Registro de productividad por operario (unidades/hora, picks/hora).

🔵 **Estándar**
- Cola de tareas priorizada e interleaving (combinar putaway + replenishment en un trayecto).
- Productividad individual y por equipo con dashboards.

🟣 **Avanzado**
- **Engineered Labor Standards** (estándares de ingeniería): tiempo esperado por tarea, medición contra estándar, incentivos.
- Balanceo dinámico de carga de trabajo.
- Planificación de personal por pronóstico de demanda.

---

## 10. Slotting (optimización de ubicaciones)

> **Para qué sirve:** Determina la ubicación óptima de cada producto dentro del almacén según su comportamiento de demanda. Su función es reducir los recorridos de picking y mejorar el uso del espacio: coloca los productos de alta rotación en las mejores posiciones (golden zone, ergonómicas, cercanas a despacho) y reubica los de baja rotación a zonas remotas. Es una optimización continua que impacta directamente la productividad del picking.

🟢 **Base**
- Clasificación ABC por frecuencia de picking.

🔵 **Estándar**
- Clasificación ABC/XYZ (volumen + volatilidad de demanda).
- Recomendaciones de reubicación scored.
- Ubicación ideal por tier (golden/estándar/remoto).

🟣 **Avanzado**
- **Science-based slotting** (Infor/Manhattan): optimización por afinidad, estacionalidad, ergonomía y cubicaje.
- Simulación dry-run del impacto (distancia/tiempo ahorrado) antes de ejecutar.
- Re-slotting automático continuo con IA.
- Matriz de afinidad (co-picking) para co-ubicar SKUs.

---

## 11. Reabastecimiento (Replenishment)

> **Para qué sirve:** Mantiene surtidas las ubicaciones de picking (pick-faces) moviendo stock desde las zonas de reserva. Su función es evitar que un picker llegue a una ubicación vacía: detecta cuándo un pick-face baja de su nivel mínimo y genera la tarea de reposición a tiempo, garantizando que siempre haya producto disponible para cumplir los pedidos sin interrumpir el flujo.

🟢 **Base**
- Detección de pick-faces bajo mínimo.
- Generación de tareas de reposición desde reserva a pick-face.

🔵 **Estándar**
- Min/max configurable por SKU/ubicación.
- Prioridad de reposición (alta/media/baja).
- Reabastecimiento automático a tiendas (retail).

🟣 **Avanzado**
- Reposición demand-driven / predictiva.
- Top-off y reposición dinámica durante la wave.
- Reglas por tienda/canal/región y estacionalidad.

---

## 12. Devoluciones (Returns / RMA / Reverse Logistics)

> **Para qué sirve:** Gestiona el flujo inverso: la mercancía que regresa del cliente o de la tienda. Su función es recibir, inspeccionar y decidir el destino de cada devolución (reingreso a inventario, reparación, baja/scrap, cuarentena o rechazo) con trazabilidad completa. Un buen módulo de devoluciones recupera valor, controla el estado del producto y es cada vez más crítico por el crecimiento del e-commerce.

🟢 **Base**
- Registro de devolución con motivo.
- Inspección y disposición: reingreso, scrap, reparación, cuarentena, rechazo.

🔵 **Estándar**
- FSM completa: solicitada → recibida en tienda → tránsito a CD → recibida en CD → validación → disposición.
- Validación de serie contra el despacho original.
- Reingreso al inventario con trazabilidad.
- Flujo de reparación (envío a taller y recepción).

🟣 **Avanzado**
- Portal RMA de autoservicio para el cliente.
- BORIS (Buy Online, Return In Store) diferenciado por canal.
- Grading automático de producto devuelto.
- Optimización de disposición por valor de recuperación.

---

## 13. Conteo cíclico e inventario físico

> **Para qué sirve:** Verifica periódicamente que el inventario del sistema coincide con el físico, sin detener la operación. Su función es mantener y medir la exactitud del inventario (IRA) mediante conteos programados y ajustes controlados, en lugar de recurrir a un inventario general anual costoso y disruptivo. Es el mecanismo que mantiene "sano" el registro de existencias en el tiempo.

🟢 **Base**
- Conteo cíclico por zona/categoría/rotación.
- Ajuste con razón y aprobación.

🔵 **Estándar**
- Programación de conteos por ABC (A más frecuente).
- Conteo en piso con captura por RF.
- Recálculo automático de IRA.

🟣 **Avanzado**
- Conteo continuo (opportunistic counting durante picking).
- Conteo por RFID / drones.
- Detección de anomalías con IA.

---

## 14. Trazabilidad (Lote / Serie / FEFO)

> **Para qué sirve:** Registra el rastro completo de cada lote y número de serie a lo largo de todo el ciclo (recepción → putaway → pick → packing → despacho → devolución). Su función es responder con precisión "¿de dónde vino y a dónde fue este producto?", habilitando el cumplimiento regulatorio, la gestión de vencimientos (FEFO), los recalls de producto y la validación de garantías. Es obligatoria en sectores como farma, alimentos y electrónica.

🟢 **Base**
- Rastreo por lote y por número de serie en todo el ciclo (recepción → putaway → pick → packing → despacho → devolución).
- FIFO/FEFO (First Expired First Out) por vencimiento.

🔵 **Estándar**
- Política de rotación configurable (FIFO/FEFO/LIFO) por producto/ubicación.
- Historial de movimientos por artículo/lote/serie.
- Genealogía de lote (de dónde vino, a dónde fue).

🟣 **Avanzado**
- Trazabilidad regulatoria (farma: serialización/track-and-trace, alimentos: FSMA).
- Integración de serie con trazabilidad financiera del ERP.
- Listas de exclusión / bloqueo de series (antifraude/garantías).

---

## 15. Omnicanalidad y e-commerce fulfillment

> **Para qué sirve:** Permite cumplir pedidos de múltiples canales (e-commerce, tienda, marketplace, B2B, app) desde el inventario del almacén y de la red. Su función es unificar el fulfillment para que un mismo stock sirva a todos los canales aplicando las reglas de cada uno (ship-from-store, click & collect, cross-docking), con SLAs y prioridades diferenciadas. Es el módulo que habilita la venta moderna: comprar en cualquier canal y recibir/recoger donde sea.

🟢 **Base**
- Órdenes por canal (ecommerce, marketplace, POS, B2B, app).
- Tipos de fulfillment: ship-from-DC, ship-from-store, pickup-in-store, cross-docking.

🔵 **Estándar**
- **Ship-from-store** y **Click & Collect / BOPIS**.
- ATP en tiempo real por canal.
- SLAs diferenciados por canal con alertas.
- Devoluciones e-commerce en tienda (BORIS).

🟣 **Avanzado**
- **Distributed Order Management (DOM)** / optimización de fuente de fulfillment (elige nodo por costo, distancia, stock, SLA).
- Priorización dinámica e-commerce vs. reposición tiendas.
- Fulfillment orchestration unificado (una sola plataforma para todos los canales — Manhattan Active).
- Suscripciones y pedidos recurrentes.

---

## 16. Multi-almacén, multi-empresa y red

> **Para qué sirve:** Gestiona varias bodegas, tiendas y empresas dentro de una misma plataforma. Su función es dar visibilidad y control del inventario a lo largo de toda la red logística, permitir traslados entre nodos con trazabilidad y —en un modelo SaaS— aislar los datos de cada empresa cliente (multi-tenant). Es lo que convierte un WMS de una sola bodega en una plataforma de red o de producto.

🟢 **Base**
- Multi-almacén (varios CDs y tiendas).
- Traslados inter-almacén con trazabilidad.
- Inventario en tránsito.

🔵 **Estándar**
- **Multi-empresa / multi-tenant** con aislamiento de datos.
- Jerarquía empresa → almacén.
- Visibilidad consolidada de inventario en red.

🟣 **Avanzado**
- Almacenes satélite / CDs secundarios por región con reglas de fulfillment.
- Balanceo de inventario entre nodos.
- Inter-company transfers con valorización.

---

## 17. Integraciones

> **Para qué sirve:** Conecta el WMS con el ecosistema de sistemas de la empresa (ERP, e-commerce, POS, transportadoras, TMS, OMS). Su función es que el WMS no opere aislado: recibe órdenes, maestros y notificaciones de otros sistemas, y devuelve confirmaciones y estados, de forma automatizada y confiable. La calidad de las integraciones define qué tan bien encaja el WMS en la operación real de la empresa.

🟢 **Base**
- Integración con ERP (maestros, OCs, ASNs, confirmaciones).
- API REST documentada.

🔵 **Estándar**
- Conectores para e-commerce/marketplace (Shopify, VTEX, Mercado Libre).
- Integración POS en tiempo real.
- APIs de transportadoras (rate, guía, tracking).
- EDI (856, 940, 945, 947...).

🟣 **Avanzado**
- Integración nativa con TMS y OMS.
- iPaaS / integration hub con conectores preconstruidos.
- Webhooks bidireccionales y event streaming.
- RFID readers (LLRP), lectores de voz, sistemas antirrobo.

---

## 18. Automatización y control de material (WCS / WES / MFS)

> **Para qué sirve:** Orquesta el trabajo entre operarios y equipos automatizados (transportadores, sorters, robots, AS/RS, AMR). Su función es coordinar en tiempo real el flujo de material físico automatizado con las órdenes del WMS, decidiendo qué hace una persona y qué hace una máquina para maximizar el rendimiento de la instalación. Es el puente entre el software de gestión y la mecatrónica del almacén.

🔵 **Estándar**
- Integración con equipos de manejo de material (MHE): transportadores, sorters.
- Interfaz con pick-to-light / put-to-light.

🟣 **Avanzado**
- **WES (Warehouse Execution System)** embebido: orquestación de trabajo humano + automatización en tiempo real.
- **MFS de SAP EWM** (Material Flow System): control directo de PLC/automatización.
- Integración con AS/RS, AMR/AGV (robots móviles), goods-to-person, cobots.
- Simulación y balanceo de flujo automatizado.

---

## 19. Movilidad y captura de datos

> **Para qué sirve:** Lleva el WMS a las manos del operario en el piso, mediante terminales RF, escaneo de códigos, voz y dispositivos vestibles. Su función es capturar cada operación en el punto y momento exactos en que ocurre —eliminando papel y errores de transcripción— y dirigir al operario paso a paso. Sin una buena capa de movilidad, el mejor WMS del mundo no llega al operario que hace el trabajo.

🟢 **Base**
- App RF (terminales) para todas las operaciones de piso.
- Escaneo de códigos de barras 1D/2D (QR, DataMatrix).

🔵 **Estándar**
- App móvil nativa/PWA instalable.
- Soporte de dispositivos Zebra/Honeywell (DataWedge).
- Impresión ZPL (Zebra) e inalámbrica.

🟣 **Avanzado**
- **Voice picking** (Körber, Honeywell Vocollect).
- RFID / wearables / ring scanners / smart glasses.
- Modo offline con sincronización.

---

## 20. Reporting, analítica y dashboards

> **Para qué sirve:** Convierte los datos operativos en visibilidad y decisiones. Su función es exponer KPIs, dashboards y proyecciones para que supervisores y gerencia entiendan el desempeño de la operación, detecten problemas a tiempo y planifiquen recursos. Es el módulo que transforma la ejecución diaria en inteligencia de negocio.

🟢 **Base**
- Dashboards operativos con KPIs en tiempo real.
- Reportes de inventario, discrepancias y movimientos.

🔵 **Estándar**
- Productividad por operario/equipo.
- OTIF y desempeño por transportadora.
- Exactitud de inventario (IRA), aging.
- Exportación CSV/Excel/PDF.

🟣 **Avanzado**
- BI embebido y self-service analytics.
- **Forecasting / proyección de demanda** (EMA, ML).
- Alertas predictivas y detección de anomalías.
- Digital twin / control tower de la operación.

### KPIs de referencia que un WMS debe exponer

| KPI | Descripción |
|---|---|
| **IRA** | Inventory Record Accuracy (exactitud de inventario) |
| **OTIF** | On-Time In-Full |
| **Order cycle time** | Tiempo desde orden hasta despacho |
| **Picking accuracy** | % de picks correctos |
| **Lines/units per hour** | Productividad por operario |
| **Dock-to-stock time** | Tiempo de recepción a disponible |
| **Order fill rate** | % de órdenes completas |
| **Space utilization** | Ocupación del almacén |
| **Returns rate** | Tasa de devoluciones |
| **Perfect order rate** | Órdenes sin error, a tiempo y completas |

---

## 21. Administración, configuración y seguridad

> **Para qué sirve:** Gestiona la configuración del sistema, los datos maestros, los usuarios y sus permisos. Su función es doble: permitir que el WMS se adapte a las reglas del negocio sin necesidad de programar (parámetros, razones, umbrales), y garantizar que cada usuario solo acceda y ejecute lo que le corresponde (RBAC), con auditoría de las acciones críticas. Es el módulo que hace del WMS un sistema seguro, gobernable y adaptable.

🟢 **Base**
- CRUD de maestros: productos, ubicaciones, almacenes, operadores, transportadoras.
- Autenticación y roles (RBAC) con permisos granulares.
- Auditoría de acciones críticas (quién, qué, cuándo).

🔵 **Estándar**
- Parámetros de negocio configurables (umbrales ABC/XYZ, min/max, SLAs).
- Motor de razones tipificadas por contexto.
- Gestión de calendarios/turnos.

🟣 **Avanzado**
- **Configuración no-code/low-code** de flujos y pantallas (Manhattan, Oracle).
- SSO / SAML / OIDC / SCIM.
- Multi-idioma y multi-moneda.
- Segregación de funciones (SoD).

---

## 22. Facturación 3PL (Billing) — clave para SaaS multi-cliente

> **Para qué sirve:** Mide y factura los servicios logísticos prestados a cada cliente en un operador 3PL o en un WMS SaaS. Su función es cuantificar la actividad por cliente (recepciones, almacenamiento por pallet/día, picks, despachos, valor agregado) y traducirla en cobros según tarifas configurables. Es el módulo que sostiene el modelo de negocio multi-cliente: sin billing preciso, un 3PL/SaaS no puede cobrar bien lo que opera. Relevante porque el objetivo de este proyecto es **WMS SaaS multi-tenant**.

🔵 **Estándar / 🟣 Avanzado**
- Medición de actividad por cliente (recepciones, almacenamiento, picks, despachos).
- Tarifas configurables por actividad, storage (por pallet/día/m³), y valor agregado.
- Generación de facturas y reportes por tenant.
- Portal de cliente (visibilidad de su inventario y órdenes).

> Referentes fuertes en 3PL billing: **Softeon, 3PL Central/Extensiv, Infolog**.

---

## 23. Plataforma y tecnología (capacidades transversales)

> **Para qué sirve:** No es un módulo funcional sino el fundamento técnico sobre el que corre todo lo demás. Su función es determinar la capacidad del WMS de escalar, actualizarse, integrarse, personalizarse y aislar clientes. Es lo que distingue a un WMS moderno (cloud-native, multi-tenant, API-first) de uno legacy monolítico, y define el techo de crecimiento del producto.

🟣 **Estándar de la nueva generación**
- **Cloud-native SaaS** (Oracle WMS Cloud, Manhattan Active): microservicios, auto-scaling.
- **Versionless / evergreen** (Manhattan Active): actualizaciones continuas sin upgrades disruptivos.
- **API-first** y extensibilidad sin tocar el core.
- **Low-code/no-code** para configuración y personalización.
- **IA/ML embebida** (Blue Yonder Luminate, Manhattan): optimización de slotting, labor, forecasting, order streaming.
- **Multi-tenant** con aislamiento y densidad.
- **Composable** / arquitectura orientada a eventos.
- Alta disponibilidad, DR, observabilidad y SLAs.

---

## Resumen: checklist de madurez

| # | Módulo | 🟢 Base | 🔵 Estándar | 🟣 Avanzado |
|---|---|---|---|---|
| 1 | Inventario | ✓ | ✓ | IA/optimización |
| 2 | Recepción | ✓ | citas, LPN, cross-dock | voz, EDI |
| 3 | Putaway | manual | dirigido | optimizado/caótico |
| 4 | Ubicaciones | jerarquía, tipos | mapa, bloqueo | 3D/gemelo digital |
| 5 | Picking | discreto | 5+ estrategias | orquestación IA, voz |
| 6 | Packing | verificación | cartonización, reglas | optimización, automatización |
| 7 | Despacho | guía, manifiesto | rate shop, OTIF | TMS, POD, load planning |
| 8 | Yard/Muelles | citas | calendario, FSM | YMS completo |
| 9 | Labor | productividad | colas, interleaving | engineered standards |
| 10 | Slotting | ABC | ABC/XYZ, recomendaciones | science-based, IA |
| 11 | Reabastecimiento | bajo mínimo | min/max | predictivo |
| 12 | Devoluciones | disposición | FSM, validación serie | portal RMA, DOM inverso |
| 13 | Conteo cíclico | por zona | por ABC, RF | continuo, RFID |
| 14 | Trazabilidad | lote/serie, FEFO | política configurable | regulatoria |
| 15 | Omnicanal | canales, fulfillment | BOPIS, ATP, SLA | DOM, orquestación |
| 16 | Multi-nodo | multi-almacén | multi-tenant | red optimizada |
| 17 | Integraciones | ERP, API | ecom, POS, carriers, EDI | TMS/OMS, iPaaS |
| 18 | Automatización | — | MHE, PTL | WES/MFS, robótica |
| 19 | Movilidad | RF, escaneo | PWA, Zebra, ZPL | voz, RFID, wearables |
| 20 | Analítica | dashboards | productividad, OTIF | BI, forecasting, IA |
| 21 | Admin/Seguridad | CRUD, RBAC | config parámetros | low-code, SSO |
| 22 | Billing 3PL | — | medición actividad | tarifas, portal cliente |
| 23 | Plataforma | — | API-first | cloud-native, versionless, IA |

---

## Relación con este proyecto

- La **cobertura actual del MVP** frente a este catálogo está documentada en `docs/gap_analysis_wms_mvp.md` (101 ítems, ~76% funcional en cliente).
- La **hoja de ruta para llevarlo a producción** (backend Go, SaaS multi-tenant en AWS) está en `docs/plan_backend_go_wms_saas.md`.
- Los módulos con mayor brecha hoy: **Despacho/Transporte (F)**, **Labor Management**, **Automatización/WES**, **DOM/orquestación** y **Billing 3PL** (necesario para el modelo SaaS).

---

*Generado con Claude Code — Catálogo de funcionalidades WMS (referencia de mercado) — 2026-07-14*
