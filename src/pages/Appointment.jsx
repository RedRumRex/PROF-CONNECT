import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import { fetchTeacher } from '../api/teachers'
import { createAppointment, fetchMyAppointmentsAsStudent } from '../api/appointments'
import { fetchThread, sendMessage as postMessage } from '../api/messages'
import { getToken, getProfile } from '../lib/auth'
import { mapTeacherCard } from '../lib/profile'

// Turns a row from GET /api/messages/thread into the shape this page's
// chat bubbles render.
function mapThreadMessage(row, profAvatar) {
  return {
    id: row.message_id,
    from: row.sender_role === 'teacher' ? 'prof' : 'user',
    avatar: row.sender_role === 'teacher' ? profAvatar : undefined,
    text: row.body,
    time: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
  }
}

// "09:00 AM — 10:30 AM" -> "09:00:00" (24h, for the appointment_time column)
function slotStartTo24h(slotTime) {
  const start = slotTime.split('—')[0].trim()
  const [time, period] = start.split(' ')
  let [hh, mm] = time.split(':').map(Number)
  if (period?.toUpperCase() === 'PM' && hh !== 12) hh += 12
  if (period?.toUpperCase() === 'AM' && hh === 12) hh = 0
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
}

function toIsoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const SLOT_OPTIONS = [
  { time: '09:00 AM — 10:30 AM', label: 'Research Overview'       },
  { time: '11:00 AM — 12:00 PM', label: 'Quick Consultation'      },
  { time: '02:00 PM — 03:30 PM', label: 'Deep Dive Session'       },
  { time: '04:00 PM — 05:00 PM', label: 'Thesis Review'           },
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su']

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOffset(year, month) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}
function formatTime() {
  const d = new Date()
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Appointment() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [teacher,   setTeacher]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')

  // The most recent request this student has already sent this teacher, if
  // any — real status (pending/accepted/declined) from the appointment
  // table, not a locally-faked "Booked!" state.
  const [existingRequest, setExistingRequest] = useState(null)
  const [submitting,      setSubmitting]      = useState(false)
  const [submitError,     setSubmitError]     = useState('')

  const today = new Date()
  const [year,         setYear]         = useState(today.getFullYear())
  const [month,        setMonth]        = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(today.getDate())
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [message,      setMessage]      = useState('')
  const [messages,     setMessages]     = useState([])
  const [chatLoading,  setChatLoading]  = useState(true)
  const [chatSending,  setChatSending]  = useState(false)
  const [chatError,    setChatError]    = useState('')
  const messagesEndRef = useRef(null)

  const profAvatarUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(id)}&backgroundColor=321817`

  useEffect(() => {
    setLoading(true)
    setLoadError('')
    fetchTeacher(id)
      .then((row) => setTeacher(mapTeacherCard(row)))
      .catch((err) => setLoadError(err.message || 'Professor not found.'))
      .finally(() => setLoading(false))

    const token = getToken()
    if (token) {
      fetchMyAppointmentsAsStudent(token)
        .then((rows) => {
          const mine = rows.find((r) => String(r.teacher_id) === String(id))
          if (mine) setExistingRequest(mine)
        })
        .catch(() => {
          // Non-fatal — the student can still send a new request.
        })
    }

    // Real, persisted conversation with this teacher — not a scripted
    // local-only chat. Both sides see the same thread.
    setChatLoading(true)
    setChatError('')
    const studentId = getProfile()?.rollno
    if (token && studentId) {
      fetchThread(studentId, id, token)
        .then((rows) => setMessages(rows.map((r) => mapThreadMessage(r, profAvatarUrl))))
        .catch((err) => setChatError(err.message || 'Could not load this conversation.'))
        .finally(() => setChatLoading(false))
    } else {
      setChatLoading(false)
    }
  }, [id])

  const prof = teacher ?? { name: 'Professor', designation: '', avatar: '' }
  const requestStatus = existingRequest?.status_label ?? null // 'pending' | 'accepted' | 'declined' | null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Calendar navigation ─────────────────────────
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDate(1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDate(1)
  }

  const daysInMonth  = getDaysInMonth(year, month)
  const firstOffset  = getFirstDayOffset(year, month)
  const isToday      = (n) => n === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const isPast       = (n) => new Date(year, month, n) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // ── Send message ────────────────────────────────
  // Posts to the real thread so the teacher actually sees it (from their
  // Dashboard's "Message" action) — no scripted local auto-reply anymore.
  const sendMessage = async () => {
    const body = message.trim()
    if (!body || chatSending) return
    const token = getToken()
    if (!token) { navigate('/login'); return }
    const studentId = getProfile()?.rollno
    if (!studentId) return

    setMessage('')
    setChatSending(true)
    setChatError('')
    try {
      const sent = await postMessage({ studentId, teacherId: Number(id), body }, token)
      setMessages(prev => [...prev, mapThreadMessage(sent, profAvatarUrl)])
    } catch (err) {
      setChatError(err.message || 'Could not send that message. Please try again.')
    } finally {
      setChatSending(false)
    }
  }

  // ── Confirm booking ─────────────────────────────
  // Sends a real request to the teacher instead of instantly marking the
  // session "booked" — the teacher has to accept it from their Dashboard
  // before it's an actual confirmed session.
  const confirmBooking = async () => {
    if (!selectedSlot || submitting) return
    const token = getToken()
    if (!token) { navigate('/login'); return }

    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await createAppointment({
        teacherId: Number(id),
        date: toIsoDate(year, month, selectedDate),
        time: slotStartTo24h(selectedSlot.time),
      }, token)
      setExistingRequest(result)
      setMessages(prev => [...prev, {
        id:     Date.now(),
        from:   'system',
        text:   `Your request for ${MONTHS[month]} ${selectedDate}, ${year} at ${selectedSlot.time} has been sent to ${prof.name}. You'll see the status here once they respond.`,
        time:   formatTime(),
      }])
    } catch (err) {
      setSubmitError(err.message || 'Could not send the request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
    <div className="min-h-screen bg-surface text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-12 pb-28 lg:pb-12">

        {/* ── HEADER ─────────────────────────────── */}
        <div className="mb-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div>
            <button
              onClick={() => navigate(`/profile/${id}`)}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors mb-4 group"
            >
              <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
              <span className="text-sm font-medium">Back to Profile</span>
            </button>
            <h1 className="text-5xl font-headline font-extrabold text-on-surface tracking-tighter mb-2">
              Session Request
            </h1>
            <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
              Coordinate your upcoming consultation. Select a date, pick a slot, and send a message.
            </p>
          </div>

          {/* Prof badge */}
          <div className="flex items-center gap-5 bg-surface-container-low p-5 rounded-2xl border border-outline-variant/10 shadow-xl shrink-0">
            <img src={prof.avatar} alt={prof.name} className="w-16 h-16 rounded-full object-cover shadow-lg" />
            <div>
              <p className="text-on-surface font-bold text-lg">{prof.name}</p>
              <p className="text-primary text-sm font-medium">{prof.designation}</p>
            </div>
          </div>
        </div>

        {/* ── REQUEST STATUS BANNER ────────────────── */}
        {requestStatus === 'accepted' && (
          <div className="mb-8 p-5 rounded-2xl bg-tertiary-container/20 border border-tertiary/20 flex items-center gap-4">
            <span className="material-symbols-outlined text-tertiary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <div>
              <p className="font-headline font-bold text-on-surface">Session Confirmed!</p>
              <p className="text-sm text-on-surface-variant">
                {existingRequest.appointment_date} · {existingRequest.appointment_time} with {prof.name}
              </p>
            </div>
            <button
              onClick={() => navigate('/home#explore')}
              className="ml-auto btn-primary px-5 py-2 text-sm"
            >
              Browse More
            </button>
          </div>
        )}

        {requestStatus === 'pending' && (
          <div className="mb-8 p-5 rounded-2xl bg-surface-container-high border border-outline-variant/20 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-3xl">hourglass_top</span>
            <div>
              <p className="font-headline font-bold text-on-surface">Request Sent — Awaiting Response</p>
              <p className="text-sm text-on-surface-variant">
                {existingRequest.appointment_date} · {existingRequest.appointment_time}. {prof.name} hasn't responded yet.
              </p>
            </div>
          </div>
        )}

        {requestStatus === 'declined' && (
          <div className="mb-8 p-5 rounded-2xl bg-error-container/10 border border-error/20 flex items-center gap-4">
            <span className="material-symbols-outlined text-error text-3xl">cancel</span>
            <div>
              <p className="font-headline font-bold text-on-surface">Previous Request Declined</p>
              <p className="text-sm text-on-surface-variant">
                {prof.name} declined your request for {existingRequest.appointment_date} · {existingRequest.appointment_time}. You can send a new request below.
              </p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="mb-8 p-4 rounded-2xl bg-error-container/10 border border-error/20">
            <p className="text-sm text-error">{submitError}</p>
          </div>
        )}

        {/* ── BENTO GRID ─────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

          {/* ── CALENDAR ─────────────────────────── */}
          <section className="xl:col-span-5 glass-panel rounded-2xl p-8 border border-outline-variant/15 shadow-2xl flex flex-col">

            {/* Month nav */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-headline font-bold">
                {MONTHS[month]} {year}
              </h3>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2.5 rounded-xl hover:bg-surface-container-high text-on-surface-variant transition-colors border border-outline-variant/10">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button onClick={nextMonth} className="p-2.5 rounded-xl hover:bg-surface-container-high text-on-surface-variant transition-colors border border-outline-variant/10">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] uppercase tracking-[0.15em] text-on-surface-variant/50 font-black pb-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Date grid */}
            <div className="grid grid-cols-7 gap-1 mb-6">
              {Array.from({ length: firstOffset }).map((_, i) => (
                <div key={`e${i}`} className="h-10" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((n) => {
                const past    = isPast(n)
                const todayMk = isToday(n)
                const sel     = selectedDate === n
                return (
                  <button
                    key={n}
                    disabled={past}
                    onClick={() => { setSelectedDate(n); setSelectedSlot(null) }}
                    className={`h-10 flex items-center justify-center text-sm rounded-xl font-medium transition-all
                      ${past    ? 'text-on-surface-variant/20 cursor-not-allowed' : ''}
                      ${sel     ? 'bg-primary text-on-primary font-black shadow-lg shadow-primary/30 scale-110' : ''}
                      ${todayMk && !sel ? 'border-2 border-primary text-primary font-bold' : ''}
                      ${!sel && !past && !todayMk ? 'hover:bg-surface-container-high text-on-surface-variant cursor-pointer' : ''}
                    `}
                  >
                    {n}
                  </button>
                )
              })}
            </div>

            {/* Selected date display */}
            <div className="mb-5 px-1">
              <p className="text-xs text-on-surface-variant/60 uppercase tracking-widest font-bold">
                Selected Date
              </p>
              <p className="text-on-surface font-bold text-sm mt-1">
                {MONTHS[month]} {selectedDate}, {year}
              </p>
            </div>

            {/* Time slots */}
            <div className="mt-auto">
              <h4 className="text-xs uppercase tracking-widest text-primary font-black mb-3">
                Available Slots
              </h4>
              <div className="space-y-2">
                {SLOT_OPTIONS.map((slot) => {
                  const isSelected = selectedSlot?.time === slot.time
                  return (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedSlot(isSelected ? null : slot)}
                      className={`w-full text-left p-4 rounded-2xl flex justify-between items-center transition-all ${
                        isSelected
                          ? 'bg-surface-container-high border-2 border-primary shadow-lg'
                          : 'bg-surface-container-low border border-outline-variant/10 hover:bg-surface-container-high'
                      }`}
                    >
                      <div>
                        <p className="text-on-surface font-bold text-sm">{slot.time}</p>
                        <p className="text-on-surface-variant text-xs">{slot.label}</p>
                      </div>
                      <span
                        className="material-symbols-outlined text-primary"
                        style={isSelected ? { fontVariationSettings: "'FILL' 1" } : { opacity: 0.3 }}
                      >
                        {isSelected ? 'check_circle' : 'add_circle'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── MESSAGING ────────────────────────── */}
          <section className="xl:col-span-7 flex flex-col gap-5">
            <div className="flex-1 glass-panel rounded-2xl border border-outline-variant/15 shadow-2xl flex flex-col overflow-hidden min-h-[520px]">

              {/* Chat header */}
              <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                <img src={prof.avatar} className="w-9 h-9 rounded-full" alt="" />
                <div>
                  <p className="text-sm font-bold text-on-surface">{prof.name}</p>
                  <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider">{prof.designation}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider">Online</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                {chatLoading && (
                  <p className="text-sm text-on-surface-variant opacity-60 text-center py-8">Loading conversation…</p>
                )}
                {!chatLoading && messages.length === 0 && (
                  <p className="text-sm text-on-surface-variant opacity-50 text-center py-8">
                    No messages yet. Say hello to {prof.name}.
                  </p>
                )}
                {messages.map((msg) => {
                  if (msg.from === 'system') {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="bg-surface-container-high/70 border border-outline-variant/10 px-4 py-2.5 rounded-2xl max-w-sm text-center">
                          <p className="text-xs text-on-surface-variant leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    )
                  }
                  return msg.from === 'prof' ? (
                    <div key={msg.id} className="flex items-start gap-3">
                      <img src={msg.avatar} className="w-8 h-8 rounded-full shadow-md shrink-0 mt-1" alt="" />
                      <div className="bg-surface-container-low p-4 rounded-3xl rounded-tl-none max-w-sm shadow-sm">
                        <p className="text-sm text-on-surface leading-relaxed">{msg.text}</p>
                        <p className="text-[10px] text-on-surface-variant mt-2 text-right opacity-40">{msg.time}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex items-start gap-3 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0 mt-1">
                        <span className="material-symbols-outlined text-sm text-on-primary-container">person</span>
                      </div>
                      <div className="bg-primary-container/60 p-4 rounded-3xl rounded-tr-none max-w-sm">
                        <p className="text-sm text-on-surface leading-relaxed">{msg.text}</p>
                        <p className="text-[10px] text-on-primary-container/50 mt-2 text-right">{msg.time}</p>
                      </div>
                    </div>
                  )
                })}

                <div ref={messagesEndRef} />
              </div>

              {chatError && (
                <p className="text-xs text-error px-6 pb-2">{chatError}</p>
              )}

              {/* Input */}
              <div className="p-5 bg-surface-container-lowest/50 border-t border-outline-variant/10">
                <div className="flex items-center gap-3 bg-surface-container-high rounded-2xl p-2 pl-5 border border-outline-variant/20 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <input
                    className="bg-transparent border-none focus:ring-0 text-sm text-on-surface flex-1 placeholder:text-on-surface-variant/40 py-1.5 outline-none"
                    placeholder="Type your message..."
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <div className="flex items-center gap-1">
                    <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-lg">attach_file</span>
                    </button>
                    <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-lg">sentiment_satisfied</span>
                    </button>
                    <button
                      onClick={sendMessage}
                      disabled={!message.trim() || chatSending}
                      className="p-2.5 bg-primary rounded-xl text-on-primary hover:brightness-110 active:scale-95 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-lg">send</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA row */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`flex items-center justify-center gap-3 h-16 rounded-2xl border-2 px-4 transition-all ${
                selectedSlot
                  ? 'border-outline-variant/20 bg-surface-container-low'
                  : 'border-outline-variant/10 bg-surface-container-lowest/30'
              }`}>
                {selectedSlot ? (
                  <div className="text-center">
                    <p className="text-xs font-bold text-primary">{selectedSlot.time}</p>
                    <p className="text-[10px] text-on-surface-variant">{selectedSlot.label} · {MONTHS[month]} {selectedDate}</p>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant/40 text-center">Select a date & slot from the calendar</p>
                )}
              </div>

              <button
                onClick={confirmBooking}
                disabled={!selectedSlot || submitting || requestStatus === 'pending' || requestStatus === 'accepted'}
                className={`flex items-center justify-center gap-3 h-16 rounded-2xl font-headline font-extrabold tracking-tight transition-all ${
                  selectedSlot && !submitting && requestStatus !== 'pending' && requestStatus !== 'accepted'
                    ? 'btn-primary'
                    : 'bg-surface-container border border-outline-variant/10 text-on-surface-variant/30 cursor-not-allowed'
                }`}
              >
                {requestStatus === 'accepted' ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Confirmed
                  </>
                ) : requestStatus === 'pending' ? (
                  <>
                    <span className="material-symbols-outlined">hourglass_top</span>
                    Awaiting Response
                  </>
                ) : submitting ? (
                  <>Sending…</>
                ) : (
                  <>
                    Confirm Booking
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Bounce animation for typing dots */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      <BottomNav />
    </div>
  )
}