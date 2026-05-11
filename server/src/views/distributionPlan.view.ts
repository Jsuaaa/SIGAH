import type { DistributionPlan, DistributionPlanWithItems } from '../types/entities';

/** Serializa un plan (sin items). */
export function distributionPlanView(p: DistributionPlan): DistributionPlan {
  return p;
}

/** Serializa un plan con items embebidos. */
export function distributionPlanWithItemsView(
  p: DistributionPlanWithItems,
): DistributionPlanWithItems {
  return p;
}

/** Serializa una lista de planes. */
export function distributionPlansView(
  rows: DistributionPlanWithItems[],
): DistributionPlanWithItems[] {
  return rows.map(distributionPlanWithItemsView);
}
