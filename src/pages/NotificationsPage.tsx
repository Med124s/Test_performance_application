import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import { loadJSON, saveJSON } from '../utils/persistentStore'
import { NotificationItem, notificationsData } from '../data/notifications'

function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>(() =>
    loadJSON('pt_notifications', notificationsData)
  )
  const [selectedTab, setSelectedTab] = useState<string>('Toutes')
  const [selectedId, setSelectedId] = useState<number>(1)

  // Persiste l'état lu/non-lu et les suppressions à chaque changement.
  useEffect(() => {
    saveJSON('pt_notifications', items)
  }, [items])

  // Tabs configuration
  const tabs = [
    { id: 'Toutes', label: 'Toutes', count: 5 },
    { id: 'Non lues', label: 'Non lues', count: 5 },
    { id: 'Informations', label: 'Informations', count: 2 },
    { id: 'Avertissements', label: 'Avertissements', count: 2 },
    { id: 'Erreurs', label: 'Erreurs', count: 1 },
    { id: 'Système', label: 'Système', count: 2 },
  ]

  // Mark all as read
  const markAllAsRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
  }

  // Filter notifications according to selectedTab
  const filteredNotifications = items.filter((item) => {
    if (selectedTab === 'Toutes') return true
    if (selectedTab === 'Non lues') return !item.read
    if (selectedTab === 'Informations') return item.category === 'Informations'
    if (selectedTab === 'Avertissements') return item.category === 'Avertissements'
    if (selectedTab === 'Erreurs') return item.category === 'Erreurs'
    if (selectedTab === 'Système') return item.category === 'Système'
    return true
  })

  // Selected notification detail
  const selectedNotif = items.find((item) => item.id === selectedId) || items[0]

  // Group filtered notifications by section
  const todayList = filteredNotifications.filter((n) => n.group === "Aujourd'hui")
  const yesterdayList = filteredNotifications.filter((n) => n.group === 'Hier')

  const getIconBadgeClass = (color: NotificationItem['iconColor']) => {
    switch (color) {
      case 'danger':
        return 'var(--pt-danger-light)'
      case 'warning':
        return 'var(--pt-warning-light)'
      case 'success':
        return 'var(--pt-success-light)'
      case 'info':
        return 'var(--pt-info-light)'
      case 'purple':
        return '#EDE9FE'
      case 'primary':
      default:
        return 'var(--pt-primary-light)'
    }
  }

  const getIconColorHex = (color: NotificationItem['iconColor']) => {
    switch (color) {
      case 'danger':
        return 'var(--pt-danger)'
      case 'warning':
        return 'var(--pt-warning)'
      case 'success':
        return 'var(--pt-success)'
      case 'info':
        return 'var(--pt-info)'
      case 'purple':
        return '#7C3AED'
      case 'primary':
      default:
        return 'var(--pt-primary)'
    }
  }

  return (
    <div className="pt-content">
      {/* Page Header */}
      <div className="pt-page-header">
        <div className="page-title">
          <h1>Notifications</h1>
          <p>Restez informe des evenements importants</p>
        </div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <button className="pt-btn-outline d-flex align-items-center gap-2" onClick={markAllAsRead}>
            <i className="bi bi-check2-all"></i>
            Tout marquer comme lu
          </button>
          <TopBar searchPlaceholder="" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
        {tabs.map((tab) => {
          const isActive = selectedTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className="btn btn-sm"
              style={{
                borderRadius: '8px',
                padding: '0.45rem 0.95rem',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid',
                borderColor: isActive ? 'var(--pt-primary)' : 'var(--pt-border)',
                backgroundColor: isActive ? 'var(--pt-primary)' : 'var(--pt-card-bg)',
                color: isActive ? '#ffffff' : 'var(--pt-text)',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
              }}
            >
              {tab.label}
              <span
                className="ms-2 px-2 py-0.5 rounded-pill"
                style={{
                  fontSize: '11px',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'var(--pt-border)',
                  color: isActive ? '#ffffff' : 'var(--pt-text-muted)',
                }}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Two Column Layout */}
      <div className="row g-4">
        {/* Left Column: Notification List */}
        <div className="col-12 col-lg-6 col-xl-5">
          <div className="pt-card p-0 overflow-hidden">
            <div
              className="p-3 d-flex justify-content-between align-items-center"
              style={{ borderBottom: '1px solid var(--pt-border)' }}
            >
              <h6 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                Liste des notifications ({filteredNotifications.length})
              </h6>
              <span style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>
                Triées par date
              </span>
            </div>

            <div style={{ maxHeight: '680px', overflowY: 'auto' }}>
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-5 text-muted" style={{ fontSize: '13px' }}>
                  Aucune notification dans cette catégorie.
                </div>
              ) : (
                <>
                  {/* Aujourd'hui Group */}
                  {todayList.length > 0 && (
                    <div>
                      <div
                        className="px-3 py-2 fw-semibold"
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--pt-text-muted)',
                          backgroundColor: 'var(--pt-bg-subtle, rgba(0,0,0,0.02))',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Aujourd'hui
                      </div>
                      {todayList.map((item) => {
                        const isSelected = item.id === selectedNotif.id
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedId(item.id)
                              // mark this item as read when selected
                              setItems((prev) =>
                                prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                              )
                            }}
                            className="p-3 d-flex gap-3 align-items-start"
                            style={{
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--pt-border)',
                              backgroundColor: isSelected
                                ? 'var(--pt-primary-light)'
                                : item.read
                                ? 'transparent'
                                : 'rgba(37,99,235,0.03)',
                              borderLeft: isSelected
                                ? '4px solid var(--pt-primary)'
                                : item.read
                                ? '4px solid transparent'
                                : '4px solid var(--pt-primary)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                backgroundColor: getIconBadgeClass(item.iconColor),
                                color: getIconColorHex(item.iconColor),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                flexShrink: 0,
                              }}
                            >
                              <i className={`bi ${item.icon}`}></i>
                            </div>

                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span
                                  style={{
                                    fontSize: '13.5px',
                                    fontWeight: item.read ? 600 : 700,
                                    color: 'var(--pt-text)',
                                  }}
                                  className="text-truncate"
                                >
                                  {item.title}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--pt-text-muted)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.time.replace("Aujourd'hui, ", '')}
                                </span>
                              </div>
                              <p
                                style={{
                                  fontSize: '12.5px',
                                  color: 'var(--pt-text-muted)',
                                  margin: 0,
                                  lineHeight: 1.35,
                                }}
                                className="text-truncate"
                              >
                                {item.description}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Hier Group */}
                  {yesterdayList.length > 0 && (
                    <div>
                      <div
                        className="px-3 py-2 fw-semibold"
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--pt-text-muted)',
                          backgroundColor: 'var(--pt-bg-subtle, rgba(0,0,0,0.02))',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Hier
                      </div>
                      {yesterdayList.map((item) => {
                        const isSelected = item.id === selectedNotif.id
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedId(item.id)
                              setItems((prev) =>
                                prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                              )
                            }}
                            className="p-3 d-flex gap-3 align-items-start"
                            style={{
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--pt-border)',
                              backgroundColor: isSelected
                                ? 'var(--pt-primary-light)'
                                : item.read
                                ? 'transparent'
                                : 'rgba(37,99,235,0.03)',
                              borderLeft: isSelected
                                ? '4px solid var(--pt-primary)'
                                : item.read
                                ? '4px solid transparent'
                                : '4px solid var(--pt-primary)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                backgroundColor: getIconBadgeClass(item.iconColor),
                                color: getIconColorHex(item.iconColor),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                flexShrink: 0,
                              }}
                            >
                              <i className={`bi ${item.icon}`}></i>
                            </div>

                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span
                                  style={{
                                    fontSize: '13.5px',
                                    fontWeight: item.read ? 600 : 700,
                                    color: 'var(--pt-text)',
                                  }}
                                  className="text-truncate"
                                >
                                  {item.title}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    color: 'var(--pt-text-muted)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.time.replace('Hier, ', '')}
                                </span>
                              </div>
                              <p
                                style={{
                                  fontSize: '12.5px',
                                  color: 'var(--pt-text-muted)',
                                  margin: 0,
                                  lineHeight: 1.35,
                                }}
                                className="text-truncate"
                              >
                                {item.description}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Notification Detail Drawer / Panel */}
        <div className="col-12 col-lg-6 col-xl-7">
          <div className="pt-card position-relative" style={{ minHeight: '520px' }}>
            {selectedNotif ? (
              <div>
                {/* Header */}
                <div className="d-flex align-items-start gap-3 pb-3 mb-4" style={{ borderBottom: '1px solid var(--pt-border)' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      backgroundColor: getIconBadgeClass(selectedNotif.iconColor),
                      color: getIconColorHex(selectedNotif.iconColor),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      flexShrink: 0,
                    }}
                  >
                    <i className={`bi ${selectedNotif.icon}`}></i>
                  </div>

                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <h5 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                        {selectedNotif.title}
                      </h5>
                      <span
                        className={`pt-pill ${
                          selectedNotif.iconColor === 'danger'
                            ? 'danger'
                            : selectedNotif.iconColor === 'warning'
                            ? 'warning'
                            : selectedNotif.iconColor === 'success'
                            ? 'success'
                            : 'info'
                        }`}
                      >
                        {selectedNotif.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--pt-text-muted)', marginTop: '4px' }}>
                      <i className="bi bi-clock me-1"></i>
                      {selectedNotif.time} ({selectedNotif.dateFull})
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <h6 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pt-text-muted)', marginBottom: '8px' }}>
                    DESCRIPTION
                  </h6>
                  <p
                    style={{
                      fontSize: '14px',
                      lineHeight: 1.6,
                      color: 'var(--pt-text)',
                      backgroundColor: 'var(--pt-bg-subtle, #F9FAFB)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--pt-border)',
                      margin: 0,
                    }}
                  >
                    {selectedNotif.description}
                  </p>
                </div>

                {/* Detail Metadata Grid */}
                <div className="mb-4">
                  <h6 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pt-text-muted)', marginBottom: '12px' }}>
                    DÉTAILS DE L'ÉVÉNEMENT
                  </h6>
                  <div className="row g-3 p-3 rounded-3" style={{ border: '1px solid var(--pt-border)', backgroundColor: 'var(--pt-card-bg)' }}>
                    <div className="col-12 col-sm-6">
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Horodatage</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--pt-text)' }}>
                        {selectedNotif.dateFull}
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Application</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--pt-primary)' }}>
                        {selectedNotif.application}
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Environnement</div>
                      <div className="mt-1">
                        <span className="pt-pill neutral">{selectedNotif.environment}</span>
                      </div>
                    </div>

                    <div className="col-12 col-sm-6">
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Scénario concerné</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--pt-text)' }}>
                        {selectedNotif.scenario}
                      </div>
                    </div>

                    <div className="col-12 col-sm-4">
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Identifiant d'exécution</div>
                      <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {selectedNotif.execution}
                      </div>
                    </div>

                    <div className="col-12 col-sm-4">
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Durée de l'essai</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600 }}>
                        {selectedNotif.duration}
                      </div>
                    </div>

                    <div className="col-12 col-sm-4">
                      <div style={{ fontSize: '12px', color: 'var(--pt-text-muted)' }}>Taux d'erreur constaté</div>
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: selectedNotif.errorRate.startsWith('5') ? 'var(--pt-danger)' : 'var(--pt-text)',
                        }}
                      >
                        {selectedNotif.errorRate}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div
                  className="pt-3 d-flex align-items-center gap-2 flex-wrap"
                  style={{ borderTop: '1px solid var(--pt-border)' }}
                >
                  <button className="pt-btn-primary">
                    <i className="bi bi-file-earmark-text me-1"></i>
                    Voir rapport
                  </button>
                  <button className="pt-btn-outline">
                    <i className="bi bi-play-circle me-1"></i>
                    Relancer
                  </button>
                  <button className="pt-btn-outline">
                    <i className="bi bi-terminal me-1"></i>
                    Voir logs
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-5 text-muted">
                Sélectionnez une notification pour afficher ses détails.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage
