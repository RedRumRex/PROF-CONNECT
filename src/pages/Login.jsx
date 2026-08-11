import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'

export default function Login() {
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background font-body">
      <Background />

      {/* Extra glow blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-tertiary-container/8 rounded-full blur-[100px] pointer-events-none" />

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
            <p className="text-on-surface-variant text-xs tracking-[0.22em] uppercase opacity-60">
              Connecting made easy
            </p>
          </div>

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
                  placeholder="••••••••"
                  className="input-base w-full py-4 pl-12 pr-4 text-sm"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-3">
              <button
                type="submit"
                className="btn-primary w-full py-4 flex items-center justify-center gap-2"
              >
                <span className="font-headline font-bold tracking-tight">Enter</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            </div>

            {/* Kiosk mode */}
            <div className="pt-4 border-t border-outline-variant/10 flex justify-center">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="group flex items-center gap-3 px-4 py-2 rounded-full border border-outline-variant/20
                           hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-on-tertiary-container group-hover:text-primary transition-colors text-lg">
                  jamboard_kiosk
                </span>
                <span className="text-xs font-label font-medium text-on-surface-variant">
                  Kiosk Mode Access
                </span>
              </button>
            </div>
          </form>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent rounded-full" />
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 opacity-35">
          <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant font-label">
            © 2025 ProfConnect · Built by Thapar Institute of Engineering and Technology
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