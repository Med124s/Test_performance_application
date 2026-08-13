import { http } from './httpClient'
import { ServerMetricSample } from '../../types'

const RESOURCE = '/serverMetrics'

export const serverMetricsApi = {
  getAll: () => http.get<ServerMetricSample[]>(RESOURCE),
  getByServer: (serverId: string) =>
    http.get<ServerMetricSample[]>(`${RESOURCE}?serverId=${serverId}&_sort=recordedAt`),
  create: (data: Omit<ServerMetricSample, 'id'>) => http.post<ServerMetricSample>(RESOURCE, data),
  remove: (id: string) => http.delete<void>(`${RESOURCE}/${id}`),
}
