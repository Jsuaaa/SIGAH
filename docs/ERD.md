# Diagrama Entidad-Relación Conceptual — SGAH

> **Sistema de Gestión y Distribución de Ayudas Humanitarias**
> Inundaciones Montería, Córdoba — 2026 · Iteración 3
>
> Documento derivado de `PLAN.md`, `ISSUES.md` y del PDF "Síntesis de Requerimientos — SGAH" (Iteración 3, Abril 2026).

## 1. Convenciones

- **Notación de cardinalidad**: `(mínimo..máximo)` en cada extremo de la relación.
  - `(1..1)` exactamente uno · `(0..1)` cero o uno · `(0..N)` cero o muchos · `(1..N)` uno o muchos.
- **Toda relación es binaria**. Las relaciones `N:M` se resuelven con entidades asociativas (tablas puente), y cualquier concepto ternario (p. ej. *Donación ↔ Recurso ↔ Cantidad*) se segmenta en dos relaciones binarias a través de una entidad débil.
- **Entidad débil**: se representa con bordes dobles lógicos y depende existencialmente de la entidad fuerte (ej. `PERSON` depende de `FAMILY`).
- **Justificación**: cada relación referencia el requisito del PDF que la origina (`RF`, `RN`, `HU` o `RNF`).

---

## 2. Entidades (22)

| # | Entidad | Tipo | Descripción |
|---|---------|------|-------------|
| E1 | USER | Fuerte | Usuarios del sistema con rol asignado (RF-41, RF-43) |
| E2 | AUDIT_LOG | Débil (de USER) | Historial inmutable de acciones (RF-40, RNF-09) |
| E3 | SCORING_CONFIG | Fuerte | Pesos configurables de la fórmula de priorización (RN-04, HU-08) |
| E4 | ALERT_THRESHOLD | Débil (de RESOURCE_TYPE) | Umbral mínimo de stock por recurso (RF-15, HU-16) |
| E5 | ZONE | Fuerte | Zona geográfica afectada (RF-08) |
| E6 | SHELTER | Fuerte | Refugio temporal (RF-09) |
| E7 | FAMILY | Fuerte | Núcleo familiar afectado (RF-01) |
| E8 | PERSON | Débil (de FAMILY) | Miembro individual de una familia (RF-02) |
| E9 | PRIVACY_CONSENT | Débil (de FAMILY) | Aceptación del aviso Ley 1581/2012 (RN-09) |
| E10 | WAREHOUSE | Fuerte | Bodega de almacenamiento (RF-10) |
| E11 | RESOURCE_TYPE | Fuerte | Catálogo de tipos de recurso (RF-13) |
| E12 | INVENTORY | Asociativa (WAREHOUSE ↔ RESOURCE_TYPE) | Stock por bodega y recurso (RF-14) |
| E13 | INVENTORY_ADJUSTMENT | Débil (de INVENTORY) | Ajuste manual con motivo (RF-16, HU-17) |
| E14 | DONOR | Fuerte | Registro de donantes (RF-18) |
| E15 | DONATION | Fuerte | Evento de donación (RF-19) |
| E16 | DONATION_DETAIL | Asociativa (DONATION ↔ RESOURCE_TYPE) | Ítems de donación en especie (RF-20) |
| E17 | DISTRIBUTION_PLAN | Fuerte | Plan priorizado de distribución (RF-22, HU-21) |
| E18 | DISTRIBUTION_PLAN_ITEM | Asociativa (PLAN ↔ FAMILY ↔ WAREHOUSE) | Asignación del plan (RF-22) |
| E19 | DELIVERY | Fuerte | Entrega materializada a una familia (RF-24) |
| E20 | DELIVERY_DETAIL | Asociativa (DELIVERY ↔ RESOURCE_TYPE) | Ítems entregados (RF-24, RF-27) |
| E21 | HEALTH_VECTOR | Fuerte | Foco de riesgo sanitario (RF-31) |
| E22 | RELOCATION | Fuerte | Traslado de familia entre refugios (RF-30) |

---

## 3. Diagrama (Mermaid ER)

