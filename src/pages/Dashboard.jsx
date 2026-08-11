import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import { getMe } from '../api/auth'
import { getToken, getProfile, setProfile as persistProfile } from '../lib/auth'
import { mapTeacherProfile } from '../lib/profile'

const NOTIFICATIONS = [
  { id: 1, text: 'Assignment #4 deadline in 3 days',        icon: 'warning',       read: false },
  { id: 2, text: 'New resource uploaded: Quantum Pack v2',  icon: 'folder_zip',    read: false },
  { id: 3, text: 'Thesis review confirmed for Wednesday',   icon: 'event_available', read: true },
]

// Empty for now — real appointment requests come from the `appointment`
// table once that flow is wired up.
const INITIAL_APPOINTMENT_REQUESTS = []

export default function Dashboard() {
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState(() => mapTeacherProfile(getProfile()))

  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login')
      return
    }
    getMe(token)
      .then((data) => {
        persistProfile(data.profile)
        setTeacher(mapTeacherProfile(data.profile))
      })
      .catch(() => {
        // Background refresh only — keep showing the cached profile.
      })
  }, [navigate])

  const [requests,          setRequests]          = useState(INITIAL_APPOINTMENT_REQUESTS)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications,     setNotifications]     = useState(NOTIFICATIONS)
  const [messageOpen,       setMessageOpen]       = useState(false)
  const [messageText,       setMessageText]       = useState('')
  const [messageSent,       setMessageSent]       = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

  const sendMessage = () => {
    if (!messageText.trim()) return
    setMessageSent(true)
    setMessageText('')
    setTimeout(() => { setMessageSent(false); setMessageOpen(false) }, 2500)
  }

  const respondToRequest = (id, status) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-12 pb-28 lg:pb-12 space-y-10">

        {/* ── HERO ─────────────────────────────────── */}
        <section className="flex flex-col md:flex-row gap-8 items-end justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-container/20 text-tertiary border border-tertiary/10">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Currently Online</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-headline font-extrabold text-on-surface tracking-tighter">
              {teacher.name}
            </h2>
            <p className="text-on-surface-variant text-lg leading-relaxed max-w-xl opacity-80">
              {teacher.designation} &middot; {teacher.department} &middot; Room {teacher.roomNumber} &middot; h-index {teacher.hIndex}
            </p>
            <p className="text-on-surface-variant text-sm opacity-60">{teacher.email}</p>
          </div>

          <div className="flex gap-3 w-full md:w-auto flex-wrap">
            <button
              onClick={() => setMessageOpen(true)}
              className="flex-1 md:flex-none px-6 py-4 rounded-xl border border-outline-variant/30 text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              Leave a Message
            </button>

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(v => !v)}
                className="relative px-4 py-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2 active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-black flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-high border border-outline-variant/20 rounded-2xl shadow-2xl z-30 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/10">
                    <h4 className="font-headline font-bold text-sm">Notifications</h4>
                    <button onClick={markAllRead} className="text-[10px] text-primary font-bold uppercase tracking-wider hover:opacity-80">
                      Mark all read
                    </button>
                  </div>
                  {notifications.map(n => (
                    <div key={n.id} className={`flex items-start gap-3 px-5 py-4 border-b border-outline-variant/5 transition-colors ${n.read ? 'opacity-50' : 'hover:bg-surface-container-highest'}`}>
                      <span className="material-symbols-outlined text-primary text-lg mt-0.5">{n.icon}</span>
                      <p className="text-sm text-on-surface flex-1">{n.text}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── MESSAGE MODAL ────────────────────────── */}
        {messageOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="glass-panel rounded-2xl p-8 w-full max-w-md border border-outline-variant/20 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline font-bold text-lg">Leave a Message</h3>
                <button onClick={() => setMessageOpen(false)} className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {messageSent ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-5xl text-tertiary mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  <p className="font-headline font-bold text-on-surface">Message Sent!</p>
                  <p className="text-sm text-on-surface-variant mt-1">Prof. Sharma will respond within 24 hours.</p>
                </div>
              ) : (
                <>
                  <textarea
                    rows={5}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Write your message to Prof. Sharma..."
                    className="input-base w-full p-4 text-sm resize-none mb-4"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setMessageOpen(false)} className="flex-1 py-3 rounded-xl border border-outline-variant/30 text-on-surface-variant font-bold text-sm hover:bg-surface-container-high transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={sendMessage}
                      disabled={!messageText.trim()}
                      className="flex-1 btn-primary py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Send Message
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── APPOINTMENT REQUESTS ─────────────────── */}
        <section className="glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-headline font-bold text-on-surface">Appointment Requests</h3>
              <p className="text-on-surface-variant text-sm">Students waiting on your response</p>
            </div>
            <span className="px-3 py-1 rounded bg-surface-container-highest text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
              {pendingCount} Pending
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/30">event_busy</span>
              <p className="text-sm text-on-surface-variant opacity-60">No appointment requests yet.</p>
            </div>
          ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/10"
              >
                <img src={r.avatar} alt={r.name} className="w-12 h-12 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">{r.name}</p>
                  <p className="text-xs text-on-surface-variant">{r.dept}</p>
                  <p className="text-xs text-on-surface-variant opacity-70 mt-0.5">
                    {r.reason} · {r.date}, {r.time}
                  </p>
                </div>

                {r.status === 'pending' ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => respondToRequest(r.id, 'accepted')}
                      className="px-3 py-2 rounded-xl bg-tertiary/10 border border-tertiary/20 text-tertiary text-xs font-bold hover:bg-tertiary/20 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondToRequest(r.id, 'declined')}
                      className="px-3 py-2 rounded-xl border border-outline-variant/20 text-on-surface-variant text-xs font-bold hover:bg-surface-container-high transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 self-start sm:self-center ${
                      r.status === 'accepted'
                        ? 'bg-tertiary/10 text-tertiary'
                        : 'bg-error/10 text-error'
                    }`}
                  >
                    {r.status}
                  </span>
                )}
              </div>
            ))}
          </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  )
}