// Data-access layer for map endpoints.
// All methods call SQL functions that return GeoJSON-compatible JSONB or typed rows.

import { db } from '../db/client';

// Minimal GeoJSON types used throughout the map module
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONFeature<P = Record<string, unknown>> {
  type: 'Feature';
  geometry: GeoJSONPoint;
  properties: P;
}

export interface GeoJSONFeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<P>[];
}

export interface MapZoneAggregate {
  zone_id: number;
  shelters: GeoJSONFeatureCollection;
  warehouses: GeoJSONFeatureCollection;
  families: GeoJSONFeatureCollection;
  vectors: GeoJSONFeatureCollection;
  recent_deliveries: GeoJSONFeatureCollection;
}

export interface ZoneWithoutDelivery {
  zone_id: number;
  zone_name: string;
  risk_level: string;
  estimated_population: number;
  family_count: string; // BIGINT comes as string from pg
}

export const MapModel = {
  /**
   * GeoJSON FeatureCollection for all shelters.
   * fn_map_shelters() — coords, occupancy, max_capacity, occupancy_pct.
   */
  async shelters(): Promise<GeoJSONFeatureCollection> {
    const row = await db.queryOne<{ fn_map_shelters: GeoJSONFeatureCollection }>(
      'SELECT fn_map_shelters()',
    );
    return row?.fn_map_shelters ?? { type: 'FeatureCollection', features: [] };
  },

  /**
   * GeoJSON FeatureCollection for all warehouses.
   * fn_map_warehouses() — coords, stock_pct, max_capacity_kg.
   */
  async warehouses(): Promise<GeoJSONFeatureCollection> {
    const row = await db.queryOne<{ fn_map_warehouses: GeoJSONFeatureCollection }>(
      'SELECT fn_map_warehouses()',
    );
    return row?.fn_map_warehouses ?? { type: 'FeatureCollection', features: [] };
  },

  /**
   * GeoJSON FeatureCollection for geolocated families.
   * fn_map_families() — coords, status, priority_score. NO head_document/names.
   */
  async families(): Promise<GeoJSONFeatureCollection> {
    const row = await db.queryOne<{ fn_map_families: GeoJSONFeatureCollection }>(
      'SELECT fn_map_families()',
    );
    return row?.fn_map_families ?? { type: 'FeatureCollection', features: [] };
  },

  /**
   * GeoJSON FeatureCollection for geolocated health vectors.
   * fn_map_vectors() — coords, risk_level, status, vector_type.
   */
  async vectors(): Promise<GeoJSONFeatureCollection> {
    const row = await db.queryOne<{ fn_map_vectors: GeoJSONFeatureCollection }>(
      'SELECT fn_map_vectors()',
    );
    return row?.fn_map_vectors ?? { type: 'FeatureCollection', features: [] };
  },

  /**
   * GeoJSON FeatureCollection of deliveries in the last p_days days.
   * fn_map_recent_deliveries(p_days) — coords, status, delivery_date, coverage_days.
   */
  async recentDeliveries(days: number): Promise<GeoJSONFeatureCollection> {
    const row = await db.queryOne<{ fn_map_recent_deliveries: GeoJSONFeatureCollection }>(
      'SELECT fn_map_recent_deliveries($1)',
      [days],
    );
    return row?.fn_map_recent_deliveries ?? { type: 'FeatureCollection', features: [] };
  },

  /**
   * Aggregate of all geolocated entities for a given zone.
   * fn_map_zone_aggregate(p_zone_id) — {shelters, warehouses, families, vectors, recent_deliveries}.
   */
  async zoneAggregate(zoneId: number): Promise<MapZoneAggregate> {
    const row = await db.queryOne<{ fn_map_zone_aggregate: MapZoneAggregate }>(
      'SELECT fn_map_zone_aggregate($1)',
      [zoneId],
    );
    if (!row) {
      throw new Error('fn_map_zone_aggregate returned no row');
    }
    return row.fn_map_zone_aggregate;
  },

  /**
   * Zones with zero ENTREGADA deliveries in the last p_days days.
   * fn_map_zones_without_deliveries(p_days) — zone_id, zone_name, estimated_population, family_count.
   */
  async zonesWithoutDeliveries(days: number): Promise<ZoneWithoutDelivery[]> {
    const result = await db.query<ZoneWithoutDelivery>(
      'SELECT * FROM fn_map_zones_without_deliveries($1)',
      [days],
    );
    return result.rows;
  },
};