```mermaid
erDiagram
    USER ||--o{ AUDIT_LOG : "registra (R1)"
    USER ||--o{ DELIVERY : "entrega (R2)"
    USER ||--o{ DELIVERY : "autoriza excepción (R3)"
    USER ||--o{ DISTRIBUTION_PLAN : "crea (R4)"
    USER ||--o{ HEALTH_VECTOR : "reporta (R5)"
    USER ||--o{ RELOCATION : "autoriza (R6)"
    USER ||--o{ PRIVACY_CONSENT : "recoge consentimiento (R7)"
    USER ||--o{ INVENTORY_ADJUSTMENT : "ajusta (R8)"
    USER ||--o{ SCORING_CONFIG : "configura (R9)"
    USER ||--o{ ALERT_THRESHOLD : "configura umbrales (R10)"

    ZONE ||--o{ SHELTER : "contiene (R11)"
    ZONE ||--o{ FAMILY : "ubica (R12)"
    ZONE ||--o{ WAREHOUSE : "alberga (R13)"
    ZONE ||--o{ HEALTH_VECTOR : "localiza (R14)"

    SHELTER ||--o{ FAMILY : "aloja (R15)"
    SHELTER ||--o{ HEALTH_VECTOR : "puede ubicar (R16)"
    SHELTER ||--o{ RELOCATION : "es origen (R17)"
    SHELTER ||--o{ RELOCATION : "es destino (R18)"

    FAMILY ||--|{ PERSON : "tiene (R19)"
    FAMILY ||--|| PRIVACY_CONSENT : "otorga (R20)"
    FAMILY ||--o{ DELIVERY : "recibe (R21)"
    FAMILY ||--o{ RELOCATION : "se traslada (R22)"
    FAMILY ||--o{ DISTRIBUTION_PLAN_ITEM : "es asignada en (R23)"

    WAREHOUSE ||--o{ INVENTORY : "almacena (R24)"
    WAREHOUSE ||--o{ DONATION : "recibe donaciones (R25)"
    WAREHOUSE ||--o{ DELIVERY : "origina (R26)"
    WAREHOUSE ||--o{ DISTRIBUTION_PLAN_ITEM : "suministra (R27)"

    RESOURCE_TYPE ||--o{ INVENTORY : "se cuantifica en (R28)"
    RESOURCE_TYPE ||--o{ DONATION_DETAIL : "se especifica en (R29)"
    RESOURCE_TYPE ||--o{ DELIVERY_DETAIL : "se despacha en (R30)"
    RESOURCE_TYPE ||--o| ALERT_THRESHOLD : "tiene umbral (R31)"

    INVENTORY ||--o{ INVENTORY_ADJUSTMENT : "registra ajustes (R32)"

    DONOR ||--o{ DONATION : "aporta (R33)"
    DONATION ||--o{ DONATION_DETAIL : "desglosa (R34)"

    DELIVERY ||--|{ DELIVERY_DETAIL : "detalla (R35)"

    DISTRIBUTION_PLAN ||--|{ DISTRIBUTION_PLAN_ITEM : "compone (R36)"
    DISTRIBUTION_PLAN_ITEM ||--o| DELIVERY : "se materializa en (R37)"

    USER {
        int id PK
        string email UK
        string name
        string password_hash
        enum role "6 valores"
        bool is_active
        int failed_login_attempts
        datetime locked_until
        bool password_must_change
    }
    AUDIT_LOG {
        int id PK
        string action
        string module
        string entity
        int entity_id
        json before
        json after
        string ip_address
        datetime created_at
    }
    SCORING_CONFIG {
        string key PK
        float value
        datetime updated_at
    }
    ALERT_THRESHOLD {
        int id PK
        int resource_type_id FK
        int min_quantity
    }
    ZONE {
        int id PK
        string name
        enum risk_level
        float latitude
        float longitude
        int estimated_population
    }
    SHELTER {
        int id PK
        string name
        int zone_id FK
        int max_capacity
        int current_occupancy
        float latitude
        float longitude
    }
    FAMILY {
        int id PK
        string family_code UK "FAM-2026-NNNNN"
        string head_document
        int zone_id FK
        int shelter_id FK "nullable"
        int num_members
        float priority_score
        json priority_score_breakdown
        enum status "ACTIVO|EN_REFUGIO|EVACUADO"
        float latitude "nullable"
        float longitude "nullable"
    }
    PERSON {
        int id PK
        int family_id FK
        string name
        string document UK
        date birth_date
        enum relationship
        string_array special_conditions
        bool requires_medication
    }
    PRIVACY_CONSENT {
        int id PK
        int family_id FK UK
        datetime accepted_at
        int accepted_by_user_id FK
        string law_version
        string ip_address
    }
    WAREHOUSE {
        int id PK
        string name
        int zone_id FK
        float max_capacity_kg
        float current_weight_kg
        enum status
        float latitude
        float longitude
    }
    RESOURCE_TYPE {
        int id PK
        string name
        enum category
        string unit_of_measure
        float unit_weight_kg
        bool is_active
    }
    INVENTORY {
        int id PK
        int warehouse_id FK
        int resource_type_id FK
        int available_quantity
        float total_weight_kg
        string batch
        date expiration_date
    }
    INVENTORY_ADJUSTMENT {
        int id PK
        int inventory_id FK
        int delta
        enum reason "MERMA|DANO|DEVOLUCION|CORRECCION"
        string reason_note
        int user_id FK
        datetime created_at
    }
    DONOR {
        int id PK
        string name
        enum type "5 valores"
        string contact
        string tax_id
    }
    DONATION {
        int id PK
        string donation_code UK "DON-2026-NNNNN"
        int donor_id FK
        int destination_warehouse_id FK
        enum donation_type
        float monetary_amount
        datetime date
    }
    DONATION_DETAIL {
        int id PK
        int donation_id FK
        int resource_type_id FK
        int quantity
        float weight_kg
    }
    DISTRIBUTION_PLAN {
        int id PK
        string plan_code UK "PLN-2026-NNNNN"
        int created_by FK
        enum status
        enum scope
        int scope_id "nullable"
        datetime created_at
    }
    DISTRIBUTION_PLAN_ITEM {
        int id PK
        int plan_id FK
        int family_id FK
        int source_warehouse_id FK
        int target_coverage_days
        enum status
        int delivery_id FK "nullable"
    }
    DELIVERY {
        int id PK
        string delivery_code UK "ENT-2026-NNNNN"
        int family_id FK
        int source_warehouse_id FK
        int delivered_by FK
        int exception_authorized_by FK "nullable"
        datetime delivery_date
        int coverage_days "CHECK>=3"
        enum status
        float delivery_latitude
        float delivery_longitude
        string client_op_id UK "nullable"
    }
    DELIVERY_DETAIL {
        int id PK
        int delivery_id FK
        int resource_type_id FK
        int quantity
        float weight_kg
    }
    HEALTH_VECTOR {
        int id PK
        enum vector_type
        enum risk_level
        enum status "ACTIVO|EN_ATENCION|RESUELTO"
        string actions_taken
        float latitude
        float longitude
        int zone_id FK "nullable"
        int shelter_id FK "nullable"
        int reported_by FK
    }
    RELOCATION {
        int id PK
        int family_id FK
        int origin_shelter_id FK
        int destination_shelter_id FK
        enum type
        datetime relocation_date
        string reason
        int authorized_by FK
    }
```

