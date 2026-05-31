import { api } from './axios';
import type { ApiItem, ApiList } from '@/types/api.types';
import type {
  Donor,
  DonorPayload,
  DonorListParams,
} from '@/types/donor.types';

export const donorsApi = {
  // Catálogo completo (solo activos) para selects de Donaciones (HU-19).
  listAll() {
    return api
      .get<ApiList<Donor>>('/donors', {
        params: { page: 1, limit: 200, is_active: true },
      })
      .then((r) => r.data.data);
  },

  // Listado paginado/filtrable para la página de Donantes (incluye inactivos
  // cuando no se filtra por is_active).
  list(params: DonorListParams) {
    const query: Record<string, string | number | boolean> = {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    };
    if (params.type) query.type = params.type;
    if (params.is_active !== undefined) query.is_active = params.is_active;
    if (params.search) query.search = params.search;
    return api.get<ApiList<Donor>>('/donors', { params: query }).then((r) => r.data);
  },

  getById(id: number) {
    return api.get<ApiItem<Donor>>(`/donors/${id}`).then((r) => r.data.data);
  },

  create(payload: DonorPayload) {
    return api.post<ApiItem<Donor>>('/donors', payload).then((r) => r.data.data);
  },

  update(id: number, payload: Partial<DonorPayload>) {
    return api.put<ApiItem<Donor>>(`/donors/${id}`, payload).then((r) => r.data.data);
  },

  // Soft-delete híbrido: el backend borra físicamente si no hay donaciones, o
  // marca is_active=false si las tiene. No expone error al frontend en ese caso.
  remove(id: number) {
    return api.delete(`/donors/${id}`).then(() => undefined);
  },
};
