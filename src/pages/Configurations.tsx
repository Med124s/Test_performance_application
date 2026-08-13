import { useState } from 'react'
import TopBar from '../components/TopBar'
import { loadDefaultTestSettings, saveDefaultTestSettings } from '../utils/defaultTestSettings'
import { loadJSON, saveJSON } from '../utils/persistentStore'

function Configurations() {
  const [activeTab, setActiveTab] = useState('general')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  // Card 1 state: Paramètres généraux
  // Chaque carte est initialisée depuis le stockage persistant (localStorage)
  // si elle a déjà été enregistrée, sinon depuis des valeurs par défaut —
  // pour ne rien perdre lors d'un changement de page ou d'un rechargement.
  const [general, setGeneral] = useState(() =>
    loadJSON('pt_config_general', {
      name: 'PERFTEST',
      timezone: 'UTC+01:00 (Africa/Casablanca)',
      language: 'Français',
      unit: 'Millisecondes (ms)',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h (HH:mm:ss)',
    })
  )

  // Card 2 state: Paramètres par défaut
  // Ces valeurs servent de base à tout nouveau lancement de test (page
  // Exécutions) : on les initialise depuis le store partagé plutôt que
  // depuis des constantes figées.
  const savedDefaults = loadDefaultTestSettings()
  const [defaults, setDefaults] = useState({
    timeout: '30s',
    httpTimeout: `${savedDefaults.httpTimeoutSeconds}s`,
    stepDelay: `${savedDefaults.stepDelayMs} ms`,
    retries: String(savedDefaults.retries),
    concurrency: String(savedDefaults.concurrency),
    rampUp: `${savedDefaults.rampUpSeconds}s`,
  })

  // Card 3 state: Stockage & Rétention
  const [storage, setStorage] = useState(() =>
    loadJSON('pt_config_storage', {
      execRetention: '90',
      metricsRetention: '180',
      compression: true,
      autoCleanup: true,
    })
  )

  // Card 4 state: Logs
  const [logs, setLogs] = useState(() =>
    loadJSON('pt_config_logs', {
      level: 'INFO',
      verbose: true,
      rotation: false,
      maxSize: '100',
      fileCount: '10',
    })
  )

  // Card 5 state: Notifications système
  const [notifications, setNotifications] = useState(() =>
    loadJSON('pt_config_notifications', {
      emailAlerts: true,
      slackAlerts: true,
      alertThreshold: '5',
      channel: 'Email',
    })
  )

  const triggerSave = (cardName: string) => {
    setSavedMessage(`Paramètres "${cardName}" enregistrés avec succès !`)
    setTimeout(() => {
      setSavedMessage(null)
    }, 3000)
  }

  const handleSaveGeneral = () => {
    saveJSON('pt_config_general', general)
    triggerSave('Paramètres généraux')
  }

  const handleSaveStorage = () => {
    saveJSON('pt_config_storage', storage)
    triggerSave('Stockage & Rétention')
  }

  const handleSaveLogs = () => {
    saveJSON('pt_config_logs', logs)
    triggerSave('Logs')
  }

  const handleSaveNotifications = () => {
    saveJSON('pt_config_notifications', notifications)
    triggerSave('Notifications système')
  }

  // Extrait la première valeur numérique d'un champ texte libre (ex: "500 ms" -> 500)
  const parseNumber = (value: string, fallback: number) => {
    const match = value.match(/\d+/)
    return match ? parseInt(match[0], 10) : fallback
  }

  const handleSaveDefaults = () => {
    saveDefaultTestSettings({
      httpTimeoutSeconds: parseNumber(defaults.httpTimeout, 10),
      stepDelayMs: parseNumber(defaults.stepDelay, 500),
      concurrency: parseNumber(defaults.concurrency, 50),
      rampUpSeconds: parseNumber(defaults.rampUp, 60),
      retries: parseNumber(defaults.retries, 3),
    })
    triggerSave('Paramètres par défaut')
  }

  const tabs = [
    { id: 'general', label: 'Général', icon: 'bi-sliders' },
    { id: 'environments', label: 'Environnements', icon: 'bi-diagram-3' },
    { id: 'executions', label: 'Exécutions', icon: 'bi-play-circle' },
    { id: 'reports', label: 'Rapports', icon: 'bi-file-earmark-bar-graph' },
    { id: 'notifications', label: 'Notifications', icon: 'bi-bell' },
    { id: 'security', label: 'Sécurité', icon: 'bi-shield-lock' },
    { id: 'integrations', label: 'Intégrations', icon: 'bi-plug' },
    { id: 'advanced', label: 'Avancées', icon: 'bi-gear-wide-connected' },
  ]

  return (
    <div className="pt-content">
      {/* Page Header */}
      <div className="pt-page-header">
        <div className="page-title">
          <h1>Configurations</h1>
          <p>Gérez les paramètres globaux de PERFTEST</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <TopBar searchPlaceholder="Rechercher une configuration..." />
        </div>
      </div>

      {/* Alert notification on save */}
      {savedMessage && (
        <div
          className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4"
          role="alert"
          style={{ borderRadius: 'var(--pt-radius-sm)', fontSize: '13.5px' }}
        >
          <i className="bi bi-check-circle-fill text-success fs-5"></i>
          <div>{savedMessage}</div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setSavedMessage(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="d-flex gap-2 border-bottom mb-4 overflow-auto pb-2" style={{ borderColor: 'var(--pt-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-light'}`}
            style={{
              borderRadius: 'var(--pt-radius-sm)',
              fontWeight: 600,
              fontSize: '13px',
              padding: '0.45rem 0.9rem',
              backgroundColor: activeTab === tab.id ? 'var(--pt-primary)' : 'var(--pt-card-bg)',
              color: activeTab === tab.id ? '#ffffff' : 'var(--pt-text-muted)',
              border: '1px solid ' + (activeTab === tab.id ? 'var(--pt-primary)' : 'var(--pt-border)'),
              whiteSpace: 'nowrap',
            }}
          >
            <i className={`bi ${tab.icon} me-1.5`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' ? (
        /* 3x2 Grid of Cards */
        <div className="row g-4">
          {/* Card 1: Paramètres généraux */}
          <div className="col-12 col-lg-6">
            <div className="pt-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2"
                  style={{ borderColor: 'var(--pt-border)' }}
                >
                  <h5 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '15px', color: 'var(--pt-text)' }}>
                    <i className="bi bi-sliders text-primary"></i>
                    Paramètres généraux
                  </h5>
                  <span className="pt-pill info">Système</span>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Nom</label>
                    <input
                      type="text"
                      className="pt-form-control"
                      value={general.name}
                      onChange={(e) => setGeneral({ ...general, name: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Fuseau horaire</label>
                    <select
                      className="pt-form-control"
                      value={general.timezone}
                      onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}
                    >
                      <option value="UTC+01:00 (Africa/Casablanca)">UTC+01:00 (Africa/Casablanca)</option>
                      <option value="UTC+01:00 (Europe/Paris)">UTC+01:00 (Europe/Paris)</option>
                      <option value="UTC+00:00 (GMT)">UTC+00:00 (GMT)</option>
                      <option value="UTC-05:00 (EST)">UTC-05:00 (EST)</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Langue</label>
                    <select
                      className="pt-form-control"
                      value={general.language}
                      onChange={(e) => setGeneral({ ...general, language: e.target.value })}
                    >
                      <option value="Français">Français</option>
                      <option value="English">English</option>
                      <option value="Español">Español</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Unité</label>
                    <select
                      className="pt-form-control"
                      value={general.unit}
                      onChange={(e) => setGeneral({ ...general, unit: e.target.value })}
                    >
                      <option value="Millisecondes (ms)">Millisecondes (ms)</option>
                      <option value="Secondes (s)">Secondes (s)</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Format date</label>
                    <select
                      className="pt-form-control"
                      value={general.dateFormat}
                      onChange={(e) => setGeneral({ ...general, dateFormat: e.target.value })}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Format heure</label>
                    <select
                      className="pt-form-control"
                      value={general.timeFormat}
                      onChange={(e) => setGeneral({ ...general, timeFormat: e.target.value })}
                    >
                      <option value="24h (HH:mm:ss)">24h (HH:mm:ss)</option>
                      <option value="12h (hh:mm:ss AM/PM)">12h (hh:mm:ss AM/PM)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-top d-flex justify-content-end" style={{ borderColor: 'var(--pt-border)' }}>
                <button className="pt-btn-primary" onClick={handleSaveGeneral}>
                  <i className="bi bi-check2"></i>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Paramètres par défaut */}
          <div className="col-12 col-lg-6">
            <div className="pt-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2"
                  style={{ borderColor: 'var(--pt-border)' }}
                >
                  <h5 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '15px', color: 'var(--pt-text)' }}>
                    <i className="bi bi-play-circle text-primary"></i>
                    Paramètres par défaut
                  </h5>
                  <span className="pt-pill neutral">Exécution</span>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Timeout</label>
                    <input
                      type="text"
                      className="pt-form-control"
                      value={defaults.timeout}
                      onChange={(e) => setDefaults({ ...defaults, timeout: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Timeout HTTP</label>
                    <input
                      type="text"
                      className="pt-form-control"
                      value={defaults.httpTimeout}
                      onChange={(e) => setDefaults({ ...defaults, httpTimeout: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Délai entre étapes</label>
                    <input
                      type="text"
                      className="pt-form-control"
                      value={defaults.stepDelay}
                      onChange={(e) => setDefaults({ ...defaults, stepDelay: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Tentatives</label>
                    <input
                      type="number"
                      className="pt-form-control"
                      value={defaults.retries}
                      onChange={(e) => setDefaults({ ...defaults, retries: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Concurrence</label>
                    <input
                      type="number"
                      className="pt-form-control"
                      value={defaults.concurrency}
                      onChange={(e) => setDefaults({ ...defaults, concurrency: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Ramp-up</label>
                    <input
                      type="text"
                      className="pt-form-control"
                      value={defaults.rampUp}
                      onChange={(e) => setDefaults({ ...defaults, rampUp: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-top d-flex justify-content-end" style={{ borderColor: 'var(--pt-border)' }}>
                <button className="pt-btn-primary" onClick={handleSaveDefaults}>
                  <i className="bi bi-check2"></i>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Stockage & Rétention */}
          <div className="col-12 col-lg-6">
            <div className="pt-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2"
                  style={{ borderColor: 'var(--pt-border)' }}
                >
                  <h5 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '15px', color: 'var(--pt-text)' }}>
                    <i className="bi bi-database text-primary"></i>
                    Stockage & Rétention
                  </h5>
                  <span className="pt-pill warning">Ressources</span>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Rétention exécutions (jours)</label>
                    <input
                      type="number"
                      className="pt-form-control"
                      value={storage.execRetention}
                      onChange={(e) => setStorage({ ...storage, execRetention: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Rétention métriques (jours)</label>
                    <input
                      type="number"
                      className="pt-form-control"
                      value={storage.metricsRetention}
                      onChange={(e) => setStorage({ ...storage, metricsRetention: e.target.value })}
                    />
                  </div>
                  <div className="col-12 mt-3">
                    <div className="d-flex align-items-center justify-content-between p-2 rounded" style={{ background: 'var(--pt-sidebar-item-hover)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>Compression des métriques</div>
                        <small className="text-muted" style={{ fontSize: '11.5px' }}>Compresser les données de performances archivées</small>
                      </div>
                      <label className="pt-toggle">
                        <input
                          type="checkbox"
                          checked={storage.compression}
                          onChange={(e) => setStorage({ ...storage, compression: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between p-2 rounded" style={{ background: 'var(--pt-sidebar-item-hover)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>Nettoyage automatique</div>
                        <small className="text-muted" style={{ fontSize: '11.5px' }}>Purger automatiquement les exécutions obsolètes</small>
                      </div>
                      <label className="pt-toggle">
                        <input
                          type="checkbox"
                          checked={storage.autoCleanup}
                          onChange={(e) => setStorage({ ...storage, autoCleanup: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-top d-flex justify-content-end" style={{ borderColor: 'var(--pt-border)' }}>
                <button className="pt-btn-primary" onClick={handleSaveStorage}>
                  <i className="bi bi-check2"></i>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Logs */}
          <div className="col-12 col-lg-6">
            <div className="pt-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2"
                  style={{ borderColor: 'var(--pt-border)' }}
                >
                  <h5 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '15px', color: 'var(--pt-text)' }}>
                    <i className="bi bi-journal-text text-primary"></i>
                    Logs
                  </h5>
                  <span className="pt-pill success">Monitoring</span>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Niveau</label>
                    <select
                      className="pt-form-control"
                      value={logs.level}
                      onChange={(e) => setLogs({ ...logs, level: e.target.value })}
                    >
                      <option value="DEBUG">DEBUG</option>
                      <option value="INFO">INFO</option>
                      <option value="WARN">WARN</option>
                      <option value="ERROR">ERROR</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Taille max (MB)</label>
                    <input
                      type="number"
                      className="pt-form-control"
                      value={logs.maxSize}
                      onChange={(e) => setLogs({ ...logs, maxSize: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Nombre fichiers</label>
                    <input
                      type="number"
                      className="pt-form-control"
                      value={logs.fileCount}
                      onChange={(e) => setLogs({ ...logs, fileCount: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6 d-flex align-items-center pt-3">
                    <div className="d-flex align-items-center justify-content-between w-100 p-2 rounded" style={{ background: 'var(--pt-sidebar-item-hover)' }}>
                      <span style={{ fontWeight: 600, fontSize: '12.5px' }}>Logs détaillés</span>
                      <label className="pt-toggle">
                        <input
                          type="checkbox"
                          checked={logs.verbose}
                          onChange={(e) => setLogs({ ...logs, verbose: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between p-2 rounded" style={{ background: 'var(--pt-sidebar-item-hover)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>Rotation des logs</div>
                        <small className="text-muted" style={{ fontSize: '11.5px' }}>Activer la rotation périodique des fichiers de log</small>
                      </div>
                      <label className="pt-toggle">
                        <input
                          type="checkbox"
                          checked={logs.rotation}
                          onChange={(e) => setLogs({ ...logs, rotation: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-top d-flex justify-content-end" style={{ borderColor: 'var(--pt-border)' }}>
                <button className="pt-btn-primary" onClick={handleSaveLogs}>
                  <i className="bi bi-check2"></i>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          {/* Card 5: Notifications système */}
          <div className="col-12 col-lg-6">
            <div className="pt-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2"
                  style={{ borderColor: 'var(--pt-border)' }}
                >
                  <h5 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '15px', color: 'var(--pt-text)' }}>
                    <i className="bi bi-bell text-primary"></i>
                    Notifications système
                  </h5>
                  <span className="pt-pill info">Alertes</span>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Seuil alerte (%)</label>
                    <input
                      type="number"
                      className="pt-form-control"
                      value={notifications.alertThreshold}
                      onChange={(e) => setNotifications({ ...notifications, alertThreshold: e.target.value })}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="pt-form-label">Canal</label>
                    <select
                      className="pt-form-control"
                      value={notifications.channel}
                      onChange={(e) => setNotifications({ ...notifications, channel: e.target.value })}
                    >
                      <option value="Email">Email</option>
                      <option value="Slack">Slack</option>
                      <option value="Teams">Teams</option>
                      <option value="Webhook">Webhook</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between p-2 rounded mb-2" style={{ background: 'var(--pt-sidebar-item-hover)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>Notifications Email</div>
                        <small className="text-muted" style={{ fontSize: '11.5px' }}>Avertissements par email en cas d'échec</small>
                      </div>
                      <label className="pt-toggle">
                        <input
                          type="checkbox"
                          checked={notifications.emailAlerts}
                          onChange={(e) => setNotifications({ ...notifications, emailAlerts: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <div className="d-flex align-items-center justify-content-between p-2 rounded" style={{ background: 'var(--pt-sidebar-item-hover)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>Notifications Slack</div>
                        <small className="text-muted" style={{ fontSize: '11.5px' }}>Diffuser les alertes sur le canal configuré</small>
                      </div>
                      <label className="pt-toggle">
                        <input
                          type="checkbox"
                          checked={notifications.slackAlerts}
                          onChange={(e) => setNotifications({ ...notifications, slackAlerts: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-top d-flex justify-content-end" style={{ borderColor: 'var(--pt-border)' }}>
                <button className="pt-btn-primary" onClick={handleSaveNotifications}>
                  <i className="bi bi-check2"></i>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          {/* Card 6: À propos */}
          <div className="col-12 col-lg-6">
            <div className="pt-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div
                  className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2"
                  style={{ borderColor: 'var(--pt-border)' }}
                >
                  <h5 className="m-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '15px', color: 'var(--pt-text)' }}>
                    <i className="bi bi-info-circle text-primary"></i>
                    À propos
                  </h5>
                  <span className="pt-pill success">v1.0.0</span>
                </div>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ borderColor: 'var(--pt-border)' }}>
                    <span className="text-muted" style={{ fontSize: '13px' }}>Version</span>
                    <span className="fw-bold" style={{ fontSize: '13px' }}>v1.0.0</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ borderColor: 'var(--pt-border)' }}>
                    <span className="text-muted" style={{ fontSize: '13px' }}>Environnement</span>
                    <span className="pt-pill success">Production</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ borderColor: 'var(--pt-border)' }}>
                    <span className="text-muted" style={{ fontSize: '13px' }}>Dernière MAJ</span>
                    <span className="fw-semibold" style={{ fontSize: '13px' }}>30/07/2026</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center py-1">
                    <span className="text-muted" style={{ fontSize: '13px' }}>Développé par</span>
                    <span className="fw-bold text-primary" style={{ fontSize: '13px' }}>
                      <i className="bi bi-code-slash me-1"></i>
                      PERFTEST Team
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--pt-border)' }}>
                <span className="text-muted small">
                  <i className="bi bi-shield-check text-success me-1"></i>
                  Plateforme opérationnelle
                </span>
                <button className="pt-btn-outline" onClick={() => alert('Vérification des mises à jour... PERFTEST v1.0.0 est à jour.')}>
                  <i className="bi bi-arrow-repeat"></i>
                  Mises à jour
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pt-card p-5 text-center">
          <i className="bi bi-gear-wide-connected text-primary display-4 mb-3"></i>
          <h5>Section "{tabs.find((t) => t.id === activeTab)?.label}"</h5>
          <p className="text-muted">Ces paramètres avancés sont gérés par les rôles administrateur.</p>
          <button className="pt-btn-primary mx-auto mt-2" onClick={() => setActiveTab('general')}>
            Retour à l'onglet Général
          </button>
        </div>
      )}
    </div>
  )
}

export default Configurations