---

## 4. Tabla de relaciones (todas binarias)

### Relaciones del usuario (USER como actor de acciones)

| ID | Relación | Cardinalidad USER | Cardinalidad opuesta | Justificación (PDF) |
|----|----------|-------------------|----------------------|---------------------|
| **R1** | `USER — registra — AUDIT_LOG` | `(1..1)` | `(0..N)` | **RF-40**: "Registrar un historial de auditoría inalterable de todas las acciones: quién hizo qué, cuándo y desde dónde." **RNF-09**, **HU-31 CA1**. Cada entrada del log se imputa a un usuario. |
| **R2** | `USER — entrega — DELIVERY` | `(1..1)` | `(0..N)` | **RF-24**: "Registrar cada entrega indicando a qué familia, desde qué bodega, qué recursos, en qué cantidad, **quién entregó** y quién recibió." **HU-22 CA2**. El operador que realiza la entrega queda identificado. |
| **R3** | `USER — autoriza excepción — DELIVERY` | `(0..1)` | `(0..N)` | **RN-02** + **HU-23 CA5**: "Solo un coordinador puede autorizar excepcionalmente una entrega anticipada, con justificación obligatoria registrada." Relación opcional: sólo aplica a entregas-excepción. |
| **R4** | `USER — crea — DISTRIBUTION_PLAN` | `(1..1)` | `(0..N)` | **RF-22** + **HU-21**: "Como coordinador de logística, quiero que el sistema genere automáticamente un plan de distribución". El plan registra quién lo solicitó/creó. |
| **R5** | `USER — reporta — HEALTH_VECTOR` | `(1..1)` | `(0..N)` | **RF-31** + **HU-25**: "Registrar focos de riesgo sanitario por zona o refugio indicando el tipo de vector, nivel de riesgo y **acciones tomadas**"; la auditoría (HU-25 CA4) exige trazabilidad del autor. |
| **R6** | `USER — autoriza — RELOCATION` | `(1..1)` | `(0..N)` | **RF-30** + **HU-24 CA5**: "El traslado queda en el historial de auditoría con usuario y fecha." El usuario que autoriza el traslado queda registrado. |
| **R7** | `USER — recoge consentimiento — PRIVACY_CONSENT` | `(1..1)` | `(0..N)` | **RN-09** + **HU-04 CA3**: "El sistema solicita la aceptación del aviso de privacidad (Ley 1581/2012) antes de guardar." El censador que recogió el consentimiento queda registrado. |
| **R8** | `USER — ajusta — INVENTORY_ADJUSTMENT` | `(1..1)` | `(0..N)` | **RF-16** + **HU-17 CA2**: "El ajuste queda registrado en el historial de auditoría con fecha, hora y usuario." |
| **R9** | `USER — configura — SCORING_CONFIG` | `(1..1)` | `(0..N)` | **RN-04** + **HU-08 CA5**: "La fórmula de puntaje puede ajustarse por el coordinador sin modificar código (parámetros configurables)." Se audita quién modificó los pesos. |
| **R10** | `USER — configura umbrales — ALERT_THRESHOLD` | `(1..1)` | `(0..N)` | **HU-16 CA2**: "El umbral de alerta es configurable por tipo de recurso." Queda registrado quién lo configuró. |

