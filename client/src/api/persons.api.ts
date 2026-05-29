import { api } from './axios'
import type { ApiItem } from '@/types/api.types'
import type { Person, PersonPayload, PersonWithFamily } from '@/types/person.types'

export const personsApi = {
  // GET /persons/search?document= — búsqueda exacta por documento (HU-06).
  // Devuelve la persona junto a su familia. Lanza 404 si no existe.
  findByDocument(document: string) {
    return api
      .get<ApiItem<PersonWithFamily>>('/persons/search', { params: { document } })
      .then((r) => r.data.data)
  },

  create(payload: PersonPayload) {
    return api.post<ApiItem<Person>>('/persons', payload).then((r) => r.data.data)
  },

  // En PUT no se reasigna family_id; se omite del cuerpo.
  update(id: number, payload: Omit<PersonPayload, 'family_id'>) {
    return api.put<ApiItem<Person>>(`/persons/${id}`, payload).then((r) => r.data.data)
  },

  remove(id: number) {
    return api.delete(`/persons/${id}`).then(() => undefined)
  },
}
