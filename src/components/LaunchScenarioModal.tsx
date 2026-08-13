import { useMemo } from 'react'
import { Application, Scenario } from '../types'
import { ScenarioLauncher } from '../hooks/useScenarioLauncher'

interface LaunchScenarioModalProps {
  launcher: ScenarioLauncher
  scenarios: Scenario[]
  applications: Application[]
}

const labelStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--pt-text)', marginBottom: '6px', display: 'block' as const }
const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 'var(--pt-radius-sm)', border: '1px solid var(--pt-border)', background: 'var(--pt-bg)', color: 'var(--pt-text)', fontSize: '13.5px' }

/**
 * Modale de lancement d'un scénario (configuration rapide → confirmation →
 * progression en direct), partagée entre la page Exécutions et la page
 * Scénarios (qui doit rester sur place plutôt que de naviguer) pour éviter
 * de dupliquer ce flux à deux endroits.
 */
function LaunchScenarioModal({ launcher, scenarios, applications }: LaunchScenarioModalProps) {
  const scenarioById = useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios])
  const appById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])

  const {
    showLaunchModal, launchStep, setLaunchStep, launching, liveSteps, launchError,
    form, setForm, selectScenario, closeModal, handleLaunch, doneCount, errorCount, progressPct, currentRunning,
  } = launcher

  if (!showLaunchModal) return null

  const selectedScenario = scenarioById.get(form.scenarioId)

  const launchCurrentScenario = () => {
    if (!selectedScenario) return
    handleLaunch(selectedScenario)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'var(--pt-card-bg)', borderRadius: 'var(--pt-radius)', padding: '2rem', width: '580px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--pt-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div>
            <h5 style={{ fontWeight: 700, margin: 0 }}>
              {launchStep === 1 ? '⚙️ Configurer le test' : launchStep === 2 ? '✅ Confirmation' : '🚀 Exécution en direct'}
            </h5>
            <p style={{ fontSize: '13px', color: 'var(--pt-text-muted)', margin: '4px 0 0' }}>
              {launchStep < 3 ? `Étape ${launchStep} sur 2` : 'Progression en temps réel'}
            </p>
          </div>
          {!launching && (
            <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--pt-text-muted)' }}>
              <i className="bi bi-x"></i>
            </button>
          )}
        </div>

        {launchStep < 3 && (
          <div style={{ height: '4px', background: 'var(--pt-border)', borderRadius: '2px', marginBottom: '1.5rem' }}>
            <div style={{ height: '100%', background: 'var(--pt-primary)', borderRadius: '2px', width: `${launchStep === 1 ? 50 : 100}%`, transition: 'width 0.3s ease' }}></div>
          </div>
        )}

        {launchError && (
          <div className="pt-alert-banner danger mb-3">
            <i className="bi bi-exclamation-triangle-fill"></i>
            {launchError}
          </div>
        )}

        {launchStep === 1 && (
          <div className="row g-3">
            <div className="col-12">
              <label style={labelStyle}>Scénario *</label>
              <select style={inputStyle} value={form.scenarioId} onChange={e => {
                selectScenario(scenarios.find((s) => s.id === e.target.value))
              }}>
                {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label style={labelStyle}>Application</label>
              <input
                type="text"
                style={{ ...inputStyle, background: 'var(--pt-border)', cursor: 'not-allowed' }}
                value={appById.get(form.applicationId)?.name ?? ''}
                disabled
                title="Déterminée automatiquement par le scénario choisi"
              />
            </div>
            <div className="col-6">
              <label style={labelStyle} className="d-flex align-items-center gap-2">
                Utilisateurs virtuels (VUs)
                {selectedScenario?.virtualUsers != null && (
                  <span className="pt-pill info" style={{ fontSize: '10.5px', fontWeight: 600 }} title="Valeur pré-remplie depuis le scénario — modifiable uniquement pour cette exécution">
                    Valeur du scénario : {selectedScenario.virtualUsers}
                  </span>
                )}
              </label>
              <input type="number" style={inputStyle} min={1} max={10000} value={form.virtualUsers} onChange={e => setForm(p => ({ ...p, virtualUsers: +e.target.value }))} />
            </div>
            <div className="col-6">
              <label style={labelStyle}>Durée (secondes)</label>
              <input type="number" style={inputStyle} min={10} value={form.duration} onChange={e => setForm(p => ({ ...p, duration: +e.target.value }))} />
            </div>
            <div className="col-6">
              <label style={labelStyle} className="d-flex align-items-center gap-2">
                Ramp-up (secondes)
                {selectedScenario?.rampUpSeconds != null && (
                  <span className="pt-pill info" style={{ fontSize: '10.5px', fontWeight: 600 }} title="Valeur pré-remplie depuis le scénario — modifiable uniquement pour cette exécution">
                    Valeur du scénario : {selectedScenario.rampUpSeconds}
                  </span>
                )}
              </label>
              <input type="number" style={inputStyle} min={0} value={form.rampUp} onChange={e => setForm(p => ({ ...p, rampUp: +e.target.value }))} />
            </div>
            <div className="col-6">
              <label style={labelStyle}>Think time (ms)</label>
              <input type="number" style={inputStyle} min={0} value={form.thinkTime} onChange={e => setForm(p => ({ ...p, thinkTime: +e.target.value }))} />
            </div>
            <div className="col-6">
              <label style={labelStyle}>Débit cible (req/s) <span style={{ color: 'var(--pt-text-muted)', fontWeight: 400 }}>optionnel</span></label>
              <input type="number" style={inputStyle} placeholder="Ex: 500" value={form.debit} onChange={e => setForm(p => ({ ...p, debit: e.target.value }))} />
            </div>
            <div className="col-12">
              <label style={labelStyle}>Mode d'arrêt</label>
              <select style={inputStyle} value={form.stopMode} onChange={e => setForm(p => ({ ...p, stopMode: e.target.value as 'auto' | 'manual' }))}>
                <option value="auto">Automatique (durée définie)</option>
                <option value="manual">Manuel</option>
              </select>
            </div>
            <div className="col-12 d-flex justify-content-end gap-2 mt-2">
              <button onClick={closeModal} style={{ background: 'var(--pt-bg)', border: '1px solid var(--pt-border)', borderRadius: 'var(--pt-radius-sm)', padding: '8px 20px', cursor: 'pointer', fontSize: '13.5px' }}>
                Annuler
              </button>
              <button onClick={() => setLaunchStep(2)} disabled={!form.scenarioId} className="pt-btn-primary" style={{ padding: '8px 20px' }}>
                Suivant <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        )}

        {launchStep === 2 && (
          <div>
            <div style={{ background: 'var(--pt-bg)', borderRadius: 'var(--pt-radius-sm)', padding: '1.25rem', border: '1px solid var(--pt-border)', marginBottom: '1.5rem' }}>
              <h6 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pt-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Résumé de la configuration</h6>
              <div className="row g-2">
                {[
                  ['Scénario', scenarioById.get(form.scenarioId)?.name ?? ''],
                  ['Application', appById.get(form.applicationId)?.name ?? ''],
                  ['Utilisateurs virtuels', `${form.virtualUsers} VUs`],
                  ['Durée', `${form.duration}s (${Math.floor(form.duration / 60)}min ${form.duration % 60}s)`],
                  ['Ramp-up', `${form.rampUp}s`],
                  ['Think time', `${form.thinkTime} ms`],
                  ['Mode arrêt', form.stopMode === 'auto' ? 'Automatique' : 'Manuel'],
                ].map(([k, v]) => (
                  <div key={k} className="col-6">
                    <div style={{ fontSize: '11px', color: 'var(--pt-text-muted)', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--pt-text)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button onClick={() => setLaunchStep(1)} style={{ background: 'var(--pt-bg)', border: '1px solid var(--pt-border)', borderRadius: 'var(--pt-radius-sm)', padding: '8px 20px', cursor: 'pointer', fontSize: '13.5px' }}>
                <i className="bi bi-arrow-left me-1"></i>Retour
              </button>
              <button onClick={launchCurrentScenario} style={{ background: 'var(--pt-success)', color: 'white', border: 'none', borderRadius: 'var(--pt-radius-sm)', padding: '8px 24px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 700 }}>
                <i className="bi bi-play-fill me-2"></i>Lancer le test
              </button>
            </div>
          </div>
        )}

        {launchStep === 3 && (
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                Progression globale — {doneCount}/{liveSteps.length} étapes
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: errorCount > 0 ? 'var(--pt-danger)' : 'var(--pt-primary)' }}>{progressPct}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--pt-border)', borderRadius: '4px', marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: errorCount > 0 ? 'var(--pt-warning)' : 'var(--pt-success)', borderRadius: '4px', width: `${progressPct}%`, transition: 'width 0.3s ease' }}></div>
            </div>

            {currentRunning && (
              <p style={{ fontSize: '13px', color: 'var(--pt-text-muted)', marginBottom: '1rem' }}>
                <i className="bi bi-arrow-repeat pt-spin me-1"></i>
                Étape en cours : <strong>{currentRunning.step.name}</strong>
              </p>
            )}
            {!currentRunning && doneCount === liveSteps.length && liveSteps.length > 0 && (
              <div className={`pt-alert-banner ${errorCount > 0 ? 'warning' : 'success'} mb-3`}>
                <i className={`bi ${errorCount > 0 ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`}></i>
                {errorCount > 0
                  ? `Exécution terminée avec ${errorCount} erreur${errorCount > 1 ? 's' : ''}.`
                  : 'Exécution terminée avec succès !'}
              </div>
            )}

            <div className="d-flex flex-column gap-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {liveSteps.map((ls, idx) => {
                const meta =
                  ls.status === 'success' ? { icon: 'bi-check-circle-fill', color: 'var(--pt-success)', label: 'Réussie' } :
                  ls.status === 'error' ? { icon: 'bi-x-circle-fill', color: 'var(--pt-danger)', label: 'Échec' } :
                  ls.status === 'skipped' ? { icon: 'bi-skip-forward-fill', color: 'var(--pt-text-muted)', label: 'Ignorée' } :
                  ls.status === 'running' ? { icon: 'bi-arrow-repeat pt-spin', color: 'var(--pt-primary)', label: 'En cours' } :
                  { icon: 'bi-hourglass', color: 'var(--pt-text-light)', label: 'En attente' }
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--pt-radius-sm)', background: 'var(--pt-bg)', border: '1px solid var(--pt-border)' }}>
                    <i className={`bi ${meta.icon}`} style={{ color: meta.color, fontSize: '15px', flexShrink: 0 }}></i>
                    {ls.vu !== undefined && (
                      <span className="pt-pill neutral" style={{ fontSize: '10px', flexShrink: 0 }}>VU {ls.vu + 1}</span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{ls.step.name}</span>
                    {ls.responseTimeMs !== undefined && (
                      <span style={{ fontSize: '11.5px', color: 'var(--pt-text-muted)' }}>{ls.responseTimeMs} ms</span>
                    )}
                    {ls.httpStatus !== undefined && (
                      <span className={`pt-pill ${ls.status === 'success' ? 'success' : 'danger'}`} style={{ fontSize: '10.5px' }}>{ls.httpStatus}</span>
                    )}
                    <span style={{ fontSize: '11.5px', color: meta.color, minWidth: '64px', textAlign: 'right' }}>{meta.label}</span>
                  </div>
                )
              })}
            </div>

            {errorCount > 0 && (
              <div className="mt-3">
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--pt-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Erreurs rencontrées</div>
                <div className="d-flex flex-column gap-1">
                  {liveSteps.filter((s) => s.error).map((s, idx) => (
                    <div key={idx} style={{ fontSize: '12px', color: 'var(--pt-danger)' }}>
                      <i className="bi bi-exclamation-triangle-fill me-1"></i>{s.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LaunchScenarioModal