### Relaciones geográficas (ZONE/SHELTER)

| ID | Relación | Cardinalidad 1 | Cardinalidad 2 | Justificación |
|----|----------|----------------|----------------|---------------|
| **R11** | `ZONE — contiene — SHELTER` | `ZONE (1..1)` | `SHELTER (0..N)` | **RF-08** + **RF-09**: "Registrar las zonas geográficas afectadas [...] Registrar refugios temporales con su ubicación". Cada refugio se enmarca en una zona para planificación logística (HU-09, HU-10). |
| **R12** | `ZONE — ubica — FAMILY` | `ZONE (1..1)` | `FAMILY (0..N)` | **RF-01**: "Registrar familias afectadas indicando dónde se encuentran". La zona es obligatoria para calcular el riesgo en el puntaje (**RN-04**: "nivel de riesgo de la zona donde están ubicados"). |
| **R13** | `ZONE — alberga — WAREHOUSE` | `ZONE (1..1)` | `WAREHOUSE (0..N)` | **RF-10**: "Registrar las bodegas [...] con su ubicación"; **RF-11**: "Identificar la bodega más cercana" — la asociación bodega-zona permite análisis logístico. |
| **R14** | `ZONE — localiza — HEALTH_VECTOR` | `ZONE (0..1)` | `HEALTH_VECTOR (0..N)` | **RF-31** + **HU-25 CA1**: "El formulario incluye: zona o refugio afectado" — un vector puede asociarse a una zona o a un refugio (al menos a uno de los dos). |
| **R15** | `SHELTER — aloja — FAMILY` | `SHELTER (0..1)` | `FAMILY (0..N)` | **RF-09** + **HU-10 CA3**: "Se puede actualizar la ocupación actual del refugio" + **Sección 3 - Desplazados en refugios: ~10.000 personas**. La relación es opcional porque no toda familia está en refugio. |
| **R16** | `SHELTER — puede ubicar — HEALTH_VECTOR` | `SHELTER (0..1)` | `HEALTH_VECTOR (0..N)` | **RF-31** + **HU-25 CA1**: el vector puede estar asociado a refugio o zona. Relación opcional. |
| **R17** | `SHELTER — es origen — RELOCATION` | `SHELTER (1..1)` | `RELOCATION (0..N)` | **RF-30** + **HU-24 CA1**: "El formulario incluye: familia, refugio de origen, refugio de destino". Todo traslado tiene origen. |
| **R18** | `SHELTER — es destino — RELOCATION` | `SHELTER (1..1)` | `RELOCATION (0..N)` | **RF-30** + **HU-24 CA3**: "La ocupación de ambos refugios (origen y destino) se actualiza". Todo traslado tiene destino. |

### Relaciones del censo (FAMILY/PERSON)

| ID | Relación | Cardinalidad 1 | Cardinalidad 2 | Justificación |
|----|----------|----------------|----------------|---------------|
| **R19** | `FAMILY — tiene — PERSON` | `FAMILY (1..1)` | `PERSON (1..N)` | **RF-02**: "Registrar a cada persona dentro de la familia" + **HU-05 CA1**: "Se pueden registrar múltiples personas asociadas a una familia ya creada." Una familia tiene como mínimo 1 miembro (el representante — HU-07 CA2: "No se puede eliminar a un integrante si ya tiene entregas asociadas"). |
| **R20** | `FAMILY — otorga — PRIVACY_CONSENT` | `FAMILY (1..1)` | `PRIVACY_CONSENT (1..1)` | **RN-09**: "Todo registro de familia debe incluir la aceptación del aviso de privacidad conforme a la Ley 1581/2012." Relación **1:1 obligatoria** — sin consentimiento no existe familia. |
| **R21** | `FAMILY — recibe — DELIVERY` | `FAMILY (1..1)` | `DELIVERY (0..N)` | **RF-24**: "Registrar cada entrega indicando **a qué familia**"; **RF-36**: "Listar familias que no han recibido ayuda" (0..N). Una familia puede tener 0 (aún sin atender) o muchas entregas. |
| **R22** | `FAMILY — se traslada — RELOCATION` | `FAMILY (1..1)` | `RELOCATION (0..N)` | **RF-30** + **HU-24 CA2**: "El traslado queda registrado en el historial de la familia." |
| **R23** | `FAMILY — es asignada en — DISTRIBUTION_PLAN_ITEM` | `FAMILY (1..1)` | `DISTRIBUTION_PLAN_ITEM (0..N)` | **RF-22** + **HU-21**: "Un plan de distribución asigna recursos a las familias de mayor prioridad." Una familia puede aparecer en múltiples planes en distintas fechas. |

