import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import { fetchMyAppointmentsAsStudent, fetchAppointmentsForTeacher } from '../api/appointments'
import { getToken, getRole } from '../lib/auth'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m || 0), 0, 0)
  if (Number.isNaN(d.getTime())) return timeStr
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function toDateTime(dateStr, timeStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T${timeStr || '00:00:00'}`)
  return Number.isNaN(d.getTime()) ? null : d
}

// Maps a row from GET /api/appointments/student or GET /api/appointments/teacher
// into the shape this page renders — same appointment table, different joins.
function mapRow(row, role) {
  const isStudent = role === 'student'
  const otherId = isStudent ? row.teacher_id : row.student_id
  return {
    id: row.appointment_id,
    otherId,
    name: isStudent ? (row.teacher_name || 'Professor') : (row.student_name || 'Student'),
    sub: isStudent
      ? [row.teacher_department, row.teacher_designation].filter(Boolean).join(' · ')
      : [row.student_branch, row.student_year ? `Year ${row.student_year}` : null].filter(Boolean).join(' · '),
    date: row.appointment_date,
    time: row.appointment_time,
    status: row.status_label,
    dateTime: toDateTime(row.appointment_date, row.appointment_time),
    avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(String(otherId))}&backgroundColor=${isStudent ? '0a1628' : '321817'}`,
  }
}

const STATUS_STYLES = {
  pending:  'bg-amber-500/10 text-amber-400',
  accepted: 'bg-tertiary/10 text-tertiary',
  declined: 'bg-error/10 text-error',
}

export default function Appointments() {
  const navigate = useNavigate()
  const role = getRole()
  const isStudent = role !== 'teacher'

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login')
      return
    }
    const fetcher = role === 'teacher' ? fetchAppointmentsForTeacher : fetchMyAppointmentsAsStudent
    fetcher(token)
      .then((data) => setRows(data.map((r) => mapRow(r, role))))
      .catch((err) => setError(err.message || 'Could not load your appointments.'))
      .finally(() => setLoading(false))
  }, [role, navigate])

  const { pending, upcoming, past } = useMemo(() => {
    const now = new Date()
    const pending  = []
    const upcoming = []
    const past     = []
    rows.forEach((r) => {
      if (r.status === 'pending') {
        pending.push(r)
      } else if (r.status === 'accepted' && r.dateTime && r.dateTime >= now) {
        upcoming.push(r)
      } else {
        past.push(r)
      }
    })
    const byDateAsc  = (a, b) => (a.dateTime?.getTime() ?? 0) - (b.dateTime?.getTime() ?? 0)
    const byDateDesc = (a, b) => (b.dateTime?.getTime() ?? 0) - (a.dateTime?.getTime() ?? 0)
    pending.sort(byDateAsc)
    upcoming.sort(byDateAsc)
    past.sort(byDateDesc)
    return { pending, upcoming, past }
  }, [rows])

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-10 pb-28 lg:pb-12">
        <div className="mb-8">
          <h2 className="text-4xl font-headline font-extrabold tracking-tighter text-on-surface">Appointments</h2>
          <p className="text-on-surface-variant text-sm mt-1 opacity-60">
            {isStudent ? 'Sessions you have requested with professors.' : 'Sessions requested by students.'}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-on-surface-variant text-sm opacity-60">Loading appointments…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined text-4xl text-error/60 mb-3">error</span>
            <p className="text-on-surface-variant text-sm opacity-70">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">event_busy</span>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No appointments yet</h3>
            <p className="text-on-surface-variant text-sm opacity-60">
              {isStudent ? 'Book a session with a professor to see it here.' : 'Requests from students will show up here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {pending.length > 0 && (
              <AppointmentSection title="Pending" icon="hourglass_top" items={pending} navigate={navigate} isStudent={isStudent} />
            )}
            <AppointmentSection title="Upcoming" icon="event_upcoming" items={upcoming} navigate={navigate} isStudent={isStudent} emptyText="No upcoming sessions." />
            <AppointmentSection title="Past" icon="history" items={past} navigate={navigate} isStudent={isStudent} emptyText="No past sessions yet." />
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

function AppointmentSection({ title, icon, items, navigate, isStudent, emptyText }) {
  if (items.length === 0 && !emptyText) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <h3 className="font-headline text-xl font-bold text-on-surface">{title}</h3>
        <span className="text-xs text-on-surface-variant opacity-50">({items.length})</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant opacity-50 pl-1">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div
              key={r.id}
              onClick={isStudent ? () => navigate(`/profile/${r.otherId}`) : undefined}
              className={`glass-card p-4 rounded-2xl flex items-center gap-4 transition-all ${
                isStudent ? 'cursor-pointer hover:border-primary/30' : ''
              }`}
            >
              <img src={r.avatar} alt={r.name} className="w-12 h-12 rounded-xl shrink-0 object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">{r.name}</p>
                <p className="text-xs text-on-surface-variant truncate">{r.sub || '—'}</p>
                <p className="text-xs text-on-surface-variant opacity-70 mt-0.5">
                  {formatDate(r.date)} · {formatTime(r.time)}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 ${STATUS_STYLES[r.status] || 'bg-surface-container-highest text-on-surface-variant'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
