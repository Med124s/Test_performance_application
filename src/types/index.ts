// ============================================================
// Types du domaine PERFTEST — reflètent exactement la forme des
// ressources exposées par JSON Server (db.json).
// ============================================================

export type EntityId = string

export interface Application {
  id: EntityId
  name: string
  url: string
  type: 'Web' | 'API REST' | 'SOAP' | 'Mobile'
  authMethod: 'Aucune' | 'Basic' | 'Bearer Token' | 'API Key' | 'OAuth2'
  status: 'Actif' | 'Inactif'
  icon: string
  color: 'blue' | 'green' | 'purple' | 'orange'
  createdAt: string
  // Identifiants d'authentification (optionnels, dépendent de authMethod) —
  // stockés tels quels dans JSON Server pour cette maquette.
  authToken?: string
  authUsername?: string
  authPassword?: string
  authClientId?: string
  authClientSecret?: string
}

/** Statut de connexion affiché dans la colonne "Statut" — dérivé de la
 * dernière exécution réelle de cette application (calculé côté frontend,
 * jamais stocké en dur, pour rester une source de vérité unique). */
export type ApplicationConnectionStatus = 'Connectée' | 'Échouée' | 'Erreur' | 'Déconnectée'

export interface ScenarioVariable {
  id: number
  name: string
  value: string
}

export interface ScenarioSchedule {
  executionType: 'immediate' | 'scheduled' | 'recurring'
  scheduledDate?: string
  scheduledTime?: string
  recurrence?: string
  notifyEmail?: boolean
  notifyOnFailureOnly?: boolean
}

export interface Scenario {
  id: EntityId
  name: string
  applicationId: EntityId
  status: 'Actif' | 'Inactif'
  description?: string
  createdAt: string
  createdBy: string
  /** Champs du wizard "Utilisateurs Virtuels & Données de Test" et
   * "Planification" (étapes 3 et 4) — optionnels pour rester compatibles
   * avec les scénarios enregistrés avant l'existence de ces écrans. Servent
   * de valeur par défaut à toute exécution de ce scénario (voir
   * useScenarioLauncher.selectScenario), jamais modifiés par un override
   * ponctuel à l'exécution. */
  virtualUsers?: number
  rampUpSeconds?: number
  userProfile?: string
  dataSource?: 'manual' | 'csv'
  csvFileName?: string
  testVariables?: ScenarioVariable[]
  schedule?: ScenarioSchedule
}

export interface StepHeader {
  id: number
  key: string
  value: string
  enabled: boolean
}

export interface StepAssertion {
  id: number
  type: string
  property: string
  operator: string
  targetValue: string
}

export interface Step {
  id: EntityId
  scenarioId: EntityId
  order: number
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  description?: string
  headers?: StepHeader[]
  bodyJson?: string
  assertions?: StepAssertion[]
  timeoutMs?: number
  /** Étape incluse dans l'exécution ? `false` = aucune requête envoyée, le
   * StepResult correspondant est marqué 'skipped'. Absent = active (valeur
   * par défaut, compatible avec les étapes existantes). */
  active?: boolean
  /** Comportement réel de fetch() face à une redirection HTTP. `false` =
   * `redirect: 'error'` (la requête échoue si le serveur redirige) au lieu
   * de `redirect: 'follow'` (suivi automatique, comportement par défaut). */
  followRedirects?: boolean
  /** Think Time réel (ms) : délai attendu avant l'envoi de la requête. */
  pauseBeforeMs?: number
  /** Pacing réel (ms) : délai attendu après la réponse avant l'étape suivante. */
  pacingAfterMs?: number
}

/** Statut d'exécution d'une étape individuelle au sein d'une exécution. */
export type StepRunStatus = 'success' | 'error' | 'pending' | 'running' | 'skipped'

export interface StepResult {
  stepId: EntityId
  status: StepRunStatus
  httpStatus?: number
  responseTimeMs?: number
  request?: { method: string; url: string; body?: string }
  response?: { statusText: string; body?: string; headers?: Record<string, string> }
  error?: string
  /** Index (0-based) de l'utilisateur virtuel réel ayant produit ce résultat
   * — plusieurs VUs rejouent le même stepId au sein d'une même Execution. */
  vu?: number
}

/** Statut global d'une exécution (cohérent avec les résultats réels des
 * étapes — voir computeExecutionStatus dans services/api/executions.ts). */
export type ExecutionStatus = 'Réussie' | 'Avec erreurs' | 'Échouée' | 'En cours' | 'Suspendue'

