import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Application, Execution, Scenario } from '../types'
import { applicationsApi } from '../services/api/applications'
import { scenariosApi } from '../services/api/scenarios'
import { executionsApi } from '../services/api/executions'
import { useApiList } from '../hooks/useApiResource'
import { usePagination } from '../hooks/usePagination'
import Pagination from '../components/Pagination'
import { setExecutionPrefill } from '../utils/executionBridge'

function Historique() {
  const navigate = useNavigate()

  // Données réelles depuis JSON Server.
  const { data: allExecutions, loading } = useApiList<Execution>(() => executionsApi.getAll())
  const { data: allScenarios } = useApiList<Scenario>(() => scenariosApi.getAll())
  const { data: allApplications } = useApiList<Application>(() => applicationsApi.getAll())

  const scenarioById = useMemo(() => new Map(allScenarios.map((s) => [s.id, s])), [allScenarios])
  const appById = useMemo(() => new Map(allApplications.map((a) => [a.id, a])), [allApplications])

  // Seules les exécutions terminées (réussies, avec erreurs, échouées)
  // apparaissent dans l'historique ; les exécutions en cours ou suspendues
  // restent visibles sur la page Exécutions.
  const executionData = allExecutions.filter(
    (e) => e.status === 'Réussie' || e.status === 'Avec erreurs' || e.status === 'Échouée'
  )

  const [activeTab, setActiveTab] = useState<'Toutes' | 'Réussies' | 'Avec erreurs' | 'Échouées'>('Toutes')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExec, setSelectedExec] = useState<Execution | null>(null)

  const countReussies = executionData.filter((e) => e.status === 'Réussie').length
  const countAvecErreurs = executionData.filter((e) => e.status === 'Avec erreurs').length
  const countEchouees = executionData.filter((e) => e.status === 'Échouée').length

  const stats = [
    { label: 'Total exécutions', value: executionData.length, color: 'blue', icon: 'bi-play-circle-fill' },
    { label: 'Réussies', value: countReussies, color: 'green', icon: 'bi-check-circle-fill' },
    { label: 'Avec erreurs', value: countAvecErreurs, color: 'orange', icon: 'bi-exclamation-triangle-fill' },
    { label: 'Échouées', value: countEchouees, color: 'red', icon: 'bi-x-circle-fill' },
  ]

  const tabs = [
    { id: 'Toutes', label: 'Toutes', count: executionData.length },
    { id: 'Réussies', label: 'Réussies', count: countReussies },
    { id: 'Avec erreurs', label: 'Avec erreurs', count: countAvecErreurs },
    { id: 'Échouées', label: 'Échouées', count: countEchouees },
  ]

  const tabToStatus: Record<string, Execution['status']> = {
    'Réussies': 'Réussie',
    'Avec erreurs': 'Avec erreurs',
    'Échouées': 'Échouée',
  }

  const filteredData = executionData.filter((item) => {
    const scenarioName = scenarioById.get(item.scenarioId)?.name ?? ''
    const appName = appById.get(item.applicationId)?.name ?? ''
    const matchesTab = activeTab === 'Toutes' || item.status === tabToStatus[activeTab]
    const matchesSearch =
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenarioName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appName.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  const { page, setPage, totalPages, pageItems, startIndex, endIndex, totalItems } = usePagination(filteredData, 10)

  const getStatusBadge = (status: Execution['status']) => {
    switch (status) {
      case 'Réussie':
        return (
          <span className="pt-pill success d-inline-flex align-items-center gap-1">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--pt-success)' }}></span>
            Réussie
          </span>
        )
      case 'Avec erreurs':
        return (
          <span className="pt-pill warning d-inline-flex align-items-center gap-1">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--pt-warning)' }}></span>
            Avec erreurs
          </span>
        )
      case 'Échouée':
        return (
          <span className="pt-pill danger d-inline-flex align-items-center gap-1">
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--pt-danger)' }}></span>
            Échouée
          </span>
        )
      default:
        return <span className="pt-pill neutral">{status}</span>
    }
  }

  return (
    <div className="pt-content">
      <div className="pt-page-header">
        <div className="page-title">
          <h1>Historique</h1>
          <p>Consultez l'historique détaillé de toutes les exécutions</p>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="col-12 col-sm-6 col-xl-3">
            <div className="pt-stat-card h-100">
              <div className="stat-header">
                <div>
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">{loading ? '—' : stat.value}</div>
                </div>
                <div className={`stat-icon ${stat.color}`}><i className={`bi ${stat.icon}`}></i></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
        <div className="pt-search">
          <i className="bi bi-search"></i>
          <input type="text" placeholder="Rechercher par ID, scénario..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <button className="pt-btn-outline d-flex align-items-center gap-2">
          <i className="bi bi-download"></i>
          Exporter
        </button>
      </div>

      <div className="pt-card" style={{ padding: 0 }}>
        <div className="d-flex flex-wrap justify-content-between align-items-center p-3 gap-3" style={{ borderBottom: '1px solid var(--pt-border)' }}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="btn btn-sm"
                  style={{
                    borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '13px', fontWeight: 600, border: '1px solid',
                    borderColor: isActive ? 'var(--pt-primary)' : 'var(--pt-border)',
                    backgroundColor: isActive ? 'var(--pt-primary-light)' : 'transparent',
                    color: isActive ? 'var(--pt-primary)' : 'var(--pt-text-muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                  <span className="ms-2 px-2 py-0.5 rounded-pill" style={{ fontSize: '11px', backgroundColor: isActive ? 'var(--pt-primary)' : 'var(--pt-border)', color: isActive ? '#fff' : 'var(--pt-text-muted)' }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="pt-empty-state">
            <i className="bi bi-arrow-repeat pt-spin" style={{ fontSize: '28px', color: 'var(--pt-primary)' }}></i>
            <p>Chargement de l'historique...</p>
          </div>
        ) : (
        <div className="pt-table-wrapper">
          <table className="pt-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" /></th>
                <th>ID</th>
                <th>Scénario</th>
                <th>Application</th>
                <th>Statut</th>
                <th>Utilisateurs</th>
                <th>Durée</th>
                <th>Démarré le</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-muted">Aucune exécution ne correspond aux critères</td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const scenarioName = scenarioById.get(item.scenarioId)?.name ?? '—'
                  const appName = appById.get(item.applicationId)?.name ?? '—'
                  return (
                  <tr key={item.id}>
                    <td><input type="checkbox" /></td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: 'var(--pt-primary)' }}>#{item.id}</span></td>
                    <td>
                      <button
                        onClick={() => navigate(`/scenarios?q=${encodeURIComponent(scenarioName)}`)}
                        title="Voir ce scénario"
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', color: 'var(--pt-text)' }}
                      >
                        {scenarioName}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/scenarios?app=${encodeURIComponent(appName)}`)}
                        title="Voir les scénarios de cette application"
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', color: 'var(--pt-text-muted)' }}
                      >
                        {appName}
                      </button>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>
                        <i className="bi bi-people me-1 text-muted"></i>{item.users}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: 'var(--pt-text-muted)' }}>
                        <i className="bi bi-stopwatch me-1 text-muted"></i>{item.duration}
                      </span>
                    </td>
                    <td><span style={{ fontSize: '12.5px', color: 'var(--pt-text-muted)' }}>{new Date(item.startedAt).toLocaleString('fr-FR')}</span></td>
                    <td>
                      <div className="d-flex justify-content-end gap-1">
                        <button className="topbar-icon" style={{ width: '32px', height: '32px', border: '1px solid var(--pt-border)' }} title="Voir les détails" onClick={() => navigate(`/executions/detail/${item.id}`)}>
                          <i className="bi bi-eye" style={{ fontSize: '13px' }}></i>
                        </button>
                        <button
                          className="topbar-icon"
                          style={{ width: '32px', height: '32px', border: '1px solid var(--pt-border)' }}
                          title="Relancer"
                          onClick={() => {
                            setExecutionPrefill({ scenario: scenarioName, application: appName })
                            navigate('/executions')
                          }}
                        >
                          <i className="bi bi-arrow-clockwise" style={{ fontSize: '13px' }}></i>
                        </button>
                        <button className="topbar-icon" style={{ width: '32px', height: '32px', border: '1px solid var(--pt-border)' }} title="Voir le rapport" onClick={() => navigate(`/executions/report/${item.id}`)}>
                          <i className="bi bi-download" style={{ fontSize: '13px' }}></i>
                        </button>
                        <button className="topbar-icon" style={{ width: '32px', height: '32px', border: '1px solid var(--pt-border)' }} title="Voir en détail dans cette page" onClick={() => setSelectedExec(item)}>
                          <i className="bi bi-three-dots" style={{ fontSize: '13px' }}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalItems}
          itemLabel="exécutions"
        />
      </div>

      {selectedExec && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content" style={{ borderRadius: '12px', border: '1px solid var(--pt-border)' }}>
              <div className="modal-header">
                <h5 className="modal-title d-flex align-items-center gap-2" style={{ fontSize: '16px', fontWeight: 600 }}>
                  <i className="bi bi-info-circle text-primary"></i>
                  Détails de l'exécution #{selectedExec.id}
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedExec(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="row g-3">
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '12px' }}>Scénario</label>
                    <div className="fw-semibold" style={{ fontSize: '14px' }}>{scenarioById.get(selectedExec.scenarioId)?.name ?? '—'}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '12px' }}>Application</label>
                    <div className="fw-semibold" style={{ fontSize: '14px' }}>{appById.get(selectedExec.applicationId)?.name ?? '—'}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted" style={{ fontSize: '12px' }}>Statut</label>
                    <div>{getStatusBadge(selectedExec.status)}</div>
                  </div>
                  <div className="col-4">
                    <label className="text-muted" style={{ fontSize: '12px' }}>Utilisateurs virtuels</label>
                    <div className="fw-bold">{selectedExec.users}</div>
                  </div>
                  <div className="col-4">
                    <label className="text-muted" style={{ fontSize: '12px' }}>Durée d'exécution</label>
                    <div className="fw-bold">{selectedExec.duration}</div>
                  </div>
                  <div className="col-4">
                    <label className="text-muted" style={{ fontSize: '12px' }}>Horodatage</label>
                    <div className="fw-bold">{new Date(selectedExec.startedAt).toLocaleString('fr-FR')}</div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="pt-btn-outline" onClick={() => setSelectedExec(null)}>Fermer</button>
                <button type="button" className="pt-btn-primary" onClick={() => navigate(`/executions/report/${selectedExec.id}`)}>
                  <i className="bi bi-file-earmark-bar-graph me-1"></i>
                  Voir rapport complet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Historique
