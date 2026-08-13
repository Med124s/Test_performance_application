import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
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
import { Application, Execution, Scenario } from '../types'
import { applicationsApi } from '../services/api/applications'
import { scenariosApi } from '../services/api/scenarios'
import { executionsApi } from '../services/api/executions'
import { useApiList } from '../hooks/useApiResource'
import { computePerformanceMetrics, durationToSeconds, percentile } from '../utils/metrics'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

interface Rapport {
  id: string
  execution: string
  executionId: string
  scenario: string
  app: string
  date: string
  avgResponse: string
  capacite: string
  vus: number
  statut: 'Généré' | 'En cours' | 'Erreur'
  kpis?: {
    min: string
    moy: string
    max: string
    p90: string
    p95: string
    p99: string
    throughput: string
    erreurs: string
  }
  recommandations?: string[]
}

/** Recommandations générées à partir de vrais seuils calculés sur
 * l'exécution (pas de texte figé indépendant des résultats). */
function buildRecommendations(errorRate: number, avgResponseTime: number, p95: number): string[] {
  const recs: string[] = []
  if (errorRate === 0) recs.push('Aucune erreur détectée sur cette exécution.')
  else if (errorRate < 2) recs.push(`Taux d'erreur faible (${errorRate.toFixed(1)}%) — à surveiller.`)
  else if (errorRate < 10) recs.push(`Taux d'erreur notable (${errorRate.toFixed(1)}%) — investiguer les étapes en échec.`)
  else recs.push(`CRITIQUE : taux d'erreur élevé (${errorRate.toFixed(1)}%) — revoir la capacité ou la stabilité de l'application testée.`)

  if (p95 > 1000) recs.push(`P95 élevé (${p95} ms) — au moins 5% des requêtes dépassent 1s, optimiser les endpoints les plus lents.`)
  else if (avgResponseTime > 500) recs.push(`Temps de réponse moyen élevé (${avgResponseTime} ms) — envisager un cache ou une optimisation des requêtes.`)
  else recs.push('Performance globale satisfaisante sur cette exécution.')

  return recs
}