export interface Execution {
  id: EntityId
  scenarioId: EntityId
  applicationId: EntityId
  status: ExecutionStatus
  users: string
  startedAt: string
  duration: string
  stepResults: StepResult[]
  errors: string[]
  /** Snapshot figé des métriques serveur au moment du lancement — voir
   * ServerSnapshot. Absent sur les exécutions créées avant cette fonctionnalité. */
  serverSnapshot?: ServerSnapshot | null
}

export interface ApiListResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/** Rôle applicatif réel (JSON Server) — ses permissions sont gérées ici,
 * mais pas encore appliquées au contrôle d'accès (voir AuthContext.canEdit,
 * qui reste la seule source de vérité pour les droits d'édition à ce stade). */
export interface Role {
  id: EntityId
  name: string
  description?: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

/** Statistiques de performance calculées à partir de vrais StepResult —
 * jamais saisies ni générées, toujours dérivées (voir utils/metrics.ts). */
export interface PerformanceMetrics {
  totalRequests: number
  successCount: number
  errorCount: number
  successRate: number // %
  errorRate: number // %
  avgResponseTime: number // ms
  minResponseTime: number // ms
  maxResponseTime: number // ms
  p95ResponseTime: number // ms
  throughput: number // req/s
}

// ============================================================
// Serveurs monitorés — ressource indépendante des Applications de test :
// un serveur d'infrastructure (CPU/RAM/latence) que l'on surveille, avec ses
// mesures réelles associées (voir ServerMetricSample). Chaque mesure est un
// point de données saisi (ou importé) explicitement — jamais générée
// aléatoirement à l'affichage.
// ============================================================

export interface Server {
  id: EntityId
  name: string
  address: string
  type: 'Application' | 'Base de données' | 'Load Balancer' | 'Cache' | 'Autre'
  createdAt: string
  /** Application testée que ce serveur héberge (optionnel — un serveur
   * d'infrastructure partagé, ex. load balancer, peut rester non rattaché).
   * Permet à une exécution de retrouver automatiquement "son" serveur. */
  applicationId?: EntityId
  /** URL d'une API de monitoring capable de rapporter les métriques réelles
   * de CE serveur (ex. Local Test Server pour le PC de développement
   * aujourd'hui, agent Spring Boot demain — voir services/api/serverSnapshot.ts).
   * Absent : le serveur n'a pas (encore) de monitoring branché. */
  monitoringUrl?: string
}

/** Niveau de santé global du serveur au moment de la mesure — indépendant
 * du temps de réponse / des erreurs des endpoints testés (ceux-ci vivent
 * dans StepResult, jamais ici). */
export type ServerHealth = 'Sain' | 'Dégradé' | 'Critique'

export interface ServerMetricSample {
  id: EntityId
  serverId: EntityId
  recordedAt: string
  cpuPercent: number
  ramPercent: number
  diskPercent: number
  networkMbps: number
  health: ServerHealth
}

// ============================================================
// Snapshot serveur figé par exécution — voir services/api/serverSnapshot.ts.
// Champs volontairement nommés comme le futur backend Spring Boot
// (GET /executions/{id}/server-metrics -> {cpu, ram, disk, network, health})
// pour que le branchement futur ne nécessite aucun renommage côté frontend.
// Tant qu'aucun vrai backend n'est branché, seule la relation (serverId) est
// connue ; les valeurs numériques restent `null` — jamais inventées.
// ============================================================

export interface ServerSnapshot {
  serverId: EntityId | null
  serverName: string | null
  applicationId: EntityId | null
  applicationName: string | null
  capturedAt: string | null
  cpu: number | null
  ram: number | null
  disk: number | null
  network: number | null
  health: ServerHealth | null
  /** D'où viennent les valeurs ci-dessus (ex. "Local Test Server", ou le
   * libellé de démonstration) — `null` tant qu'aucune source, réelle ou
   * simulée, n'a pu être résolue, pour ne jamais laisser croire que des
   * métriques `null` viennent d'un monitoring actif. */
  source: string | null
  /** `true` si cpu/ram/disk/network/health viennent de données de
   * démonstration pré-enregistrées (ServerMetricSample) plutôt que d'un
   * monitoring réellement interrogé en direct (Local Test Server aujourd'hui,
   * agent Spring Boot demain) — pilote l'affichage honnête du badge dans
   * ExecutionDetail. Absent/`false` = source réelle (ou aucune donnée). */
  simulated?: boolean
}
