import type { Relocation, RelocationEnriched } from '../types/entities';

type AnyRelocation = Relocation | RelocationEnriched;

export function relocationView<T extends AnyRelocation>(r: T): T {
  return r;
}

export function relocationsView<T extends AnyRelocation>(rows: T[]): T[] {
  return rows.map(relocationView);
}
