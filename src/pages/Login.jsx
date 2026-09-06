import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import Background from '../components/Background'
import { login } from '../api/auth'
import { setRole as persistRole, setToken, setProfile } from '../lib/auth'

const ROLES = [
  {
    id: 'student',
    label: 'Student',
    sub: 'Browse professors, book sessions, track courses',
    icon: 'school',
  },
  {
    id: 'teacher',
    label: 'Professor',
    sub: 'Manage availability, schedule & resources',
    icon: 'cast_for_education',
  },
]

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const initialRole = location.state?.role === 'teacher' ? 'teacher' : (location.state?.role === 'student' ? 'student' : null)

  const [role, setRole] = useState(initialRole)
  const [showRoleModal, setShowRoleModal] = useState(!initialRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupNotice, setSignupNotice] = useState(Boolean(location.state?.signupSuccess))

  const chooseRole = (id) => {
    setRole(id)
    setShowRoleModal(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!role) {
      setShowRoleModal(true)
      return
    }

    setSubmitting(true)
    try {
      const data = await login({ role, email, password })
      persistRole(data.role)
      setToken(data.access_token)
      setProfile(data.profile)
      navigate(data.role === 'teacher' ? '/dashboard' : '/home')
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  const roleMeta = ROLES.find((r) => r.id === role)

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background font-body">
      <Background />

      {/* Extra glow blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-tertiary-container/8 rounded-full blur-[100px] pointer-events-none" />

      {/* ── ROLE SELECTION MODAL ──────────────────── */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl p-8 w-full max-w-md border border-outline-variant/20 shadow-2xl animate-fade-up">
            <div className="text-center mb-8">
              <h2 className="font-headline font-extrabold text-2xl text-on-surface tracking-tight mb-2">
                Welcome to ProfConnect
              </h2>
              <p className="text-on-surface-variant text-sm opacity-70">
                Are you signing in as a student or a professor?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => chooseRole(r.id)}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface-container-low
                             border border-outline-variant/10 hover:border-primary/40 hover:bg-surface-container
                             transition-all active:scale-95 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary-container/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-2xl">
                      {r.icon}
                    </span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-on-surface text-sm">{r.label}</p>
                    <p className="text-[10px] text-on-surface-variant opacity-60 mt-1 leading-relaxed">
                      {r.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-6 animate-fade-up stagger-1">
        <div className="glass-panel rounded-2xl p-10 shadow-2xl relative">

          {/* Branding */}
          <div className="flex flex-col items-center mb-10">
            <div
              className="mb-5 w-16 h-16 rounded-full bg-primary-container flex items-center justify-center
                         border border-primary/20 shadow-[0_0_24px_rgba(139,0,0,0.45)]"
            >
              <span
                className="material-symbols-outlined text-primary text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                network_intelligence
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-surface mb-1">
              PROF CONNECT
            </h1>
            <p className="text-on-surface-variant text-xs tracking-[0.22em] uppercase opacity-60 mb-3">
              Connecting made easy
            </p>
            {roleMeta && (
              <button
                onClick={() => setShowRoleModal(true)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high
                           border border-outline-variant/20 hover:border-primary/30 transition-colors"
              >
                <span className="material-symbols-outlined text-primary text-sm">{roleMeta.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Signing in as {roleMeta.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                  Switch
                </span>
              </button>
            )}
          </div>

          {signupNotice && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs leading-relaxed flex items-start gap-2">
              <span className="material-symbols-outlined text-base leading-none">check_circle</span>
              <span>Account created — please log in with your new credentials.</span>
            </div>
          )}

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs leading-relaxed">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-label font-semibold text-on-surface-variant tracking-widest uppercase pl-1"
              >
                Institutional Email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">
                  alternate_email
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSignupNotice(false) }}
                  placeholder="username@institution.edu"
                  className="input-base w-full py-4 pl-12 pr-4 text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label
                  htmlFor="password"
                  className="block text-xs font-label font-semibold text-on-surface-variant tracking-widest uppercase"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-[10px] font-bold text-primary/80 hover:text-primary transition-colors uppercase tracking-tight"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">
                  lock
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-base w-full py-4 pl-12 pr-4 text-sm"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                    <span className="font-headline font-bold tracking-tight">Signing In…</span>
                  </>
                ) : (
                  <>
                    <span className="font-headline font-bold tracking-tight">Enter</span>
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-on-surface-variant/70 mt-6">
            Don&apos;t have an account?{' '}
            <Link to={role ? `/signup?role=${role}` : '/signup'} className="text-primary font-bold hover:underline">
              Sign Up
            </Link>
          </p>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent rounded-full" />
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 opacity-35">
          <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant font-label">
            © 2025 ProfConnect · Built by Thapar Institute of Engineering and Technology
          </p>
          <p className="text-[9px] uppercase tracking-[0.18em] text-emerald-400/70 font-label">
            CI/CD pipeline test — auto-deployed via GitHub Actions
          </p>
          <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {['Privacy', 'Terms', 'Security'].map((t) => (
              <button key={t} className="hover:text-primary transition-colors">{t}</button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