function buildRapport(exec: Execution, scenarioName: string, appName: string): Rapport {
  const durationSec = durationToSeconds(exec.duration)
  const perf = computePerformanceMetrics(exec.stepResults, durationSec)
  const responseTimes = exec.stepResults
    .map((r) => r.responseTimeMs)
    .filter((v): v is number => typeof v === 'number')

  const statut: Rapport['statut'] =
    exec.status === 'En cours' ? 'En cours' : exec.status === 'Échouée' ? 'Erreur' : 'Généré'

  const hasResults = perf.totalRequests > 0

  return {
    id: `#RPT-${exec.id}`,
    execution: `#EXEC-${exec.id}`,
    executionId: exec.id,
    scenario: scenarioName,
    app: appName,
    date: new Date(exec.startedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    avgResponse: hasResults ? `${perf.avgResponseTime} ms` : '-',
    capacite: exec.users,
    vus: parseInt(exec.users) || 0,
    statut,
    kpis: hasResults
      ? {
          min: `${perf.minResponseTime} ms`,
          moy: `${perf.avgResponseTime} ms`,
          max: `${perf.maxResponseTime} ms`,
          p90: `${Math.round(percentile(responseTimes, 90))} ms`,
          p95: `${perf.p95ResponseTime} ms`,
          p99: `${Math.round(percentile(responseTimes, 99))} ms`,
          throughput: `${perf.throughput.toFixed(2)} req/s`,
          erreurs: `${perf.errorRate.toFixed(1)}%`,
        }
      : undefined,
    recommandations: hasResults ? buildRecommendations(perf.errorRate, perf.avgResponseTime, perf.p95ResponseTime) : undefined,
  }
}

function Rapports() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'all' | 'genere' | 'en_cours' | 'erreur'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRapport, setSelectedRapport] = useState<Rapport | null>(null)

  // Un rapport par exécution réelle — mêmes données que Historique /
  // ExecutionDetail, calculées via le même module de métriques centralisé.
  const { data: allExecutions, loading: executionsLoading } = useApiList<Execution>(() => executionsApi.getAll())
  const { data: allScenarios, loading: scenariosLoading } = useApiList<Scenario>(() => scenariosApi.getAll())
  const { data: allApplications, loading: appsLoading } = useApiList<Application>(() => applicationsApi.getAll())
  const dataLoading = executionsLoading || scenariosLoading || appsLoading

  const scenarioById = useMemo(() => new Map(allScenarios.map((s) => [s.id, s])), [allScenarios])
  const appById = useMemo(() => new Map(allApplications.map((a) => [a.id, a])), [allApplications])

  const rapportsData: Rapport[] = useMemo(() => {
    return [...allExecutions]
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .map((exec) => buildRapport(
        exec,
        scenarioById.get(exec.scenarioId)?.name ?? exec.scenarioId,
        appById.get(exec.applicationId)?.name ?? exec.applicationId
      ))
  }, [allExecutions, scenarioById, appById])

  const filteredRapports = rapportsData.filter((r) => {
    if (activeTab === 'genere' && r.statut !== 'Généré') return false
    if (activeTab === 'en_cours' && r.statut !== 'En cours') return false
    if (activeTab === 'erreur' && r.statut !== 'Erreur') return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return r.id.toLowerCase().includes(q) || r.scenario.toLowerCase().includes(q) || r.app.toLowerCase().includes(q)
    }
    return true
  })

  // Analyse de capacité réelle : un point par exécution réelle (VUs réels vs
  // temps de réponse moyen / taux d'erreur réels), pas une courbe inventée.
  const capacityPoints = useMemo(() => {
    return rapportsData
      .filter((r) => r.kpis)
      .map((r) => {
        const exec = allExecutions.find((e) => e.id === r.executionId)!
        const perf = computePerformanceMetrics(exec.stepResults, durationToSeconds(exec.duration))
        return { vus: r.vus, avg: perf.avgResponseTime, errorRate: perf.errorRate }
      })
      .sort((a, b) => a.vus - b.vus)
  }, [rapportsData, allExecutions])

  const capacityChartData = {
    labels: capacityPoints.map((p) => String(p.vus)),
    datasets: [
      {
        label: 'Temps de réponse (ms)',
        data: capacityPoints.map((p) => p.avg),
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#2563EB',
        yAxisID: 'y',
      },
      {
        label: 'Taux d\'erreurs (%)',
        data: capacityPoints.map((p) => p.errorRate),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: '#EF4444',
        yAxisID: 'y1',
      },
    ],
  }

  const capacityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const, labels: { font: { size: 11 }, color: '#6B7280' } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 11 } }, title: { display: true, text: 'Utilisateurs virtuels (VUs) — une exécution réelle par point', color: '#6B7280', font: { size: 11 } } },
      y: { grid: { color: '#F3F4F6' }, ticks: { color: '#9CA3AF', font: { size: 11 } }, title: { display: true, text: 'Temps réponse (ms)', color: '#6B7280', font: { size: 11 } } },
      y1: { position: 'right' as const, grid: { drawOnChartArea: false }, ticks: { color: '#EF4444', font: { size: 11 } }, title: { display: true, text: 'Erreurs (%)', color: '#EF4444', font: { size: 11 } } },
    },
  }

  const totalCount = rapportsData.length
  const genereCount = rapportsData.filter((r) => r.statut === 'Généré').length
  const erreurCount = rapportsData.filter((r) => r.statut === 'Erreur').length
  const enCoursCount = rapportsData.filter((r) => r.statut === 'En cours').length

  const getStatutBadge = (statut: Rapport['statut']) => {
    switch (statut) {
      case 'Généré': return <span className="pt-pill success"><i className="bi bi-check-circle-fill me-1" style={{ fontSize: '10px' }}></i>Généré</span>
      case 'En cours': return <span className="pt-pill info"><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--pt-info)', display: 'inline-block', marginRight: '5px', animation: 'pulse 1.5s infinite' }}></span>En cours</span>
      case 'Erreur': return <span className="pt-pill danger"><i className="bi bi-x-circle-fill me-1" style={{ fontSize: '10px' }}></i>Erreur</span>
    }
  }

  return (
    <div className="pt-content">
      {/* Header */}
      <div className="pt-page-header">
        <div className="page-title">
          <h1>Rapports</h1>
          <p>Consultez les rapports de tests de performance, générés depuis les vraies exécutions</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <TopBar searchPlaceholder="Rechercher un rapport..." />
        </div>
      </div>

      {/* Stat Cards — comptages réels dérivés des exécutions */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">Total rapports</div>
                <div className="stat-value">{totalCount}</div>
                <div className="stat-trend neutral">une exécution = un rapport</div>
              </div>
              <div className="stat-icon blue"><i className="bi bi-file-earmark-bar-graph"></i></div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">Générés</div>
                <div className="stat-value">{genereCount}</div>
                <div className="stat-trend positive">{totalCount > 0 ? Math.round((genereCount / totalCount) * 100) : 0}% du total</div>
              </div>
              <div className="stat-icon green"><i className="bi bi-check-circle"></i></div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">En erreur</div>
                <div className="stat-value">{erreurCount}</div>
                <div className="stat-trend neutral">{totalCount > 0 ? Math.round((erreurCount / totalCount) * 100) : 0}% du total</div>
              </div>
              <div className="stat-icon red"><i className="bi bi-x-circle"></i></div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">En cours</div>
                <div className="stat-value">{enCoursCount}</div>
                <div className="stat-trend neutral">exécution en cours</div>
              </div>
              <div className="stat-icon orange"><i className="bi bi-hourglass-split"></i></div>
            </div>
          </div>
        </div>
      </div>

      {/* Capacity Chart */}
      <div className="pt-card mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Analyse de la capacité — toutes exécutions réelles</h6>
            <p style={{ fontSize: '12px', color: 'var(--pt-text-muted)', margin: '4px 0 0' }}>Temps de réponse moyen et taux d'erreur réels, par nombre d'utilisateurs virtuels réellement utilisé</p>
          </div>
        </div>
        {capacityPoints.length === 0 ? (
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Aucune exécution terminée pour construire cette analyse.</p>
        ) : (
          <div style={{ height: '220px' }}>
            <Line data={capacityChartData} options={capacityChartOptions} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="pt-card" style={{ padding: 0 }}>
        <div className="p-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex gap-2 flex-wrap">
              {(['all', 'genere', 'en_cours', 'erreur'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}
                  style={{ borderRadius: 'var(--pt-radius-sm)', fontWeight: 600, fontSize: '12.5px' }}
                >
                  {tab === 'all' ? 'Tous' : tab === 'genere' ? 'Générés' : tab === 'en_cours' ? 'En cours' : 'Erreurs'}
                  {tab === 'all' && <span className="badge bg-secondary ms-1">{totalCount}</span>}
                  {tab === 'genere' && <span className="badge bg-success ms-1">{genereCount}</span>}
                  {tab === 'en_cours' && <span className="badge bg-info ms-1">{enCoursCount}</span>}
                  {tab === 'erreur' && <span className="badge bg-danger ms-1">{erreurCount}</span>}
                </button>
              ))}
            </div>
            <div className="pt-search" style={{ width: '240px' }}>
              <i className="bi bi-search"></i>
              <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="pt-table-wrapper">
          <table className="pt-table">
            <thead>
              <tr>
                <th>ID Rapport</th>
                <th>Exécution / Scénario</th>
                <th>Application</th>
                <th>Date</th>
                <th>Temps moy.</th>
                <th>VUs</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dataLoading ? (
                <tr><td colSpan={8} className="text-center text-muted py-4"><i className="bi bi-arrow-repeat pt-spin me-2"></i>Chargement...</td></tr>
              ) : filteredRapports.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted py-4">Aucun rapport pour l'instant — lancez une exécution depuis la page Exécutions.</td></tr>
              ) : filteredRapports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      onClick={() => navigate(`/executions/detail/${r.executionId}`)}
                      title="Voir cette exécution"
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: 'var(--pt-primary)' }}>{r.id}</span>
                      <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}>{r.execution}</div>
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => navigate(`/scenarios?q=${encodeURIComponent(r.scenario)}`)}
                      title="Voir ce scénario"
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--pt-text)' }}>{r.scenario}</div>
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => navigate(`/scenarios?app=${encodeURIComponent(r.app)}`)}
                      title="Voir les scénarios de cette application"
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--pt-text-muted)' }}>{r.app}</span>
                    </button>
                  </td>
                  <td style={{ fontSize: '12.5px', color: 'var(--pt-text-muted)' }}>{r.date}</td>
                  <td>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: r.avgResponse === '-' ? 'var(--pt-text-muted)' : 'var(--pt-text)' }}>{r.avgResponse}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--pt-primary)' }}>{r.capacite}</span>
                  </td>
                  <td>{getStatutBadge(r.statut)}</td>
                  <td>
                    <div className="d-flex justify-content-end gap-1">
                      <button
                        className="topbar-icon"
                        style={{ width: '32px', height: '32px', border: '1px solid var(--pt-border)' }}
                        title="Voir le rapport"
                        onClick={() => setSelectedRapport(r)}
                        disabled={!r.kpis}
                      >
                        <i className="bi bi-eye" style={{ fontSize: '14px' }}></i>
                      </button>
                      <button
                        className="topbar-icon"
                        style={{ width: '32px', height: '32px', border: '1px solid var(--pt-border)' }}
                        title="Voir le détail complet de l'exécution"
                        onClick={() => navigate(`/executions/report/${r.executionId}`)}
                      >
                        <i className="bi bi-file-earmark-text" style={{ fontSize: '14px' }}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-pagination" style={{ padding: '0.75rem 1.25rem' }}>
          <span>Affichage de {filteredRapports.length} sur {totalCount} rapports</span>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRapport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--pt-card-bg)', borderRadius: 'var(--pt-radius)', padding: '2rem', width: '680px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--pt-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div className="d-flex justify-content-between align-items-start mb-4">
              <div>
                <h5 style={{ fontWeight: 700, margin: 0 }}>Rapport {selectedRapport.id}</h5>
                <p style={{ color: 'var(--pt-text-muted)', fontSize: '13px', margin: '4px 0 0' }}>{selectedRapport.scenario} — {selectedRapport.app}</p>
              </div>
              <button onClick={() => setSelectedRapport(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--pt-text-muted)' }}>
                <i className="bi bi-x"></i>
              </button>
            </div>

            {selectedRapport.kpis && (
              <>
                <h6 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pt-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>KPIs de performance (réels)</h6>
                <div className="row g-2 mb-4">
                  {[
                    { label: 'Min', value: selectedRapport.kpis.min, icon: 'bi-arrow-down-circle', color: 'green' },
                    { label: 'Moyen', value: selectedRapport.kpis.moy, icon: 'bi-dash-circle', color: 'blue' },
                    { label: 'Max', value: selectedRapport.kpis.max, icon: 'bi-arrow-up-circle', color: 'red' },
                    { label: 'P90', value: selectedRapport.kpis.p90, icon: 'bi-graph-up', color: 'orange' },
                    { label: 'P95', value: selectedRapport.kpis.p95, icon: 'bi-graph-up-arrow', color: 'orange' },
                    { label: 'P99', value: selectedRapport.kpis.p99, icon: 'bi-exclamation-circle', color: 'red' },
                    { label: 'Throughput', value: selectedRapport.kpis.throughput, icon: 'bi-lightning-charge', color: 'blue' },
                    { label: 'Taux erreurs', value: selectedRapport.kpis.erreurs, icon: 'bi-bug', color: 'red' },
                  ].map((kpi, i) => (
                    <div key={i} className="col-6 col-md-3">
                      <div style={{ background: 'var(--pt-bg)', borderRadius: 'var(--pt-radius-sm)', padding: '12px', border: '1px solid var(--pt-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)', marginBottom: '4px' }}>{kpi.label}</div>
                        <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--pt-text)' }}>{kpi.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <h6 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pt-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Utilisateurs virtuels</h6>
                <div style={{ background: 'var(--pt-bg)', borderRadius: 'var(--pt-radius-sm)', padding: '16px', border: '1px solid var(--pt-border)', marginBottom: '1.5rem' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--pt-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="bi bi-people-fill" style={{ fontSize: '22px', color: 'var(--pt-primary)' }}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--pt-text)' }}>{selectedRapport.capacite}</div>
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Utilisateurs virtuels réellement configurés pour cette exécution</div>
                    </div>
                  </div>
                </div>

                <h6 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pt-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Recommandations</h6>
                <div style={{ marginBottom: '1.5rem' }}>
                  {(selectedRapport.recommandations || []).map((rec, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px', background: 'var(--pt-bg)', borderRadius: 'var(--pt-radius-sm)', marginBottom: '6px', border: '1px solid var(--pt-border)' }}>
                      <i className="bi bi-lightbulb-fill" style={{ color: 'var(--pt-warning)', marginTop: '2px', flexShrink: 0 }}></i>
                      <span style={{ fontSize: '13px', color: 'var(--pt-text)' }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="d-flex gap-2 justify-content-end">
              <button onClick={() => setSelectedRapport(null)} style={{ background: 'var(--pt-bg)', border: '1px solid var(--pt-border)', borderRadius: 'var(--pt-radius-sm)', padding: '8px 18px', cursor: 'pointer', fontSize: '13.5px', color: 'var(--pt-text)' }}>
                Fermer
              </button>
              <button
                onClick={() => navigate(`/executions/report/${selectedRapport.executionId}`)}
                className="pt-btn-primary"
                style={{ padding: '8px 18px' }}
              >
                <i className="bi bi-file-earmark-text me-2"></i>Ouvrir le rapport complet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Rapports
