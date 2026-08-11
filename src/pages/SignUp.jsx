import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Background from '../components/Background'
import { signupStudent, signupTeacher } from '../api/auth'
import { validatePassword } from '../lib/validators'

const ROLES = [
  { id: 'student', label: 'Student', icon: 'school' },
  { id: 'teacher', label: 'Professor', icon: 'cast_for_education' },
]

// Field config drives both the form and the payload sent to the API —
// matches the student/teacher table schema in db/schema.sql exactly.
const STUDENT_FIELDS = [
  { name: 'rollno',   label: 'Roll Number',  icon: 'badge',           type: 'number', numeric: true },
  { name: 'name',     label: 'Full Name',    icon: 'person',          type: 'text' },
  { name: 'phone_no', label: 'Phone Number', icon: 'call',            type: 'tel',    numeric: true },
  { name: 'branch',   label: 'Branch',       icon: 'account_tree',    type: 'text' },
  { name: 'email',    label: 'Email',        icon: 'alternate_email', type: 'email' },
  { name: 'year',     label: 'Year',         icon: 'calendar_today',  type: 'number', numeric: true },
]

const TEACHER_FIELDS = [
  { name: 'teacher_id',  label: 'Teacher ID',  icon: 'badge',           type: 'number', numeric: true },
  { name: 'name',        label: 'Full Name',   icon: 'person',          type: 'text' },
  { name: 'room_number', label: 'Room Number', icon: 'meeting_room',    type: 'text' },
  { name: 'department',  label: 'Department',  icon: 'apartment',       type: 'text' },
  { name: 'designation', label: 'Designation', icon: 'workspace_premium', type: 'text' },
  { name: 'h_index',     label: 'h-index',     icon: 'trending_up',     type: 'number', numeric: true },
  { name: 'email',       label: 'Email',       icon: 'alternate_email', type: 'email' },
]

function emptyFormFor(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {})
}

export default function SignUp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'teacher' ? 'teacher' : 'student'

  const [role, setRole] = useState(initialRole)
  const fields = role === 'teacher' ? TEACHER_FIELDS : STUDENT_FIELDS

  const [form, setForm] = useState(() => emptyFormFor(fields))
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const switchRole = (id) => {
    setRole(id)
    setForm(emptyFormFor(id === 'teacher' ? TEACHER_FIELDS : STUDENT_FIELDS))
    setError('')
  }

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const pwError = validatePassword(password)
    if (pwError) {
      setError(pwError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    // Coerce numeric fields to numbers before sending.
    const payload = { ...form, password }
    for (const f of fields) {
      if (f.numeric) payload[f.name] = Number(form[f.name])
    }

    setSubmitting(true)
    try {
      if (role === 'student') {
        await signupStudent(payload)
      } else {
        await signupTeacher(payload)
      }
      // Explicitly NOT logging the user in — send them back to /login.
      navigate('/login', { state: { signupSuccess: true, role } })
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background font-body py-10">
      <Background />

      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-tertiary-container/8 rounded-full blur-[100px] pointer-events-none" />

      <main className="relative z-10 w-full max-w-md mx-auto px-6 animate-fade-up">
        <div className="glass-panel rounded-2xl p-10 shadow-2xl relative">

          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-5 w-16 h-16 rounded-full bg-primary-container flex items-center justify-center border border-primary/20 shadow-[0_0_24px_rgba(139,0,0,0.45)]">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                network_intelligence
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-surface mb-1">
              Create Account
            </h1>
            <p className="text-on-surface-variant text-xs tracking-[0.22em] uppercase opacity-60">
              Join ProfConnect
            </p>
          </div>

          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-3 mb-7">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => switchRole(r.id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-sm font-headline font-bold
                  ${role === r.id
                    ? 'bg-primary-container/25 border-primary/40 text-primary'
                    : 'bg-surface-container-low border-outline-variant/10 text-on-surface-variant hover:border-primary/20'}`}
              >
                <span className="material-symbols-outlined text-lg">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((f) => (
              <div key={f.name} className="space-y-2">
                <label
                  htmlFor={f.name}
                  className="block text-xs font-label font-semibold text-on-surface-variant tracking-widest uppercase pl-1"
                >
                  {f.label}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">
                    {f.icon}
                  </span>
                  <input
                    id={f.name}
                    type={f.type}
                    required
                    value={form[f.name]}
                    onChange={(e) => updateField(f.name, e.target.value)}
                    className="input-base w-full py-3.5 pl-12 pr-4 text-sm"
                  />
                </div>
              </div>
            ))}

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-label font-semibold text-on-surface-variant tracking-widest uppercase pl-1">
                Password
              </label>
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
                  className="input-base w-full py-3.5 pl-12 pr-4 text-sm"
                />
              </div>
              <p className="text-[10px] text-on-surface-variant/50 pl-1 leading-relaxed">
                At least 8 characters, with uppercase, lowercase, and a number.
              </p>
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-xs font-label font-semibold text-on-surface-variant tracking-widest uppercase pl-1">
                Confirm Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl">
                  lock_reset
                </span>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-base w-full py-3.5 pl-12 pr-4 text-sm"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                    <span className="font-headline font-bold tracking-tight">Creating Account…</span>
                  </>
                ) : (
                  <>
                    <span className="font-headline font-bold tracking-tight">Sign Up</span>
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-on-surface-variant/70 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Log in
            </Link>
          </p>

          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent rounded-full" />
        </div>
      </main>
    </div>
  )
}
