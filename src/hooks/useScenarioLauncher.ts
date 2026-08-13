import { useState } from 'react'
import { Scenario, Step, StepResult } from '../types'
import { stepsApi } from '../services/api/steps'
import { executionsApi, computeExecutionStatus } from '../services/api/executions'
import { applicationsApi } from '../services/api/applications'
import { serverSnapshotApi } from '../services/api/serverSnapshot'
import { loadDefaultTestSettings } from '../utils/defaultTestSettings'
import { runStep, buildVariableMap, sleep, LiveStepState } from '../services/stepRunner'
import { useAuth } from '../context/AuthContext'

const defaultTestSettings = loadDefaultTestSettings()

// Garde-fou de sécurité : cette page envoie de VRAIES requêtes HTTP depuis
// le navigateur vers de vraies applications (parfois des domaines publics
// tiers, ex. dummyjson.com). Sans plafond, un VUs=10000 saisi dans la
// modale déclencherait une vraie attaque par déni de service involontaire.
// Le nombre réellement exécuté est plafonné ici — et c'est CE nombre réel,
// jamais la valeur saisie, qui est affiché/stocké (voir handleLaunch).
const MAX_REAL_VUS = 50

export type { LiveStepState }

export interface LaunchForm {
  scenarioId: string
  applicationId: string
  virtualUsers: number
  duration: number
  rampUp: number
  thinkTime: number
  debit: string
  stopMode: 'auto' | 'manual'
}

/**
 * Encapsule tout le flux "lancer un scénario" (modale de configuration,
 * création d'une vraie execution dans JSON Server, progression étape par
 * étape écrite en direct sur le serveur) — partagé entre la page Exécutions
 * (bouton "Nouvelle exécution") et la page Scénarios (bouton "Exécuter",
 * qui doit rester sur place plutôt que de naviguer) pour ne pas dupliquer
 * cette logique à deux endroits.
 */
