import { Router } from 'express';
import * as controller from '../controllers/reports.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  inventoryRules,
  unattendedFamiliesRules,
  donationsByTypeRules,
  deliveriesByZoneRules,
  dashboardRules,
  traceabilityRules,
} from '../validators/reports.validator';

const router = Router();

// All report endpoints require authentication and one of these roles.
// RF-28: ADMIN, COORDINADOR_LOGISTICA, FUNCIONARIO_CONTROL.
router.use(authenticate);
router.use(authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'FUNCIONARIO_CONTROL'));

// RF-28 CA1 — Cobertura vigente por zona.
router.get('/coverage', controller.coverage);

// RF-28 CA2 — Inventario por bodega y categoría.
router.get('/inventory', validate(inventoryRules), controller.inventory);

// RF-28 CA3 — Familias sin cobertura (unattended), con filtros de zona y fecha.
router.get('/unattended-families', validate(unattendedFamiliesRules), controller.unattendedFamilies);

// ── Issue #31 — Advanced reports (ADMIN | COORDINADOR_LOGISTICA | FUNCIONARIO_CONTROL) ──

// Issue #31 CA1 — Donaciones agrupadas por tipo de donante + export PDF/Excel.
router.get('/donations-by-type', validate(donationsByTypeRules), controller.donationsByType);

// Issue #31 CA2 — Entregas por zona con count y peso + export PDF/Excel.
router.get('/deliveries-by-zone', validate(deliveriesByZoneRules), controller.deliveriesByZone);

// Issue #31 CA3 — Dashboard de métricas (1 sola query JSONB) + export PDF/Excel.
router.get('/dashboard', validate(dashboardRules), controller.dashboard);

// Issue #31 CA5/CA6 — Trazabilidad donante → bodega → entrega → familia.
// Requiere ?donation_id=X o ?resource_type_id=Y (validado en controller, HU-29 CA1).
router.get('/traceability', validate(traceabilityRules), controller.traceability);

export default router;
