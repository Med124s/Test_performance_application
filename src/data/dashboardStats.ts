import { Application, Scenario, Execution as ApiExecution } from '../types'
import { computeMetricsForExecutions, durationToSeconds, formatDuration } from '../utils/metrics'

export interface ExecutionStatusBreakdown {
  success: number
  inProgress: number
  failed: number
  cancelled: number
}

export interface RecentExecution {
  name: string
  status: 'Réussi' | 'Échoué' | 'En cours'
  time: string
  color: 'success' | 'danger' | 'info'
  icon: string
}

export interface TopScenario {
  name: string
  percent: number
}

export interface DashboardStats {
  avgResponseTime: number // ms
  throughput: number // req/s
  errorRate: number // %
  activeUsers: number
  testsInProgress: number
  scenarios: number
  executions: number
  avgDurationSec: number
  responseTimeSeries: number[] // 7 points
  executionStatus: ExecutionStatusBreakdown
  recentExecutions: RecentExecution[]
  topScenarios: TopScenario[]
}

export type StatsPhase = 'before' | 'after'

const statusMeta: Record<ApiExecution['status'], { status: RecentExecution['status']; color: RecentExecution['color']; icon: string }> = {
  'Réussie': { status: 'Réussi', color: 'success', icon: 'bi-check-circle-fill' },
  'Échouée': { status: 'Échoué', color: 'danger', icon: 'bi-x-circle-fill' },
  'Avec erreurs': { status: 'Échoué', color: 'danger', icon: 'bi-x-circle-fill' },
  'En cours': { status: 'En cours', color: 'info', icon: 'bi-play-circle-fill' },
  'Suspendue': { status: 'En cours', color: 'info', icon: 'bi-pause-circle-fill' },
}

/** Moyenne réelle des temps de réponse des 7 derniers jours calendaires,
 * calculée à partir des vrais stepResults des exécutions fournies (0 si
 * aucune exécution réelle ce jour-là — jamais de valeur inventée). */
function dailyAvgResponseTime(executions: ApiExecution[]): number[] {
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now)
    dayStart.setDate(now.getDate() - (6 - i))
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayStart.getDate() + 1)
    const dayResults = executions
      .filter((e) => {
        const t = new Date(e.startedAt)
        return t >= dayStart && t < dayEnd
      })
      .flatMap((e) => e.stepResults)
    return dayResults.length > 0
      ? Math.round(dayResults.reduce((s, r) => s + (r.responseTimeMs ?? 0), 0) / dayResults.length)
      : 0
  })
}

/**
 * Calcule un snapshot de statistiques 100% réel à partir d'un ensemble
 * d'exécutions (et des scénarios associés) — aucune valeur aléatoire.
 * Reprend exactement la même logique de calcul (moyennes sur les vrais
 * stepResults) que la page Métriques.
 */
