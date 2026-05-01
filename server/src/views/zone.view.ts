// Zones have no sensitive fields; the view is currently a passthrough but the
// indirection is kept so future fields (e.g. computed flags) only affect this
// file rather than every caller.

import type { Zone } from '../types/entities';

export function zoneView(zone: Zone): Zone {
  return zone;
}

export function zonesView(zones: Zone[]): Zone[] {
  return zones.map(zoneView);
}