### Relaciones de inventario (WAREHOUSE/RESOURCE_TYPE)

| ID | Relación | Cardinalidad 1 | Cardinalidad 2 | Justificación |
|----|----------|----------------|----------------|---------------|
| **R24** | `WAREHOUSE — almacena — INVENTORY` | `WAREHOUSE (1..1)` | `INVENTORY (0..N)` | **RF-14**: "Consultar cuánto hay disponible de cada recurso **en cada bodega**." Cada línea de inventario pertenece a exactamente una bodega. |
| **R25** | `WAREHOUSE — recibe donaciones — DONATION` | `WAREHOUSE (1..1)` | `DONATION (0..N)` | **RF-19**: "Registrar cada donación indicando [...] **a qué bodega llegó**." Toda donación tiene bodega destino (para donaciones en especie/mixtas). |
| **R26** | `WAREHOUSE — origina — DELIVERY` | `WAREHOUSE (1..1)` | `DELIVERY (0..N)` | **RF-24**: "Registrar cada entrega indicando [...] **desde qué bodega**." Toda entrega sale de una bodega específica. |
| **R27** | `WAREHOUSE — suministra — DISTRIBUTION_PLAN_ITEM` | `WAREHOUSE (1..1)` | `DISTRIBUTION_PLAN_ITEM (0..N)` | **HU-21 CA4**: "El plan atiende primero las más prioritarias y genera alerta de familias sin atender" — cada ítem del plan indica qué bodega suministra. |
| **R28** | `RESOURCE_TYPE — se cuantifica en — INVENTORY` | `RESOURCE_TYPE (1..1)` | `INVENTORY (0..N)` | **RF-13** + **RF-14**: "Registrar los tipos de recursos disponibles [...] Consultar cuánto hay disponible de cada recurso". Cada línea de inventario referencia exactamente un tipo. |
| **R29** | `RESOURCE_TYPE — se especifica en — DONATION_DETAIL` | `RESOURCE_TYPE (1..1)` | `DONATION_DETAIL (0..N)` | **RF-20**: "Desglosar los recursos que componen una donación en especie (qué tipo de recurso y cuánto)." |
| **R30** | `RESOURCE_TYPE — se despacha en — DELIVERY_DETAIL` | `RESOURCE_TYPE (1..1)` | `DELIVERY_DETAIL (0..N)` | **RF-24** + **RF-27**: "Registrar cada entrega indicando [...] qué recursos, en qué cantidad" + "Descontar automáticamente del inventario lo que se entregó" — requiere especificar tipo de recurso por ítem. |
| **R31** | `RESOURCE_TYPE — tiene umbral — ALERT_THRESHOLD` | `RESOURCE_TYPE (1..1)` | `ALERT_THRESHOLD (0..1)` | **RF-15** + **HU-16 CA2**: "El umbral de alerta es configurable por tipo de recurso." Cada recurso tiene como máximo un umbral activo (opcional). |
| **R32** | `INVENTORY — registra ajustes — INVENTORY_ADJUSTMENT` | `INVENTORY (1..1)` | `INVENTORY_ADJUSTMENT (0..N)` | **RF-16** + **HU-17 CA1**: "Ajustar manualmente el inventario cuando haya correcciones (merma, daño, devolución)." El ajuste aplica a una línea de inventario específica. |

### Relaciones de donaciones

| ID | Relación | Cardinalidad 1 | Cardinalidad 2 | Justificación |
|----|----------|----------------|----------------|---------------|
| **R33** | `DONOR — aporta — DONATION` | `DONOR (1..1)` | `DONATION (0..N)` | **RF-18** + **RF-19** + **RF-21**: "Registrar donantes [...] Registrar cada donación indicando **quién la hizo** [...] Consultar el historial completo de donaciones por donante." |
| **R34** | `DONATION — desglosa — DONATION_DETAIL` | `DONATION (1..1)` | `DONATION_DETAIL (0..N)` | **RF-20**: "Desglosar los recursos que componen una donación en especie." Relación 0..N porque las donaciones monetarias (HU-19 CA2) no tienen detalle. |

