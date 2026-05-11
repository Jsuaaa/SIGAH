// Routes for map endpoints.
// All routes require authentication but NO role restriction (HU-29 AC6).

import { Router } from 'express';
import * as mapController from '../controllers/map.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParamRule, daysQueryRule } from '../validators/map.validator';

const router = Router();

// All map endpoints require a valid JWT
router.use(authenticate);

// GET /map/shelters — coords, occupancy, capacity, % occupancy (AC1)
router.get('/shelters', mapController.shelters);

// GET /map/warehouses — coords, % stock, max_capacity_kg (AC1)
router.get('/warehouses', mapController.warehouses);

// GET /map/families — coords + status + priority_score, sin datos personales (AC2)
router.get('/families', mapController.families);

// GET /map/vectors — coords + risk_level + status + vector_type (AC1)
router.get('/vectors', mapController.vectors);

// GET /map/zone/:id — all entities aggregated for a zone (AC3)
router.get('/zone/:id', validate(idParamRule), mapController.zoneAggregate);

// GET /map/recent-deliveries?days=7 — deliveries with coords in the last N days (AC4)
router.get('/recent-deliveries', validate(daysQueryRule), mapController.recentDeliveries);

// GET /map/zones-without-deliveries?days=30 — zones with zero ENTREGADA deliveries (AC5)
router.get(
  '/zones-without-deliveries',
  validate(daysQueryRule),
  mapController.zonesWithoutDeliveries,
);

export default router;
