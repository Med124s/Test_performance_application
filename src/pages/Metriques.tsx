import { useMemo, useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import TopBar from '../components/TopBar'
import { Application, Scenario, Step, Execution, StepResult, Server, ServerMetricSample, ServerHealth } from '../types'
import { applicationsApi } from '../services/api/applications'
import { scenariosApi } from '../services/api/scenarios'
import { stepsApi } from '../services/api/steps'
import { executionsApi } from '../services/api/executions'
import { serversApi } from '../services/api/servers'
import { serverMetricsApi } from '../services/api/serverMetrics'
import { useApiList } from '../hooks/useApiResource'
import { useAuth } from '../context/AuthContext'
import { firstError, validateRequired, validateMaxLength, NAME_MAX_LENGTH } from '../utils/validation'
import { computePerformanceMetrics, durationToSeconds } from '../utils/metrics'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function Metriques() {
  const { canEdit } = useAuth()
  const [timeRange, setTimeRange] = useState('24h')

  // Données réelles depuis JSON Server — aucune métrique n'est plus
  // générée aléatoirement : tout est calculé à partir des vraies
  // exécutions et de leurs vrais résultats d'étapes (stepResults).
  const { data: allApplicationsRaw, loading: appsLoading } = useApiList<Application>(() => applicationsApi.getAll())
  const { data: allScenarios, loading: scenariosLoading } = useApiList<Scenario>(() => scenariosApi.getAll())
  const { data: allSteps } = useApiList<Step>(() => stepsApi.getAll())
  const { data: allExecutions, loading: executionsLoading } = useApiList<Execution>(() => executionsApi.getAll())
  const { data: allServers, refetch: refetchServers } = useApiList<Server>(() => serversApi.getAll())
  const { data: allServerMetrics, refetch: refetchServerMetrics } = useApiList<ServerMetricSample>(() => serverMetricsApi.getAll())
  const dataLoading = appsLoading || scenariosLoading || executionsLoading

  const allApplications = allApplicationsRaw.filter((a) => a.status === 'Actif')
  const appById = useMemo(() => new Map(allApplicationsRaw.map((a) => [a.id, a])), [allApplicationsRaw])
  const scenarioById = useMemo(() => new Map(allScenarios.map((s) => [s.id, s])), [allScenarios])
  const stepById = useMemo(() => new Map(allSteps.map((s) => [s.id, s])), [allSteps])

  // Sélection en cascade : Application → Scénario → Étape, par vrais IDs
  // (jamais par nom). Chaque niveau filtre les statistiques de la page.
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>('all')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('all')
  const [selectedStepId, setSelectedStepId] = useState<string>('all')

  const scenariosForSelectedApp =
    selectedApplicationId === 'all'
      ? allScenarios
      : allScenarios.filter((s) => s.applicationId === selectedApplicationId)

  const selectedScenario =
    selectedScenarioId !== 'all' ? scenarioById.get(selectedScenarioId) ?? null : null

  const stepsForSelectedScenario = selectedScenario
    ? allSteps.filter((s) => s.scenarioId === selectedScenario.id)
    : []

  const selectedStep =
    selectedStepId !== 'all' ? stepsForSelectedScenario.find((s) => s.id === selectedStepId) ?? null : null

  const scopeLevel: 'all' | 'app' | 'scenario' | 'step' = selectedStep
    ? 'step'
    : selectedScenario
    ? 'scenario'
    : selectedApplicationId !== 'all'
    ? 'app'
    : 'all'

  const handleAppChange = (value: string) => {
    setSelectedApplicationId(value)
    setSelectedScenarioId('all')
    setSelectedStepId('all')
  }

  const handleScenarioChange = (value: string) => {
    setSelectedScenarioId(value)
    setSelectedStepId('all')
    // Sélectionner un scénario directement (sans être passé par son
    // application) aligne aussi le niveau "Application" par cohérence.
    if (value !== 'all') {
      const sc = scenarioById.get(value)
      if (sc) setSelectedApplicationId(sc.applicationId)
    }
  }

  const selectedAppName =
    selectedApplicationId === 'all' ? 'Toutes les applications' : appById.get(selectedApplicationId)?.name ?? ''

  const scopeLabel =
    scopeLevel === 'step'
      ? `${selectedScenario?.name} → ${selectedStep?.name}`
      : scopeLevel === 'scenario'
      ? selectedScenario?.name ?? ''
      : scopeLevel === 'app'
      ? selectedAppName
      : 'Toutes les applications'

  // ---- Agrégation RÉELLE des résultats selon le niveau sélectionné ----
  const matchingExecutions = allExecutions.filter((e) => {
    if (scopeLevel === 'scenario' || scopeLevel === 'step') return e.scenarioId === selectedScenario!.id
    if (scopeLevel === 'app') return e.applicationId === selectedApplicationId
    return true
  }).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))

  const matchingResults: { result: StepResult; execution: Execution }[] = []
  matchingExecutions.forEach((e) => {
    e.stepResults.forEach((r) => {
      if (scopeLevel === 'step' && r.stepId !== selectedStep!.id) return
      matchingResults.push({ result: r, execution: e })
    })
  })

  const totalDurationSec = matchingExecutions.reduce((sum, e) => sum + durationToSeconds(e.duration), 0)
  const perf = computePerformanceMetrics(matchingResults.map((r) => r.result), totalDurationSec)
  const totalReq = perf.totalRequests
  const successCount = perf.successCount
  const errorCount = perf.errorCount
  const errorRateVal = perf.errorRate
  const avgDurationVal = perf.avgResponseTime
  const p95Val = perf.p95ResponseTime
  const throughputVal = perf.throughput
  const maxVUsVal = matchingExecutions.length > 0
    ? Math.max(...matchingExecutions.map((e) => parseInt(e.users) || 0))
    : 0

  const kpis = [
    {
      title: 'Utilisateurs max simultanés',
      value: maxVUsVal.toLocaleString('fr-FR'),
      subtitle: `sur ${matchingExecutions.length} exécution${matchingExecutions.length > 1 ? 's' : ''}`,
      icon: 'bi-people-fill',
      color: 'blue',
    },
    {
      title: 'Requêtes totales',
      value: totalReq.toLocaleString('fr-FR'),
      subtitle: `${successCount} réussies`,
      icon: 'bi-send-fill',
      color: 'green',
    },
    {
      title: 'Durée moyenne',
      value: `${avgDurationVal} ms`,
      subtitle: 'temps de réponse',
      icon: 'bi-clock-history',
      color: 'purple',
    },
    {
      title: 'P95',
      value: `${p95Val} ms`,
      subtitle: '95% des requêtes sous ce seuil',
      icon: 'bi-graph-up-arrow',
      color: 'purple',
    },
    {
      title: 'Taux erreur',
      value: `${errorRateVal.toFixed(2)}%`,
      subtitle: `${errorCount} erreur${errorCount > 1 ? 's' : ''}`,
      icon: 'bi-exclamation-triangle-fill',
      color: 'red',
    },
    {
      title: 'Débit moyen',
      value: `${throughputVal.toFixed(2)} req/s`,
      subtitle: 'requêtes / seconde',
      icon: 'bi-lightning-charge-fill',
      color: 'orange',
    },
  ]

  // Chart 1: Utilisateurs virtuels — une valeur réelle par exécution.
  const execLabels = matchingExecutions.map((e) =>
    new Date(e.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
    ' ' + new Date(e.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
  const vusData = {
    labels: execLabels,
    datasets: [{
      label: 'Utilisateurs virtuels (VUs)',
      data: matchingExecutions.map((e) => parseInt(e.users) || 0),
      borderColor: '#2563EB',
      backgroundColor: 'rgba(37, 99, 235, 0.12)',
      borderWidth: 2,
      tension: 0.3,
      fill: true,
      pointBackgroundColor: '#2563EB',
      pointRadius: 3,
    }],
  }
  const vusOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' as const, intersect: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 11 } } },
      y: { grid: { color: 'rgba(229, 231, 235, 0.5)' }, ticks: { color: '#9CA3AF', font: { size: 11 } }, beginAtZero: true },
    },
  }

  // Chart 2: Temps de réponse moyen — réel, par exécution.
  const responseTimeData = {
    labels: execLabels,
    datasets: [{
      label: 'Temps de réponse moyen (ms)',
      data: matchingExecutions.map((e) => {
        const results = e.stepResults.filter((r) => scopeLevel !== 'step' || r.stepId === selectedStep!.id)
        return results.length > 0 ? Math.round(results.reduce((s, r) => s + (r.responseTimeMs ?? 0), 0) / results.length) : 0
      }),
      borderColor: '#2563EB',
      borderWidth: 2, tension: 0.3, pointRadius: 3,
    }],
  }
  const responseTimeOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' as const, intersect: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 11 } } },
      y: { grid: { color: 'rgba(229, 231, 235, 0.5)' }, ticks: { color: '#9CA3AF', font: { size: 11 }, callback: (val: any) => `${val} ms` }, beginAtZero: true },
    },
  }

  // Chart 3: Taux d'erreur réel, par exécution.
  const errorRateData = {
    labels: execLabels,
    datasets: [{
      label: "Taux d'erreur (%)",
      data: matchingExecutions.map((e) => {
        const results = e.stepResults.filter((r) => scopeLevel !== 'step' || r.stepId === selectedStep!.id)
        const errs = results.filter((r) => r.status === 'error').length
        return results.length > 0 ? Math.round((errs / results.length) * 10000) / 100 : 0
      }),
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderWidth: 2, tension: 0.3, fill: true, pointBackgroundColor: '#EF4444', pointRadius: 3,
    }],
  }
  const errorRateOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context: any) => ` Taux d'erreur: ${context.raw}%` } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 11 } } },
      y: { grid: { color: 'rgba(229, 231, 235, 0.5)' }, ticks: { color: '#9CA3AF', font: { size: 11 }, callback: (val: any) => `${val}%` }, beginAtZero: true },
    },
  }

  // Table 1 (vue globale) : Top Applications par requêtes réelles.
  const reqsByApp = new Map<string, number>()
  allExecutions.forEach((e) => {
    reqsByApp.set(e.applicationId, (reqsByApp.get(e.applicationId) ?? 0) + e.stepResults.length)
  })
  const totalReqsAllApps = Array.from(reqsByApp.values()).reduce((a, b) => a + b, 0)
  const appColors = ['#2563EB', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899']
  const topApplications = Array.from(reqsByApp.entries())
    .map(([appId, reqs]) => ({ appId, name: appById.get(appId)?.name ?? appId, reqs, percent: totalReqsAllApps > 0 ? Math.round((reqs / totalReqsAllApps) * 1000) / 10 : 0 }))
    .sort((a, b) => b.reqs - a.reqs)
    .slice(0, 4)
    .map((a, i) => ({ ...a, reqs: a.reqs.toLocaleString('fr-FR'), color: appColors[i % appColors.length] }))

  // Durée moyenne réelle par scénario, à partir de toutes ses exécutions.
  const avgDurationForScenario = (scenarioId: string): number | null => {
    const results = allExecutions.filter((e) => e.scenarioId === scenarioId).flatMap((e) => e.stepResults)
    if (results.length === 0) return null
    return Math.round(results.reduce((s, r) => s + (r.responseTimeMs ?? 0), 0) / results.length)
  }
  const statusForDuration = (ms: number) => (ms > 350 ? { status: 'Inquiétant', color: 'danger' } : ms > 200 ? { status: 'Modéré', color: 'warning' } : { status: 'Optimal', color: 'success' })

  // Table 2 (vue globale) : Top Scénarios par durée réelle.
  const topScenarios = allScenarios
    .map((sc) => ({ scenario: sc, avg: avgDurationForScenario(sc.id) }))
    .filter((x): x is { scenario: Scenario; avg: number } => x.avg !== null)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 4)
    .map(({ scenario, avg }) => ({ id: scenario.id, name: scenario.name, duration: `${avg} ms`, ...statusForDuration(avg) }))

  // Table 2 (vue "Application") : scénarios de cette appli, durée réelle.
  const scenariosOfSelectedApp = scenariosForSelectedApp.map((sc) => {
    const avg = avgDurationForScenario(sc.id)
    const stepCount = allSteps.filter((s) => s.scenarioId === sc.id).length
    return avg !== null
      ? { id: sc.id, name: sc.name, duration: `${avg} ms`, stepCount, ...statusForDuration(avg) }
      : { id: sc.id, name: sc.name, duration: '—', stepCount, status: 'Jamais exécuté', color: 'neutral' }
  })

  // Table 2 (vue "Scénario") : étapes réelles, durée moyenne réelle par étape.
  const stepsOfSelectedScenario = stepsForSelectedScenario.map((st) => {
    const results = allExecutions.filter((e) => e.scenarioId === selectedScenario?.id)
      .flatMap((e) => e.stepResults)
      .filter((r) => r.stepId === st.id)
    const duration = results.length > 0
      ? Math.round(results.reduce((s, r) => s + (r.responseTimeMs ?? 0), 0) / results.length)
      : 0
    return { ...st, duration }
  })

  // Table 3 : Top Erreurs réelles, regroupées par code HTTP + message.
  const errorGroups = new Map<string, { code: string; name: string; count: number }>()
  allExecutions.forEach((e) => {
    e.stepResults.filter((r) => r.status === 'error').forEach((r) => {
      const key = `${r.httpStatus}-${r.error ?? ''}`
      const existing = errorGroups.get(key)
      if (existing) existing.count++
      else errorGroups.set(key, { code: String(r.httpStatus ?? '—'), name: r.error ?? 'Erreur inconnue', count: 1 })
    })
  })
  const totalErrorsAll = Array.from(errorGroups.values()).reduce((s, g) => s + g.count, 0)
  const topErrors = Array.from(errorGroups.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((g) => ({ ...g, count: g.count.toLocaleString('fr-FR'), rate: totalErrorsAll > 0 ? `${((g.count / totalErrorsAll) * 100).toFixed(2)}%` : '0%' }))

  // ---- Serveurs monitorés : agrégats réels calculés depuis serverMetrics
  // (jamais de valeur générée à l'affichage — seules les mesures elles-mêmes,
  // saisies explicitement via "+ Ajouter une mesure", sont des données
  // ponctuelles fournies par l'utilisateur). ----
  const metricsByServer = useMemo(() => {
    const map = new Map<string, ServerMetricSample[]>()
    allServerMetrics.forEach((m) => {
      const list = map.get(m.serverId) ?? []
      list.push(m)
      map.set(m.serverId, list)
    })
    for (const list of map.values()) list.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1))
    return map
  }, [allServerMetrics])

  const serverRows = allServers.map((srv) => {
    const samples = metricsByServer.get(srv.id) ?? []
    const n = samples.length
    const avgCpu = n > 0 ? samples.reduce((s, m) => s + m.cpuPercent, 0) / n : 0
    const avgRam = n > 0 ? samples.reduce((s, m) => s + m.ramPercent, 0) / n : 0
    const avgDisk = n > 0 ? samples.reduce((s, m) => s + m.diskPercent, 0) / n : 0
    const avgNetwork = n > 0 ? samples.reduce((s, m) => s + m.networkMbps, 0) / n : 0
    const latestHealth: ServerHealth | null = n > 0 ? samples[n - 1].health : null
    const latestRecordedAt: string | null = n > 0 ? samples[n - 1].recordedAt : null
    return { server: srv, samples, avgCpu, avgRam, avgDisk, avgNetwork, latestHealth, latestRecordedAt, count: n }
  })

  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const selectedServerRow = serverRows.find((r) => r.server.id === selectedServerId) ?? null

  const [showServerModal, setShowServerModal] = useState(false)
  const [editingServerId, setEditingServerId] = useState<string | null>(null)
  const [serverForm, setServerForm] = useState<{ name: string; address: string; type: Server['type']; applicationId: string }>({
    name: '', address: '', type: 'Application', applicationId: '',
  })
  const [showMetricModal, setShowMetricModal] = useState(false)
  const [metricForm, setMetricForm] = useState<{ cpuPercent: number; ramPercent: number; diskPercent: number; networkMbps: number; health: ServerHealth }>({
    cpuPercent: 50, ramPercent: 50, diskPercent: 40, networkMbps: 50, health: 'Sain',
  })
  const [serverSaving, setServerSaving] = useState(false)
  // Validation harmonisée (même pattern que Applications/CreateScenario) :
  // erreurs affichées au blur puis systématiquement à la tentative
  // d'enregistrement, bouton désactivé tant que le formulaire est invalide.
  const [serverFormTouched, setServerFormTouched] = useState<{ name?: boolean; address?: boolean }>({})
  const serverNameError = firstError(
    validateRequired(serverForm.name, 'Le nom'),
    validateMaxLength(serverForm.name, NAME_MAX_LENGTH, 'Le nom')
  )
  const serverAddressError = validateRequired(serverForm.address, "L'adresse")
  const isServerFormValid = !serverNameError && !serverAddressError

  const openAddServer = () => {
    if (!canEdit) return
    setEditingServerId(null)
    setServerForm({ name: '', address: '', type: 'Application', applicationId: '' })
    setServerFormTouched({})
    setShowServerModal(true)
  }
  const openEditServer = (srv: Server) => {
    if (!canEdit) return
    setEditingServerId(srv.id)
    setServerForm({ name: srv.name, address: srv.address, type: srv.type, applicationId: srv.applicationId ?? '' })
    setServerFormTouched({})
    setShowServerModal(true)
  }
  const handleSaveServer = async () => {
    if (!canEdit) return
    setServerFormTouched({ name: true, address: true })
    if (!isServerFormValid || serverSaving) return
    setServerSaving(true)
    try {
      const payload = { ...serverForm, applicationId: serverForm.applicationId || undefined }
      if (editingServerId) {
        await serversApi.update(editingServerId, payload)
      } else {
        await serversApi.create({ ...payload, createdAt: new Date().toISOString() })
      }
      await refetchServers()
      setShowServerModal(false)
    } finally {
      setServerSaving(false)
    }
  }
  const handleDeleteServer = async (srv: Server) => {
    if (!canEdit) return
    if (!window.confirm(`Supprimer le serveur "${srv.name}" et toutes ses mesures ?`)) return
    const samples = metricsByServer.get(srv.id) ?? []
    await Promise.all(samples.map((m) => serverMetricsApi.remove(m.id)))
    await serversApi.remove(srv.id)
    if (selectedServerId === srv.id) setSelectedServerId(null)
    await Promise.all([refetchServers(), refetchServerMetrics()])
  }
  const handleAddMetric = async () => {
    if (!canEdit) return
    if (!selectedServerId || serverSaving) return
    setServerSaving(true)
    try {
      await serverMetricsApi.create({
        serverId: selectedServerId,
        recordedAt: new Date().toISOString(),
        cpuPercent: metricForm.cpuPercent,
        ramPercent: metricForm.ramPercent,
        diskPercent: metricForm.diskPercent,
        networkMbps: metricForm.networkMbps,
        health: metricForm.health,
      })
      await refetchServerMetrics()
      setShowMetricModal(false)
    } finally {
      setServerSaving(false)
    }
  }

  const serverChartLabels = (selectedServerRow?.samples ?? []).map((m) =>
    new Date(m.recordedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
  const serverDiskData = {
    labels: serverChartLabels,
    datasets: [{
      label: `${selectedServerRow?.server.name ?? ''} — Disk (%)`,
      data: (selectedServerRow?.samples ?? []).map((m) => m.diskPercent),
      borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.3, pointRadius: 3,
    }],
  }
  const serverCpuData = {
    labels: serverChartLabels,
    datasets: [{ label: 'CPU (%)', data: (selectedServerRow?.samples ?? []).map((m) => m.cpuPercent), backgroundColor: '#F59E0B', borderRadius: 4 }],
  }
  const serverRamData = {
    labels: serverChartLabels,
    datasets: [{ label: 'RAM (%)', data: (selectedServerRow?.samples ?? []).map((m) => m.ramPercent), backgroundColor: '#8B5CF6', borderRadius: 4 }],
  }
  const serverNetworkData = {
    labels: serverChartLabels,
    datasets: [{ label: 'Network (Mbps)', data: (selectedServerRow?.samples ?? []).map((m) => m.networkMbps), borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.15)', fill: true, tension: 0.3, pointRadius: 3 }],
  }
  const smallChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } },
  }

  return (
    <div className="pt-content">
      {/* Page Header */}
      <div className="pt-page-header">
        <div className="page-title">
          <h1>Metriques</h1>
          <p>Analysez les performances de vos tests de charge</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <select
            className="pt-form-control"
            style={{ width: 'auto', fontSize: '13px' }}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="1h">Dernière heure</option>
            <option value="24h">Dernières 24 heures</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
          <TopBar searchPlaceholder="Rechercher une métrique..." />
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pt-text-muted)' }}>
        <i className="bi bi-speedometer2" style={{ color: 'var(--pt-primary)' }}></i> PERFORMANCE
      </div>

      {/* Sélecteur de niveau : Application → Scénario → Étape */}
      <div className="pt-card mb-4" style={{ padding: '1rem 1.25rem' }}>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-4">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pt-text-muted)', marginBottom: '6px', display: 'block' }}>
              Application
            </label>
            <select
              className="pt-form-control"
              style={{ width: '100%', fontSize: '13px' }}
              value={selectedApplicationId}
              onChange={(e) => handleAppChange(e.target.value)}
            >
              <option value="all">Toutes les applications</option>
              {allApplications.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pt-text-muted)', marginBottom: '6px', display: 'block' }}>
              Scénario
            </label>
            <select
              className="pt-form-control"
              style={{ width: '100%', fontSize: '13px' }}
              value={selectedScenarioId}
              onChange={(e) => handleScenarioChange(e.target.value)}
            >
              <option value="all">Tous les scénarios</option>
              {scenariosForSelectedApp.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}{selectedApplicationId === 'all' ? ` (${appById.get(sc.applicationId)?.name ?? ''})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pt-text-muted)', marginBottom: '6px', display: 'block' }}>
              Étape
            </label>
            <select
              className="pt-form-control"
              style={{ width: '100%', fontSize: '13px' }}
              value={selectedStepId}
              onChange={(e) => setSelectedStepId(e.target.value)}
              disabled={!selectedScenario}
            >
              <option value="all">Toutes les étapes</option>
              {stepsForSelectedScenario.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 mt-3" style={{ fontSize: '12.5px', color: 'var(--pt-text-muted)' }}>
          <i className="bi bi-funnel-fill" style={{ color: 'var(--pt-primary)' }}></i>
          Statistiques affichées pour : <strong style={{ color: 'var(--pt-text)' }}>{scopeLabel}</strong>
          {dataLoading && <span className="ms-2"><i className="bi bi-arrow-repeat pt-spin"></i> Chargement...</span>}
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="row g-3 mb-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="col-12 col-sm-6 col-lg col-xl">
            <div className="pt-stat-card h-100">
              <div className="stat-header">
                <div>
                  <div className="stat-label">{kpi.title}</div>
                  <div className="stat-value">{kpi.value}</div>
                  <div className="stat-trend neutral">{kpi.subtitle}</div>
                </div>
                <div className={`stat-icon ${kpi.color}`}>
                  <i className={`bi ${kpi.icon}`}></i>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3 Charts */}
      <div className="row g-3 mb-4">
        {/* Chart 1: Utilisateurs simultanés */}
        <div className="col-12 col-lg-6">
          <div className="pt-card h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  Utilisateurs simultanés
                </h6>
                <small style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>
                  Nombre de VUs virtuels actifs sur la période
                </small>
              </div>
              <span className="pt-pill info">Temps réel</span>
            </div>
            <div style={{ height: '260px' }}>
              <Line data={vusData} options={vusOptions} />
            </div>
          </div>
        </div>

        {/* Chart 2: Temps de réponse */}
        <div className="col-12 col-lg-6">
          <div className="pt-card h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  Temps de réponse
                </h6>
                <small style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>
                  Moyenne par exécution (ms) — P95 global : {p95Val} ms
                </small>
              </div>
              <span className="pt-pill warning">P95: {p95Val} ms</span>
            </div>
            <div style={{ height: '260px' }}>
              <Line data={responseTimeData} options={responseTimeOptions} />
            </div>
          </div>
        </div>

        {/* Chart 3: Taux d'erreur */}
        <div className="col-12">
          <div className="pt-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  Taux derreur
                </h6>
                <small style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>
                  Pourcentage de requêtes en erreur au cours du temps
                </small>
              </div>
              <span className="pt-pill danger">Seuil: 5%</span>
            </div>
            <div style={{ height: '220px' }}>
              <Line data={errorRateData} options={errorRateOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Tableaux contextuels : leur contenu s'adapte au niveau consulté */}
      <div className="row g-3 mb-4">
        {scopeLevel === 'all' && (
          <>
            {/* Table 1: Top Applications par requetes */}
            <div className="col-12 col-lg-4">
              <div className="pt-card h-100" style={{ padding: 0 }}>
                <div className="p-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
                  <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                    Top Applications par requetes
                  </h6>
                  <small style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>
                    Applications générant le plus de trafic
                  </small>
                </div>
                <div className="pt-table-wrapper">
                  <table className="pt-table">
                    <thead>
                      <tr>
                        <th>Application</th>
                        <th style={{ textAlign: 'right' }}>Requêtes</th>
                        <th style={{ textAlign: 'right', width: '30%' }}>Part</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topApplications.map((app, i) => (
                        <tr
                          key={i}
                          onClick={() => handleAppChange(app.appId)}
                          style={{ cursor: 'pointer' }}
                          title="Voir les statistiques de cette application"
                        >
                          <td>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{app.name}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '13px' }}>{app.reqs}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="d-flex align-items-center gap-2 justify-content-end">
                              <div style={{ width: '50px', height: '6px', background: 'var(--pt-border)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${app.percent}%`, height: '100%', background: app.color, borderRadius: '3px' }}></div>
                              </div>
                              <span style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)', minWidth: '35px' }}>{app.percent}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Table 2: Top Scenarios par duree (vue globale) */}
            <div className="col-12 col-lg-4">
              <div className="pt-card h-100" style={{ padding: 0 }}>
                <div className="p-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
                  <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                    Top Scenarios par duree
                  </h6>
                  <small style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>
                    Scénarios les plus lents à s'exécuter
                  </small>
                </div>
                <div className="pt-table-wrapper">
                  <table className="pt-table">
                    <thead>
                      <tr>
                        <th>Scénario</th>
                        <th style={{ textAlign: 'right' }}>Durée moy.</th>
                        <th style={{ textAlign: 'right' }}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topScenarios.map((sc, i) => (
                        <tr
                          key={i}
                          onClick={() => handleScenarioChange(sc.id)}
                          style={{ cursor: 'pointer' }}
                          title="Voir ce scénario"
                        >
                          <td>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{sc.name}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--pt-primary)', fontWeight: 600 }}>
                            {sc.duration}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`pt-pill ${sc.color}`}>
                              {sc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {scopeLevel === 'app' && (
          <div className="col-12 col-lg-8">
            <div className="pt-card h-100" style={{ padding: 0 }}>
              <div className="p-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  Scénarios de {selectedAppName}
                </h6>
                <small style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>
                  Cliquez sur un scénario pour voir uniquement ses statistiques
                </small>
              </div>
              <div className="pt-table-wrapper">
                <table className="pt-table">
                  <thead>
                    <tr>
                      <th>Scénario</th>
                      <th style={{ textAlign: 'right' }}>Étapes</th>
                      <th style={{ textAlign: 'right' }}>Durée moy.</th>
                      <th style={{ textAlign: 'right' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenariosOfSelectedApp.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted">
                          Aucun scénario pour cette application.
                        </td>
                      </tr>
                    ) : (
                      scenariosOfSelectedApp.map((sc, i) => (
                        <tr
                          key={i}
                          onClick={() => handleScenarioChange(sc.id)}
                          style={{ cursor: 'pointer' }}
                          title="Voir ce scénario"
                        >
                          <td><span style={{ fontSize: '13px', fontWeight: 600 }}>{sc.name}</span></td>
                          <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--pt-text-muted)' }}>{sc.stepCount}</td>
                          <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--pt-primary)', fontWeight: 600 }}>{sc.duration}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`pt-pill ${sc.color}`}>{sc.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {scopeLevel === 'scenario' && (
          <div className="col-12 col-lg-8">
            <div className="pt-card h-100" style={{ padding: 0 }}>
              <div className="p-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  Étapes de {selectedScenario?.name}
                </h6>
                <small style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>
                  Cliquez sur une étape pour voir uniquement ses statistiques
                </small>
              </div>
              <div className="pt-table-wrapper">
                <table className="pt-table">
                  <thead>
                    <tr>
                      <th>Méthode</th>
                      <th>Étape</th>
                      <th>URL / Ressource</th>
                      <th style={{ textAlign: 'right' }}>Durée moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepsOfSelectedScenario.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-muted">
                          Aucune étape définie pour ce scénario.
                        </td>
                      </tr>
                    ) : (
                      stepsOfSelectedScenario.map((st) => (
                        <tr
                          key={st.id}
                          onClick={() => setSelectedStepId(String(st.id))}
                          style={{ cursor: 'pointer' }}
                          title="Voir uniquement cette étape"
                        >
                          <td>
                            <span
                              style={{
                                padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                background: st.method === 'GET' ? 'var(--pt-primary-light)' : 'var(--pt-success-light)',
                                color: st.method === 'GET' ? 'var(--pt-primary)' : 'var(--pt-success)',
                              }}
                            >
                              {st.method}
                            </span>
                          </td>
                          <td><span style={{ fontSize: '13px', fontWeight: 600 }}>{st.name}</span></td>
                          <td>
                            <code style={{ fontSize: '12px', color: 'var(--pt-primary)', background: 'rgba(37,99,235,0.06)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                              {st.url}
                            </code>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--pt-primary)', fontWeight: 600 }}>{st.duration} ms</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {scopeLevel === 'step' && selectedStep && (
          <div className="col-12 col-lg-8">
            <div className="pt-card h-100">
              <h6 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>
                Détails de l'étape sélectionnée
              </h6>
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)', marginBottom: '4px' }}>Méthode</div>
                  <span
                    style={{
                      padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                      background: selectedStep.method === 'GET' ? 'var(--pt-primary-light)' : 'var(--pt-success-light)',
                      color: selectedStep.method === 'GET' ? 'var(--pt-primary)' : 'var(--pt-success)',
                    }}
                  >
                    {selectedStep.method}
                  </span>
                </div>
                <div className="col-6 col-md-9">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)', marginBottom: '4px' }}>Nom de l'étape</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedStep.name}</div>
                </div>
                <div className="col-12">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)', marginBottom: '4px' }}>URL / Ressource</div>
                  <code style={{ fontSize: '13px', color: 'var(--pt-primary)', background: 'rgba(37,99,235,0.06)', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>
                    {selectedStep.url}
                  </code>
                </div>
                <div className="col-12">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)', marginBottom: '4px' }}>Scénario parent</div>
                  <button
                    onClick={() => setSelectedStepId('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', color: 'var(--pt-primary)', fontWeight: 600 }}
                  >
                    <i className="bi bi-arrow-return-left me-1"></i>{selectedScenario?.name}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Erreurs : reste affiché à tous les niveaux */}
        <div className={scopeLevel === 'all' ? 'col-12 col-lg-4' : 'col-12 col-lg-4'}>
          <div className="pt-card h-100" style={{ padding: 0 }}>
            <div className="p-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
              <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                Top Erreurs
              </h6>
              <small style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>
                Principaux codes d'erreur rencontrés
              </small>
            </div>
            <div className="pt-table-wrapper">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Code & Description</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {topErrors.map((err, i) => (
                    <tr key={i}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="pt-pill danger" style={{ fontWeight: 700 }}>
                            {err.code}
                          </span>
                          <span style={{ fontSize: '12.5px', color: 'var(--pt-text)' }}>{err.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{err.count}</td>
                      <td style={{ textAlign: 'right', fontSize: '12.5px', color: 'var(--pt-danger)' }}>{err.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Serveurs monitorés — ressource indépendante (id_serveur), CRUD réel
          via JSON Server ; les agrégats CPU/RAM/Disk/Network/Health sont
          calculés depuis les vraies mesures enregistrées (serverMetrics),
          jamais générés à l'affichage. Séparé visuellement des métriques de
          performance ci-dessus (endpoints/scénarios) — ce sont deux
          domaines distincts qui ne doivent jamais être mélangés. */}
      <div className="d-flex align-items-center gap-2 mb-2 mt-2" style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pt-text-muted)' }}>
        <i className="bi bi-hdd-rack" style={{ color: 'var(--pt-primary)' }}></i> SERVER MONITORING
        <span className="pt-pill neutral" style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: 'normal' }}>
          <i className="bi bi-info-circle"></i> Mode démonstration — données simulées
        </span>
      </div>
      <div className="pt-card mb-4" style={{ padding: 0 }}>
        <div className="p-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ borderBottom: '1px solid var(--pt-border)' }}>
          <div>
            <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
              Serveurs monitorés <span className="pt-pill neutral ms-1" style={{ fontSize: '10.5px' }}>id_serveur</span>
            </h6>
            <small style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>
              Vue d'ensemble des ressources par serveur (CPU/RAM liés via id_serveur)
            </small>
          </div>
          {canEdit && (
            <button className="pt-btn-primary" style={{ fontSize: '12.5px' }} onClick={openAddServer}>
              <i className="bi bi-plus-lg"></i> Ajouter un serveur
            </button>
          )}
        </div>

        {serverRows.length === 0 ? (
          <div className="pt-empty-state">
            <i className="bi bi-hdd-stack" style={{ fontSize: '28px', color: 'var(--pt-text-light)' }}></i>
            <p>Aucun serveur monitoré pour l'instant.</p>
          </div>
        ) : (
        <div className="pt-table-wrapper">
          <table className="pt-table">
            <thead>
              <tr>
                <th>Serveur</th>
                <th>Adresse</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>CPU moyen</th>
                <th style={{ textAlign: 'right' }}>RAM moyenne</th>
                <th style={{ textAlign: 'right' }}>Disk moyen</th>
                <th style={{ textAlign: 'right' }}>Network moy.</th>
                <th style={{ textAlign: 'right' }}>Health</th>
                <th style={{ textAlign: 'right' }}>Mesures</th>
                <th style={{ textAlign: 'right' }}>Dernière mesure</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {serverRows.map(({ server: srv, avgCpu, avgRam, avgDisk, avgNetwork, latestHealth, latestRecordedAt, count }) => (
                <tr
                  key={srv.id}
                  onClick={() => setSelectedServerId(srv.id)}
                  style={{ cursor: 'pointer', background: selectedServerId === srv.id ? 'var(--pt-sidebar-item-hover)' : undefined }}
                >
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: avgCpu > 85 ? 'var(--pt-danger)' : avgCpu > 60 ? 'var(--pt-warning)' : 'var(--pt-success)', flexShrink: 0 }}></span>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{srv.name}</span>
                        {srv.applicationId && (
                          <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>
                            <i className="bi bi-link-45deg"></i> {appById.get(srv.applicationId)?.name ?? srv.applicationId}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><code style={{ fontSize: '12px' }}>{srv.address}</code></td>
                  <td><span className="pt-pill neutral">{srv.type}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: avgCpu > 85 ? 'var(--pt-danger)' : avgCpu > 60 ? 'var(--pt-warning)' : 'var(--pt-success)' }}>{count > 0 ? `${avgCpu.toFixed(1)}%` : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: avgRam > 85 ? 'var(--pt-danger)' : avgRam > 60 ? 'var(--pt-warning)' : 'var(--pt-success)' }}>{count > 0 ? `${avgRam.toFixed(1)}%` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{count > 0 ? `${avgDisk.toFixed(1)}%` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{count > 0 ? `${avgNetwork.toFixed(1)} Mbps` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    {latestHealth ? (
                      <span className={`pt-pill ${latestHealth === 'Sain' ? 'success' : latestHealth === 'Dégradé' ? 'warning' : 'danger'}`}>{latestHealth}</span>
                    ) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--pt-text-muted)' }}>{count}</td>
                  <td style={{ textAlign: 'right', fontSize: '12px', color: 'var(--pt-text-muted)' }}>
                    {latestRecordedAt ? new Date(latestRecordedAt).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <div className="d-flex justify-content-end gap-1">
                        <button className="topbar-icon" style={{ width: '28px', height: '28px' }} title="Modifier" onClick={() => openEditServer(srv)}>
                          <i className="bi bi-pencil" style={{ fontSize: '12px' }}></i>
                        </button>
                        <button className="topbar-icon" style={{ width: '28px', height: '28px' }} title="Supprimer" onClick={() => handleDeleteServer(srv)}>
                          <i className="bi bi-trash" style={{ fontSize: '12px', color: 'var(--pt-danger)' }}></i>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {selectedServerRow && (
        <div className="pt-card mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
              <i className="bi bi-hdd-network me-2 text-primary"></i>
              Détail — {selectedServerRow.server.name}
            </h6>
            {canEdit && (
              <button className="pt-btn-outline" style={{ fontSize: '12.5px' }} onClick={() => setShowMetricModal(true)}>
                <i className="bi bi-plus-lg"></i> Ajouter une mesure
              </button>
            )}
          </div>

          {selectedServerRow.count === 0 ? (
            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Aucune mesure enregistrée pour ce serveur.</p>
          ) : (
          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Disk par serveur</div>
              <div style={{ height: '220px' }}><Line data={serverDiskData} options={smallChartOptions} /></div>
            </div>
            <div className="col-12 col-lg-6">
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Network par serveur</div>
              <div style={{ height: '220px' }}><Line data={serverNetworkData} options={smallChartOptions} /></div>
            </div>
            <div className="col-12 col-lg-6">
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>CPU par serveur</div>
              <div style={{ height: '220px' }}><Bar data={serverCpuData} options={smallChartOptions} /></div>
            </div>
            <div className="col-12 col-lg-6">
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>RAM par serveur</div>
              <div style={{ height: '220px' }}><Bar data={serverRamData} options={smallChartOptions} /></div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Modale Ajouter / Modifier un serveur */}
      {showServerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--pt-card-bg)', borderRadius: 'var(--pt-radius)', padding: '2rem', width: '420px', maxWidth: '95vw', border: '1px solid var(--pt-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ fontWeight: 700, margin: 0 }}>{editingServerId ? 'Modifier le serveur' : 'Ajouter un serveur'}</h5>
              <button onClick={() => setShowServerModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--pt-text-muted)' }}>
                <i className="bi bi-x"></i>
              </button>
            </div>
            <div className="d-flex flex-column gap-3">
              <div>
                <label className="pt-form-label">Nom *</label>
                <input
                  className="pt-form-control"
                  style={{ width: '100%', borderColor: serverFormTouched.name && serverNameError ? 'var(--pt-danger)' : undefined }}
                  placeholder="ex: Serveur Web"
                  value={serverForm.name}
                  onChange={(e) => setServerForm((p) => ({ ...p, name: e.target.value }))}
                  onBlur={() => setServerFormTouched((t) => ({ ...t, name: true }))}
                />
                {serverFormTouched.name && serverNameError && (
                  <div style={{ color: 'var(--pt-danger)', fontSize: '12px', marginTop: '4px' }}>{serverNameError}</div>
                )}
              </div>
              <div>
                <label className="pt-form-label">Adresse *</label>
                <input
                  className="pt-form-control"
                  style={{ width: '100%', borderColor: serverFormTouched.address && serverAddressError ? 'var(--pt-danger)' : undefined }}
                  placeholder="ex: 192.168.1.10"
                  value={serverForm.address}
                  onChange={(e) => setServerForm((p) => ({ ...p, address: e.target.value }))}
                  onBlur={() => setServerFormTouched((t) => ({ ...t, address: true }))}
                />
                {serverFormTouched.address && serverAddressError && (
                  <div style={{ color: 'var(--pt-danger)', fontSize: '12px', marginTop: '4px' }}>{serverAddressError}</div>
                )}
              </div>
              <div>
                <label className="pt-form-label">Type</label>
                <select className="pt-form-control" style={{ width: '100%' }} value={serverForm.type} onChange={(e) => setServerForm((p) => ({ ...p, type: e.target.value as Server['type'] }))}>
                  <option>Application</option>
                  <option>Base de données</option>
                  <option>Load Balancer</option>
                  <option>Cache</option>
                  <option>Autre</option>
                </select>
              </div>
              <div>
                <label className="pt-form-label">Application associée</label>
                <select className="pt-form-control" style={{ width: '100%' }} value={serverForm.applicationId} onChange={(e) => setServerForm((p) => ({ ...p, applicationId: e.target.value }))}>
                  <option value="">Aucune</option>
                  {allApplications.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)', marginTop: '4px' }}>
                  Permet à une exécution de cette application de retrouver automatiquement ce serveur (Server Snapshot).
                </div>
              </div>
            </div>
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button onClick={() => setShowServerModal(false)} style={{ background: 'var(--pt-bg)', border: '1px solid var(--pt-border)', borderRadius: 'var(--pt-radius-sm)', padding: '8px 20px', cursor: 'pointer', fontSize: '13.5px' }}>
                Annuler
              </button>
              <button onClick={handleSaveServer} disabled={!isServerFormValid || serverSaving} className="pt-btn-primary" style={{ padding: '8px 20px' }}>
                {serverSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Ajouter une mesure réelle pour le serveur sélectionné */}
      {showMetricModal && selectedServerRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--pt-card-bg)', borderRadius: 'var(--pt-radius)', padding: '2rem', width: '420px', maxWidth: '95vw', border: '1px solid var(--pt-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ fontWeight: 700, margin: 0 }}>Nouvelle mesure — {selectedServerRow.server.name}</h5>
              <button onClick={() => setShowMetricModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--pt-text-muted)' }}>
                <i className="bi bi-x"></i>
              </button>
            </div>
            <div className="row g-3">
              <div className="col-6">
                <label className="pt-form-label">CPU (%)</label>
                <input type="number" min={0} max={100} className="pt-form-control" style={{ width: '100%' }} value={metricForm.cpuPercent} onChange={(e) => setMetricForm((p) => ({ ...p, cpuPercent: +e.target.value }))} />
              </div>
              <div className="col-6">
                <label className="pt-form-label">RAM (%)</label>
                <input type="number" min={0} max={100} className="pt-form-control" style={{ width: '100%' }} value={metricForm.ramPercent} onChange={(e) => setMetricForm((p) => ({ ...p, ramPercent: +e.target.value }))} />
              </div>
              <div className="col-6">
                <label className="pt-form-label">Disk (%)</label>
                <input type="number" min={0} max={100} className="pt-form-control" style={{ width: '100%' }} value={metricForm.diskPercent} onChange={(e) => setMetricForm((p) => ({ ...p, diskPercent: +e.target.value }))} />
              </div>
              <div className="col-6">
                <label className="pt-form-label">Network (Mbps)</label>
                <input type="number" min={0} className="pt-form-control" style={{ width: '100%' }} value={metricForm.networkMbps} onChange={(e) => setMetricForm((p) => ({ ...p, networkMbps: +e.target.value }))} />
              </div>
              <div className="col-6">
                <label className="pt-form-label">Health</label>
                <select className="pt-form-control" style={{ width: '100%' }} value={metricForm.health} onChange={(e) => setMetricForm((p) => ({ ...p, health: e.target.value as ServerHealth }))}>
                  <option>Sain</option>
                  <option>Dégradé</option>
                  <option>Critique</option>
                </select>
              </div>
            </div>
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button onClick={() => setShowMetricModal(false)} style={{ background: 'var(--pt-bg)', border: '1px solid var(--pt-border)', borderRadius: 'var(--pt-radius-sm)', padding: '8px 20px', cursor: 'pointer', fontSize: '13.5px' }}>
                Annuler
              </button>
              <button onClick={handleAddMetric} disabled={serverSaving} className="pt-btn-primary" style={{ padding: '8px 20px' }}>
                {serverSaving ? 'Enregistrement...' : 'Ajouter la mesure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-3"
        style={{ borderTop: '1px solid var(--pt-border)', fontSize: '12px', color: 'var(--pt-text-muted)' }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-clock-history"></i>
          <span>Metriques mises a jour toutes les 5 minutes</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-globe"></i>
          <span>Fuseau horaire UTC+01:00 Casablanca</span>
        </div>
      </div>
    </div>
  )
}

export default Metriques
