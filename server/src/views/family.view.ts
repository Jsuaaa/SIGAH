// Family responses currently expose every column. The view keeps a
// passthrough so future redactions (e.g. masking head_document for
// non-CONTROL_OFFICER roles) only touch this file.

import type { Family } from '../types/entities';

export function familyView(family: Family): Family {
  return family;
}

export function familiesView(families: Family[]): Family[] {
  return families.map(familyView);
}
