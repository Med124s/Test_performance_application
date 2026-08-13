import { http } from './httpClient'
import { Server } from '../../types'

const RESOURCE = '/servers'

export const serversApi = {
  getAll: () => http.get<Server[]>(RESOURCE),
  getById: (id: string) => http.get<Server>(`${RESOURCE}/${id}`),
  create: (data: Omit<Server, 'id'>) => http.post<Server>(RESOURCE, data),
  update: (id: string, data: Partial<Server>) => http.patch<Server>(`${RESOURCE}/${id}`, data),
  remove: (id: string) => http.delete<void>(`${RESOURCE}/${id}`),
}