function computeStatsFromExecutions(executions: ApiExecution[], scenarios: Scenario[]): DashboardStats {
  const perf = computeMetricsForExecutions(executions)
  const totalReq = perf.totalRequests
  const avgResponseTime = perf.avgResponseTime
  const errorRate = Math.round(perf.errorRate * 100) / 100
  const throughput = Math.round(perf.throughput * 100) / 100
  const avgDurationSec = executions.length > 0
    ? Math.round(executions.reduce((s, e) => s + durationToSeconds(e.duration), 0) / executions.length)
    : 0

  // "Actifs" = réellement en cours d'exécution maintenant, jamais un chiffre
  // de remplissage.
  const runningExecs = executions.filter((e) => e.status === 'En cours')
  const testsInProgress = runningExecs.length
  const activeUsers = runningExecs.reduce((s, e) => s + (parseInt(e.users) || 0), 0)

  const executionStatus: ExecutionStatusBreakdown = {
    success: executions.filter((e) => e.status === 'Réussie').length,
    inProgress: executions.filter((e) => e.status === 'En cours').length,
    failed: executions.filter((e) => e.status === 'Échouée' || e.status === 'Avec erreurs').length,
    cancelled: executions.filter((e) => e.status === 'Suspendue').length,
  }

  // "Scénarios les plus utilisés" = part réelle des exécutions par scénario.
  const execCountByScenario = new Map<string, number>()
  executions.forEach((e) => execCountByScenario.set(e.scenarioId, (execCountByScenario.get(e.scenarioId) ?? 0) + 1))
  const topScenarios: TopScenario[] = Array.from(execCountByScenario.entries())
    .map(([scenarioId, count]) => ({
      name: scenarios.find((s) => s.id === scenarioId)?.name ?? scenarioId,
      percent: executions.length > 0 ? Math.round((count / executions.length) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 4)

  const recentExecutions: RecentExecution[] = [...executions]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 3)
    .map((e) => {
      // Filet de sécurité : un statut inattendu/corrompu ne doit jamais faire
      // planter tout le Dashboard, seulement dégrader l'affichage de cette ligne.
      const meta = statusMeta[e.status] ?? { status: 'En cours', color: 'info', icon: 'bi-question-circle-fill' }
      const scenarioName = scenarios.find((s) => s.id === e.scenarioId)?.name ?? e.scenarioId
      const time = new Date(e.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      return { name: scenarioName, status: meta.status, color: meta.color, icon: meta.icon, time }
    })

  return {
    avgResponseTime,
    throughput,
    errorRate,
    activeUsers,
    testsInProgress,
    scenarios: scenarios.length,
    executions: executions.length,
    avgDurationSec,
    responseTimeSeries: dailyAvgResponseTime(executions),
    executionStatus,
    recentExecutions,
    topScenarios,
  }
}

/** Découpe chronologique honnête d'un historique d'exécutions en
 * "plus ancienne moitié" (utilisée comme référence "Avant" dans le mode
 * comparaison). Avec moins de 2 exécutions, il n'y a pas assez d'historique
 * pour comparer : "Avant" = "Après" (delta 0), plutôt que d'inventer un
 * écart. */
function olderHalf(executions: ApiExecution[]): ApiExecution[] {
  const sorted = [...executions].sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
  if (sorted.length < 2) return sorted
  return sorted.slice(0, Math.ceil(sorted.length / 2))
}

/**
 * Snapshot de statistiques pour une application donnée (par son vrai id) et
 * une phase donnée, calculé uniquement à partir des vraies données JSON
 * Server passées en paramètre.
 * "after" = état actuel (toutes les exécutions réelles de l'application).
 * "before" = moitié la plus ancienne de ce même historique réel.
 */
export function buildStats(
  seedId: string,
  phase: StatsPhase,
  real: { applications: Application[]; scenarios: Scenario[]; executions: ApiExecution[] }
): DashboardStats {
  const app = real.applications.find((a) => a.id === seedId)
  const scenariosForApp = app ? real.scenarios.filter((s) => s.applicationId === app.id) : []
  const executionsForApp = app ? real.executions.filter((e) => e.applicationId === app.id) : []
  const scopedExecutions = phase === 'after' ? executionsForApp : olderHalf(executionsForApp)
  return computeStatsFromExecutions(scopedExecutions, scenariosForApp)
}

/** Vue agrégée ("Toutes les applications") : calculée directement sur la
 * totalité des vraies exécutions et scénarios de JSON Server. */
export function buildAggregateStats(
  phase: StatsPhase,
  real: { applications: Application[]; scenarios: Scenario[]; executions: ApiExecution[] }
): DashboardStats {
  const scopedExecutions = phase === 'after' ? real.executions : olderHalf(real.executions)
  return computeStatsFromExecutions(scopedExecutions, real.scenarios)
}

export function getStats(
  appId: string | 'all',
  phase: StatsPhase,
  real: { applications: Application[]; scenarios: Scenario[]; executions: ApiExecution[] }
): DashboardStats {
  return appId === 'all' ? buildAggregateStats(phase, real) : buildStats(appId, phase, real)
}

export function percentDelta(after: number, before: number): number {
  if (before === 0) return 0
  return Math.round(((after - before) / before) * 1000) / 10
}

export { formatDuration }

