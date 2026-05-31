import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type { Person, PersonPayload } from '@/types/person.types'

export const personsApi = {
  // GET /families/:id/persons — el backend devuelve un array sin paginación.
  listByFamily(familyId: number) {
    return api.get<ApiItem<Person[]>>(`/families/${familyId}/persons`).then((r) => r.data.data)
  },

  // POST /persons — al crear, el backend recalcula conteos y puntaje de la familia.
  create(payload: PersonPayload) {
    return api.post<ApiItem<Person>>('/persons', payload).then((r) => r.data.data)
  },

  update(id: number, payload: Partial<PersonPayload>) {
    return api.put<ApiItem<Person>>(`/persons/${id}`, payload).then((r) => r.data.data)
  },

  remove(id: number) {
    return api.delete(`/persons/${id}`).then(() => undefined)
  },
}
