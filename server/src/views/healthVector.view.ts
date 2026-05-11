import type { HealthVector, HealthVectorEnriched } from '../types/entities';

export function healthVectorView(hv: HealthVector | HealthVectorEnriched): HealthVector | HealthVectorEnriched {
  return hv;
}

export function healthVectorsView(
  hvs: Array<HealthVector | HealthVectorEnriched>,
): Array<HealthVector | HealthVectorEnriched> {
  return hvs.map(healthVectorView);
}