export function useScenarioLauncher(onExecuted?: () => void | Promise<void>) {
  const { canEdit } = useAuth()
  const [showLaunchModal, setShowLaunchModal] = useState(false)
  const [launchStep, setLaunchStep] = useState<1 | 2 | 3>(1)
  const [launching, setLaunching] = useState(false)
  const [liveSteps, setLiveSteps] = useState<LiveStepState[]>([])
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [form, setForm] = useState<LaunchForm>({
    scenarioId: '',
    applicationId: '',
    virtualUsers: defaultTestSettings.concurrency,
    duration: 300,
    rampUp: defaultTestSettings.rampUpSeconds,
    thinkTime: defaultTestSettings.stepDelayMs,
    debit: '',
    stopMode: 'auto',
  })

  const openModal = () => {
    if (!canEdit) return
    setLaunchStep(1)
    setLaunchError(null)
    setShowLaunchModal(true)
  }

  // Change le scénario ciblé par la modale : le scénario devient la valeur
  // par défaut de l'exécution (VUs/Ramp-up) — l'utilisateur peut ensuite la
  // surcharger librement dans le formulaire (form), sans jamais modifier le
  // scénario original (voir LaunchScenarioModal, badge "Valeur du scénario").
  const selectScenario = (scenario: Scenario | undefined) => {
    setForm((p) => ({
      ...p,
      scenarioId: scenario?.id ?? '',
      applicationId: scenario?.applicationId ?? p.applicationId,
      virtualUsers: scenario?.virtualUsers ?? defaultTestSettings.concurrency,
      rampUp: scenario?.rampUpSeconds ?? defaultTestSettings.rampUpSeconds,
    }))
  }

  /** Ouvre directement la modale pré-remplie pour un scénario donné (bouton
   * "Exécuter" sur une ligne de la liste). */
  const openForScenario = (scenario: Scenario) => {
    if (!canEdit) return
    selectScenario(scenario)
    setLaunchStep(1)
    setLaunchError(null)
    setShowLaunchModal(true)
  }

  const closeModal = () => {
    if (launching) return
    setShowLaunchModal(false)
    setLaunchStep(1)
  }

  /** Exécute la séquence complète des étapes pour UN utilisateur virtuel
   * (séquentiellement, dans l'ordre — chaque étape attend son propre Think
   * Time/Pacing réel et respecte son propre statut actif/inactif), en
   * reportant chaque résultat en direct dans `liveSteps` à son index réel
   * (vu * steps.length + i) pour ne jamais écraser un autre VU. */
  const runVirtualUser = async (
    vu: number,
    steps: Step[],
    baseUrl: string,
    defaultTimeoutMs: number,
    variables: Record<string, string>,
    thinkTimeOverrideMs: number,
    baseIndex: number
  ): Promise<StepResult[]> => {
    const results: StepResult[] = []
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const flatIndex = baseIndex + i
      setLiveSteps((prev) => prev.map((ls, idx) => (idx === flatIndex ? { ...ls, status: 'running' } : ls)))

      const result = await runStep(step, baseUrl, defaultTimeoutMs, { variables, vu, thinkTimeOverrideMs })
      results.push(result)

      setLiveSteps((prev) => prev.map((ls, idx) => (idx === flatIndex
        ? { ...ls, status: result.status, httpStatus: result.httpStatus, responseTimeMs: result.responseTimeMs, error: result.error }
        : ls)))
    }
    return results
  }

  // Lance réellement le scénario : crée l'exécution dans JSON Server, puis
  // fait tourner N vrais utilisateurs virtuels (chacun rejoue la vraie
  // séquence d'étapes, avec son propre Think Time/Pacing/timeout/
  // assertions), démarrés progressivement sur la durée de Ramp-up
  // configurée — pas une seule passe simulée. La progression réelle est
  // écrite sur le serveur au fur et à mesure — l'appelant reste sur sa page
  // et voit tout en direct.
  const handleLaunch = async (scenario: Scenario) => {
    if (!canEdit) return
    setLaunchError(null)
    setLaunching(true)
    setLaunchStep(3)

    try {
      const [scenarioSteps, application] = await Promise.all([
        stepsApi.getByScenario(scenario.id),
        applicationsApi.getById(scenario.applicationId),
      ])
      if (scenarioSteps.length === 0) {
        setLaunchError("Ce scénario n'a aucune étape à exécuter.")
        setLaunching(false)
        return
      }

      const vuCount = Math.min(Math.max(1, Math.round(form.virtualUsers) || 1), MAX_REAL_VUS)
      const rampUpMs = Math.max(0, form.rampUp) * 1000
      const staggerMs = vuCount > 1 ? rampUpMs / vuCount : 0

      setLiveSteps(
        Array.from({ length: vuCount }, (_, vu) =>
          scenarioSteps.map((step) => ({ step, status: 'pending' as const, vu }))
        ).flat()
      )

      // Snapshot serveur figé au moment du lancement (voir
      // services/api/serverSnapshot.ts) — relation réelle, valeurs à null
      // tant qu'aucun backend/monitoring ne les fournit.
      const serverSnapshot = await serverSnapshotApi.captureForApplication(application)

      const startedAt = new Date().toISOString()
      const created = await executionsApi.create({
        scenarioId: scenario.id,
        applicationId: scenario.applicationId,
        status: 'En cours',
        users: `${vuCount} VUs`,
        startedAt,
        duration: '00:00:00',
        stepResults: [],
        errors: [],
        serverSnapshot,
      })

      const startTs = Date.now()
      const defaultTimeoutMs = defaultTestSettings.httpTimeoutSeconds * 1000
      const variables = buildVariableMap(scenario.testVariables)

      // Résultats de tous les VUs, remplis au fur et à mesure — un tableau
      // JS partagé suffit ici (mono-thread, push toujours cumulatif) ; seule
      // la mise à jour PATCH intermédiaire peut ponctuellement arriver
      // dans le désordre entre deux VUs concurrents (l'écriture finale plus
      // bas est toujours la version complète et fait foi).
      const allResultsByVu: StepResult[][] = new Array(vuCount)

      await Promise.all(
        Array.from({ length: vuCount }, (_, vu) => {
          const baseIndex = vu * scenarioSteps.length
          return (async () => {
            if (vu > 0) await sleep(vu * staggerMs)
            allResultsByVu[vu] = await runVirtualUser(
              vu,
              scenarioSteps,
              application.url,
              defaultTimeoutMs,
              variables,
              form.thinkTime,
              baseIndex
            )
            await executionsApi.update(created.id, { stepResults: allResultsByVu.flatMap((r) => r ?? []) })
          })()
        })
      )

      const finalResults = allResultsByVu.flatMap((r) => r ?? [])
      const finalStatus = computeExecutionStatus(finalResults)
      const elapsedSec = Math.round((Date.now() - startTs) / 1000)
      const h = String(Math.floor(elapsedSec / 3600)).padStart(2, '0')
      const m = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0')
      const s = String(elapsedSec % 60).padStart(2, '0')
      const errors = finalResults.filter((r) => r.error).map((r) => r.error!) as string[]

      await executionsApi.update(created.id, {
        status: finalStatus,
        duration: `${h}:${m}:${s}`,
        stepResults: finalResults,
        errors,
      })

      if (onExecuted) await onExecuted()

      setTimeout(() => {
        setShowLaunchModal(false)
        setLaunchStep(1)
        setLaunching(false)
        setLiveSteps([])
      }, 1200)
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Erreur lors du lancement de l'exécution")
      setLaunching(false)
    }
  }

  const doneCount = liveSteps.filter((s) => s.status === 'success' || s.status === 'error' || s.status === 'skipped').length
  const errorCount = liveSteps.filter((s) => s.status === 'error').length
  const progressPct = liveSteps.length > 0 ? Math.round((doneCount / liveSteps.length) * 100) : 0
  const currentRunning = liveSteps.find((s) => s.status === 'running')

  return {
    showLaunchModal,
    launchStep,
    setLaunchStep,
    launching,
    liveSteps,
    launchError,
    form,
    setForm,
    openModal,
    openForScenario,
    selectScenario,
    closeModal,
    handleLaunch,
    doneCount,
    errorCount,
    progressPct,
    currentRunning,
  }
}

export type ScenarioLauncher = ReturnType<typeof useScenarioLauncher>
