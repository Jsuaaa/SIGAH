// Controllers for map endpoints.
// All endpoints return GeoJSON-compatible responses.
// Access: any authenticated user (no role restriction — HU-29 AC6).

import * as mapService from '../services/map.service';
import { asyncHandler } from '../utils/asyncHandler';

// GET /map/shelters
export const shelters = asyncHandler(async (_req, res) => {
  const data = await mapService.getShelters();
  res.json({ success: true, data });
});

// GET /map/warehouses
export const warehouses = asyncHandler(async (_req, res) => {
  const data = await mapService.getWarehouses();
  res.json({ success: true, data });
});

// GET /map/families — no personal data exposed (AC2)
export const families = asyncHandler(async (_req, res) => {
  const data = await mapService.getFamilies();
  res.json({ success: true, data });
});

// GET /map/vectors
export const vectors = asyncHandler(async (_req, res) => {
  const data = await mapService.getVectors();
  res.json({ success: true, data });
});

// GET /map/zone/:id
export const zoneAggregate = asyncHandler(async (req, res) => {
  const zoneId = Number(req.params.id);
  const data = await mapService.getZoneAggregate(zoneId);
  res.json({ success: true, data });
});

// GET /map/recent-deliveries?days=7
export const recentDeliveries = asyncHandler(async (req, res) => {
  const days = req.query.days !== undefined ? Number(req.query.days) : 7;
  const data = await mapService.getRecentDeliveries(days);
  res.json({ success: true, data });
});

// GET /map/zones-without-deliveries?days=30
export const zonesWithoutDeliveries = asyncHandler(async (req, res) => {
  const days = req.query.days !== undefined ? Number(req.query.days) : 30;
  const data = await mapService.getZonesWithoutDeliveries(days);
  res.json({ success: true, data });
});
