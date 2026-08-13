import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
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
import { Application, Execution, Scenario, Step, StepResult } from '../types'
import { executionsApi } from '../services/api/executions'
import { scenariosApi } from '../services/api/scenarios'
import { useAuth } from '../context/AuthContext'
import { applicationsApi } from '../services/api/applications'
import { stepsApi } from '../services/api/steps'
import { setExecutionPrefill } from '../utils/executionBridge'
import { computePerformanceMetrics, durationToSeconds } from '../utils/metrics'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

/** Réindente le body de réponse en JSON lisible quand c'est possible ;
 * sinon affiche le texte brut tel que reçu de l'API. */
function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function ExecutionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit } = useAuth()
  const [activeTab, setActiveTab] = useState('Vue ensemble')

  const [execution, setExecution] = useState<Execution | null>(null)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Récupère la VRAIE exécution correspondant à l'ID de la route sur JSON
  // Server, ainsi que son scénario, son application et ses étapes réelles —
  // chaque exécution affiche donc ses propres données, jamais les mêmes.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    executionsApi.getById(id)
      .then(async (exec) => {
        if (cancelled) return
        setExecution(exec)
        const [sc, app, stepList] = await Promise.all([
          scenariosApi.getById(exec.scenarioId).catch(() => null),
          applicationsApi.getById(exec.applicationId).catch(() => null),
          stepsApi.getByScenario(exec.scenarioId).catch(() => []),
        ])
        if (cancelled) return
        setScenario(sc)
        setApplication(app)
        setSteps(stepList)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Exécution introuvable'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const statusBadge = (() => {
    switch (execution?.status) {
      case 'Réussie': return { cls: 'success', icon: 'bi-check-circle-fill', text: 'Terminée avec succès' }
      case 'Avec erreurs': return { cls: 'warning', icon: 'bi-exclamation-triangle-fill', text: 'Terminée avec erreurs' }
      case 'Échouée': return { cls: 'danger', icon: 'bi-x-circle-fill', text: 'Échouée' }
      case 'En cours': return { cls: 'info', icon: 'bi-play-circle-fill', text: 'En cours' }
      case 'Suspendue': return { cls: 'neutral', icon: 'bi-pause-circle-fill', text: 'Suspendue' }
      default: return { cls: 'neutral', icon: 'bi-question-circle-fill', text: 'Statut inconnu' }
    }
  })()

  const handleRelaunch = () => {
    if (!canEdit) return
    if (scenario && application) {
      setExecutionPrefill({ scenario: scenario.name, application: application.name })
    }
    navigate('/executions')
  }

  const stepResults = execution?.stepResults ?? []
  // Étapes réellement envoyées — exclut les 'skipped' (Étape active
  // décochée) des graphiques de temps de réponse, où un 0ms serait trompeur
  // (laisserait croire à une requête ultra-rapide plutôt qu'à une absence
  // de requête).
  const sentStepResults = stepResults.filter((r) => r.status !== 'skipped')
  const stepById = new Map(steps.map((s) => [s.id, s]))
  const perf = computePerformanceMetrics(stepResults, execution ? durationToSeconds(execution.duration) : 0)
  const totalReq = perf.totalRequests
  const successCount = perf.successCount
  const errorCount = perf.errorCount
  const successRate = perf.successRate
  const avgResponseTime = perf.avgResponseTime

  const kpis = [
    { label: 'Durée totale', value: execution?.duration ?? '—', icon: 'bi-clock-history', color: 'blue' },
    { label: 'Utilisateurs virtuels', value: execution?.users ?? '—', icon: 'bi-people', color: 'purple' },
    { label: 'Requêtes totales', value: String(totalReq), icon: 'bi-arrow-repeat', color: 'blue' },
    { label: 'Taux réussite', value: `${successRate.toFixed(1)}%`, icon: 'bi-check-circle', color: 'green' },
    { label: 'Taux erreur', value: `${perf.errorRate.toFixed(1)}%`, icon: 'bi-exclamation-triangle', color: 'red' },
    { label: 'Moyenne', value: `${avgResponseTime} ms`, icon: 'bi-lightning-charge', color: 'orange' },
    { label: 'Min', value: `${perf.minResponseTime} ms`, icon: 'bi-arrow-down-circle', color: 'green' },
    { label: 'Max', value: `${perf.maxResponseTime} ms`, icon: 'bi-arrow-up-circle', color: 'red' },
    { label: 'P95', value: `${perf.p95ResponseTime} ms`, icon: 'bi-graph-up-arrow', color: 'purple' },
    { label: 'Débit', value: `${perf.throughput.toFixed(2)} req/s`, icon: 'bi-speedometer2', color: 'blue' },
  ]

  // Line Chart : temps de réponse RÉEL, étape par étape (dans l'ordre
  // d'exécution) — remplace toute télémétrie CPU/RAM fictive.
  const lineChartData = {
    labels: sentStepResults.map((r) => stepById.get(r.stepId)?.name ?? r.stepId),
    datasets: [
      {
        label: 'Temps de réponse (ms)',
        data: sentStepResults.map((r) => r.responseTimeMs ?? 0),
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  }
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { title: { display: true, text: 'ms' }, grid: { color: 'rgba(0,0,0,0.05)' } },
    },
  }

  // Doughnut Chart : répartition réelle succès/erreurs
  const doughnutData = {
    labels: [`Succès (${successCount})`, `Erreurs (${errorCount})`],
    datasets: [{ data: [successCount, errorCount], backgroundColor: ['#22C55E', '#EF4444'], hoverOffset: 4, borderWidth: 0 }],
  }
  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12 } } },
    cutout: '70%',
  }

  // Bar Chart : répartition réelle des temps de réponse par tranche
  const buckets = [
    { label: '< 100ms', min: 0, max: 100 },
    { label: '100-300ms', min: 100, max: 300 },
    { label: '300-600ms', min: 300, max: 600 },
    { label: '600ms-1s', min: 600, max: 1000 },
    { label: '> 1s', min: 1000, max: Infinity },
  ]
  const barChartData = {
    labels: buckets.map((b) => b.label),
    datasets: [{
      label: 'Nombre de requêtes',
      data: buckets.map((b) => sentStepResults.filter((r) => (r.responseTimeMs ?? 0) >= b.min && (r.responseTimeMs ?? 0) < b.max).length),
      backgroundColor: '#2563EB',
      borderRadius: 6,
    }],
  }
  const barChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { precision: 0 } } },
  }

  // Chronologie & logs : construits à partir des vrais résultats d'étapes.
  const vuLabel = (r: StepResult) => (r.vu !== undefined ? ` [VU ${r.vu + 1}]` : '')
  const timelineEvents = stepResults.map((r, i) => {
    const step = stepById.get(r.stepId)
    return {
      title: `Étape ${i + 1} — ${step?.name ?? r.stepId}${vuLabel(r)}`,
      desc: r.status === 'success'
        ? `${r.request?.method} ${r.request?.url} → ${r.httpStatus} (${r.responseTimeMs} ms)`
        : r.status === 'skipped'
        ? 'Étape ignorée (marquée inactive) — aucune requête envoyée.'
        : (r.error ?? `Échec sur ${r.request?.method} ${r.request?.url}`),
      type: r.status === 'success' ? 'success' : r.status === 'skipped' ? 'skipped' : 'warning',
    }
  })

  const recentLogs = stepResults.map((r, i) => {
    const step = stepById.get(r.stepId)
    return {
      time: `#${i + 1}`,
      level: r.status === 'success' ? 'INFO' : r.status === 'skipped' ? 'SKIP' : 'ERROR',
      message: r.status === 'success'
        ? `${r.request?.method} ${r.request?.url} → ${r.httpStatus} ${r.response?.statusText} en ${r.responseTimeMs}ms (${step?.name}${vuLabel(r)})`
        : r.status === 'skipped'
        ? `Étape ignorée (inactive) — ${step?.name}${vuLabel(r)}`
        : `${r.error} — ${r.request?.method} ${r.request?.url}${vuLabel(r)}`,
    }
  }).reverse()

  const tabs = ['Vue ensemble', 'Graphiques', 'Étapes & Requêtes', 'Logs']

  if (loading) {
    return (
      <div className="pt-content">
        <div className="pt-empty-state">
          <i className="bi bi-arrow-repeat pt-spin" style={{ fontSize: '28px', color: 'var(--pt-primary)' }}></i>
          <p>Chargement de l'exécution...</p>
        </div>
      </div>
    )
  }

  if (error || !execution) {
    return (
      <div className="pt-content">
        <div className="pt-alert-banner danger">
          <i className="bi bi-exclamation-triangle-fill"></i>
          {error ?? 'Exécution introuvable.'}
        </div>
        <Link to="/executions" className="pt-btn-outline mt-3 d-inline-block">
          <i className="bi bi-arrow-left"></i> Retour aux exécutions
        </Link>
      </div>
    )
  }

  return (
    <div className="pt-content">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0" style={{ fontSize: '13px' }}>
            <li className="breadcrumb-item">
              <Link to="/executions" className="text-decoration-none text-muted">Exécutions</Link>
            </li>
            <li className="breadcrumb-item active text-primary fw-semibold" aria-current="page">
              Détail exécution #{id}
            </li>
          </ol>
        </nav>
        <TopBar searchPlaceholder="Rechercher dans l'exécution..." />
      </div>

      <div className="pt-page-header">
        <div className="page-title">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <h1>Exécution #{id} — {application?.name ?? 'Application inconnue'}</h1>
            <span className={`pt-pill ${statusBadge.cls}`}>
              <i className={`bi ${statusBadge.icon}`}></i> {statusBadge.text}
            </span>
          </div>
          <p>
            Scénario <Link to={`/scenarios?q=${encodeURIComponent(scenario?.name ?? '')}`} className="text-decoration-none">{scenario?.name ?? '—'}</Link>
            {' '}— lancée le {new Date(execution.startedAt).toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="header-actions">
          {canEdit && (
            <button className="pt-btn-primary" onClick={handleRelaunch}>
              <i className="bi bi-arrow-repeat"></i> Relancer le test
            </button>
          )}
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pt-text-muted)' }}>
        <i className="bi bi-speedometer2" style={{ color: 'var(--pt-primary)' }}></i> PERFORMANCE
      </div>
      <div className="row g-3 mb-4">
        {kpis.map((kpi, idx) => (
          <div className="col-12 col-sm-6 col-md-4 col-xl-2" key={idx}>
            <div className="pt-stat-card">
              <div className="stat-header">
                <span className="stat-label">{kpi.label}</span>
                <div className={`stat-icon ${kpi.color}`}><i className={`bi ${kpi.icon}`}></i></div>
              </div>
              <div className="stat-value" style={{ fontSize: '22px' }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Server Snapshot — état du serveur au moment de l'exécution,
          volontairement séparé des métriques de performance ci-dessus.
          Tant qu'aucun backend (Spring Boot + JMeter) n'est branché, seule
          la relation avec le serveur est connue ; les valeurs restent en
          attente plutôt que d'être inventées (voir services/api/serverSnapshot.ts). */}
      <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--pt-text-muted)' }}>
        <i className="bi bi-hdd-rack" style={{ color: 'var(--pt-primary)' }}></i> SERVER MONITORING
      </div>
      <div className="pt-card mb-4">
        {!execution.serverSnapshot ? (
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
            <i className="bi bi-info-circle me-1"></i>
            Aucun serveur associé à {application?.name ?? 'cette application'}. Associez-en un depuis la page Métriques pour préparer le suivi.
          </p>
        ) : (
          <>
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-4">
                <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>Server Name</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  <i className="bi bi-hdd-network me-1 text-primary"></i>
                  {execution.serverSnapshot.serverName ?? execution.serverSnapshot.serverId}
                </div>
              </div>
              <div className="col-6 col-md-4">
                <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>Application</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{execution.serverSnapshot.applicationName ?? '—'}</div>
              </div>
              <div className="col-6 col-md-4">
                <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>Captured At</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {execution.serverSnapshot.capturedAt ? new Date(execution.serverSnapshot.capturedAt).toLocaleString('fr-FR') : '—'}
                </div>
              </div>
            </div>
            {execution.serverSnapshot.cpu === null ? (
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                <i className="bi bi-hourglass-split me-1"></i>
                En attente des métriques du backend (Spring Boot + JMeter) — l'architecture est prête, les valeurs arriveront automatiquement une fois le backend branché.
              </p>
            ) : (
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>CPU</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{execution.serverSnapshot.cpu}%</div>
                </div>
                <div className="col-6 col-md-3">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>RAM</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{execution.serverSnapshot.ram}%</div>
                </div>
                <div className="col-6 col-md-3">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>Disk</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{execution.serverSnapshot.disk}%</div>
                </div>
                <div className="col-6 col-md-3">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>Network</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{execution.serverSnapshot.network} Mbps</div>
                </div>
                <div className="col-6 col-md-3">
                  <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>Health</div>
                  <span className={`pt-pill ${execution.serverSnapshot.health === 'Sain' ? 'success' : execution.serverSnapshot.health === 'Dégradé' ? 'warning' : 'danger'}`}>
                    {execution.serverSnapshot.health}
                  </span>
                </div>
                {execution.serverSnapshot.source && (
                  <div className="col-12">
                    <span className={`pt-pill ${execution.serverSnapshot.simulated ? 'neutral' : 'info'}`}>
                      <i className={`bi ${execution.serverSnapshot.simulated ? 'bi-info-circle' : 'bi-broadcast'} me-1`}></i>
                      {execution.serverSnapshot.simulated
                        ? execution.serverSnapshot.source
                        : `Métriques réelles — source : ${execution.serverSnapshot.source}`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6">
          <div className="pt-card h-100">
            <div className="pt-card-title d-flex align-items-center justify-content-between">
              <span><i className="bi bi-globe2 me-2 text-primary"></i>Application testée</span>
            </div>
            <div className="mt-3">
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span className="text-muted">Nom</span>
                <span className="fw-semibold">{application?.name ?? '—'}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span className="text-muted">URL cible</span>
                <a href={application?.url} target="_blank" rel="noreferrer" className="text-primary text-decoration-none fw-semibold">
                  {application?.url} <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '11px' }}></i>
                </a>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span className="text-muted">Type</span>
                <span className="fw-semibold">{application?.type ?? '—'}</span>
              </div>
              <div className="d-flex justify-content-between py-2">
                <span className="text-muted">Authentification</span>
                <span className="fw-semibold">{application?.authMethod ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="pt-card h-100">
            <div className="pt-card-title d-flex align-items-center justify-content-between">
              <span><i className="bi bi-diagram-3 me-2 text-primary"></i>Paramètres du scénario</span>
            </div>
            <div className="mt-3">
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span className="text-muted">Scénario</span>
                <span className="fw-semibold">{scenario?.name ?? '—'}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span className="text-muted">Description</span>
                <span className="fw-semibold text-end" style={{ maxWidth: '60%' }}>{scenario?.description ?? '—'}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom">
                <span className="text-muted">Utilisateurs virtuels</span>
                <span className="fw-semibold">{execution.users}</span>
              </div>
              <div className="d-flex justify-content-between py-2">
                <span className="text-muted">Nombre d'étapes</span>
                <span className="fw-semibold">{steps.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-card mb-4">
        <div className="pt-card-title mb-3">
          <i className="bi bi-hourglass-split me-2 text-primary"></i>
          Chronologie des étapes exécutées
        </div>
        {timelineEvents.length === 0 ? (
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Aucune étape exécutée pour le moment.</p>
        ) : (
        <div className="row g-3">
          {timelineEvents.map((evt, idx) => (
            <div className="col-12 col-md-6 col-lg-4" key={idx}>
              <div className="p-3 rounded border" style={{ background: 'var(--pt-bg)', borderColor: 'var(--pt-border)' }}>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className={`badge ${evt.type === 'success' ? 'bg-success-subtle text-success' : evt.type === 'skipped' ? 'bg-secondary-subtle text-secondary' : 'bg-warning-subtle text-warning'}`} style={{ fontSize: '10.5px' }}>
                    {evt.type.toUpperCase()}
                  </span>
                </div>
                <div className="fw-semibold text-dark mb-1" style={{ fontSize: '13.5px' }}>{evt.title}</div>
                <div className="text-muted font-monospace" style={{ fontSize: '11.5px', wordBreak: 'break-word' }}>{evt.desc}</div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <div className="border-bottom mb-4">
        <ul className="nav nav-tabs border-0" style={{ gap: '0.5rem' }}>
          {tabs.map((tab) => (
            <li className="nav-item" key={tab}>
              <button
                className={`nav-link border-0 fw-medium px-3 py-2 ${activeTab === tab ? 'active fw-semibold' : 'text-muted'}`}
                style={{ background: 'transparent', borderBottom: activeTab === tab ? '3px solid var(--pt-primary)' : 'none', borderRadius: 0, fontSize: '13.5px', color: activeTab === tab ? 'var(--pt-primary)' : undefined }}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {(activeTab === 'Vue ensemble' || activeTab === 'Graphiques') && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-xl-6">
            <div className="pt-card h-100">
              <div className="pt-card-title d-flex justify-content-between align-items-center mb-3">
                <span><i className="bi bi-graph-up me-2 text-primary"></i>Temps de réponse par étape</span>
              </div>
              <div style={{ height: '280px' }}><Line data={lineChartData} options={lineChartOptions} /></div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="pt-card h-100">
              <div className="pt-card-title mb-3"><i className="bi bi-pie-chart me-2 text-success"></i>Taux de réussite</div>
              <div style={{ height: '240px', position: 'relative' }}><Doughnut data={doughnutData} options={doughnutOptions} /></div>
              <div className="text-center mt-2">
                <div className="fw-bold text-success" style={{ fontSize: '18px' }}>{successRate.toFixed(1)}% Succès</div>
                <small className="text-muted">{successCount} / {totalReq} requêtes</small>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="pt-card h-100">
              <div className="pt-card-title mb-3"><i className="bi bi-bar-chart me-2 text-primary"></i>Répartition des temps de réponse</div>
              <div style={{ height: '280px' }}><Bar data={barChartData} options={barChartOptions} /></div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'Vue ensemble' || activeTab === 'Étapes & Requêtes') && (
        <div className="row g-3">
          <div className="col-12">
            <div className="pt-card">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="pt-card-title mb-0"><i className="bi bi-list-check me-2 text-primary"></i>Résultat de chaque étape</div>
              </div>
              <div className="pt-table-wrapper">
                <table className="pt-table">
                  <thead>
                    <tr>
                      <th>Méthode & Endpoint</th>
                      <th>Temps de réponse</th>
                      <th>Code HTTP</th>
                      <th>Statut</th>
                      <th>Détail requête / réponse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepResults.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-muted py-3">Aucun résultat pour cette exécution.</td></tr>
                    ) : stepResults.map((r, i) => {
                      const step = stepById.get(r.stepId)
                      if (r.status === 'skipped') {
                        return (
                          <tr key={i} style={{ opacity: 0.65 }}>
                            <td>
                              <span className="font-monospace fw-medium" style={{ fontSize: '13px' }}>{step?.name ?? r.stepId}</span>
                              {r.vu !== undefined && <span className="pt-pill neutral ms-2" style={{ fontSize: '10px' }}>VU {r.vu + 1}</span>}
                              <div className="text-muted" style={{ fontSize: '11px' }}>Étape inactive — aucune requête envoyée</div>
                            </td>
                            <td>—</td>
                            <td>—</td>
                            <td><span className="pt-pill neutral">Ignorée</span></td>
                            <td></td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={i}>
                          <td>
                            <span className={`badge me-2 ${r.request?.method === 'GET' ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success'}`} style={{ minWidth: '45px' }}>
                              {r.request?.method}
                            </span>
                            <span className="font-monospace fw-medium" style={{ fontSize: '13px' }}>{r.request?.url}</span>
                            {r.vu !== undefined && <span className="pt-pill neutral ms-2" style={{ fontSize: '10px' }}>VU {r.vu + 1}</span>}
                            <div className="text-muted" style={{ fontSize: '11px' }}>{step?.name}</div>
                          </td>
                          <td className={r.status === 'error' ? 'fw-bold text-danger' : 'fw-bold'}>{r.responseTimeMs} ms</td>
                          <td><span className="badge bg-light text-dark border">{r.httpStatus}</span></td>
                          <td><span className={`pt-pill ${r.status === 'success' ? 'success' : 'danger'}`}>{r.status === 'success' ? 'Réussie' : 'Échec'}</span></td>
                          <td>
                            {r.request?.body && (
                              <details>
                                <summary style={{ cursor: 'pointer', fontSize: '11.5px', color: 'var(--pt-primary)' }}>Body requête</summary>
                                <pre style={{ fontSize: '10.5px', background: 'var(--pt-bg)', padding: '4px 6px', borderRadius: '4px', marginTop: '4px' }}>{r.request.body}</pre>
                              </details>
                            )}
                            {r.response && (
                              <details>
                                <summary style={{ cursor: 'pointer', fontSize: '11.5px', color: 'var(--pt-primary)' }}>Réponse</summary>
                                <div style={{ fontSize: '10.5px', background: 'var(--pt-bg)', padding: '6px 8px', borderRadius: '4px', marginTop: '4px' }}>
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Code HTTP :</strong> {r.httpStatus} {r.response.statusText}
                                  </div>
                                  <div style={{ marginBottom: '4px' }}>
                                    <strong>Temps de réponse :</strong> {r.responseTimeMs} ms
                                  </div>
                                  {r.response.headers && Object.keys(r.response.headers).length > 0 && (
                                    <div style={{ marginBottom: '4px' }}>
                                      <strong>Response Headers :</strong>
                                      <pre style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {Object.entries(r.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                                      </pre>
                                    </div>
                                  )}
                                  {r.response.body && (
                                    <div>
                                      <strong>Response Body :</strong>
                                      <pre style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {formatResponseBody(r.response.body)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                            {r.error && <div className="text-danger" style={{ fontSize: '11.5px' }}>{r.error}</div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'Vue ensemble' || activeTab === 'Logs') && (
        <div className="row g-3 mt-1">
          <div className="col-12">
            <div className="pt-card">
              <div className="pt-card-title mb-3"><i className="bi bi-terminal me-2 text-info"></i>Logs de l'exécution</div>
              <div style={{ maxHeight: '320px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', background: 'var(--pt-bg)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--pt-border)' }}>
                {recentLogs.length === 0 ? (
                  <p className="text-muted mb-0">Aucun log disponible.</p>
                ) : recentLogs.map((log, idx) => (
                  <div key={idx} className="d-flex gap-2 mb-2 pb-2 border-bottom border-light-subtle align-items-start">
                    <span className="text-muted" style={{ minWidth: '30px' }}>{log.time}</span>
                    <span className={`badge ${log.level === 'ERROR' ? 'bg-danger text-white' : log.level === 'SKIP' ? 'bg-secondary-subtle text-secondary' : 'bg-info-subtle text-info'}`} style={{ minWidth: '45px', fontSize: '10px' }}>{log.level}</span>
                    <span className="text-dark" style={{ wordBreak: 'break-word' }}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExecutionDetail
