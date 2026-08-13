import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import TopBar from '../components/TopBar'
import { Application, Scenario, Execution } from '../types'
import { applicationsApi } from '../services/api/applications'
import { scenariosApi } from '../services/api/scenarios'
import { executionsApi } from '../services/api/executions'
import { useApiList } from '../hooks/useApiResource'
import { getStats, percentDelta, formatDuration, DashboardStats } from '../data/dashboardStats'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatWeekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => capitalize(d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }))
  return `${fmt(start)} - ${fmt(end)}`
}

function trendInfo(deltaPct: number, lowerIsBetter: boolean) {
  if (deltaPct === 0) {
    return { cls: 'neutral', icon: 'bi bi-dash-lg', text: '0%' }
  }
  const isIncrease = deltaPct > 0
  const good = lowerIsBetter ? !isIncrease : isIncrease
  return {
    cls: good ? 'positive' : 'negative',
    icon: isIncrease ? 'bi bi-arrow-up' : 'bi bi-arrow-down',
    text: `${isIncrease ? '+' : ''}${deltaPct}%`,
  }
}

function Dashboard() {
  const navigate = useNavigate()
  // Données réelles depuis JSON Server — rechargées à chaque montage, donc
  // toujours à jour après une création/modification/suppression ailleurs
  // dans l'application.
  const { data: allApplications, loading: appsLoading } = useApiList<Application>(() => applicationsApi.getAll())
  const { data: allScenarios, loading: scenariosLoading } = useApiList<Scenario>(() => scenariosApi.getAll())
  const { data: allExecutions, loading: executionsLoading } = useApiList<Execution>(() => executionsApi.getAll())
  const dataLoading = appsLoading || scenariosLoading || executionsLoading

  const activeApplications = allApplications.filter((a) => a.status === 'Actif')

  const [selectedAppId, setSelectedAppId] = useState<string | 'all'>('all')
  const [compareMode, setCompareMode] = useState(false)

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const weekEnd = useMemo(() => {
    const e = new Date(weekStart)
    e.setDate(e.getDate() + 6)
    e.setHours(23, 59, 59, 999)
    return e
  }, [weekStart])
  const isCurrentWeek = weekStart.getTime() === startOfWeek(new Date()).getTime()
  const goToPreviousWeek = () =>
    setWeekStart((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  const goToNextWeek = () =>
    setWeekStart((prev) => {
      if (prev.getTime() === startOfWeek(new Date()).getTime()) return prev
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  const goToCurrentWeek = () => setWeekStart(startOfWeek(new Date()))

  const realData = useMemo(() => {
    const executionsInWeek = allExecutions.filter((e) => {
      const t = new Date(e.startedAt)
      return t >= weekStart && t <= weekEnd
    })
    return { applications: allApplications, scenarios: allScenarios, executions: executionsInWeek }
  }, [allApplications, allScenarios, allExecutions, weekStart, weekEnd])

  const afterStats: DashboardStats = useMemo(() => getStats(selectedAppId, 'after', realData), [selectedAppId, realData])
  const beforeStats: DashboardStats = useMemo(() => getStats(selectedAppId, 'before', realData), [selectedAppId, realData])

  const selectedAppName =
    selectedAppId === 'all'
      ? 'Toutes les applications'
      : activeApplications.find((a) => a.id === selectedAppId)?.name ?? 'Application'

  const dayLabels = ['J-6', 'J-5', 'J-4', 'J-3', 'J-2', 'J-1', "Aujourd'hui"]

  const responseTimeDatasets = compareMode
    ? [
        {
          label: 'Après',
          data: afterStats.responseTimeSeries,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37,99,235,0.08)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#2563EB',
          pointRadius: 3,
        },
        {
          label: 'Avant',
          data: beforeStats.responseTimeSeries,
          borderColor: '#9CA3AF',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.4,
          fill: false,
          pointBackgroundColor: '#9CA3AF',
          pointRadius: 3,
        },
      ]
    : [
        {
          label: 'Temps de réponse (ms)',
          data: afterStats.responseTimeSeries,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37,99,235,0.08)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#2563EB',
          pointRadius: 4,
        },
      ]

  const responseTimeData = {
    labels: dayLabels,
    datasets: responseTimeDatasets,
  }

  const responseTimeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: compareMode, position: 'top' as const, labels: { font: { size: 11.5 }, color: '#6B7280' } },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9CA3AF', font: { size: 11 } },
      },
      y: {
        grid: { color: '#F3F4F6' },
        ticks: { color: '#9CA3AF', font: { size: 11 } },
      },
    },
  }

  const makeExecutionStatusData = (stats: DashboardStats) => ({
    labels: ['Réussies', 'En cours', 'Échouées', 'Annulées'],
    datasets: [
      {
        data: [
          stats.executionStatus.success,
          stats.executionStatus.inProgress,
          stats.executionStatus.failed,
          stats.executionStatus.cancelled,
        ],
        backgroundColor: ['#22C55E', '#3B82F6', '#EF4444', '#A3A3A3'],
        borderWidth: 0,
        cutout: '70%',
      },
    ],
  })

  const executionStatusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 10,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11.5 },
          color: '#6B7280',
        },
      },
    },
  }

  const afterTotal =
    afterStats.executionStatus.success +
    afterStats.executionStatus.inProgress +
    afterStats.executionStatus.failed +
    afterStats.executionStatus.cancelled

  const beforeTotal =
    beforeStats.executionStatus.success +
    beforeStats.executionStatus.inProgress +
    beforeStats.executionStatus.failed +
    beforeStats.executionStatus.cancelled

  const comparisonRows = [
    {
      label: 'Temps de réponse moyen',
      before: `${beforeStats.avgResponseTime} ms`,
      after: `${afterStats.avgResponseTime} ms`,
      delta: percentDelta(afterStats.avgResponseTime, beforeStats.avgResponseTime),
      lowerIsBetter: true,
    },
    {
      label: 'Throughput moyen',
      before: `${beforeStats.throughput} req/s`,
      after: `${afterStats.throughput} req/s`,
      delta: percentDelta(afterStats.throughput, beforeStats.throughput),
      lowerIsBetter: false,
    },
    {
      label: "Taux d'erreurs",
      before: `${beforeStats.errorRate}%`,
      after: `${afterStats.errorRate}%`,
      delta: percentDelta(afterStats.errorRate, beforeStats.errorRate),
      lowerIsBetter: true,
    },
    {
      label: 'Utilisateurs actifs',
      before: `${beforeStats.activeUsers}`,
      after: `${afterStats.activeUsers}`,
      delta: percentDelta(afterStats.activeUsers, beforeStats.activeUsers),
      lowerIsBetter: false,
    },
    {
      label: 'Exécutions',
      before: `${beforeStats.executions}`,
      after: `${afterStats.executions}`,
      delta: percentDelta(afterStats.executions, beforeStats.executions),
      lowerIsBetter: false,
    },
    {
      label: 'Durée moyenne des tests',
      before: formatDuration(beforeStats.avgDurationSec),
      after: formatDuration(afterStats.avgDurationSec),
      delta: percentDelta(afterStats.avgDurationSec, beforeStats.avgDurationSec),
      lowerIsBetter: true,
    },
  ]

  const responseTimeTrend = trendInfo(percentDelta(afterStats.avgResponseTime, beforeStats.avgResponseTime), true)
  const throughputTrend = trendInfo(percentDelta(afterStats.throughput, beforeStats.throughput), false)
  const errorRateTrend = trendInfo(percentDelta(afterStats.errorRate, beforeStats.errorRate), true)
  const activeUsersTrend = trendInfo(percentDelta(afterStats.activeUsers, beforeStats.activeUsers), false)
  const scenariosTrend = trendInfo(percentDelta(afterStats.scenarios, beforeStats.scenarios), false)
  const executionsTrend = trendInfo(percentDelta(afterStats.executions, beforeStats.executions), false)
  const durationTrend = trendInfo(percentDelta(afterStats.avgDurationSec, beforeStats.avgDurationSec), true)

  return (
    <>
      <div className="pt-content">
        {/* Page Header */}
        <div className="pt-page-header">
          <div className="page-title">
            <h1>Dashboard</h1>
            <p>
              Vue d'ensemble de la plateforme — <strong>{selectedAppName}</strong>
            </p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <select
              className="pt-form-control"
              style={{ width: 'auto', minWidth: '220px' }}
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value === 'all' ? 'all' : e.target.value)}
            >
              <option value="all">Toutes les applications</option>
              {activeApplications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <button
              className={compareMode ? 'pt-btn-primary' : 'pt-btn-outline'}
              onClick={() => setCompareMode(!compareMode)}
            >
              <i className="bi bi-arrow-left-right me-1"></i>
              {compareMode ? 'Masquer la comparaison' : 'Comparer avant / après'}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="pt-btn-outline d-flex align-items-center gap-2"
                onClick={() => setShowWeekPicker((v) => !v)}
              >
                <i className="bi bi-calendar3"></i>
                <span>{formatWeekLabel(weekStart, weekEnd)}</span>
              </button>
              {showWeekPicker && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                    onClick={() => setShowWeekPicker(false)}
                  ></div>
                  <div
                    className="pt-card"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      zIndex: 11,
                      width: '260px',
                      padding: '0.75rem',
                      boxShadow: 'var(--pt-shadow-md)',
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <button
                        type="button"
                        className="pt-btn-outline"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={goToPreviousWeek}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, textAlign: 'center' }}>
                        {formatWeekLabel(weekStart, weekEnd)}
                      </span>
                      <button
                        type="button"
                        className="pt-btn-outline"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={goToNextWeek}
                        disabled={isCurrentWeek}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="pt-btn-outline w-100"
                      style={{ fontSize: '12.5px' }}
                      onClick={goToCurrentWeek}
                      disabled={isCurrentWeek}
                    >
                      Semaine actuelle
                    </button>
                  </div>
                </>
              )}
            </div>
            <TopBar searchPlaceholder="" />
          </div>
        </div>

        {compareMode && (
          <div
            className="pt-card mb-4 d-flex align-items-center gap-2"
            style={{ background: 'var(--pt-primary-light)', border: '1px solid var(--pt-primary)', padding: '0.85rem 1.25rem' }}
          >
            <i className="bi bi-info-circle-fill" style={{ color: 'var(--pt-primary)' }}></i>
            <span style={{ fontSize: '13px', color: 'var(--pt-text)' }}>
              Mode comparaison actif pour <strong>{selectedAppName}</strong> : les valeurs "Avant" reflètent l'état
              précédent la dernière modification, comparées aux valeurs "Après" actuelles.
            </span>
          </div>
        )}

        {/* Metric Cards - Row 1 */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6 col-xl">
            <div className="pt-stat-card">
              <div className="stat-header">
                <div>
                  <div className="stat-label">Temps de réponse moyen</div>
                  <div className="stat-value">{afterStats.avgResponseTime} ms</div>
                  <div className={`stat-trend ${responseTimeTrend.cls}`}>
                    <i className={responseTimeTrend.icon}></i> {responseTimeTrend.text} vs avant
                  </div>
                </div>
                <div className="stat-icon blue">
                  <i className="bi bi-clock-history"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl">
            <div className="pt-stat-card">
              <div className="stat-header">
                <div>
                  <div className="stat-label">Throughput moyen</div>
                  <div className="stat-value">{afterStats.throughput.toLocaleString('fr-FR')} req/s</div>
                  <div className={`stat-trend ${throughputTrend.cls}`}>
                    <i className={throughputTrend.icon}></i> {throughputTrend.text} vs avant
                  </div>
                </div>
                <div className="stat-icon green">
                  <i className="bi bi-lightning-charge"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl">
            <div className="pt-stat-card">
              <div className="stat-header">
                <div>
                  <div className="stat-label">Taux d'erreurs</div>
                  <div className="stat-value">{afterStats.errorRate}%</div>
                  <div className={`stat-trend ${errorRateTrend.cls}`}>
                    <i className={errorRateTrend.icon}></i> {errorRateTrend.text} vs avant
                  </div>
                </div>
                <div className="stat-icon red">
                  <i className="bi bi-exclamation-triangle"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl">
            <div className="pt-stat-card">
              <div className="stat-header">
                <div>
                  <div className="stat-label">Utilisateurs actifs</div>
                  <div className="stat-value">{afterStats.activeUsers}</div>
                  <div className={`stat-trend ${activeUsersTrend.cls}`}>
                    <i className={activeUsersTrend.icon}></i> {activeUsersTrend.text} vs avant
                  </div>
                </div>
                <div className="stat-icon orange">
                  <i className="bi bi-people"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl">
            <div className="pt-stat-card">
              <div className="stat-header">
                <div>
                  <div className="stat-label">Tests en cours</div>
                  <div className="stat-value">{afterStats.testsInProgress}</div>
                  <div className="stat-trend neutral">actuellement</div>
                </div>
                <div className="stat-icon purple">
                  <i className="bi bi-play-circle"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-lg-7">
            <div className="pt-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                  Évolution des temps de réponse (ms)
                </h6>
                <span className="pt-pill info">7 jours</span>
              </div>
              <div style={{ height: '280px' }}>
                <Line data={responseTimeData} options={responseTimeOptions} />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="pt-card">
              <h6 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>
                Statut des exécutions
              </h6>
              {compareMode ? (
                <div className="d-flex" style={{ height: '280px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Doughnut data={makeExecutionStatusData(beforeStats)} options={executionStatusOptions} />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '38%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--pt-text)' }}>{beforeTotal}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--pt-text-muted)' }}>Avant</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Doughnut data={makeExecutionStatusData(afterStats)} options={executionStatusOptions} />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '38%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--pt-text)' }}>{afterTotal}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--pt-text-muted)' }}>Après</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative', height: '280px' }}>
                  <Doughnut data={makeExecutionStatusData(afterStats)} options={executionStatusOptions} />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '38%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--pt-text)' }}>{afterTotal}</div>
                    <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Total</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        {compareMode && (
          <div className="pt-card mb-4" style={{ padding: 0 }}>
            <div className="p-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
              <h6 style={{ fontSize: '14.5px', fontWeight: 600, margin: 0 }}>
                Comparaison détaillée — {selectedAppName}
              </h6>
            </div>
            <div className="pt-table-wrapper">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Métrique</th>
                    <th>Avant</th>
                    <th>Après</th>
                    <th style={{ textAlign: 'right' }}>Variation</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => {
                    const t = trendInfo(row.delta, row.lowerIsBetter)
                    return (
                      <tr key={row.label}>
                        <td style={{ fontWeight: 500 }}>{row.label}</td>
                        <td style={{ color: 'var(--pt-text-muted)' }}>{row.before}</td>
                        <td style={{ fontWeight: 600 }}>{row.after}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`stat-trend ${t.cls}`} style={{ justifyContent: 'flex-end' }}>
                            <i className={t.icon}></i> {t.text}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Metric Cards - Row 2 */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3 col-xl">
            <div className="pt-stat-card" role="button" onClick={() => navigate('/scenarios')} style={{ cursor: 'pointer' }}>
              <div className="stat-label">Scénarios</div>
              <div className="stat-value">{afterStats.scenarios}</div>
              <div className={`stat-trend ${scenariosTrend.cls}`}>
                <i className={scenariosTrend.icon}></i> {scenariosTrend.text}
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3 col-xl">
            <div className="pt-stat-card" role="button" onClick={() => navigate('/applications')} style={{ cursor: 'pointer' }}>
              <div className="stat-label">Applications</div>
              <div className="stat-value">{selectedAppId === 'all' ? activeApplications.length : 1}</div>
              <div className="stat-trend neutral">{selectedAppId === 'all' ? 'actives' : selectedAppName}</div>
            </div>
          </div>
          <div className="col-6 col-md-3 col-xl">
            <div className="pt-stat-card" role="button" onClick={() => navigate('/executions')} style={{ cursor: 'pointer' }}>
              <div className="stat-label">Exécutions</div>
              <div className="stat-value">{afterStats.executions}</div>
              <div className={`stat-trend ${executionsTrend.cls}`}>
                <i className={executionsTrend.icon}></i> {executionsTrend.text}
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3 col-xl">
            <div className="pt-stat-card">
              <div className="stat-label">Durée moyenne des tests</div>
              <div className="stat-value" style={{ fontSize: '22px' }}>{formatDuration(afterStats.avgDurationSec)}</div>
              <div className={`stat-trend ${durationTrend.cls}`}>
                <i className={durationTrend.icon}></i> {durationTrend.text}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - 2 columns */}
        <div className="row g-3">
          {/* Recent Executions */}
          <div className="col-12 col-lg-6">
            <div className="pt-card">
              <h6 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>
                Exécutions récentes
              </h6>
              <div className="d-flex flex-column gap-3">
                {afterStats.recentExecutions.map((exec, i) => (
                  <div
                    key={i}
                    className="d-flex align-items-center gap-3"
                    role="button"
                    onClick={() => navigate('/executions')}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className={`bi ${exec.icon}`} style={{ color: `var(--pt-${exec.color})`, fontSize: '18px' }}></i>
                    <div className="flex-grow-1">
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pt-text)' }}>{exec.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>{exec.time}</div>
                    </div>
                    <span className={`pt-pill ${exec.color}`}>{exec.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Most Used Scenarios */}
          <div className="col-12 col-lg-6">
            <div className="pt-card">
              <h6 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '1rem' }}>
                Scénarios les plus utilisés
              </h6>
              <div className="d-flex flex-column gap-3">
                {afterStats.topScenarios.map((scenario, i) => (
                  <div
                    key={i}
                    role="button"
                    onClick={() => navigate(`/scenarios?q=${encodeURIComponent(scenario.name)}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex justify-content-between mb-1">
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--pt-text)' }}>
                        {i + 1}. {scenario.name}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>{scenario.percent}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--pt-border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${scenario.percent}%`,
                          background: 'var(--pt-primary)',
                          borderRadius: '4px',
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Dashboard
