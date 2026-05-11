// Service for map endpoints. Delegates to MapModel; no business logic beyond
// coercing the days parameter to a safe integer.

import { MapModel, type GeoJSONFeatureCollection, type MapZoneAggregate } from '../models/map.model';

export interface ZoneWithoutDeliverySerialized {
  zone_id: number;
  zone_name: string;
  risk_level: string;
  estimated_population: number;
  family_count: number;
}

export async function getShelters(): Promise<GeoJSONFeatureCollection> {
  return MapModel.shelters();
}

export async function getWarehouses(): Promise<GeoJSONFeatureCollection> {
  return MapModel.warehouses();
}

export async function getFamilies(): Promise<GeoJSONFeatureCollection> {
  return MapModel.families();
}

export async function getVectors(): Promise<GeoJSONFeatureCollection> {
  return MapModel.vectors();
}

export async function getRecentDeliveries(days: number): Promise<GeoJSONFeatureCollection> {
  // Clamp to a reasonable range: 1-365 days
  const safeDays = Math.min(Math.max(days, 1), 365);
  return MapModel.recentDeliveries(safeDays);
}

export async function getZoneAggregate(zoneId: number): Promise<MapZoneAggregate> {
  return MapModel.zoneAggregate(zoneId);
}

export async function getZonesWithoutDeliveries(
  days: number,
): Promise<ZoneWithoutDeliverySerialized[]> {
  const safeDays = Math.min(Math.max(days, 1), 365);
  const rows = await MapModel.zonesWithoutDeliveries(safeDays);
  return rows.map((r) => ({
    zone_id: r.zone_id,
    zone_name: r.zone_name,
    risk_level: r.risk_level,
    estimated_population: r.estimated_population,
    family_count: Number(r.family_count),
  }));
}
