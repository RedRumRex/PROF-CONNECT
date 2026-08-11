import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'

const TIMETABLE = [
  { day: 'Mon', time: '09:00–11:30', title: 'Quantum Computing', room: 'Lab 402',        color: 'border-primary-container' },
  { day: 'Tue', time: null,          title: null,                 room: null,             color: null                       },
  { day: 'Wed', time: '10:00–12:00', title: 'Thesis Reviews',    room: 'Office B12',     color: 'border-primary-container' },
  { day: 'Thu', time: '14:00–16:30', title: 'Advanced AI',       room: 'Lecture Hall 1', color: 'border-tertiary'          },
  { day: 'Fri', time: '09:00–11:30', title: 'Quantum Computing', room: 'Lab 402',        color: 'border-primary-container' },
]

const INITIAL_RESOURCES = [
  { icon: 'folder_zip',  title: 'Resource Pack v2', sub: 'Quantum basics', downloaded: false },
  { icon: 'assignment',  title: 'Assignment #4',    sub: 'Due in 3 days',  downloaded: false },
  { icon: 'groups',      title: 'Seminar Group',    sub: '12 Members',     downloaded: false },
]

const NOTIFICATIONS = [
  { id: 1, text: 'Assignment #4 deadline in 3 days',        icon: 'warning',       read: false },
  { id: 2, text: 'New resource uploaded: Quantum Pack v2',  icon: 'folder_zip',    read: false },
  { id: 3, text: 'Thesis review confirmed for Wednesday',   icon: 'event_available', read: true },
]

export default function Dashboard() {
  const navigate = useNavigate()

  const [resources,         setResources]         = useState(INITIAL_RESOURCES)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications,     setNotifications]     = useState(NOTIFICATIONS)
  const [messageOpen,       setMessageOpen]       = useState(false)
  const [messageText,       setMessageText]       = useState('')
  const [messageSent,       setMessageSent]       = useState(false)
  const [abstract,          setAbstract]          = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

  const handleResource = (title) => {
    setResources(prev =>
      prev.map(r => r.title === title ? { ...r, downloaded: true } : r)
    )
  }

  const sendMessage = () => {
    if (!messageText.trim()) return
    setMessageSent(true)
    setMessageText('')
    setTimeout(() => { setMessageSent(false); setMessageOpen(false) }, 2500)
  }

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
              Prof. Sharma
            </h2>
            <p className="text-on-surface-variant text-lg leading-relaxed max-w-xl opacity-80">
              Head of Quantum Informatics. Dedicated to bridging the gap between theoretical physics and neural architecture.
            </p>
          </div>

          <div className="flex gap-3 w-full md:w-auto flex-wrap">
            <button
              onClick={() => navigate('/appointment/aris-thorne')}
              className="btn-primary flex-1 md:flex-none px-6 py-4 flex items-center justify-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-lg">event_available</span>
              Book Appointment
            </button>
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

        {/* ── MAIN GRID ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Timetable */}
          <div className="lg:col-span-8 glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-headline font-bold text-on-surface">Weekly Timetable</h3>
                <p className="text-on-surface-variant text-sm">Academic Semester Fall 2024</p>
              </div>
              <span className="px-3 py-1 rounded bg-surface-container-highest text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                Office Hours: 2PM–4PM
              </span>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {TIMETABLE.map(({ day, time, title, room, color }) => (
                <div key={day} className="space-y-4">
                  <span className="text-[10px] text-on-surface-variant font-black uppercase opacity-40">{day}</span>
                  {time ? (
                    <div className={`h-32 rounded-xl bg-surface-container/80 border-l-2 ${color} p-3 space-y-1.5 hover:bg-surface-container transition-colors cursor-pointer`}>
                      <p className="text-[10px] font-bold text-primary">{time}</p>
                      <p className="text-xs font-headline font-bold leading-snug">{title}</p>
                      <p className="text-[9px] text-on-surface-variant">{room}</p>
                    </div>
                  ) : (
                    <div className="h-32 rounded-xl bg-surface-container-low border border-outline-variant/5 flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant/20">coffee</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Side panels */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* Latest publication */}
            <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">clinical_notes</span>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm">Latest Publication</h4>
                  <p className="text-xs text-on-surface-variant">September 2024</p>
                </div>
              </div>
              <p className="text-sm font-medium mb-4 leading-relaxed">
                "Neural Superposition: The next frontier in silicon-based quantum logic gates."
              </p>
              {abstract ? (
                <div className="text-xs text-on-surface-variant leading-relaxed mb-3 p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                  This paper investigates polymorphic superposition states in silicon-based quantum gates, proposing a novel architecture that achieves 94% coherence fidelity at room temperature using CNT lattice scaffolding.
                </div>
              ) : null}
              <button
                onClick={() => setAbstract(v => !v)}
                className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:gap-3 transition-all"
              >
                {abstract ? 'Hide Abstract' : 'Read Abstract'}
                <span className="material-symbols-outlined text-sm">
                  {abstract ? 'expand_less' : 'arrow_forward'}
                </span>
              </button>
            </div>

            {/* Availability */}
            <div className="flex-1 bg-surface-container-high rounded-2xl p-6 border border-outline-variant/20">
              <h4 className="font-headline font-bold mb-5">Availability Overview</h4>
              <div className="space-y-5">
                {[
                  { label: 'Morning Slots',   value: 'Full',        color: 'bg-error-container',    width: 'w-full'  },
                  { label: 'Afternoon Slots', value: '4 Available', color: 'bg-tertiary-container', width: 'w-[40%]' },
                ].map(({ label, value, color, width }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-on-surface-variant">{label}</span>
                      <span className={value === 'Full' ? 'text-error font-bold' : 'text-tertiary font-bold'}>
                        {value}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                      <div className={`h-full ${color} ${width} rounded-full`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-outline-variant/10">
                <button
                  onClick={() => navigate('/appointment/aris-thorne')}
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  Book a Slot
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant leading-relaxed italic opacity-60 mt-3">
                *Typically responds within 24 business hours.
              </p>
            </div>
          </div>
        </div>

        {/* ── RESOURCE CARDS ───────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {resources.map(({ icon, title, sub, downloaded }) => (
            <button
              key={title}
              onClick={() => handleResource(title)}
              className={`bg-surface-container-lowest border border-outline-variant/10 p-6 rounded-2xl
                         flex items-center gap-4 hover:bg-surface-container transition-colors cursor-pointer group text-left
                         ${downloaded ? 'border-primary/20' : ''}`}
            >
              <span className={`material-symbols-outlined text-3xl transition-opacity ${downloaded ? 'text-primary opacity-100' : 'opacity-30 group-hover:opacity-100'}`}
                style={downloaded ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {downloaded ? 'check_circle' : icon}
              </span>
              <div>
                <h5 className="text-sm font-bold">{title}</h5>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">
                  {downloaded ? 'Accessed ✓' : sub}
                </p>
              </div>
            </button>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  )
}