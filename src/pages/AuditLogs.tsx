import React, { useState } from 'react'
import TopBar from '../components/TopBar'
import Pagination from '../components/Pagination'
import { usePagination } from '../hooks/usePagination'

interface AuditLogEvent {
  id: string
  timestamp: string
  fullTimestamp: string
  user: string
  email: string
  action: 'LOGIN' | 'CREATE' | 'UPDATE' | 'DELETE' | 'START' | 'VIEW' | 'EXPORT' | 'ROLE_CHANGE'
  resource: string
  detail: string
  ip: string
  browser: string
  system: string
  severity: 'Info' | 'Avertissement' | 'Critique'
  jsonPayload: object
}

const auditLogsData: AuditLogEvent[] = [
  {
    id: 'evt_001',
    timestamp: '30/07/2026 11:28',
    fullTimestamp: '2026-07-30T11:28:42.102Z',
    user: 'Admin User',
    email: 'admin@perftest.com',
    action: 'LOGIN',
    resource: 'Auth / Session',
    detail: 'Connexion réussie',
    ip: '192.168.1.45',
    browser: 'Chrome 126.0 (macOS)',
    system: 'PERFTEST Core API v2.4',
    severity: 'Info',
    jsonPayload: {
      event_id: 'evt_001',
      timestamp: '2026-07-30T11:28:42.102Z',
      actor: {
        id: 'usr_01',
        name: 'Admin User',
        email: 'admin@perftest.com',
        role: 'Admin',
      },
      action: 'LOGIN',
      resource: {
        type: 'session',
        id: 'sess_883a91',
      },
      client: {
        ip: '192.168.1.45',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      status: 'SUCCESS',
    },
  },
  {
    id: 'evt_002',
    timestamp: '30/07/2026 11:15',
    fullTimestamp: '2026-07-30T11:15:10.840Z',
    user: 'Test Manager',
    email: 'manager@perftest.com',
    action: 'START',
    resource: 'Test Run #402',
    detail: 'Démarrage du test de charge CRM',
    ip: '192.168.1.102',
    browser: 'Firefox 127.0 (Windows)',
    system: 'PERFTEST Execution Engine v1.8',
    severity: 'Info',
    jsonPayload: {
      event_id: 'evt_002',
      timestamp: '2026-07-30T11:15:10.840Z',
      actor: {
        id: 'usr_02',
        name: 'Test Manager',
        email: 'manager@perftest.com',
        role: 'Test Manager',
      },
      action: 'START_TEST',
      resource: {
        type: 'test_run',
        id: 'run_402',
        name: 'Test de charge CRM Peak Load',
      },
      parameters: {
        virtual_users: 500,
        duration_seconds: 3600,
        ramp_up_seconds: 300,
      },
      status: 'EXECUTING',
    },
  },
  {
    id: 'evt_003',
    timestamp: '30/07/2026 10:50',
    fullTimestamp: '2026-07-30T10:50:33.412Z',
    user: 'DevOps User',
    email: 'devops@perftest.com',
    action: 'UPDATE',
    resource: 'App Config',
    detail: 'Modification du timeout API (30s -> 60s)',
    ip: '192.168.1.88',
    browser: 'Safari 17.5 (macOS)',
    system: 'PERFTEST Config Gateway',
    severity: 'Avertissement',
    jsonPayload: {
      event_id: 'evt_003',
      timestamp: '2026-07-30T10:50:33.412Z',
      actor: {
        id: 'usr_05',
        name: 'DevOps User',
        email: 'devops@perftest.com',
        role: 'DevOps',
      },
      action: 'UPDATE_CONFIG',
      resource: {
        type: 'app_config',
        key: 'api_timeout_seconds',
      },
      changes: {
        previous_value: 30,
        new_value: 60,
      },
      status: 'APPLIED',
    },
  },
  {
    id: 'evt_004',
    timestamp: '30/07/2026 10:32',
    fullTimestamp: '2026-07-30T10:32:05.110Z',
    user: 'Test Engineer',
    email: 'engineer@perftest.com',
    action: 'CREATE',
    resource: 'Scenario #88',
    detail: 'Création du scénario Checkout Flow',
    ip: '192.168.1.110',
    browser: 'Chrome 126.0 (Windows)',
    system: 'PERFTEST Scenario Builder',
    severity: 'Info',
    jsonPayload: {
      event_id: 'evt_004',
      timestamp: '2026-07-30T10:32:05.110Z',
      actor: {
        id: 'usr_03',
        name: 'Test Engineer',
        email: 'engineer@perftest.com',
        role: 'Test Engineer',
      },
      action: 'CREATE_SCENARIO',
      resource: {
        type: 'scenario',
        id: 'scen_88',
        name: 'Checkout Flow E-Commerce',
      },
      status: 'CREATED',
    },
  },
  {
    id: 'evt_005',
    timestamp: '30/07/2026 09:45',
    fullTimestamp: '2026-07-30T09:45:19.990Z',
    user: 'Admin User',
    email: 'admin@perftest.com',
    action: 'ROLE_CHANGE',
    resource: 'User #12',
    detail: 'Modification rôle John Doe -> Test Engineer',
    ip: '192.168.1.45',
    browser: 'Chrome 126.0 (macOS)',
    system: 'PERFTEST Identity Manager',
    severity: 'Avertissement',
    jsonPayload: {
      event_id: 'evt_005',
      timestamp: '2026-07-30T09:45:19.990Z',
      actor: {
        id: 'usr_01',
        name: 'Admin User',
        email: 'admin@perftest.com',
      },
      action: 'CHANGE_USER_ROLE',
      target_user: {
        id: 'usr_08',
        name: 'John Doe',
        email: 'john.doe@perftest.com',
      },
      changes: {
        previous_role: 'Lecteur',
        new_role: 'Test Engineer',
      },
      status: 'SUCCESS',
    },
  },
  {
    id: 'evt_006',
    timestamp: '30/07/2026 09:12',
    fullTimestamp: '2026-07-30T09:12:01.002Z',
    user: 'Admin User',
    email: 'admin@perftest.com',
    action: 'DELETE',
    resource: 'Test Run #390',
    detail: "Suppression de l'exécution périmée",
    ip: '192.168.1.45',
    browser: 'Chrome 126.0 (macOS)',
    system: 'PERFTEST Data Retention',
    severity: 'Critique',
    jsonPayload: {
      event_id: 'evt_006',
      timestamp: '2026-07-30T09:12:01.002Z',
      actor: {
        id: 'usr_01',
        name: 'Admin User',
        email: 'admin@perftest.com',
      },
      action: 'DELETE_TEST_RUN',
      resource: {
        type: 'test_run',
        id: 'run_390',
        deleted_records: 142000,
      },
      status: 'DELETED',
    },
  },
  {
    id: 'evt_007',
    timestamp: '30/07/2026 08:30',
    fullTimestamp: '2026-07-30T08:30:45.300Z',
    user: 'Analyst User',
    email: 'analyst@perftest.com',
    action: 'EXPORT',
    resource: 'Report #104',
    detail: 'Export PDF du rapport de performance',
    ip: '10.0.4.12',
    browser: 'Firefox 125.0 (Linux)',
    system: 'PERFTEST Reporting Engine',
    severity: 'Info',
    jsonPayload: {
      event_id: 'evt_007',
      timestamp: '2026-07-30T08:30:45.300Z',
      actor: {
        id: 'usr_06',
        name: 'Analyst User',
        email: 'analyst@perftest.com',
      },
      action: 'EXPORT_REPORT',
      resource: {
        type: 'report',
        id: 'rep_104',
        format: 'PDF',
      },
      file_size_bytes: 4820100,
      status: 'COMPLETED',
    },
  },
  {
    id: 'evt_008',
    timestamp: '29/07/2026 17:40',
    fullTimestamp: '2026-07-29T17:40:12.720Z',
    user: 'Read Only User',
    email: 'readonly@perftest.com',
    action: 'VIEW',
    resource: 'Metrics Dashboard',
    detail: 'Consultation du tableau de bord métriques',
    ip: '192.168.1.201',
    browser: 'Edge 126.0 (Windows)',
    system: 'PERFTEST Metrics Service',
    severity: 'Info',
    jsonPayload: {
      event_id: 'evt_008',
      timestamp: '2026-07-29T17:40:12.720Z',
      actor: {
        id: 'usr_04',
        name: 'Read Only User',
        email: 'readonly@perftest.com',
      },
      action: 'VIEW_DASHBOARD',
      resource: {
        type: 'dashboard',
        name: 'System Metrics Overview',
      },
      status: 'VIEWED',
    },
  },
  {
    id: 'evt_009',
    timestamp: '29/07/2026 16:15',
    fullTimestamp: '2026-07-29T16:15:00.000Z',
    user: 'Admin User',
    email: 'admin@perftest.com',
    action: 'UPDATE',
    resource: 'System Security',
    detail: "Activation de l'authentification 2FA obligatoire",
    ip: '192.168.1.45',
    browser: 'Chrome 126.0 (macOS)',
    system: 'PERFTEST Security Policy',
    severity: 'Critique',
    jsonPayload: {
      event_id: 'evt_009',
      timestamp: '2026-07-29T16:15:00.000Z',
      actor: {
        id: 'usr_01',
        name: 'Admin User',
        email: 'admin@perftest.com',
      },
      action: 'ENFORCE_2FA',
      resource: {
        type: 'security_policy',
        id: 'pol_2fa',
      },
      status: 'ENFORCED',
    },
  },
  {
    id: 'evt_010',
    timestamp: '29/07/2026 15:00',
    fullTimestamp: '2026-07-29T15:00:22.500Z',
    user: 'Support User',
    email: 'support@perftest.com',
    action: 'LOGIN',
    resource: 'Auth / Session',
    detail: 'Échec de connexion (mot de passe incorrect)',
    ip: '192.168.1.150',
    browser: 'Chrome 125.0 (Windows)',
    system: 'PERFTEST Identity Gateway',
    severity: 'Avertissement',
    jsonPayload: {
      event_id: 'evt_010',
      timestamp: '2026-07-29T15:00:22.500Z',
      actor: {
        id: 'usr_07',
        name: 'Support User',
        email: 'support@perftest.com',
      },
      action: 'LOGIN_ATTEMPT',
      failure_reason: 'INVALID_CREDENTIALS',
      client: {
        ip: '192.168.1.150',
      },
      status: 'FAILED',
    },
  },
]

function getActionBadgeStyle(action: AuditLogEvent['action']) {
  switch (action) {
    case 'LOGIN':
    case 'START':
    case 'EXPORT':
      return { bg: 'var(--pt-info-light)', color: 'var(--pt-info)' }
    case 'CREATE':
      return { bg: 'var(--pt-success-light)', color: 'var(--pt-success)' }
    case 'UPDATE':
    case 'ROLE_CHANGE':
      return { bg: 'var(--pt-warning-light)', color: 'var(--pt-warning)' }
    case 'DELETE':
      return { bg: 'var(--pt-danger-light)', color: 'var(--pt-danger)' }
    case 'VIEW':
      return { bg: '#F3F4F6', color: 'var(--pt-text-muted)' }
    default:
      return { bg: '#F3F4F6', color: 'var(--pt-text-muted)' }
  }
}

function getSeverityPillClass(severity: AuditLogEvent['severity']) {
  switch (severity) {
    case 'Info':
      return 'info'
    case 'Avertissement':
      return 'warning'
    case 'Critique':
      return 'danger'
    default:
      return 'neutral'
  }
}

export default function AuditLogs() {
  const [selectedEvent, setSelectedEvent] = useState<AuditLogEvent>(
    auditLogsData[0]
  )
  const [dateFilter, setDateFilter] = useState('7d')
  const [userFilter, setUserFilter] = useState('Tous')
  const [actionFilter, setActionFilter] = useState('Toutes')
  const [resourceFilter, setResourceFilter] = useState('Toutes')
  const [copied, setCopied] = useState(false)

  const handleResetFilters = () => {
    setDateFilter('7d')
    setUserFilter('Tous')
    setActionFilter('Toutes')
    setResourceFilter('Toutes')
  }

  const handleCopyJson = () => {
    navigator.clipboard.writeText(
      JSON.stringify(selectedEvent.jsonPayload, null, 2)
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredLogs = auditLogsData.filter((log) => {
    const matchesUser = userFilter === 'Tous' || log.user === userFilter
    const matchesAction = actionFilter === 'Toutes' || log.action === actionFilter
    const matchesResource =
      resourceFilter === 'Toutes' || log.resource.includes(resourceFilter)
    return matchesUser && matchesAction && matchesResource
  })

  const { page, setPage, totalPages, pageItems, startIndex, endIndex, totalItems } = usePagination(filteredLogs, 10)

  return (
    <div className="pt-content">
      {/* Page Header */}
      <div className="pt-page-header">
        <div className="page-title">
          <h1>Audit Logs</h1>
          <p>Traquez toutes les actions effectuées sur la plateforme</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <button className="pt-btn-outline">
            <i className="bi bi-download me-1"></i>
            Exporter les journaux
          </button>
          <TopBar searchPlaceholder="Rechercher dans l'audit log..." />
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">Événements totaux</div>
                <div className="stat-value">1248</div>
                <div className="stat-trend positive">
                  <i className="bi bi-arrow-up"></i> +156 cette semaine
                </div>
              </div>
              <div className="stat-icon blue">
                <i className="bi bi-shield-check"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">Utilisateurs actifs</div>
                <div className="stat-value">18</div>
                <div className="stat-trend positive">Dernières 24h</div>
              </div>
              <div className="stat-icon green">
                <i className="bi bi-people"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">Événements aujourd'hui</div>
                <div className="stat-value">92</div>
                <div className="stat-trend positive">+12% vs hier</div>
              </div>
              <div className="stat-icon orange">
                <i className="bi bi-calendar-day"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">Critiques</div>
                <div className="stat-value">7</div>
                <div className="stat-trend negative">Attention requise</div>
              </div>
              <div className="stat-icon red">
                <i className="bi bi-exclamation-triangle"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg">
          <div className="pt-stat-card">
            <div className="stat-header">
              <div>
                <div className="stat-label">Ressources</div>
                <div className="stat-value">76</div>
                <div className="stat-trend neutral">Surveillées</div>
              </div>
              <div className="stat-icon purple">
                <i className="bi bi-hdd"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="pt-card mb-4" style={{ padding: '1rem' }}>
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-3">
            <label className="pt-form-label mb-1" style={{ fontSize: '11.5px' }}>
              Plage de dates
            </label>
            <select
              className="pt-form-control"
              style={{ fontSize: '12.5px' }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="24h">Dernières 24 heures</option>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="custom">Personnalisé...</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="pt-form-label mb-1" style={{ fontSize: '11.5px' }}>
              Utilisateur
            </label>
            <select
              className="pt-form-control"
              style={{ fontSize: '12.5px' }}
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="Tous">Tous les utilisateurs</option>
              <option value="Admin User">Admin User</option>
              <option value="Test Manager">Test Manager</option>
              <option value="Test Engineer">Test Engineer</option>
              <option value="DevOps User">DevOps User</option>
              <option value="Analyst User">Analyst User</option>
              <option value="Read Only User">Read Only User</option>
              <option value="Support User">Support User</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="pt-form-label mb-1" style={{ fontSize: '11.5px' }}>
              Action
            </label>
            <select
              className="pt-form-control"
              style={{ fontSize: '12.5px' }}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as any)}
            >
              <option value="Toutes">Toutes les actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="START">START</option>
              <option value="VIEW">VIEW</option>
              <option value="EXPORT">EXPORT</option>
              <option value="ROLE_CHANGE">ROLE_CHANGE</option>
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label className="pt-form-label mb-1" style={{ fontSize: '11.5px' }}>
              Ressource
            </label>
            <select
              className="pt-form-control"
              style={{ fontSize: '12.5px' }}
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
            >
              <option value="Toutes">Toutes les ressources</option>
              <option value="Auth">Auth / Session</option>
              <option value="Test">Test Run</option>
              <option value="Config">App Config / Security</option>
              <option value="Scenario">Scenario</option>
              <option value="Report">Report</option>
            </select>
          </div>

          <div className="col-12 col-md-2 d-flex align-items-end">
            <button
              className="pt-btn-outline w-100"
              style={{ fontSize: '12.5px', marginTop: '1.25rem' }}
              onClick={handleResetFilters}
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i> Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="row g-3">
        {/* Left Column: Audit Table */}
        <div className="col-12 col-lg-8">
          <div className="pt-card" style={{ padding: 0 }}>
            <div
              className="d-flex justify-content-between align-items-center p-3"
              style={{ borderBottom: '1px solid var(--pt-border)' }}
            >
              <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                Historique des événements ({filteredLogs.length})
              </h6>
              <span style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>
                Mise à jour en temps réel <i className="bi bi-arrow-repeat ms-1"></i>
              </span>
            </div>

            <div className="pt-table-wrapper">
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Date / Heure</th>
                    <th>Utilisateur</th>
                    <th>Action</th>
                    <th>Ressource</th>
                    <th>Détail</th>
                    <th>IP</th>
                    <th>Sévérité</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((log) => {
                    const actionBadge = getActionBadgeStyle(log.action)
                    const isSelected = selectedEvent.id === log.id
                    return (
                      <tr
                        key={log.id}
                        style={{
                          cursor: 'pointer',
                          background: isSelected
                            ? 'var(--pt-primary-light)'
                            : undefined,
                        }}
                        onClick={() => setSelectedEvent(log)}
                      >
                        <td
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {log.timestamp}
                        </td>
                        <td
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--pt-text)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {log.user}
                        </td>
                        <td>
                          <span
                            className="pt-pill"
                            style={{
                              background: actionBadge.bg,
                              color: actionBadge.color,
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 500,
                            color: 'var(--pt-text)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {log.resource}
                        </td>
                        <td
                          style={{
                            fontSize: '12px',
                            color: 'var(--pt-text-muted)',
                            maxWidth: '180px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {log.detail}
                        </td>
                        <td
                          style={{
                            fontSize: '11.5px',
                            fontFamily: 'monospace',
                            color: 'var(--pt-text-muted)',
                          }}
                        >
                          {log.ip}
                        </td>
                        <td>
                          <span
                            className={`pt-pill ${getSeverityPillClass(
                              log.severity
                            )}`}
                            style={{ fontSize: '11px' }}
                          >
                            {log.severity}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={totalItems}
              itemLabel="événements"
            />
          </div>
        </div>

        {/* Right Column: Detail Panel */}
        <div className="col-12 col-lg-4">
          <div className="pt-card">
            {/* Panel Header */}
            <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
              <div>
                <h6 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                  Détail de l'événement
                </h6>
                <small style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>
                  ID: {selectedEvent.id}
                </small>
              </div>
              <span
                className={`pt-pill ${getSeverityPillClass(
                  selectedEvent.severity
                )}`}
              >
                {selectedEvent.severity}
              </span>
            </div>

            {/* Key Field Grid */}
            <div className="mb-3 pb-2 border-bottom">
              <div
                className="mb-2 p-2 rounded"
                style={{ background: 'var(--pt-bg)' }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--pt-text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Intitulé
                </div>
                <div
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: 'var(--pt-text)',
                  }}
                >
                  {selectedEvent.detail}
                </div>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Date & Heure:</span>
                <span style={{ fontWeight: 600, color: 'var(--pt-text)' }}>
                  {selectedEvent.timestamp}
                </span>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Utilisateur:</span>
                <span style={{ fontWeight: 600, color: 'var(--pt-primary)' }}>
                  {selectedEvent.user}
                </span>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Email:</span>
                <span style={{ color: 'var(--pt-text)' }}>
                  {selectedEvent.email}
                </span>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Action:</span>
                <span
                  className="pt-pill"
                  style={{
                    background: getActionBadgeStyle(selectedEvent.action).bg,
                    color: getActionBadgeStyle(selectedEvent.action).color,
                    fontSize: '11px',
                  }}
                >
                  {selectedEvent.action}
                </span>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Ressource:</span>
                <span style={{ fontWeight: 600, color: 'var(--pt-text)' }}>
                  {selectedEvent.resource}
                </span>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Adresse IP:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--pt-text)' }}>
                  {selectedEvent.ip}
                </span>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Navigateur:</span>
                <span style={{ color: 'var(--pt-text)' }}>
                  {selectedEvent.browser}
                </span>
              </div>

              <div
                className="d-flex justify-content-between py-1"
                style={{ fontSize: '12.5px' }}
              >
                <span style={{ color: 'var(--pt-text-muted)' }}>Système:</span>
                <span style={{ color: 'var(--pt-text)' }}>
                  {selectedEvent.system}
                </span>
              </div>
            </div>

            {/* JSON Block Section */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--pt-text-muted)',
                  }}
                >
                  Payload JSON brut
                </span>
                <button
                  className="btn btn-sm btn-link p-0 text-decoration-none"
                  style={{ fontSize: '11.5px', color: 'var(--pt-primary)' }}
                  onClick={handleCopyJson}
                >
                  <i
                    className={`bi ${
                      copied ? 'bi-check-lg text-success' : 'bi-clipboard'
                    } me-1`}
                  ></i>
                  {copied ? 'Copié !' : 'Copier JSON'}
                </button>
              </div>

              <pre
                style={{
                  background: '#1E293B',
                  color: '#E2E8F0',
                  padding: '0.75rem',
                  borderRadius: 'var(--pt-radius-sm)',
                  fontSize: '11.5px',
                  lineHeight: '1.4',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  margin: 0,
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(selectedEvent.jsonPayload, null, 2)}
              </pre>
            </div>

            {/* Actions */}
            <div className="d-flex gap-2">
              <button
                className="pt-btn-primary flex-grow-1"
                style={{ fontSize: '12px', padding: '0.45rem' }}
                onClick={handleCopyJson}
              >
                <i className="bi bi-file-earmark-code me-1"></i> Copier
              </button>
              <button
                className="pt-btn-outline"
                style={{ fontSize: '12px', padding: '0.45rem' }}
                title="Filtrer par cet utilisateur"
                onClick={() => setUserFilter(selectedEvent.user)}
              >
                <i className="bi bi-funnel me-1"></i> Filtrer user
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
