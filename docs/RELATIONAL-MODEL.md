# Modelo Relacional — SGAH

> **Sistema de Gestión y Distribución de Ayudas Humanitarias**
> Inundaciones Montería, Córdoba — 2026 · Iteración 3
>
> Modelo relacional derivado del Diagrama Entidad-Relación (`ERD.md`) y del PDF "Síntesis de Requerimientos — SGAH" (Iteración 3, Abril 2026). Normalizado hasta **3FN**.

---

## 1. Convenciones

- **Notación**: `TABLA(atributo_pk, atributo, ..., atributo_fk)`.
- **Subrayado** (`_atributo_`): clave primaria (PK). Si es compuesta, todos sus componentes aparecen subrayados.
- **PK compuesta**: se indica al inicio de cada tabla debajo del nombre.
- **FK**: se listan en la sección *Foreign Keys* de cada tabla. Notación: `atributo → TABLA_REFERENCIADA(atributo_referenciado)`.
- **Restricciones**: UNIQUE (UK), NOT NULL (NN), CHECK (CK), DEFAULT (DF).
- **Dominios**: tipos de datos del modelo físico (PostgreSQL). Enums se listan explícitamente.
- Todo `id` PK es `BIGSERIAL` salvo que se indique.
- Timestamps `created_at` y `updated_at` son `TIMESTAMP(3) NOT NULL`; `updated_at` se actualiza por trigger.

---

## 2. Dominios (ENUMs)

| Enum | Valores |
|------|---------|
| `ROLE` | ADMIN, CENSADOR, OPERADOR_ENTREGAS, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL, REGISTRADOR_DONACIONES |
| `RISK_LEVEL` | LOW, MEDIUM, HIGH, CRITICAL |
| `FAMILY_STATUS` | ACTIVO, EN_REFUGIO, EVACUADO |
| `RELATIONSHIP` | ESPOSO_A, HIJO_A, PADRE_MADRE, HERMANO_A, OTRO |
| `SPECIAL_CONDITION` | CHILD_UNDER_5, ELDERLY_OVER_65, PREGNANT, DISABLED, REQUIRES_MEDICATION |
| `SHELTER_TYPE` | SCHOOL, SPORTS_CENTER, CHURCH, COMMUNITY_CENTER, OTHER |
| `WAREHOUSE_STATUS` | ACTIVE, INACTIVE |
| `RESOURCE_CATEGORY` | FOOD, BLANKET, MATTRESS, HYGIENE, MEDICATION |
| `DONOR_TYPE` | PERSONA_NATURAL, EMPRESA, ALCALDIA, GOBERNACION, ORGANIZACION |
| `DONATION_TYPE` | IN_KIND, MONETARY, MIXED |
| `PLAN_STATUS` | PROGRAMADA, EN_EJECUCION, COMPLETADA, CANCELADA |
| `PLAN_SCOPE` | GLOBAL, ZONA, REFUGIO, LOTE |
| `PLAN_ITEM_STATUS` | PENDIENTE, ENTREGADO, SIN_ATENDER |
| `DELIVERY_STATUS` | PROGRAMADA, EN_CURSO, ENTREGADA |
| `VECTOR_TYPE` | AGUA_CONTAMINADA, INSECTOS, ROEDORES, OTRO |
| `VECTOR_STATUS` | ACTIVO, EN_ATENCION, RESUELTO |
| `RELOCATION_TYPE` | TEMPORARY, PERMANENT |
| `ADJUSTMENT_REASON` | MERMA, DANO, DEVOLUCION, CORRECCION |

---

## 3. Esquema relacional (22 tablas)

### T1. USERS

```
USERS(_id_, email, name, password_hash, role, is_active,
      failed_login_attempts, locked_until, last_login_at,
      password_must_change, created_at, updated_at)
```

| Atributo | Tipo | Restricciones | Notas |
|----------|------|---------------|-------|
| id | BIGSERIAL | **PK** | |
| email | VARCHAR(120) | UK, NN | índice |
| name | VARCHAR(120) | NN | HU-01 CA1 |
| password_hash | VARCHAR(80) | NN | bcrypt |
| role | ROLE | NN, DF 'FUNCIONARIO_CONTROL' | RF-43 |
| is_active | BOOLEAN | NN, DF TRUE | RF-41 |
| failed_login_attempts | SMALLINT | NN, DF 0 | HU-02 CA5 |
| locked_until | TIMESTAMP(3) | NULL | HU-02 CA5 |
| last_login_at | TIMESTAMP(3) | NULL | |
| password_must_change | BOOLEAN | NN, DF FALSE | HU-01 CA5, HU-03 |
| created_at | TIMESTAMP(3) | NN, DF now() | |
| updated_at | TIMESTAMP(3) | NN | |

**Justificación**: RF-41 (crear/modificar/desactivar), RF-42 (credenciales), RF-43 (rol), RF-44 (cambiar contraseña), HU-01, HU-02, HU-03.

---

