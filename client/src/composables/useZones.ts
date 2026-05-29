import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { zonesApi } from '@/api/zones.api'
import type { ZoneListParams, ZonePayload } from '@/types/zone.types'

// Catálogo completo de zonas (selects/joins). Lo consume FamiliesListPage.
export function useZones() {
  return useQuery({
    queryKey: ['zones', 'all'],
    queryFn: zonesApi.listAll,
    staleTime: 1000 * 60 * 30, // catálogo estable: 30 min
  })
}

// Listado paginado/filtrable para la página de Zonas.
export function useZonesList(params: Ref<ZoneListParams>) {
  return useQuery({
    queryKey: ['zones', 'list', params],
    queryFn: () => zonesApi.list(params.value),
    placeholderData: keepPreviousData,
  })
}

export function useZone(id: Ref<number>) {
  return useQuery({
    queryKey: ['zones', 'detail', id],
    queryFn: () => zonesApi.getById(id.value),
    enabled: () => !!id.value,
  })
}

export function useZoneFamilies(id: Ref<number>) {
  return useQuery({
    queryKey: ['zones', id, 'families'],
    queryFn: () => zonesApi.families(id.value),
    enabled: () => !!id.value,
  })
}
export function useZoneShelters(id: Ref<number>) {
  return useQuery({
    queryKey: ['zones', id, 'shelters'],
    queryFn: () => zonesApi.shelters(id.value),
    enabled: () => !!id.value,
  })
}
export function useZoneWarehouses(id: Ref<number>) {
  return useQuery({
    queryKey: ['zones', id, 'warehouses'],
    queryFn: () => zonesApi.warehouses(id.value),
    enabled: () => !!id.value,
  })
}

// Mutaciones de zona: al terminar invalidan todo lo de zonas (catálogo + listado).
export function useZoneMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['zones'] })

  const create = useMutation({ mutationFn: zonesApi.create, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ZonePayload> }) =>
      zonesApi.update(id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: zonesApi.remove, onSuccess: invalidate })

  return { create, update, remove }
}
