import React, { useState } from 'react'
import TopBar from '../components/TopBar'
import { loadJSON, saveJSON } from '../utils/persistentStore'

type TabType =
  | 'General'
  | 'Notifications'
  | 'Securite'
  | 'Executions'
  | 'Integrations'
  | 'Stockage'
  | 'Apparence'
  | 'Systeme'
  | 'Sauvegarde'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('General')
  const [savedNotice, setSavedSavedNotice] = useState<string | null>(null)

  // Card 1 state
  const [generalInfo, setGeneralInfo] = useState(() =>
    loadJSON('pt_settings_general', {
      name: 'PERFTEST',
      description: 'Plateforme de tests de performance entreprise',
      url: 'https://perftest.company.com',
      timezone: 'Europe/Paris (UTC+1)',
      language: 'Français',
      dateFormat: 'DD/MM/YYYY',
      datetimeFormat: 'DD/MM/YYYY HH:mm',
      currency: 'EUR (€)',
    })
  )

  // Card 2 state
  const [reportSettings, setReportSettings] = useState(() =>
    loadJSON('pt_settings_reports', {
      format: 'PDF',
      includeCharts: true,
      includeRequests: true,
      includeErrors: true,
      maxExec: 10,
      retentionDays: 365,
    })
  )

  // Card 3 state
  const [securitySettings, setSecuritySettings] = useState(() =>
    loadJSON('pt_settings_security', {
      enable2FA: true,
      sessionTimeout: 120,
      maxAttempts: 5,
      lockoutDuration: 30,
      passwordPolicy: 'Fort (Min 12 car., 1 maj., 1 chiffre, 1 symb.)',
      passwordExpiryDays: 90,
    })
  )

  // Card 4 state
  const [executionSettings, setExecutionSettings] = useState(() =>
    loadJSON('pt_settings_executions', {
      timeoutSeconds: 30,
      gracePeriodMs: 500,
      maxVirtualUsers: 1000,
      defaultRepetitions: 1,
      strategy: 'Ramp-up progressif',
      retryDelaySeconds: 5,
    })
  )

  // Card 5 state
  const [emailSettings, setEmailSettings] = useState(() =>
    loadJSON('pt_settings_email', {
      senderName: 'PERFTEST Alertes',
      senderEmail: 'noreply@perftest.com',
      smtpHost: 'smtp.perftest.com',
      smtpPort: 587,
      encryption: 'TLS / STARTTLS',
      smtpAuth: true,
    })
  )

  const triggerSaveNotification = (sectionName: string) => {
    setSavedSavedNotice(`Paramètres "${sectionName}" enregistrés avec succès.`)
    setTimeout(() => setSavedSavedNotice(null), 3000)
  }

  // Persiste réellement chaque section dans le stockage local au moment de
  // l'enregistrement (plutôt qu'un simple message de confirmation factice).
  const saveGeneral = () => { saveJSON('pt_settings_general', generalInfo); triggerSaveNotification('Informations générales') }
  const saveReports = () => { saveJSON('pt_settings_reports', reportSettings); triggerSaveNotification('Paramètres des rapports') }
  const saveSecurity = () => { saveJSON('pt_settings_security', securitySettings); triggerSaveNotification('Paramètres de sécurité') }
  const saveExecutions = () => { saveJSON('pt_settings_executions', executionSettings); triggerSaveNotification('Paramètres des exécutions') }
  const saveEmail = () => { saveJSON('pt_settings_email', emailSettings); triggerSaveNotification('Paramètres des emails') }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'General', label: 'Général', icon: 'bi-sliders' },
    { id: 'Notifications', label: 'Notifications', icon: 'bi-bell' },
    { id: 'Securite', label: 'Sécurité', icon: 'bi-shield-lock' },
    { id: 'Executions', label: 'Exécutions', icon: 'bi-play-circle' },
    { id: 'Integrations', label: 'Intégrations', icon: 'bi-plug' },
    { id: 'Stockage', label: 'Stockage', icon: 'bi-hdd' },
    { id: 'Apparence', label: 'Apparence', icon: 'bi-palette' },
    { id: 'Systeme', label: 'Système', icon: 'bi-cpu' },
    { id: 'Sauvegarde', label: 'Sauvegarde', icon: 'bi-cloud-arrow-up' },
  ]

  const services = [
    { name: 'Base de données PostgreSQL', status: 'En ligne', ping: '4ms' },
    { name: "Moteur d'exécution K6/JMeter", status: 'En ligne', ping: '12ms' },
    { name: "Service de file d'attente Redis", status: 'En ligne', ping: '1ms' },
    { name: "Serveur d'authentification OAuth2", status: 'En ligne', ping: '8ms' },
    { name: 'API Gateway', status: 'En ligne', ping: '5ms' },
    { name: 'Service de stockage S3', status: 'En ligne', ping: '22ms' },
    { name: 'Service de notifications Email/Slack', status: 'En ligne', ping: '15ms' },
  ]

  return (
    <div className="pt-content">
      {/* Page Header */}
      <div className="pt-page-header">
        <div className="page-title">
          <h1>Settings</h1>
          <p>Personnalisez et configurez votre plateforme PERFTEST</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <TopBar searchPlaceholder="Rechercher dans la configuration..." />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        className="d-flex align-items-center gap-1 mb-4 overflow-auto border-bottom pb-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn btn-sm d-flex align-items-center gap-2 px-3 py-2 rounded-2 transition-all"
              style={{
                border: 'none',
                background: isActive ? 'var(--pt-primary-light)' : 'transparent',
                color: isActive ? 'var(--pt-primary)' : 'var(--pt-text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                whiteSpace: 'nowrap',
              }}
            >
              <i className={`bi ${tab.icon}`}></i>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Save Notification Toast */}
      {savedNotice && (
        <div
          className="alert alert-success d-flex align-items-center gap-2 mb-3 py-2 px-3 fade show"
          style={{
            fontSize: '13px',
            borderRadius: 'var(--pt-radius-sm)',
            border: '1px solid var(--pt-success)',
            background: 'var(--pt-success-light)',
            color: 'var(--pt-success)',
          }}
        >
          <i className="bi bi-check-circle-fill"></i>
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Info Banner */}
      <div
        className="pt-card mb-4 d-flex align-items-center justify-content-between"
        style={{
          background: 'var(--pt-primary-light)',
          borderColor: 'var(--pt-primary)',
          padding: '0.85rem 1.25rem',
        }}
      >
        <div className="d-flex align-items-center gap-2.5">
          <i
            className="bi bi-info-circle-fill"
            style={{ color: 'var(--pt-primary)', fontSize: '18px' }}
          ></i>
          <span
            style={{
              fontSize: '13.5px',
              fontWeight: 500,
              color: 'var(--pt-text)',
            }}
          >
            Configurez les paramètres généraux de la plateforme.
          </span>
        </div>
        <span
          className="pt-pill"
          style={{ background: 'var(--pt-card-bg)', color: 'var(--pt-primary)' }}
        >
          Version 2.4.0
        </span>
      </div>

      {/* 4-Column Grid of 8 Cards */}
      <div className="row row-cols-1 row-cols-md-2 row-cols-xl-4 g-3">
        {/* Card 1: Informations générales */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-gear-fill me-2 text-primary"></i>
                  Informations générales
                </h6>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                <div>
                  <label className="pt-form-label">Nom de la plateforme</label>
                  <input
                    type="text"
                    className="pt-form-control"
                    value={generalInfo.name}
                    onChange={(e) =>
                      setGeneralInfo({ ...generalInfo, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Description</label>
                  <input
                    type="text"
                    className="pt-form-control"
                    value={generalInfo.description}
                    onChange={(e) =>
                      setGeneralInfo({ ...generalInfo, description: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">URL de la plateforme</label>
                  <input
                    type="text"
                    className="pt-form-control"
                    value={generalInfo.url}
                    onChange={(e) =>
                      setGeneralInfo({ ...generalInfo, url: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Fuseau horaire</label>
                  <select
                    className="pt-form-control"
                    value={generalInfo.timezone}
                    onChange={(e) =>
                      setGeneralInfo({ ...generalInfo, timezone: e.target.value })
                    }
                  >
                    <option value="Europe/Paris (UTC+1)">Europe/Paris (UTC+1)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York (UTC-5)">America/New_York (UTC-5)</option>
                  </select>
                </div>

                <div>
                  <label className="pt-form-label">Langue</label>
                  <select
                    className="pt-form-control"
                    value={generalInfo.language}
                    onChange={(e) =>
                      setGeneralInfo({ ...generalInfo, language: e.target.value })
                    }
                  >
                    <option value="Français">Français</option>
                    <option value="English">English</option>
                  </select>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <label className="pt-form-label">Format date</label>
                    <select
                      className="pt-form-control"
                      value={generalInfo.dateFormat}
                      onChange={(e) =>
                        setGeneralInfo({ ...generalInfo, dateFormat: e.target.value })
                      }
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="pt-form-label">Format datetime</label>
                    <select
                      className="pt-form-control"
                      value={generalInfo.datetimeFormat}
                      onChange={(e) =>
                        setGeneralInfo({
                          ...generalInfo,
                          datetimeFormat: e.target.value,
                        })
                      }
                    >
                      <option value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm</option>
                      <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="pt-form-label">Devise</label>
                  <select
                    className="pt-form-control"
                    value={generalInfo.currency}
                    onChange={(e) =>
                      setGeneralInfo({ ...generalInfo, currency: e.target.value })
                    }
                  >
                    <option value="EUR (€)">EUR (€)</option>
                    <option value="USD ($)">USD ($)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              className="pt-btn-primary w-100"
              style={{ fontSize: '12.5px', padding: '0.45rem' }}
              onClick={saveGeneral}
            >
              <i className="bi bi-check2 me-1"></i> Enregistrer
            </button>
          </div>
        </div>

        {/* Card 2: Paramètres des rapports */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-file-earmark-bar-graph-fill me-2 text-success"></i>
                  Paramètres des rapports
                </h6>
              </div>

              <div className="d-flex flex-column gap-2.5 mb-3">
                <div>
                  <label className="pt-form-label">Format par défaut</label>
                  <select
                    className="pt-form-control"
                    value={reportSettings.format}
                    onChange={(e) =>
                      setReportSettings({ ...reportSettings, format: e.target.value })
                    }
                  >
                    <option value="PDF">PDF</option>
                    <option value="HTML">HTML</option>
                    <option value="CSV">CSV</option>
                    <option value="JSON">JSON</option>
                  </select>
                </div>

                <div className="p-2.5 rounded border bg-light-subtle">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      Inclure les graphiques
                    </span>
                    <label className="pt-toggle">
                      <input
                        type="checkbox"
                        checked={reportSettings.includeCharts}
                        onChange={(e) =>
                          setReportSettings({
                            ...reportSettings,
                            includeCharts: e.target.checked,
                          })
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      Inclure détail des requêtes
                    </span>
                    <label className="pt-toggle">
                      <input
                        type="checkbox"
                        checked={reportSettings.includeRequests}
                        onChange={(e) =>
                          setReportSettings({
                            ...reportSettings,
                            includeRequests: e.target.checked,
                          })
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="d-flex justify-content-between align-items-center">
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                      Inclure logs d'erreurs
                    </span>
                    <label className="pt-toggle">
                      <input
                        type="checkbox"
                        checked={reportSettings.includeErrors}
                        onChange={(e) =>
                          setReportSettings({
                            ...reportSettings,
                            includeErrors: e.target.checked,
                          })
                        }
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="pt-form-label">
                    Max exécutions affichées dans le rapport
                  </label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={reportSettings.maxExec}
                    onChange={(e) =>
                      setReportSettings({
                        ...reportSettings,
                        maxExec: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">
                    Rétention des rapports (jours)
                  </label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={reportSettings.retentionDays}
                    onChange={(e) =>
                      setReportSettings({
                        ...reportSettings,
                        retentionDays: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <button
              className="pt-btn-primary w-100"
              style={{ fontSize: '12.5px', padding: '0.45rem' }}
              onClick={saveReports}
            >
              <i className="bi bi-check2 me-1"></i> Enregistrer
            </button>
          </div>
        </div>

        {/* Card 3: Paramètres de sécurité */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-shield-lock-fill me-2 text-warning"></i>
                  Paramètres de sécurité
                </h6>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                <div className="d-flex justify-content-between align-items-center p-2 rounded border">
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
                      Double authentification (2FA)
                    </div>
                    <small
                      style={{ fontSize: '11px', color: 'var(--pt-text-muted)' }}
                    >
                      Obligatoire pour les administrateurs
                    </small>
                  </div>
                  <label className="pt-toggle">
                    <input
                      type="checkbox"
                      checked={securitySettings.enable2FA}
                      onChange={(e) =>
                        setSecuritySettings({
                          ...securitySettings,
                          enable2FA: e.target.checked,
                        })
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div>
                  <label className="pt-form-label">Timeout de session (min)</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={securitySettings.sessionTimeout}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        sessionTimeout: parseInt(e.target.value) || 10,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Tentatives max avant blocage</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={securitySettings.maxAttempts}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        maxAttempts: parseInt(e.target.value) || 3,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Durée de verrouillage (min)</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={securitySettings.lockoutDuration}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        lockoutDuration: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Politique de mot de passe</label>
                  <input
                    type="text"
                    className="pt-form-control"
                    value={securitySettings.passwordPolicy}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        passwordPolicy: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Expiration mot de passe (jours)</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={securitySettings.passwordExpiryDays}
                    onChange={(e) =>
                      setSecuritySettings({
                        ...securitySettings,
                        passwordExpiryDays: parseInt(e.target.value) || 30,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <button
              className="pt-btn-primary w-100"
              style={{ fontSize: '12.5px', padding: '0.45rem' }}
              onClick={saveSecurity}
            >
              <i className="bi bi-check2 me-1"></i> Enregistrer
            </button>
          </div>
        </div>

        {/* Card 4: Paramètres des exécutions */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-cpu-fill me-2 text-danger"></i>
                  Paramètres des exécutions
                </h6>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                <div>
                  <label className="pt-form-label">Timeout des requêtes (sec)</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={executionSettings.timeoutSeconds}
                    onChange={(e) =>
                      setExecutionSettings({
                        ...executionSettings,
                        timeoutSeconds: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Délai de grâce d'arrêt (ms)</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={executionSettings.gracePeriodMs}
                    onChange={(e) =>
                      setExecutionSettings({
                        ...executionSettings,
                        gracePeriodMs: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Max utilisateurs virtuels (VUs)</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={executionSettings.maxVirtualUsers}
                    onChange={(e) =>
                      setExecutionSettings({
                        ...executionSettings,
                        maxVirtualUsers: parseInt(e.target.value) || 10,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Répétitions par défaut</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={executionSettings.defaultRepetitions}
                    onChange={(e) =>
                      setExecutionSettings({
                        ...executionSettings,
                        defaultRepetitions: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Stratégie de montée en charge</label>
                  <select
                    className="pt-form-control"
                    value={executionSettings.strategy}
                    onChange={(e) =>
                      setExecutionSettings({
                        ...executionSettings,
                        strategy: e.target.value,
                      })
                    }
                  >
                    <option value="Ramp-up progressif">Ramp-up progressif</option>
                    <option value="Pic de charge instantané">Pic de charge instantané</option>
                    <option value="Paliers successifs">Paliers successifs</option>
                  </select>
                </div>

                <div>
                  <label className="pt-form-label">Délai réessai sur échec (sec)</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={executionSettings.retryDelaySeconds}
                    onChange={(e) =>
                      setExecutionSettings({
                        ...executionSettings,
                        retryDelaySeconds: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <button
              className="pt-btn-primary w-100"
              style={{ fontSize: '12.5px', padding: '0.45rem' }}
              onClick={saveExecutions}
            >
              <i className="bi bi-check2 me-1"></i> Enregistrer
            </button>
          </div>
        </div>

        {/* Card 5: Paramètres des emails */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-envelope-fill me-2 text-info"></i>
                  Paramètres des emails
                </h6>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                <div>
                  <label className="pt-form-label">Nom d'expéditeur</label>
                  <input
                    type="text"
                    className="pt-form-control"
                    value={emailSettings.senderName}
                    onChange={(e) =>
                      setEmailSettings({
                        ...emailSettings,
                        senderName: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Email d'expéditeur</label>
                  <input
                    type="email"
                    className="pt-form-control"
                    value={emailSettings.senderEmail}
                    onChange={(e) =>
                      setEmailSettings({
                        ...emailSettings,
                        senderEmail: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Serveur SMTP</label>
                  <input
                    type="text"
                    className="pt-form-control"
                    value={emailSettings.smtpHost}
                    onChange={(e) =>
                      setEmailSettings({
                        ...emailSettings,
                        smtpHost: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Port SMTP</label>
                  <input
                    type="number"
                    className="pt-form-control"
                    value={emailSettings.smtpPort}
                    onChange={(e) =>
                      setEmailSettings({
                        ...emailSettings,
                        smtpPort: parseInt(e.target.value) || 25,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="pt-form-label">Chiffrement</label>
                  <select
                    className="pt-form-control"
                    value={emailSettings.encryption}
                    onChange={(e) =>
                      setEmailSettings({
                        ...emailSettings,
                        encryption: e.target.value,
                      })
                    }
                  >
                    <option value="TLS / STARTTLS">TLS / STARTTLS</option>
                    <option value="SSL">SSL</option>
                    <option value="Aucun">Aucun</option>
                  </select>
                </div>

                <div className="d-flex justify-content-between align-items-center p-2 rounded border">
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    Authentification SMTP
                  </span>
                  <label className="pt-toggle">
                    <input
                      type="checkbox"
                      checked={emailSettings.smtpAuth}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          smtpAuth: e.target.checked,
                        })
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <button
              className="pt-btn-primary w-100"
              style={{ fontSize: '12.5px', padding: '0.45rem' }}
              onClick={saveEmail}
            >
              <i className="bi bi-check2 me-1"></i> Enregistrer
            </button>
          </div>
        </div>

        {/* Card 6: État des services */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-activity me-2 text-success"></i>
                  État des services
                </h6>
                <span className="pt-pill success" style={{ fontSize: '10.5px' }}>
                  7/7 Opérationnels
                </span>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                {services.map((svc, i) => (
                  <div
                    key={i}
                    className="d-flex justify-content-between align-items-center p-1.5 rounded"
                    style={{
                      background: 'var(--pt-bg)',
                      border: '1px solid var(--pt-border)',
                      fontSize: '11.5px',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-check-circle-fill text-success"></i>
                      <span style={{ fontWeight: 500, color: 'var(--pt-text)' }}>
                        {svc.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '10.5px', color: 'var(--pt-text-muted)' }}>
                      {svc.ping}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* License Status Badge */}
            <div
              className="p-2.5 rounded text-center border"
              style={{
                background: 'var(--pt-success-light)',
                borderColor: 'var(--pt-success)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--pt-success)',
                }}
              >
                <i className="bi bi-patch-check-fill me-1"></i>
                Licence Entreprise
              </div>
              <div style={{ fontSize: '11px', color: 'var(--pt-text)' }}>
                Valide jusqu'au 31/12/2025
              </div>
            </div>
          </div>
        </div>

        {/* Card 7: Actions rapides */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-lightning-charge-fill me-2 text-warning"></i>
                  Actions rapides
                </h6>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                <button
                  className="pt-btn-outline text-start w-100 justify-content-start"
                  style={{ fontSize: '12px', padding: '0.45rem 0.75rem' }}
                  onClick={() => triggerSaveNotification('Cache système vidé')}
                >
                  <i className="bi bi-trash me-2 text-danger"></i>
                  Vider le cache système
                </button>

                <button
                  className="pt-btn-outline text-start w-100 justify-content-start"
                  style={{ fontSize: '12px', padding: '0.45rem 0.75rem' }}
                  onClick={() =>
                    triggerSaveNotification('Réindexation lancée en arrière-plan')
                  }
                >
                  <i className="bi bi-arrow-repeat me-2 text-primary"></i>
                  Réindexer les données
                </button>

                <button
                  className="pt-btn-outline text-start w-100 justify-content-start"
                  style={{ fontSize: '12px', padding: '0.45rem 0.75rem' }}
                  onClick={() =>
                    triggerSaveNotification('Test BD réussi (Latency: 4ms)')
                  }
                >
                  <i className="bi bi-database-check me-2 text-success"></i>
                  Tester connexion BD
                </button>

                <button
                  className="pt-btn-outline text-start w-100 justify-content-start"
                  style={{ fontSize: '12px', padding: '0.45rem 0.75rem' }}
                  onClick={() =>
                    triggerSaveNotification('Configuration réinitialisée')
                  }
                >
                  <i className="bi bi-arrow-counterclockwise me-2 text-warning"></i>
                  Réinitialiser la config
                </button>

                <button
                  className="pt-btn-outline text-start w-100 justify-content-start"
                  style={{ fontSize: '12px', padding: '0.45rem 0.75rem' }}
                  onClick={() =>
                    triggerSaveNotification('Signal de redémarrage envoyé')
                  }
                >
                  <i className="bi bi-power me-2 text-danger"></i>
                  Redémarrer les services
                </button>
              </div>
            </div>

            <div
              className="p-2 rounded text-center"
              style={{ background: 'var(--pt-bg)', fontSize: '11px', color: 'var(--pt-text-muted)' }}
            >
              <i className="bi bi-shield-exclamation me-1 text-warning"></i>
              Actions système à exécuter avec précaution
            </div>
          </div>
        </div>

        {/* Card 8: Besoin d'aide ? */}
        <div className="col">
          <div className="pt-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h6 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>
                  <i className="bi bi-question-circle-fill me-2 text-primary"></i>
                  Besoin d'aide ?
                </h6>
              </div>

              <div className="d-flex flex-column gap-3 mb-3">
                <div
                  className="p-3 rounded text-center"
                  style={{ background: 'var(--pt-primary-light)' }}
                >
                  <i
                    className="bi bi-book-half"
                    style={{ fontSize: '28px', color: 'var(--pt-primary)' }}
                  ></i>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      marginTop: '6px',
                      color: 'var(--pt-text)',
                    }}
                  >
                    Documentation Administrateur
                  </div>
                  <p
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--pt-text-muted)',
                      margin: '4px 0 0 0',
                    }}
                  >
                    Consultez nos guides détaillés pour personnaliser et sécuriser votre instance.
                  </p>
                </div>

                <div className="d-flex flex-column gap-2">
                  <a
                    href="#docs"
                    className="d-flex align-items-center justify-content-between text-decoration-none p-2 rounded border"
                    style={{ fontSize: '12px', color: 'var(--pt-text)' }}
                  >
                    <span>
                      <i className="bi bi-journal-text me-2 text-primary"></i>
                      Guide de configuration
                    </span>
                    <i className="bi bi-box-arrow-up-right text-muted"></i>
                  </a>

                  <a
                    href="#support"
                    className="d-flex align-items-center justify-content-between text-decoration-none p-2 rounded border"
                    style={{ fontSize: '12px', color: 'var(--pt-text)' }}
                  >
                    <span>
                      <i className="bi bi-headset me-2 text-success"></i>
                      Contacter le support
                    </span>
                    <i className="bi bi-box-arrow-up-right text-muted"></i>
                  </a>
                </div>
              </div>
            </div>

            <button
              className="pt-btn-outline w-100"
              style={{ fontSize: '12.5px', padding: '0.45rem' }}
              onClick={() => window.open('https://perftest.company.com/docs', '_blank')}
            >
              <i className="bi bi-book me-1"></i> Consulter la documentation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
