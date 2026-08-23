import { useEffect, useRef } from 'react'
import { scenariosApi } from '../services/api/scenarios'
import { useScenarioLauncher, LaunchForm } from './useScenarioLauncher'
import { loadDefaultTestSettings } from '../utils/defaultTestSettings'

const CHECK_INTERVAL_MS = 15000

/**
 * Déclencheur réel des scénarios planifiés ("Planification" — Type
 * d'exécution "Planifiée", voir CreateStep.tsx écran 5). Monté UNE SEULE
 * FOIS dans MainLayout (donc actif sur toutes les pages authentifiées) :
 * vérifie périodiquement si un scénario a une date/heure planifiée déjà
 * passée, et le lance alors pour de vrai (vraies requêtes HTTP, comme un
 * lancement manuel) — invisible (aucune modale), mais une vraie Execution
 * est bien créée et écrite sur JSON Server.
 *
 * Limite honnête, inhérente à une architecture 100% frontend sans serveur
 * dédié : ça ne fonctionne que tant qu'un onglet de l'application reste
 * ouvert dans le navigateur. Fermer l'onglet avant l'heure planifiée fait
 * manquer le déclenchement (voir CONCEPTION_GENERALE.md, section
 * Architecture actuelle).
 */
export function useScheduledExecutions() {
  const launcher = useScenarioLauncher()
  // Empêche de relancer deux fois le même scénario pendant l'intervalle où
  // le PATCH qui efface sa planification n'est pas encore reflété par un
  // prochain fetch (la même précaution existe pour l'anti double-clic
  // ailleurs dans le projet).
  const firingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      let scenarios
      try {
        scenarios = await scenariosApi.getAll()
      } catch {
        return
      }
      if (cancelled) return

      const now = Date.now()
      for (const sc of scenarios) {
        if (sc.schedule?.executionType !== 'scheduled') continue
        if (!sc.schedule.scheduledDate) continue
        if (firingRef.current.has(sc.id)) continue

        const due = new Date(`${sc.schedule.scheduledDate}T${sc.schedule.scheduledTime || '00:00'}`)
        if (Number.isNaN(due.getTime()) || due.getTime() > now) continue

        firingRef.current.add(sc.id)
        try {
          // Efface la planification AVANT de lancer : un scénario déjà
          // déclenché ne doit plus jamais se relancer tout seul (ni au
          // prochain contrôle, ni après un rechargement de page).
          await scenariosApi.update(sc.id, {
            schedule: { ...sc.schedule, executionType: 'immediate' },
          })

          const defaults = loadDefaultTestSettings()
          const formOverride: LaunchForm = {
            scenarioId: sc.id,
            applicationId: sc.applicationId,
            virtualUsers: sc.virtualUsers ?? defaults.concurrency,
            duration: 300,
            rampUp: sc.rampUpSeconds ?? defaults.rampUpSeconds,
            thinkTime: defaults.stepDelayMs,
            debit: '',
            stopMode: 'auto',
          }
          await launcher.handleLaunch(sc, formOverride)
        } catch {
          // Échec du déclenchement (application/étapes introuvables...) :
          // on retire le verrou pour retenter au prochain contrôle plutôt
          // que d'abandonner silencieusement pour toujours.
          firingRef.current.delete(sc.id)
        }
      }
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
