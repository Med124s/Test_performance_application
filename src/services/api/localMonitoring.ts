// ============================================================
// Client pour le "Local Test Server" — PAS JSON Server. C'est un tout
// petit service Node séparé (voir /local-monitoring-server à la racine
// du projet) qui expose les vraies métriques CPU/RAM/Disk/Network/Health
// du PC Windows sur lequel tourne ce projet, pour un test local sans VPS.
//
// Point de branchement volontairement isolé : demain, un agent Spring
// Boot exposera la même forme de réponse sur un autre `monitoringUrl`
// (voir Server.monitoringUrl) — seul ce fichier changerait, jamais
// serverSnapshot.ts ni les composants qui le consomment.
// ============================================================

export interface LocalServerMetrics {
  cpu: number
  ram: number
  disk: number
  network: number
  health: 'Healthy' | 'Degraded' | 'Critical'
  capturedAt: string
}

const FETCH_TIMEOUT_MS = 4000

export const localMonitoringApi = {
  /** Interroge le service de monitoring à `monitoringUrl`. Ne lève jamais :
   * un service éteint/injoignable rend simplement `null` (les valeurs de
   * l'exécution restent alors `null`, jamais inventées). */
  async fetchMetrics(monitoringUrl: string): Promise<LocalServerMetrics | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(monitoringUrl, { signal: controller.signal })
      if (!response.ok) return null
      return (await response.json()) as LocalServerMetrics
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  },
}
