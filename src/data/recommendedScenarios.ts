// ============================================================
// Scénarios "recommandés" — configuration frontend statique, PAS un
// classement calculé (voir CreateScenarioLanding.tsx : le libellé affiché
// est toujours "Scénarios recommandés", jamais "Top 3" ou équivalent).
//
// Un scénario recommandé ne devient un vrai Scenario/Step persistant en
// base QUE lorsque l'utilisateur clique "Utiliser ce scénario" — tant que
// ce n'est pas fait, rien n'est écrit dans db.json (voir handleUseRecommended
// dans CreateScenarioLanding.tsx).
// ============================================================

export interface RecommendedStepDef {
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers?: { key: string; value: string }[]
  bodyJson?: string
}

export interface RecommendedScenarioDef {
  name: string
  description: string
  steps: RecommendedStepDef[]
}

const AUTH_HEADER = [{ key: 'Authorization', value: 'Bearer TEST-TOKEN-123' }]
const LOGIN_STEP: RecommendedStepDef = {
  name: 'Login agent',
  method: 'POST',
  url: '/api/auth/login',
  bodyJson: JSON.stringify({ username: 'agent001', password: 'test123' }, null, 2),
}

// Les 3 mises en avant (badges 🥇🥈🥉) sur la page de choix d'application —
// un sous-ensemble des scénarios ci-dessous, pas une liste différente.
export const HIGHLIGHTED_SCENARIO_NAMES = ['Consultation solde et commission', 'Transfert national', 'Paiement facture']

/** Scénarios recommandés par nom d'application (correspondance exacte sur
 * Application.name) — n'ajoute rien pour une application non listée ici. */
export const recommendedScenariosByApp: Record<string, RecommendedScenarioDef[]> = {
  'Banking Test API': [
    {
      name: 'Authentification',
      description: "Connexion d'un agent avec identifiants fictifs.",
      steps: [LOGIN_STEP],
    },
    {
      name: 'Consultation solde et commission',
      description: 'Consulte le solde et la commission du compte agent.',
      steps: [LOGIN_STEP, { name: 'Consulter le solde', method: 'GET', url: '/api/account/balance', headers: AUTH_HEADER }],
    },
    {
      name: 'Consultation historique agent',
      description: "Consulte l'historique des opérations de l'agent.",
      steps: [LOGIN_STEP, { name: "Consulter l'historique", method: 'GET', url: '/api/agent/history', headers: AUTH_HEADER }],
    },
    {
      name: 'Transfert international',
      description: 'Envoie un transfert international fictif.',
      steps: [
        LOGIN_STEP,
        {
          name: 'Transfert international',
          method: 'POST',
          url: '/api/transfers/international',
          headers: AUTH_HEADER,
          bodyJson: JSON.stringify(
            { sourceAccount: 'ACC001', destinationCountry: 'FR', destinationAccount: 'FR001', amount: 1500, currency: 'EUR' },
            null,
            2
          ),
        },
      ],
    },
    {
      name: 'Transfert national',
      description: 'Envoie un transfert national fictif.',
      steps: [
        LOGIN_STEP,
        {
          name: 'Transfert national',
          method: 'POST',
          url: '/api/transfers/national',
          headers: AUTH_HEADER,
          bodyJson: JSON.stringify({ sourceAccount: 'ACC001', destinationAccount: 'ACC002', amount: 500 }, null, 2),
        },
      ],
    },
    {
      name: 'Paiement facture',
      description: 'Paie une facture fictive.',
      steps: [
        LOGIN_STEP,
        {
          name: 'Payer la facture',
          method: 'POST',
          url: '/api/bills/pay',
          headers: AUTH_HEADER,
          bodyJson: JSON.stringify({ clientId: 'CL001', billNumber: 'FACT-2026-001', amount: 350 }, null, 2),
        },
      ],
    },
    {
      name: 'Versement client',
      description: 'Enregistre un versement client fictif.',
      steps: [
        LOGIN_STEP,
        {
          name: 'Versement client',
          method: 'POST',
          url: '/api/deposits',
          headers: AUTH_HEADER,
          bodyJson: JSON.stringify({ account: 'ACC001', amount: 1000 }, null, 2),
        },
      ],
    },
  ],
}

export function getRecommendedScenarios(applicationName: string): RecommendedScenarioDef[] {
  return recommendedScenariosByApp[applicationName] ?? []
}
