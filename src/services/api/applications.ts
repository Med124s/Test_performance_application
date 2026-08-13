import { http } from './httpClient'
import { Application, ApplicationConnectionStatus, Execution } from '../../types'

const RESOURCE = '/applications'

export const applicationsApi = {
  getAll: () => http.get<Application[]>(RESOURCE),
  getById: (id: string) => http.get<Application>(`${RESOURCE}/${id}`),
  create: (data: Omit<Application, 'id'>) => http.post<Application>(RESOURCE, data),
  update: (id: string, data: Partial<Application>) =>
    http.patch<Application>(`${RESOURCE}/${id}`, data),
  replace: (id: string, data: Application) => http.put<Application>(`${RESOURCE}/${id}`, data),
  remove: (id: string) => http.delete<void>(`${RESOURCE}/${id}`),
}

/**
 * Dérive le statut de connexion affiché dans la colonne "Statut" de la
 * liste des applications, à partir de la dernière exécution réelle de
 * cette application — jamais stocké en dur, toujours recalculé depuis les
 * vraies données pour rester cohérent.
 */
export function deriveConnectionStatus(
  app: Application,
  latestExecution: Execution | null
): ApplicationConnectionStatus {
  if (app.status === 'Inactif') return 'Déconnectée'
  if (!latestExecution) return 'Déconnectée'
  switch (latestExecution.status) {
    case 'Réussie':
    case 'En cours':
      return 'Connectée'
    case 'Échouée':
      return 'Échouée'
    case 'Avec erreurs':
    case 'Suspendue':
      return 'Erreur'
    default:
      return 'Déconnectée'
  }
}
