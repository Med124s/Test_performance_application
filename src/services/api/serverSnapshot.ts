import { serversApi } from './servers'
import { serverMetricsApi } from './serverMetrics'
import { localMonitoringApi } from './localMonitoring'
import { Application, ServerHealth, ServerSnapshot } from '../../types'

// ============================================================
// Point de branchement unique pour le futur backend Spring Boot + JMeter.
//
// AUJOURD'HUI, pour le serveur lié à l'application testée (s'il existe),
// trois cas par ordre de priorité :
//   1. `monitoringUrl` renseigné et joignable (Local Test Server, PC
//      Windows — voir /local-monitoring-server) : métriques réelles,
//      `simulated: false`.
//   2. Sinon, une mesure de démonstration déjà enregistrée pour ce serveur
//      (ServerMetricSample, page Métriques) : on reprend la plus récente
//      telle quelle — jamais générée aléatoirement — avec `simulated: true`
//      pour que l'UI l'affiche honnêtement comme donnée de démo.
//   3. Sinon (aucun serveur lié, ou serveur sans aucune mesure) : métriques
//      `null`, rien n'est inventé.
//
// DEMAIN : un agent Spring Boot exposera la même forme de réponse sur son
// propre `monitoringUrl` — seul localMonitoring.ts changerait de cible,
// aucun appelant (useScenarioLauncher, ExecutionDetail) n'a besoin de
// changer, ils ne dépendent que de la forme `ServerSnapshot`.
// ============================================================

const HEALTH_LABELS: Record<string, ServerHealth> = {
  Healthy: 'Sain',
  Degraded: 'Dégradé',
  Critical: 'Critique',
}

const LIVE_SOURCE_LABEL = 'Local Test Server'
const DEMO_SOURCE_LABEL = 'Mode démonstration — données simulées'

export const serverSnapshotApi = {
  async captureForApplication(application: Application): Promise<ServerSnapshot | null> {
    const servers = await serversApi.getAll()
    const linkedServer = servers.find((s) => s.applicationId === application.id)
    if (!linkedServer) return null

    const base = {
      serverId: linkedServer.id,
      serverName: linkedServer.name,
      applicationId: application.id,
      applicationName: application.name,
    }

    const liveMetrics = linkedServer.monitoringUrl
      ? await localMonitoringApi.fetchMetrics(linkedServer.monitoringUrl)
      : null

    if (liveMetrics) {
      return {
        ...base,
        capturedAt: liveMetrics.capturedAt,
        cpu: liveMetrics.cpu,
        ram: liveMetrics.ram,
        disk: liveMetrics.disk,
        network: liveMetrics.network,
        health: HEALTH_LABELS[liveMetrics.health] ?? null,
        source: LIVE_SOURCE_LABEL,
        simulated: false,
      }
    }

    const samples = await serverMetricsApi.getByServer(linkedServer.id)
    const latestSample = samples[samples.length - 1]

    if (latestSample) {
      return {
        ...base,
        capturedAt: new Date().toISOString(),
        cpu: latestSample.cpuPercent,
        ram: latestSample.ramPercent,
        disk: latestSample.diskPercent,
        network: latestSample.networkMbps,
        health: latestSample.health,
        source: DEMO_SOURCE_LABEL,
        simulated: true,
      }
    }

    return {
      ...base,
      capturedAt: new Date().toISOString(),
      cpu: null,
      ram: null,
      disk: null,
      network: null,
      health: null,
      source: null,
      simulated: false,
    }
  },
}