### Relaciones de distribución

| ID | Relación | Cardinalidad 1 | Cardinalidad 2 | Justificación |
|----|----------|----------------|----------------|---------------|
| **R35** | `DELIVERY — detalla — DELIVERY_DETAIL` | `DELIVERY (1..1)` | `DELIVERY_DETAIL (1..N)` | **RF-24** + **RN-01** + **HU-22 CA2**: "Registrar cada entrega indicando [...] qué recursos, en qué cantidad" + "Cada entrega de alimentos debe cubrir al menos 3 días." No puede existir entrega sin ítems. |
| **R36** | `DISTRIBUTION_PLAN — compone — DISTRIBUTION_PLAN_ITEM` | `DISTRIBUTION_PLAN (1..1)` | `DISTRIBUTION_PLAN_ITEM (1..N)` | **RF-22** + **HU-21 CA1-2**: "El plan incluye solo familias cuya cobertura anterior ha expirado [...] las familias se ordenan de mayor a menor puntaje de prioridad." Un plan sin asignaciones no tendría razón de existir. |
| **R37** | `DISTRIBUTION_PLAN_ITEM — se materializa en — DELIVERY` | `DISTRIBUTION_PLAN_ITEM (0..1)` | `DELIVERY (0..1)` | **HU-21 CA5** + **HU-22**: "El plan queda guardado con estado 'programada' y es visible para los operadores" — la materialización convierte un ítem en una entrega. La relación es 0..1 en ambos lados porque (a) un ítem puede estar aún PENDIENTE (sin delivery) o SIN_ATENDER, y (b) una entrega puede crearse fuera de un plan (entrega individual o batch). |

---

## 5. Segmentación binaria de conceptos ternarios

El sistema contiene varios conceptos que parecen ternarios en el discurso natural del PDF. A continuación se documenta cómo se segmenta cada uno en relaciones binarias mediante entidades asociativas.

### 5.1 "Donación de un tipo de recurso con cantidad"
**Discurso (RF-20)**: "Desglosar los recursos que componen una donación en especie (qué tipo de recurso y cuánto)."

Concepto ternario candidato: `DONATION × RESOURCE_TYPE × Cantidad`.
**Segmentación**: se extrae la entidad asociativa `DONATION_DETAIL` con atributos propios (`quantity`, `weight_kg`).

```
DONATION (1..1) ── desglosa ── (0..N) DONATION_DETAIL (0..N) ── se especifica ── (1..1) RESOURCE_TYPE
```

### 5.2 "Entrega de recursos a una familia"
**Discurso (RF-24)**: "Registrar cada entrega indicando a qué familia, **desde qué bodega**, qué recursos, en qué cantidad, quién entregó y quién recibió."

Concepto cuaternario candidato: `FAMILY × WAREHOUSE × RESOURCE_TYPE × USER`.
**Segmentación**:
1. `DELIVERY` agrupa los atributos comunes (fecha, estado, ubicación, coverage_days) y se conecta con `FAMILY`, `WAREHOUSE`, `USER` (entregador) y opcionalmente `USER` (autorizador de excepción).
2. `DELIVERY_DETAIL` resuelve la relación N:M con `RESOURCE_TYPE`.

```
FAMILY (1..1) ── recibe ── (0..N) DELIVERY (0..N) ── origina ── (1..1) WAREHOUSE
DELIVERY (1..1) ── entrega ── (1..1) USER
DELIVERY (1..1) ── detalla ── (1..N) DELIVERY_DETAIL (0..N) ── se despacha ── (1..1) RESOURCE_TYPE
```

### 5.3 "Stock de un recurso en una bodega"
**Discurso (RF-14)**: "Consultar cuánto hay disponible de cada recurso en cada bodega."

Concepto ternario implícito: `WAREHOUSE × RESOURCE_TYPE × (cantidad, lote, expiración)`.
**Segmentación**: entidad asociativa `INVENTORY` con atributos propios y clave compuesta (warehouse_id, resource_type_id, batch).

```
WAREHOUSE (1..1) ── almacena ── (0..N) INVENTORY (0..N) ── se cuantifica ── (1..1) RESOURCE_TYPE
```

### 5.4 "Plan que asigna familia + bodega"
**Discurso (RF-22 + HU-21)**: "Generar un plan de distribución que asigne recursos a las familias de mayor prioridad **según lo disponible en las bodegas**."

