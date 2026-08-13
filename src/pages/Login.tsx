import { useState, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, UserRole } from '../context/AuthContext'
import { validateRequired, validateEmail, firstError } from '../utils/validation'

type ViewMode = 'login' | 'forgot' | 'sent'

const features = [
  { icon: 'bi-lightning-charge-fill', text: 'Testez vos applications Web, API REST et SOAP' },
  { icon: 'bi-graph-up-arrow', text: 'Suivez vos métriques de performance en temps réel' },
  { icon: 'bi-shield-check', text: 'Gestion fine des rôles Visiteur, Testeur & Admin' },
  { icon: 'bi-file-earmark-bar-graph', text: 'Rapports détaillés exportables en PDF / Excel' },
]

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [view, setView] = useState<ViewMode>('login')
  const [email, setEmail] = useState('admin@perftest.com')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [role, setRole] = useState<UserRole>('Admin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  const redirectTo = (location.state as { from?: string })?.from || '/'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const emailError = firstError(validateRequired(email, "L'adresse email"), validateEmail(email))
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = firstError(
      validateRequired(password, 'Le mot de passe'),
      password.trim().length > 0 && password.trim().length < 4
        ? 'Le mot de passe doit contenir au moins 4 caractères.'
        : null
    )
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (loading) return
    setLoading(true)
    // Simulation d'authentification (aucun backend connecté)
    setTimeout(() => {
      login(email.trim(), role, remember)
      setLoading(false)
      navigate(redirectTo, { replace: true })
    }, 600)
  }

  const handleForgotSubmit = (e: FormEvent) => {
    e.preventDefault()
    setForgotError('')
    const emailError = firstError(validateRequired(forgotEmail, "L'adresse email"), validateEmail(forgotEmail))
    if (emailError) {
      setForgotError(emailError)
      return
    }
    if (forgotLoading) return
    setForgotLoading(true)
    setTimeout(() => {
      setForgotLoading(false)
      setView('sent')
    }, 500)
  }

  const quickFill = (demoRole: UserRole) => {
    setRole(demoRole)
    const emails: Record<UserRole, string> = {
      Admin: 'admin@perftest.com',
      Testeur: 'testeur@perftest.com',
      Visiteur: 'visiteur@perftest.com',
    }
    setEmail(emails[demoRole])
    setPassword('demo1234')
  }

  return (
    <div className="pt-auth-page">
      {/* Left branding panel */}
      <div className="pt-auth-brand">
        <div className="pt-auth-brand-inner">
          <div className="pt-auth-logo">
            <div className="pt-auth-logo-icon">
              <i className="bi bi-speedometer2"></i>
            </div>
            <div>
              <h4>PERFTEST</h4>
              <span>Performance Testing Platform</span>
            </div>
          </div>

          <h1 className="pt-auth-headline">
            Pilotez vos tests de performance en toute confiance
          </h1>
          <p className="pt-auth-subheadline">
            Créez des scénarios multi-requêtes, lancez vos tests de charge et suivez vos KPIs
            en temps réel — le tout depuis une seule plateforme.
          </p>

          <ul className="pt-auth-features">
            {features.map((f, i) => (
              <li key={i}>
                <span className="pt-auth-feature-icon">
                  <i className={`bi ${f.icon}`}></i>
                </span>
                {f.text}
              </li>
            ))}
          </ul>

          <div className="pt-auth-quote">
            <i className="bi bi-quote"></i>
            <p>
              « Le point de saturation de notre API est détecté automatiquement — un gain de
              temps énorme pour notre équipe QA. »
            </p>
            <span>— Équipe Performance Engineering</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="pt-auth-form-panel">
        <div className="pt-auth-form-wrapper">
          {view === 'login' && (
            <>
              <div className="pt-auth-form-header">
                <h2>Connexion</h2>
                <p>Accédez à votre espace PERFTEST</p>
              </div>

              {error && (
                <div className="pt-auth-alert">
                  <i className="bi bi-exclamation-circle-fill"></i>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label className="pt-form-label">Adresse email</label>
                  <div className="pt-auth-input-group">
                    <i className="bi bi-envelope"></i>
                    <input
                      type="email"
                      className="pt-form-control"
                      placeholder="vous@entreprise.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="mb-2">
                  <label className="pt-form-label">Mot de passe</label>
                  <div className="pt-auth-input-group">
                    <i className="bi bi-lock"></i>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="pt-form-control"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="pt-auth-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-3 mt-2">
                  <label className="pt-auth-checkbox">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span>Se souvenir de moi</span>
                  </label>
                  <button
                    type="button"
                    className="pt-auth-link"
                    onClick={() => { setForgotError(''); setView('forgot') }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <button type="submit" className="pt-btn-primary w-100 justify-content-center" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      Se connecter <i className="bi bi-arrow-right"></i>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-auth-divider">
                <span>Comptes de démonstration</span>
              </div>

              <div className="pt-auth-demo-roles">
                <button type="button" className="pt-auth-demo-card" onClick={() => quickFill('Admin')}>
                  <span className="pt-auth-demo-icon admin">
                    <i className="bi bi-shield-lock-fill"></i>
                  </span>
                  <div>
                    <strong>Admin</strong>
                    <small>Accès complet à la plateforme</small>
                  </div>
                </button>
                <button type="button" className="pt-auth-demo-card" onClick={() => quickFill('Testeur')}>
                  <span className="pt-auth-demo-icon tester">
                    <i className="bi bi-person-check-fill"></i>
                  </span>
                  <div>
                    <strong>Testeur</strong>
                    <small>Créer et lancer des tests</small>
                  </div>
                </button>
                <button type="button" className="pt-auth-demo-card" onClick={() => quickFill('Visiteur')}>
                  <span className="pt-auth-demo-icon viewer">
                    <i className="bi bi-eye-fill"></i>
                  </span>
                  <div>
                    <strong>Visiteur</strong>
                    <small>Consultation en lecture seule</small>
                  </div>
                </button>
              </div>

              <p className="pt-auth-footer-text">
                PERFTEST v1.0.0 — Environnement de démonstration (frontend seul, sans backend)
              </p>
            </>
          )}

          {view === 'forgot' && (
            <>
              <button type="button" className="pt-auth-back-btn" onClick={() => setView('login')}>
                <i className="bi bi-arrow-left"></i> Retour à la connexion
              </button>

              <div className="pt-auth-form-header">
                <h2>Mot de passe oublié</h2>
                <p>Recevez un lien de réinitialisation par email</p>
              </div>

              {forgotError && (
                <div className="pt-auth-alert">
                  <i className="bi bi-exclamation-circle-fill"></i>
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleForgotSubmit} noValidate>
                <div className="mb-3">
                  <label className="pt-form-label">Adresse email</label>
                  <div className="pt-auth-input-group">
                    <i className="bi bi-envelope"></i>
                    <input
                      type="email"
                      className="pt-form-control"
                      placeholder="vous@entreprise.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="pt-btn-primary w-100 justify-content-center" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer le lien de réinitialisation'
                  )}
                </button>
              </form>
            </>
          )}

          {view === 'sent' && (
            <div className="pt-auth-success">
              <div className="pt-auth-success-icon">
                <i className="bi bi-envelope-check-fill"></i>
              </div>
              <h2>Email envoyé</h2>
              <p>
                Si un compte existe pour <strong>{forgotEmail}</strong>, un lien de
                réinitialisation vient de lui être envoyé.
              </p>
              <button type="button" className="pt-btn-outline" onClick={() => setView('login')}>
                <i className="bi bi-arrow-left"></i> Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
