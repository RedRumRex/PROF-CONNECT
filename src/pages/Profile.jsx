import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import useLiveStatus from '../hooks/useLiveStatus'
import { fetchTeacher } from '../api/teachers'
import { mapTeacherCard } from '../lib/profile'

const STATUS_COLORS = {
  available: { dot: 'bg-green-500',  text: 'text-green-400',  label: 'Available' },
  busy:      { dot: 'bg-amber-500',  text: 'text-amber-400',  label: 'Busy'      },
  away:      { dot: 'bg-rose-600',   text: 'text-rose-400',   label: 'Away'      },
}

export default function Profile() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [teacher,   setTeacher]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    setLoading(true)
    setLoadError('')
    fetchTeacher(id)
      .then((row) => setTeacher(mapTeacherCard(row)))
      .catch((err) => setLoadError(err.message || 'Professor not found.'))
      .finally(() => setLoading(false))
  }, [id])

  // Live availability pushed from this professor's door-mounted Raspberry Pi.
  const { statusMap, connected } = useLiveStatus()
  const status = statusMap[id]?.status ?? 'away'
  const statusStyle = STATUS_COLORS[status] ?? STATUS_COLORS.away

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-on-surface-variant text-sm opacity-60">Loading professor…</p>
      </div>
    )
  }

  if (loadError || !teacher) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-on-surface-variant text-lg mb-4">{loadError || 'Professor not found.'}</p>
          <button onClick={() => navigate('/home#explore')} className="btn-primary px-6 py-3">
            Back to Explore
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-12 pb-28 lg:pb-12 space-y-8">

        {/* Back */}
        <button
          onClick={() => navigate('/home#explore')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
        >
          <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          <span className="text-sm font-medium">Back to Home</span>
        </button>

        {/* ── HERO ─────────────────────────────────────────── */}
        <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col md:flex-row gap-8 items-start">

            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-32 h-32 rounded-2xl overflow-hidden ring-2 ring-primary/20 shadow-2xl">
                <img src={teacher.avatar} alt={teacher.name} className="w-full h-full object-cover" />
              </div>
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-container-highest ${statusStyle.dot}`} />
            </div>

            {/* Name + status + actions */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/20">
                  <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                    connected
                      ? 'bg-tertiary-container/20 text-tertiary border-tertiary/20'
                      : 'bg-surface-container-highest text-on-surface-variant/50 border-outline-variant/10'
                  }`}
                  title={connected ? 'Live from door unit' : 'Live status unavailable — showing last known status'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-tertiary animate-pulse' : 'bg-on-surface-variant/30'}`} />
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
              <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface tracking-tighter mb-1">
                {teacher.name}
              </h1>
              <p className="text-on-surface-variant text-lg mb-1">{teacher.department}</p>
              <p className="text-on-surface-variant text-sm opacity-60 mb-6">
                {teacher.designation} &middot; Room {teacher.roomNumber}
              </p>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => navigate(`/appointment/${teacher.id}`)}
                  className="btn-primary px-6 py-3 flex items-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined text-sm">event_available</span>
                  Book Session
                </button>
                <button
                  onClick={() => navigate(`/appointment/${teacher.id}`)}
                  className="px-6 py-3 rounded-xl border border-outline-variant/30 text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors flex items-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">mail</span>
                  Send Message
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex md:flex-col gap-6 md:gap-5 shrink-0">
              <div className="text-center md:text-right">
                <div className="text-2xl font-black text-primary leading-none">{teacher.hIndex}</div>
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold mt-0.5">
                  H-Index
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