Concepto ternario: `PLAN × FAMILY × WAREHOUSE`.
**Segmentación**: entidad asociativa `DISTRIBUTION_PLAN_ITEM` con atributos propios (`target_coverage_days`, `status`), que además se puede materializar como 0..1 `DELIVERY`.

```
DISTRIBUTION_PLAN (1..1) ── compone ── (1..N) DISTRIBUTION_PLAN_ITEM (0..N) ── asigna ── (1..1) FAMILY
DISTRIBUTION_PLAN_ITEM (0..N) ── suministra ── (1..1) WAREHOUSE
DISTRIBUTION_PLAN_ITEM (0..1) ── se materializa ── (0..1) DELIVERY
```

### 5.5 "Vector sanitario en zona o refugio"
**Discurso (RF-31 + HU-25)**: "Registrar focos de riesgo sanitario **por zona o refugio**".

Concepto de **disyunción exclusiva opcional** (XOR parcial): un vector se asocia con zona, con refugio, con ambos, o (teóricamente) con ninguno. Se modela con dos relaciones binarias independientes opcionales.

```
ZONE (0..1) ── localiza ── (0..N) HEALTH_VECTOR (0..N) ── puede ubicar ── (0..1) SHELTER
```

Restricción: al menos una de las dos FK debe estar presente (CHECK a nivel BD).

### 5.6 "Traslado con origen y destino"
**Discurso (RF-30 + HU-24)**: "Registrar el traslado de familias entre refugios (temporal o definitivo)."

Concepto ternario: `FAMILY × SHELTER_ORIGEN × SHELTER_DESTINO`.
**Segmentación**: `RELOCATION` mantiene dos relaciones binarias a `SHELTER` (con roles diferenciados) y una a `FAMILY`.

```
FAMILY (1..1) ── se traslada ── (0..N) RELOCATION (0..N) ── es origen ── (1..1) SHELTER
RELOCATION (0..N) ── es destino ── (1..1) SHELTER
```

Restricción: `origin_shelter_id ≠ destination_shelter_id`.

---

## 6. Restricciones adicionales derivadas de las reglas de negocio

| Regla PDF | Restricción impuesta al modelo |
|-----------|--------------------------------|
| **RN-01 / RF-26** — Cobertura mínima 3 días | `DELIVERY.coverage_days ≥ 3` (CHECK) |
| **RN-02 / RF-25** — Prevención duplicidad | No se permite nueva `DELIVERY` para `FAMILY` con cobertura vigente, salvo excepción autorizada (R3) |
| **RN-03 / RF-10** — Capacidad de bodega | `WAREHOUSE.current_weight_kg ≤ WAREHOUSE.max_capacity_kg` |
| **RN-05 / RF-27** — Descuento automático | Transacción atómica: `DELIVERY_DETAIL.quantity` decrementa `INVENTORY.available_quantity` en la misma operación |
| **RN-07** — Códigos secuenciales | `FAMILY.family_code`, `DONATION.donation_code`, `DELIVERY.delivery_code`, `DISTRIBUTION_PLAN.plan_code` → UNIQUE + formato |
| **RN-08** — Recálculo prioridad | `FAMILY.priority_score` y `priority_score_breakdown` recalculados en triggers (ver §7 del PLAN) |
| **RN-09 / RF-06** — Aviso privacidad | `PRIVACY_CONSENT` obligatorio (cardinalidad `(1..1)` en R20) |
| **RN-10** | `SHELTER.latitude`, `SHELTER.longitude`, `WAREHOUSE.latitude`, `WAREHOUSE.longitude` **NOT NULL**; `FAMILY.latitude/longitude` **NULL permitido** |
| **RNF-09 / RF-40** — Inalterabilidad | `AUDIT_LOG` sin permisos UPDATE/DELETE para el rol de BD de la aplicación |

---

## 7. Resumen de cardinalidades (cuadro sinóptico)

