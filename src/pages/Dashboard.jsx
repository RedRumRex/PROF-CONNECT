import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import { getMe } from '../api/auth'
import { fetchAppointmentsForTeacher, respondToAppointment } from '../api/appointments'
import { fetchThread, sendMessage as postMessage } from '../api/messages'
import { setMyAvailability } from '../api/availability'
import { getToken, getProfile, setProfile as persistProfile } from '../lib/auth'
import { mapTeacherProfile } from '../lib/profile'
import useLiveStatus from '../hooks/useLiveStatus'

const NOTIFICATIONS = [
  { id: 1, text: 'Assignment #4 deadline in 3 days',        icon: 'warning',       read: false },
  { id: 2, text: 'New resource uploaded: Quantum Pack v2',  icon: 'folder_zip',    read: false },
  { id: 3, text: 'Thesis review confirmed for Wednesday',   icon: 'event_available', read: true },
]

// Maps a row from GET /api/appointments/teacher (appointment + joined
// student name/branch/year) into the shape this page renders.
function mapAppointmentRequest(row) {
  return {
    id: row.appointment_id,
    studentId: row.student_id,
    name: row.student_name || 'Student',
    dept: row.student_branch
      ? `${row.student_branch}${row.student_year ? ` · Year ${row.student_year}` : ''}`
      : '—',
    date: row.appointment_date,
    time: row.appointment_time,
    status: row.status_label, // 'pending' | 'accepted' | 'declined'
    avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(String(row.student_id))}&backgroundColor=321817`,
  }
}

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

  const [requests,        setRequests]        = useState([])
  const [requestsError,   setRequestsError]   = useState('')
  const [respondingId,    setRespondingId]    = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications,     setNotifications]     = useState(NOTIFICATIONS)

  // ── "Available in Room" toggle ──────────────────────────────────────
  // Professor-only: pushes this teacher's real room availability over the
  // same live-status channel every Explore card / Profile page listens to
  // (see hooks/useLiveStatus.js). statusMap updates itself once the socket
  // broadcast comes back, so isAvailable below reflects the change without
  // any local optimistic state.
  const { statusMap } = useLiveStatus()
  const [togglingAvailability, setTogglingAvailability] = useState(false)
  const [availabilityError,    setAvailabilityError]    = useState('')
  const isAvailable = statusMap[teacher.teacherId]?.status === 'available'

  const toggleAvailability = async () => {
    const token = getToken()
    if (!token || togglingAvailability) return
    setTogglingAvailability(true)
    setAvailabilityError('')
    try {
      await setMyAvailability(!isAvailable, token)
    } catch (err) {
      setAvailabilityError(err.message || 'Could not update your availability.')
    } finally {
      setTogglingAvailability(false)
    }
  }

  // ── Per-student chat (opened from the "Message" action on a request) ──
  const [chatWith,     setChatWith]     = useState(null) // the request row, or null when closed
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading,  setChatLoading]  = useState(false)
  const [chatError,    setChatError]    = useState('')
  const [chatInput,    setChatInput]    = useState('')
  const [chatSending,  setChatSending]  = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) return
    fetchAppointmentsForTeacher(token)
      .then((rows) => setRequests(rows.map(mapAppointmentRequest)))
      .catch((err) => setRequestsError(err.message || 'Could not load appointment requests.'))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

  const openChat = (request) => {
    const token = getToken()
    if (!token) return
    setChatWith(request)
    setChatMessages([])
    setChatError('')
    setChatLoading(true)
    const teacherId = getProfile()?.teacher_id
    fetchThread(request.studentId, teacherId, token)
      .then((rows) => setChatMessages(rows))
      .catch((err) => setChatError(err.message || 'Could not load this conversation.'))
      .finally(() => setChatLoading(false))
  }

  const closeChat = () => {
    setChatWith(null)
    setChatMessages([])
    setChatInput('')
    setChatError('')
  }

  const sendChatMessage = async () => {
    const body = chatInput.trim()
    if (!body || !chatWith || chatSending) return
    const token = getToken()
    if (!token) return
    setChatSending(true)
    try {
      const teacherId = getProfile()?.teacher_id
      const sent = await postMessage({ studentId: chatWith.studentId, teacherId, body }, token)
      setChatMessages(prev => [...prev, sent])
      setChatInput('')
    } catch (err) {
      setChatError(err.message || 'Could not send that message. Please try again.')
    } finally {
      setChatSending(false)
    }
  }

  const respondToRequest = async (id, accept) => {
    const token = getToken()
    if (!token || respondingId) return
    setRespondingId(id)
    setRequestsError('')
    try {
      await respondToAppointment(id, accept, token)
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: accept ? 'accepted' : 'declined' } : r))
    } catch (err) {
      setRequestsError(err.message || 'Could not update this request. Please try again.')
    } finally {
      setRespondingId(null)
    }
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

          <div className="flex gap-3 w-full md:w-auto flex-wrap items-start">
            <div className="flex flex-col gap-1.5">
              <button
                onClick={toggleAvailability}
                disabled={togglingAvailability}
                title="Toggle whether students see you as available in your room right now"
                className={`px-5 py-4 rounded-xl border transition-colors flex items-center gap-2.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                  isAvailable
                    ? 'bg-tertiary/10 border-tertiary/30 text-tertiary hover:bg-tertiary/20'
                    : 'border-outline-variant/30 text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-tertiary animate-pulse' : 'bg-rose-600'}`} />
                <span className="text-sm font-bold">
                  {isAvailable ? 'Available in Room' : 'Not in Room'}
                </span>
              </button>
              {availabilityError && (
                <p className="text-[11px] text-error px-1">{availabilityError}</p>
              )}
            </div>

            <button
              onClick={() => navigate('/appointments')}
              className="px-4 py-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">calendar_month</span>
              <span className="text-sm font-bold hidden sm:inline">Appointments</span>
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

          {requestsError && (
            <p className="text-xs text-error mb-4">{requestsError}</p>
          )}

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
                    {r.date} · {r.time}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0 items-center">
                  <button
                    onClick={() => openChat(r)}
                    className="px-3 py-2 rounded-xl border border-outline-variant/20 text-on-surface-variant text-xs font-bold hover:bg-surface-container-high hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">mail</span>
                    Message
                  </button>

                  {r.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => respondToRequest(r.id, true)}
                        disabled={respondingId === r.id}
                        className="px-3 py-2 rounded-xl bg-tertiary/10 border border-tertiary/20 text-tertiary text-xs font-bold hover:bg-tertiary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondToRequest(r.id, false)}
                        disabled={respondingId === r.id}
                        className="px-3 py-2 rounded-xl border border-outline-variant/20 text-on-surface-variant text-xs font-bold hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full self-start sm:self-center ${
                        r.status === 'accepted'
                          ? 'bg-tertiary/10 text-tertiary'
                          : 'bg-error/10 text-error'
                      }`}
                    >
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </section>
      </main>

      {/* ── CHAT MODAL ────────────────────────────── */}
      {chatWith && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl w-full max-w-lg border border-outline-variant/20 shadow-2xl flex flex-col overflow-hidden" style={{ height: '600px', maxHeight: '85vh' }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/10 shrink-0">
              <img src={chatWith.avatar} alt={chatWith.name} className="w-10 h-10 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">{chatWith.name}</p>
                <p className="text-[11px] text-on-surface-variant opacity-60 truncate">{chatWith.dept}</p>
              </div>
              <button onClick={closeChat} className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
              {chatLoading ? (
                <p className="text-sm text-on-surface-variant opacity-60 text-center py-8">Loading conversation…</p>
              ) : chatMessages.length === 0 ? (
                <p className="text-sm text-on-surface-variant opacity-50 text-center py-8">
                  No messages yet. Say hello to {chatWith.name}.
                </p>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender_role === 'teacher'
                  return (
                    <div key={msg.message_id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-primary text-on-primary rounded-br-sm'
                          : 'bg-surface-container-high text-on-surface rounded-bl-sm border border-outline-variant/10'
                      }`}>
                        {msg.body}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {chatError && (
              <p className="text-xs text-error px-5 pb-2">{chatError}</p>
            )}

            {/* Input */}
            <div className="p-4 border-t border-outline-variant/10 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder={`Message ${chatWith.name}...`}
                  className="input-base flex-1 text-sm"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatSending}
                  className="btn-primary p-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}