### T2. AUDIT_LOGS

```
AUDIT_LOGS(_id_, action, module, entity, entity_id,
           user_id, before, after, ip_address, user_agent, created_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| action | VARCHAR(50) | NN (`CREATE`/`UPDATE`/`DELETE`/`LOGIN`/`EXCEPTION`...) |
| module | VARCHAR(50) | NN |
| entity | VARCHAR(80) | NN |
| entity_id | BIGINT | NULL (para acciones sin entidad concreta) |
| user_id | BIGINT | FK → USERS(id), NN |
| before | JSONB | NULL |
| after | JSONB | NULL |
| ip_address | INET | NULL |
| user_agent | VARCHAR(255) | NULL |
| created_at | TIMESTAMP(3) | NN, DF now() |

**Foreign Keys**: `user_id → USERS(id)` ON DELETE RESTRICT.

**Restricciones adicionales**: a nivel BD, el rol de aplicación **NO** tiene permisos UPDATE ni DELETE sobre esta tabla.

**Justificación**: RF-40, RNF-09, HU-31 CA1-CA4 ("El historial registra: tipo de acción, usuario, fecha y hora, datos antes y después del cambio, y dispositivo/IP de origen; ningún usuario puede modificarlo").

---

### T3. SCORING_CONFIG

```
SCORING_CONFIG(_key_, value, updated_by, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| key | VARCHAR(40) | **PK** (`W_MEMBERS`, `W_CHILDREN_5`, `W_ADULTS_65`, `W_PREGNANT`, `W_DISABLED`, `W_ZONE_RISK`, `W_DAYS_NO_AID`, `W_DELIVERIES`, `MAX_DAYS`) |
| value | DECIMAL(10,3) | NN |
| updated_by | BIGINT | FK → USERS(id), NN |
| updated_at | TIMESTAMP(3) | NN |

**Justificación**: RN-04 + HU-08 CA5 ("La fórmula de puntaje puede ajustarse por el coordinador sin modificar código - parámetros configurables").

---

### T4. ALERT_THRESHOLDS

```
ALERT_THRESHOLDS(_id_, resource_type_id, min_quantity, updated_by, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| resource_type_id | BIGINT | FK, UK, NN |
| min_quantity | INTEGER | NN, CK (≥ 0) |
| updated_by | BIGINT | FK → USERS(id), NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**: `resource_type_id → RESOURCE_TYPES(id)` ON DELETE CASCADE.

**Justificación**: RF-15 ("alertas cuando un recurso esté por agotarse") + HU-16 CA2 ("El umbral de alerta es configurable por tipo de recurso").

---

### T5. ZONES

```
ZONES(_id_, name, risk_level, latitude, longitude, estimated_population,
      created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| name | VARCHAR(120) | UK, NN |
| risk_level | RISK_LEVEL | NN |
| latitude | DECIMAL(9,6) | NN, CK (between -90 and 90) |
| longitude | DECIMAL(9,6) | NN, CK (between -180 and 180) |
| estimated_population | INTEGER | NN, CK (≥ 0) |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Justificación**: RF-08 ("Registrar las zonas geográficas afectadas con su nombre, nivel de riesgo y población estimada") + HU-09.

---

### T6. SHELTERS

```
SHELTERS(_id_, name, address, zone_id, type, max_capacity, current_occupancy,
         latitude, longitude, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| name | VARCHAR(150) | NN |
| address | VARCHAR(255) | NN |
| zone_id | BIGINT | FK, NN |
| type | SHELTER_TYPE | NN |
| max_capacity | INTEGER | NN, CK (> 0) |
| current_occupancy | INTEGER | NN, DF 0, CK (≥ 0 AND ≤ max_capacity) |
| latitude | DECIMAL(9,6) | NN |
| longitude | DECIMAL(9,6) | NN |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**: `zone_id → ZONES(id)` ON DELETE RESTRICT.

**Restricciones adicionales**: UK (name, zone_id).

**Justificación**: RF-09 + HU-10 + RN-10 ("Refugios y bodegas deben registrar su ubicación exacta al crearse").

---

### T7. FAMILIES

```
FAMILIES(_id_, family_code, head_document, zone_id, shelter_id, num_members,
         num_children_under_5, num_adults_over_65, num_pregnant, num_disabled,
         priority_score, priority_score_breakdown, status,
         latitude, longitude, reference_address, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| family_code | VARCHAR(20) | UK, NN, CK (formato `FAM-\d{4}-\d{5}`) |
| head_document | VARCHAR(30) | NN |
| zone_id | BIGINT | FK, NN |
| shelter_id | BIGINT | FK, NULL |
| num_members | INTEGER | NN, CK (> 0) |
| num_children_under_5 | INTEGER | NN, DF 0, CK (≥ 0) |
| num_adults_over_65 | INTEGER | NN, DF 0, CK (≥ 0) |
| num_pregnant | INTEGER | NN, DF 0, CK (≥ 0) |
| num_disabled | INTEGER | NN, DF 0, CK (≥ 0) |
| priority_score | DECIMAL(10,3) | NN, DF 0 |
| priority_score_breakdown | JSONB | NULL |
| status | FAMILY_STATUS | NN, DF 'ACTIVO' |
| latitude | DECIMAL(9,6) | NULL |
| longitude | DECIMAL(9,6) | NULL |
| reference_address | VARCHAR(255) | NULL |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**:
- `zone_id → ZONES(id)` ON DELETE RESTRICT
- `shelter_id → SHELTERS(id)` ON DELETE SET NULL

**Justificación**: RF-01 (registrar familia), RF-03 (código único `FAM-2026-NNNNN`), RF-04 (puntaje), RF-05 (actualizar), RN-07 (códigos secuenciales), RN-10 (coords opcionales para familia), HU-04, HU-07, HU-08 CA2 (breakdown por factor).

---

### T8. PERSONS

```
PERSONS(_id_, family_id, name, document, birth_date, gender, relationship,
        special_conditions, requires_medication, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| family_id | BIGINT | FK, NN |
| name | VARCHAR(120) | NN |
| document | VARCHAR(30) | UK, NN |
| birth_date | DATE | NN |
| gender | CHAR(1) | NN, CK (IN 'M','F','O') |
| relationship | RELATIONSHIP | NN |
| special_conditions | SPECIAL_CONDITION[] | NN, DF '{}' |
| requires_medication | BOOLEAN | NN, DF FALSE |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**: `family_id → FAMILIES(id)` ON DELETE RESTRICT.

**Restricciones adicionales**: trigger BEFORE DELETE — no permite eliminar el último miembro de una familia activa (HU-07 CA2).

**Justificación**: RF-02 (nombre, documento, edad, parentesco, condición especial), HU-05.

---

### T9. PRIVACY_CONSENTS

```
PRIVACY_CONSENTS(_id_, family_id, accepted_at, accepted_by_user_id,
                 law_version, ip_address)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| family_id | BIGINT | FK, **UK**, NN |
| accepted_at | TIMESTAMP(3) | NN, DF now() |
| accepted_by_user_id | BIGINT | FK → USERS(id), NN |
| law_version | VARCHAR(40) | NN, DF 'Ley 1581/2012' |
| ip_address | INET | NULL |

**Foreign Keys**:
- `family_id → FAMILIES(id)` ON DELETE CASCADE
- `accepted_by_user_id → USERS(id)` ON DELETE RESTRICT

**Justificación**: RN-09 ("Todo registro de familia debe incluir la aceptación del aviso de privacidad conforme a la Ley 1581/2012"), RNF-06 (protección de datos personales), HU-04 CA3.

**Cardinalidad 1:1**: la UK sobre `family_id` garantiza exactamente un consentimiento por familia.

---

### T10. WAREHOUSES

```
WAREHOUSES(_id_, name, address, zone_id, max_capacity_kg, current_weight_kg,
           status, latitude, longitude, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| name | VARCHAR(150) | UK, NN |
| address | VARCHAR(255) | NN |
| zone_id | BIGINT | FK, NN |
| max_capacity_kg | DECIMAL(10,2) | NN, CK (> 0) |
| current_weight_kg | DECIMAL(10,2) | NN, DF 0, CK (≥ 0 AND ≤ max_capacity_kg) |
| status | WAREHOUSE_STATUS | NN, DF 'ACTIVE' |
| latitude | DECIMAL(9,6) | NN |
| longitude | DECIMAL(9,6) | NN |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**: `zone_id → ZONES(id)` ON DELETE RESTRICT.

**Justificación**: RF-10 (ubicación, capacidad máxima y peso actual), RN-03 ("Cada bodega tiene un límite de peso que no puede excederse"), RN-10 (coords obligatorias), HU-11.

---

### T11. RESOURCE_TYPES

```
RESOURCE_TYPES(_id_, name, category, unit_of_measure, unit_weight_kg,
               is_active, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| name | VARCHAR(120) | NN |
| category | RESOURCE_CATEGORY | NN |
| unit_of_measure | VARCHAR(20) | NN (`kg`, `unidad`, `litro`) |
| unit_weight_kg | DECIMAL(10,3) | NN, CK (> 0) |
| is_active | BOOLEAN | NN, DF TRUE |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Restricciones adicionales**: UK (name, category) — HU-14 CA2 ("No se puede registrar un recurso duplicado con el mismo nombre y categoría").

**Justificación**: RF-13 (tipos con categoría, unidad de medida y peso unitario), HU-14 CA4 ("Un recurso puede marcarse como inactivo si ya no se distribuye, sin eliminarse del historial").

---

### T12. INVENTORY

```
INVENTORY(_id_, warehouse_id, resource_type_id, available_quantity,
          total_weight_kg, batch, expiration_date, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| warehouse_id | BIGINT | FK, NN |
| resource_type_id | BIGINT | FK, NN |
| available_quantity | INTEGER | NN, DF 0, CK (≥ 0) |
| total_weight_kg | DECIMAL(10,2) | NN, DF 0, CK (≥ 0) |
| batch | VARCHAR(60) | NN, DF 'SIN_LOTE' |
| expiration_date | DATE | NULL |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**:
- `warehouse_id → WAREHOUSES(id)` ON DELETE RESTRICT
- `resource_type_id → RESOURCE_TYPES(id)` ON DELETE RESTRICT

**Restricciones adicionales**: UK (warehouse_id, resource_type_id, batch).

**Justificación**: RF-14 (consultar disponible por recurso y bodega) + RF-17 (resumen general), HU-15.

---

### T13. INVENTORY_ADJUSTMENTS

```
INVENTORY_ADJUSTMENTS(_id_, inventory_id, delta, reason, reason_note,
                     user_id, created_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| inventory_id | BIGINT | FK, NN |
| delta | INTEGER | NN, CK (delta ≠ 0) |
| reason | ADJUSTMENT_REASON | NN |
| reason_note | VARCHAR(255) | NN |
| user_id | BIGINT | FK → USERS(id), NN |
| created_at | TIMESTAMP(3) | NN, DF now() |

**Foreign Keys**:
- `inventory_id → INVENTORY(id)` ON DELETE RESTRICT
- `user_id → USERS(id)` ON DELETE RESTRICT

**Restricciones adicionales**: trigger que rechaza ajustes cuando `inventory.available_quantity + delta < 0` (HU-17 CA3).

**Justificación**: RF-16 ("Ajustar manualmente el inventario cuando haya correcciones — merma, daño, devolución"), HU-17.

---

### T14. DONORS

```
DONORS(_id_, name, type, contact, tax_id, is_active, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| name | VARCHAR(150) | NN |
| type | DONOR_TYPE | NN |
| contact | VARCHAR(120) | NN |
| tax_id | VARCHAR(40) | UK when not null |
| is_active | BOOLEAN | NN, DF TRUE |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Restricciones adicionales**: UK (name, type) — HU-18 CA3 ("No se puede registrar un donante duplicado con el mismo nombre y tipo").

**Justificación**: RF-18 (personas naturales, empresas, alcaldía, gobernación, organizaciones), HU-18 CA2 ("Los campos mínimos son: nombre o razón social, tipo de donante y dato de contacto").

---

### T15. DONATIONS

```
DONATIONS(_id_, donation_code, donor_id, destination_warehouse_id,
          donation_type, monetary_amount, date, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| donation_code | VARCHAR(20) | UK, NN, CK (formato `DON-\d{4}-\d{5}`) |
| donor_id | BIGINT | FK, NN |
| destination_warehouse_id | BIGINT | FK, NN |
| donation_type | DONATION_TYPE | NN |
| monetary_amount | DECIMAL(14,2) | NULL, CK (≥ 0) |
| date | TIMESTAMP(3) | NN, DF now() |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**:
- `donor_id → DONORS(id)` ON DELETE RESTRICT
- `destination_warehouse_id → WAREHOUSES(id)` ON DELETE RESTRICT

**Restricciones adicionales**: CK (donation_type='MONETARY' IMPLIES monetary_amount IS NOT NULL).

**Justificación**: RF-19 (donación con donante, bodega, tipo y fecha), RN-07 (código `DON-2026-NNNNN`), HU-19.

---

### T16. DONATION_DETAILS

```
DONATION_DETAILS(_id_, donation_id, resource_type_id, quantity, weight_kg)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| donation_id | BIGINT | FK, NN |
| resource_type_id | BIGINT | FK, NN |
| quantity | INTEGER | NN, CK (> 0) |
| weight_kg | DECIMAL(10,2) | NN, CK (≥ 0) |

**Foreign Keys**:
- `donation_id → DONATIONS(id)` ON DELETE CASCADE
- `resource_type_id → RESOURCE_TYPES(id)` ON DELETE RESTRICT

**Restricciones adicionales**: UK (donation_id, resource_type_id).

**Justificación**: RF-20 ("Desglosar los recursos que componen una donación en especie — qué tipo de recurso y cuánto"), HU-19 CA2.

---

### T17. DISTRIBUTION_PLANS

```
DISTRIBUTION_PLANS(_id_, plan_code, created_by, status, scope, scope_id,
                   notes, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| plan_code | VARCHAR(20) | UK, NN, CK (formato `PLN-\d{4}-\d{5}`) |
| created_by | BIGINT | FK → USERS(id), NN |
| status | PLAN_STATUS | NN, DF 'PROGRAMADA' |
| scope | PLAN_SCOPE | NN, DF 'GLOBAL' |
| scope_id | BIGINT | NULL (FK blanda según scope) |
| notes | TEXT | NULL |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**: `created_by → USERS(id)` ON DELETE RESTRICT.

**Restricciones adicionales**: CK (scope='GLOBAL' IMPLIES scope_id IS NULL; ELSE scope_id IS NOT NULL).

**Justificación**: RF-22 (plan priorizado según stock), RF-23 (entrega por lote), HU-21 CA5-6 ("El plan queda guardado con estado 'programada'... se puede generar el plan para un grupo específico por zona, refugio o lote").

---

### T18. DISTRIBUTION_PLAN_ITEMS

```
DISTRIBUTION_PLAN_ITEMS(_id_, plan_id, family_id, source_warehouse_id,
                        target_coverage_days, status, delivery_id)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| plan_id | BIGINT | FK, NN |
| family_id | BIGINT | FK, NN |
| source_warehouse_id | BIGINT | FK, NN |
| target_coverage_days | INTEGER | NN, CK (≥ 3) |
| status | PLAN_ITEM_STATUS | NN, DF 'PENDIENTE' |
| delivery_id | BIGINT | FK, NULL, UK (cuando no NULL) |

**Foreign Keys**:
- `plan_id → DISTRIBUTION_PLANS(id)` ON DELETE CASCADE
- `family_id → FAMILIES(id)` ON DELETE RESTRICT
- `source_warehouse_id → WAREHOUSES(id)` ON DELETE RESTRICT
- `delivery_id → DELIVERIES(id)` ON DELETE SET NULL

**Restricciones adicionales**: UK (plan_id, family_id) — una familia no se asigna dos veces al mismo plan.

**Justificación**: RF-22 (asignar recursos), RN-01 (cobertura mínima 3 días), HU-21 CA3 ("Cada asignación garantiza al menos 3 días de provisión"), HU-21 CA4 ("Si los recursos no alcanzan, el plan atiende primero las más prioritarias y genera alerta").

---

### T19. DELIVERIES

```
DELIVERIES(_id_, delivery_code, family_id, source_warehouse_id, delivered_by,
           exception_authorized_by, exception_reason, delivery_date,
           coverage_days, status, received_by_document,
           delivery_latitude, delivery_longitude, client_op_id,
           created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| delivery_code | VARCHAR(20) | UK, NN, CK (formato `ENT-\d{4}-\d{5}`) |
| family_id | BIGINT | FK, NN |
| source_warehouse_id | BIGINT | FK, NN |
| delivered_by | BIGINT | FK → USERS(id), NN |
| exception_authorized_by | BIGINT | FK → USERS(id), NULL |
| exception_reason | VARCHAR(255) | NULL |
| delivery_date | TIMESTAMP(3) | NN |
| coverage_days | INTEGER | NN, CK (≥ 3) |
| status | DELIVERY_STATUS | NN, DF 'PROGRAMADA' |
| received_by_document | VARCHAR(30) | NN |
| delivery_latitude | DECIMAL(9,6) | NN |
| delivery_longitude | DECIMAL(9,6) | NN |
| client_op_id | VARCHAR(50) | UK when not null |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**:
- `family_id → FAMILIES(id)` ON DELETE RESTRICT
- `source_warehouse_id → WAREHOUSES(id)` ON DELETE RESTRICT
- `delivered_by → USERS(id)` ON DELETE RESTRICT
- `exception_authorized_by → USERS(id)` ON DELETE RESTRICT

**Restricciones adicionales**:
- CK (exception_reason IS NULL) ↔ (exception_authorized_by IS NULL): ambos presentes o ambos ausentes.
- Índice sobre (family_id, delivery_date) para consulta de cobertura vigente.

**Justificación**: RF-24 (a qué familia, desde qué bodega, quién entregó y recibió), RF-26 (cobertura mínima 3 días), RF-28 (ubicación de entrega), RF-29 (estados), RN-01, RN-02, RN-07, HU-22, HU-23 CA5.

---

### T20. DELIVERY_DETAILS

```
DELIVERY_DETAILS(_id_, delivery_id, resource_type_id, quantity, weight_kg)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| delivery_id | BIGINT | FK, NN |
| resource_type_id | BIGINT | FK, NN |
| quantity | INTEGER | NN, CK (> 0) |
| weight_kg | DECIMAL(10,2) | NN, CK (≥ 0) |

**Foreign Keys**:
- `delivery_id → DELIVERIES(id)` ON DELETE CASCADE
- `resource_type_id → RESOURCE_TYPES(id)` ON DELETE RESTRICT

**Restricciones adicionales**: UK (delivery_id, resource_type_id).

**Justificación**: RF-24 (qué recursos, en qué cantidad), RF-27 (descuento automático).

---

### T21. HEALTH_VECTORS

```
HEALTH_VECTORS(_id_, vector_type, risk_level, status, actions_taken,
               latitude, longitude, zone_id, shelter_id, reported_by,
               reported_date, created_at, updated_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| vector_type | VECTOR_TYPE | NN |
| risk_level | RISK_LEVEL | NN |
| status | VECTOR_STATUS | NN, DF 'ACTIVO' |
| actions_taken | TEXT | NN |
| latitude | DECIMAL(9,6) | NN |
| longitude | DECIMAL(9,6) | NN |
| zone_id | BIGINT | FK, NULL |
| shelter_id | BIGINT | FK, NULL |
| reported_by | BIGINT | FK → USERS(id), NN |
| reported_date | TIMESTAMP(3) | NN, DF now() |
| created_at | TIMESTAMP(3) | NN |
| updated_at | TIMESTAMP(3) | NN |

**Foreign Keys**:
- `zone_id → ZONES(id)` ON DELETE SET NULL
- `shelter_id → SHELTERS(id)` ON DELETE SET NULL
- `reported_by → USERS(id)` ON DELETE RESTRICT

**Restricciones adicionales**: CK (zone_id IS NOT NULL OR shelter_id IS NOT NULL) — al menos una asociación geográfica (RF-31, HU-25 CA1).

**Justificación**: RF-31 (vectores por zona o refugio), RF-32 (visualización en mapa), HU-25, HU-26.

---

### T22. RELOCATIONS

```
RELOCATIONS(_id_, family_id, origin_shelter_id, destination_shelter_id,
            type, relocation_date, reason, authorized_by, created_at)
```

| Atributo | Tipo | Restricciones |
|----------|------|---------------|
| id | BIGSERIAL | **PK** |
| family_id | BIGINT | FK, NN |
| origin_shelter_id | BIGINT | FK, NN |
| destination_shelter_id | BIGINT | FK, NN |
| type | RELOCATION_TYPE | NN |
| relocation_date | TIMESTAMP(3) | NN, DF now() |
| reason | VARCHAR(255) | NN |
| authorized_by | BIGINT | FK → USERS(id), NN |
| created_at | TIMESTAMP(3) | NN |

**Foreign Keys**:
- `family_id → FAMILIES(id)` ON DELETE RESTRICT
- `origin_shelter_id → SHELTERS(id)` ON DELETE RESTRICT
- `destination_shelter_id → SHELTERS(id)` ON DELETE RESTRICT
- `authorized_by → USERS(id)` ON DELETE RESTRICT

**Restricciones adicionales**: CK (origin_shelter_id ≠ destination_shelter_id).

**Justificación**: RF-30 (traslado temporal o definitivo), HU-24 CA1 (familia, refugio origen, refugio destino, fecha y motivo), HU-24 CA3 (la ocupación de ambos refugios se actualiza).

---

## 4. Diagrama de tablas (resumen visual)

```
USERS ────────┬── AUDIT_LOGS
              ├── SCORING_CONFIG.updated_by
              ├── ALERT_THRESHOLDS.updated_by
              ├── PRIVACY_CONSENTS.accepted_by_user_id
              ├── INVENTORY_ADJUSTMENTS.user_id
              ├── DONATIONS (implícito vía audit)
              ├── DISTRIBUTION_PLANS.created_by
              ├── DELIVERIES.delivered_by
              ├── DELIVERIES.exception_authorized_by (nullable)
              ├── HEALTH_VECTORS.reported_by
              └── RELOCATIONS.authorized_by

ZONES ───┬── SHELTERS.zone_id
         ├── WAREHOUSES.zone_id
         ├── FAMILIES.zone_id
         └── HEALTH_VECTORS.zone_id (nullable)

SHELTERS ─┬── FAMILIES.shelter_id (nullable)
          ├── HEALTH_VECTORS.shelter_id (nullable)
          ├── RELOCATIONS.origin_shelter_id
          └── RELOCATIONS.destination_shelter_id

FAMILIES ─┬── PERSONS.family_id
          ├── PRIVACY_CONSENTS.family_id (1:1)
          ├── DELIVERIES.family_id
          ├── RELOCATIONS.family_id
          └── DISTRIBUTION_PLAN_ITEMS.family_id

WAREHOUSES ─┬── INVENTORY.warehouse_id
            ├── DONATIONS.destination_warehouse_id
            ├── DELIVERIES.source_warehouse_id
            └── DISTRIBUTION_PLAN_ITEMS.source_warehouse_id

RESOURCE_TYPES ─┬── INVENTORY.resource_type_id
                ├── DONATION_DETAILS.resource_type_id
                ├── DELIVERY_DETAILS.resource_type_id
                └── ALERT_THRESHOLDS.resource_type_id (1:1)

INVENTORY ── INVENTORY_ADJUSTMENTS.inventory_id

DONORS ── DONATIONS.donor_id
DONATIONS ── DONATION_DETAILS.donation_id

DISTRIBUTION_PLANS ── DISTRIBUTION_PLAN_ITEMS.plan_id
DISTRIBUTION_PLAN_ITEMS ── DELIVERIES.id (nullable 1:1)

DELIVERIES ── DELIVERY_DETAILS.delivery_id
```

---

## 5. Índices recomendados

| Tabla | Índice | Propósito |
|-------|--------|-----------|
| USERS | (email) UNIQUE | Login |
| FAMILIES | (family_code) UNIQUE | Búsqueda por código |
| FAMILIES | (head_document) | Búsqueda por documento |
| FAMILIES | (zone_id, status) | Listados por zona |
| FAMILIES | (priority_score DESC) | Ranking (RF-22) |
| FAMILIES | (reference_address) USING GIN (trigram) | Búsqueda textual (HU-06 CA1) |
| PERSONS | (document) UNIQUE | Búsqueda por documento (RF-06) |
| PERSONS | (family_id) | Listado por familia |
| DELIVERIES | (family_id, delivery_date DESC) | Consulta de cobertura vigente (RF-07, RNF-04) |
| DELIVERIES | (status) | Filtro por estado |
| DELIVERIES | (client_op_id) UNIQUE WHERE client_op_id IS NOT NULL | Idempotencia offline |
| INVENTORY | (warehouse_id, resource_type_id, batch) UNIQUE | Identidad de lote |
| INVENTORY | (expiration_date) WHERE expiration_date IS NOT NULL | Alertas de vencimiento |
| AUDIT_LOGS | (user_id, created_at) | Consulta del historial por usuario (HU-31 CA3) |
| AUDIT_LOGS | (module, entity, entity_id) | Rastreo de cambios por entidad |
| DONATIONS | (donor_id, date DESC) | Historial por donante (RF-21) |

---

## 6. Triggers y procedimientos derivados de reglas de negocio

| Trigger / Proc | Evento | Lógica | Regla origen |
|----------------|--------|--------|--------------|
| `trg_family_composition_sync` | AFTER INSERT/UPDATE/DELETE on PERSONS | Recalcula `num_members`, `num_children_under_5`, etc. en FAMILIES; recalcula `priority_score` | RN-08, HU-05 CA5, HU-07 CA4 |
| `trg_delivery_inventory_decrement` | AFTER INSERT on DELIVERY_DETAILS | Decrementa `INVENTORY.available_quantity`, `INVENTORY.total_weight_kg` y `WAREHOUSES.current_weight_kg` | RF-27, RN-05 |
| `trg_donation_inventory_increment` | AFTER INSERT on DONATION_DETAILS | Incrementa inventario y peso de bodega destino | RF-19 + HU-19 CA4 |
| `trg_shelter_occupancy_sync` | AFTER INSERT on RELOCATIONS | Actualiza ocupación de ambos refugios | HU-24 CA3 |
| `trg_audit_log_readonly` | BEFORE UPDATE/DELETE on AUDIT_LOGS | RAISE EXCEPTION | RNF-09, CV-11 |
| `trg_prevent_last_member_delete` | BEFORE DELETE on PERSONS | RAISE si es el último miembro | HU-07 CA2 |
| `trg_warehouse_capacity_check` | BEFORE INSERT/UPDATE on DONATION_DETAILS / INVENTORY_ADJUSTMENTS | Verifica que `current_weight_kg ≤ max_capacity_kg` | RN-03, HU-11 CA4, HU-19 CA3 |
| `trg_family_code_sequence` | BEFORE INSERT on FAMILIES | Genera `FAM-{year}-{NNNNN}` | RN-07 |
| `trg_donation_code_sequence` | BEFORE INSERT on DONATIONS | Genera `DON-{year}-{NNNNN}` | RN-07 |
| `trg_delivery_code_sequence` | BEFORE INSERT on DELIVERIES | Genera `ENT-{year}-{NNNNN}` | RN-07 |
| `trg_plan_code_sequence` | BEFORE INSERT on DISTRIBUTION_PLANS | Genera `PLN-{year}-{NNNNN}` | RN-07 (extensión) |
| `trg_score_recalc_on_delivery` | AFTER INSERT on DELIVERIES | Llama al servicio de priorización | RN-08 |

---

## 7. Normalización

El esquema cumple **3FN**:
- **1FN**: todos los atributos son atómicos; los arrays (`special_conditions`) se modelan con tipo `ENUM[]` y podrían normalizarse en una tabla `PERSON_SPECIAL_CONDITIONS(person_id, condition)` si se requiere 1FN estricta. Se acepta el array por eficiencia y por tratarse de un conjunto cerrado de valores.
- **2FN**: ningún atributo no-clave depende parcialmente de una clave compuesta. Las tablas con PK compuesta (`DONATION_DETAILS`, `DELIVERY_DETAILS`, `INVENTORY` con UK compuesto) tienen atributos dependientes de la combinación completa.
- **3FN**: no hay dependencias transitivas. Por ejemplo, `priority_score_breakdown` en FAMILIES es derivable (cacheado por performance — RNF-04), pero su cálculo depende directamente de la propia familia y de `SCORING_CONFIG`.

**Decisiones de desnormalización controlada**:
- `FAMILIES.num_members` y agregados de vulnerabilidad son **calculados y cacheados** por `trg_family_composition_sync` para resolver consultas de priorización en <2s (RNF-04).
- `FAMILIES.priority_score` + `priority_score_breakdown` se almacenan calculados por la misma razón, con recálculo disparado por triggers (RN-08).
- `WAREHOUSES.current_weight_kg` se mantiene como suma cacheada del inventario por eficiencia en las consultas de capacidad (RN-03 chequeado en tiempo constante).
- `INVENTORY.total_weight_kg` se almacena en vez de calcularse cada vez, por trazabilidad histórica de lotes.

Todas estas desnormalizaciones son **seguras** porque están protegidas por triggers transaccionales que garantizan consistencia.

---

## 8. Tabla de correspondencia: Modelo relacional ↔ Requerimientos

| Tabla | RF / RN / HU que la justifican |
|-------|--------------------------------|
| USERS | RF-41, RF-42, RF-43, RF-44, HU-01, HU-02, HU-03 |
| AUDIT_LOGS | RF-40, RNF-09, HU-31 |
| SCORING_CONFIG | RN-04, HU-08 CA5 |
| ALERT_THRESHOLDS | RF-15, HU-16 CA2 |
| ZONES | RF-08, HU-09 |
| SHELTERS | RF-09, RN-10, HU-10 |
| FAMILIES | RF-01, RF-03, RF-04, RF-05, RF-06, RN-07, RN-10, HU-04, HU-06, HU-07, HU-08 |
| PERSONS | RF-02, HU-05 |
| PRIVACY_CONSENTS | RN-09, RNF-06, HU-04 CA3 |
| WAREHOUSES | RF-10, RN-03, RN-10, HU-11 |
| RESOURCE_TYPES | RF-13, HU-14 |
| INVENTORY | RF-14, RF-17, HU-15 |
| INVENTORY_ADJUSTMENTS | RF-16, HU-17 |
| DONORS | RF-18, HU-18 |
| DONATIONS | RF-19, RN-07, HU-19 |
| DONATION_DETAILS | RF-20, HU-19 CA2 |
| DISTRIBUTION_PLANS | RF-22, RF-23, HU-21 |
| DISTRIBUTION_PLAN_ITEMS | RF-22, RN-01, HU-21 CA3-4 |
| DELIVERIES | RF-24, RF-25, RF-26, RF-28, RF-29, RN-01, RN-02, RN-07, HU-22, HU-23 |
| DELIVERY_DETAILS | RF-24, RF-27 |
| HEALTH_VECTORS | RF-31, RF-32, HU-25, HU-26 |
| RELOCATIONS | RF-30, HU-24 |

---

## 9. DDL de referencia (resumido para PostgreSQL)

> El DDL definitivo se genera automáticamente por Prisma (`schema.prisma`). Este esquema sirve de contrato con el docente.

```sql
-- Enums principales
CREATE TYPE role AS ENUM ('ADMIN','CENSADOR','OPERADOR_ENTREGAS',
                          'COORDINADOR_LOGISTICA','FUNCIONARIO_CONTROL',
                          'REGISTRADOR_DONACIONES');
CREATE TYPE risk_level AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE family_status AS ENUM ('ACTIVO','EN_REFUGIO','EVACUADO');
CREATE TYPE delivery_status AS ENUM ('PROGRAMADA','EN_CURSO','ENTREGADA');
-- ... (resto de enums de §2)

-- Ejemplo de creación con restricciones
CREATE TABLE families (
  id BIGSERIAL PRIMARY KEY,
  family_code VARCHAR(20) UNIQUE NOT NULL CHECK (family_code ~ '^FAM-\d{4}-\d{5}$'),
  head_document VARCHAR(30) NOT NULL,
  zone_id BIGINT NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
  shelter_id BIGINT REFERENCES shelters(id) ON DELETE SET NULL,
  num_members INTEGER NOT NULL CHECK (num_members > 0),
  num_children_under_5 INTEGER NOT NULL DEFAULT 0 CHECK (num_children_under_5 >= 0),
  -- ...
  priority_score NUMERIC(10,3) NOT NULL DEFAULT 0,
  priority_score_breakdown JSONB,
  status family_status NOT NULL DEFAULT 'ACTIVO',
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  reference_address VARCHAR(255),
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(3) NOT NULL
);

CREATE INDEX idx_families_zone_status ON families(zone_id, status);
CREATE INDEX idx_families_priority ON families(priority_score DESC);

-- Restricción de capacidad de bodega
ALTER TABLE warehouses
  ADD CONSTRAINT warehouse_capacity_check
  CHECK (current_weight_kg <= max_capacity_kg);

-- Permisos para inalterabilidad del audit log
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
```

---

## 10. Referencias

- **PDF "Síntesis de Requerimientos — SGAH"** (Iteración 3, Abril 2026), secciones 4 a 8.
- `ERD.md` — Diagrama entidad-relación conceptual de este proyecto.
- `PLAN.md` — Plan técnico de backend.
- `ISSUES.md` — Issues con matriz de trazabilidad RF/HU/RN/RNF → Issue.