| Relación | Lado izquierdo | Lado derecho |
|----------|----------------|--------------|
| R1 USER ↔ AUDIT_LOG | (1..1) | (0..N) |
| R2 USER ↔ DELIVERY (entregador) | (1..1) | (0..N) |
| R3 USER ↔ DELIVERY (autorizador excepción) | (0..1) | (0..N) |
| R4 USER ↔ DISTRIBUTION_PLAN | (1..1) | (0..N) |
| R5 USER ↔ HEALTH_VECTOR | (1..1) | (0..N) |
| R6 USER ↔ RELOCATION | (1..1) | (0..N) |
| R7 USER ↔ PRIVACY_CONSENT | (1..1) | (0..N) |
| R8 USER ↔ INVENTORY_ADJUSTMENT | (1..1) | (0..N) |
| R9 USER ↔ SCORING_CONFIG | (1..1) | (0..N) |
| R10 USER ↔ ALERT_THRESHOLD | (1..1) | (0..N) |
| R11 ZONE ↔ SHELTER | (1..1) | (0..N) |
| R12 ZONE ↔ FAMILY | (1..1) | (0..N) |
| R13 ZONE ↔ WAREHOUSE | (1..1) | (0..N) |
| R14 ZONE ↔ HEALTH_VECTOR | (0..1) | (0..N) |
| R15 SHELTER ↔ FAMILY | (0..1) | (0..N) |
| R16 SHELTER ↔ HEALTH_VECTOR | (0..1) | (0..N) |
| R17 SHELTER ↔ RELOCATION (origen) | (1..1) | (0..N) |
| R18 SHELTER ↔ RELOCATION (destino) | (1..1) | (0..N) |
| R19 FAMILY ↔ PERSON | (1..1) | (1..N) |
| R20 FAMILY ↔ PRIVACY_CONSENT | (1..1) | (1..1) |
| R21 FAMILY ↔ DELIVERY | (1..1) | (0..N) |
| R22 FAMILY ↔ RELOCATION | (1..1) | (0..N) |
| R23 FAMILY ↔ DISTRIBUTION_PLAN_ITEM | (1..1) | (0..N) |
| R24 WAREHOUSE ↔ INVENTORY | (1..1) | (0..N) |
| R25 WAREHOUSE ↔ DONATION | (1..1) | (0..N) |
| R26 WAREHOUSE ↔ DELIVERY | (1..1) | (0..N) |
| R27 WAREHOUSE ↔ DISTRIBUTION_PLAN_ITEM | (1..1) | (0..N) |
| R28 RESOURCE_TYPE ↔ INVENTORY | (1..1) | (0..N) |
| R29 RESOURCE_TYPE ↔ DONATION_DETAIL | (1..1) | (0..N) |
| R30 RESOURCE_TYPE ↔ DELIVERY_DETAIL | (1..1) | (0..N) |
| R31 RESOURCE_TYPE ↔ ALERT_THRESHOLD | (1..1) | (0..1) |
| R32 INVENTORY ↔ INVENTORY_ADJUSTMENT | (1..1) | (0..N) |
| R33 DONOR ↔ DONATION | (1..1) | (0..N) |
| R34 DONATION ↔ DONATION_DETAIL | (1..1) | (0..N) |
| R35 DELIVERY ↔ DELIVERY_DETAIL | (1..1) | (1..N) |
| R36 DISTRIBUTION_PLAN ↔ DISTRIBUTION_PLAN_ITEM | (1..1) | (1..N) |
| R37 DISTRIBUTION_PLAN_ITEM ↔ DELIVERY | (0..1) | (0..1) |

---

## 8. Reglas de participación totales vs. parciales

- **Participación total (obligatoria)** — toda instancia de la entidad participa en la relación:
  - `FAMILY` en R20 (toda familia tiene consentimiento).
  - `FAMILY` en R19 (toda familia tiene al menos un miembro — el representante).
  - `DELIVERY` en R35 (toda entrega tiene al menos un ítem).
  - `DISTRIBUTION_PLAN` en R36 (todo plan tiene al menos un ítem).
  - `DONATION` en R25 (toda donación referencia una bodega, incluso las monetarias, por trazabilidad del origen).
- **Participación parcial (opcional)** — es posible que una instancia no participe:
  - `FAMILY` en R15 (una familia puede no estar en refugio).
  - `FAMILY` en R21 (una familia puede no haber recibido entregas — RF-36).
  - `HEALTH_VECTOR` en R14 y R16 (al menos una, pero no ambas obligatoriamente — ver CHECK en 5.5).
  - `RESOURCE_TYPE` en R31 (un recurso puede no tener umbral configurado todavía).

---

## 9. Referencias al PDF

Todas las justificaciones de este documento referencian el **PDF "Síntesis de Requerimientos — SGAH, Iteración 3, Abril 2026"**, secciones:
- **4.1 Registro de Familias y Personas** — RF-01 a RF-07
- **4.2 Ubicación Geográfica** — RF-08 a RF-12
- **4.3 Inventario de Recursos** — RF-13 a RF-17
- **4.4 Donaciones** — RF-18 a RF-21
- **4.5 Distribución de Ayudas** — RF-22 a RF-30
- **4.6 Monitoreo de Salubridad** — RF-31, RF-32
- **4.7 Reportes y Transparencia** — RF-33 a RF-40
- **4.8 Acceso y Seguridad** — RF-41 a RF-44
- **6. Reglas de Negocio** — RN-01 a RN-10
- **8. Historias de Usuario** — HU-01 a HU-31
