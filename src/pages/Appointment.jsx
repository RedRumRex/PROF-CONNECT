import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'

const PROFESSORS = {
  'aris-thorne':   { name: 'Dr. Aris Thorne',    role: 'Neural Engineering Lead',      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ArisThorne&backgroundColor=321817'   },
  'elena-vance':   { name: 'Dr. Elena Vance',     role: 'Theoretical Physics',          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ElenaVance&backgroundColor=321817'   },
  'julian-kross':  { name: 'Prof. Julian Kross',  role: 'Computational Ethics Lead',    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=JulianKross&backgroundColor=321817'  },
  'marcus-wei':    { name: 'Dr. Marcus Wei',      role: 'Cyber-Physical Security',      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=MarcusWei&backgroundColor=321817'    },
  'sarah-jenkins': { name: 'Dr. Sarah Jenkins',   role: 'Genomic Computing Lead',       avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=SarahJenkins&backgroundColor=321817' },
  'arthur-dent':   { name: 'Prof. Arthur Dent',   role: 'Astronomy & Comp. Logic',      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ArthurDent&backgroundColor=321817'   },
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
  const prof     = PROFESSORS[id] ?? PROFESSORS['aris-thorne']

  const today = new Date()
  const [year,         setYear]         = useState(today.getFullYear())
  const [month,        setMonth]        = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(today.getDate())
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [message,      setMessage]      = useState('')
  const [messages,     setMessages]     = useState([
    {
      id: 1,
      from: 'prof',
      avatar: prof.avatar,
      text: `Hello! I'm looking forward to our session. Please select a date and time slot that works best for you, and feel free to share any topics you'd like to discuss.`,
      time: '10:42 AM',
    },
  ])
  const [booked,       setBooked]       = useState(false)
  const [isTyping,     setIsTyping]     = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

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
  const sendMessage = () => {
    if (!message.trim()) return
    const userMsg = {
      id:   Date.now(),
      from: 'user',
      text: message.trim(),
      time: formatTime(),
    }
    setMessages(prev => [...prev, userMsg])
    setMessage('')
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      const replies = [
        "Thank you for reaching out! I'll review your message and get back to you shortly.",
        "Great, that sounds good. I'll make sure to prepare relevant materials for our session.",
        "Noted! Please also check the available time slots on the calendar to confirm a meeting.",
        "Thanks for the context — this will help me prepare a more focused session for you.",
      ]
      setMessages(prev => [...prev, {
        id:     Date.now() + 1,
        from:   'prof',
        avatar: prof.avatar,
        text:   replies[Math.floor(Math.random() * replies.length)],
        time:   formatTime(),
      }])
    }, 1500)
  }

  // ── Confirm booking ─────────────────────────────
  const confirmBooking = () => {
    if (!selectedSlot) return
    setBooked(true)
    setMessages(prev => [...prev, {
      id:     Date.now(),
      from:   'prof',
      avatar: prof.avatar,
      text:   `Your session has been confirmed for ${MONTHS[month]} ${selectedDate}, ${year} at ${selectedSlot.time}. Looking forward to our ${selectedSlot.label}!`,
      time:   formatTime(),
    }])
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
              <p className="text-primary text-sm font-medium">{prof.role}</p>
            </div>
          </div>
        </div>

        {/* ── BOOKING CONFIRMED BANNER ───────────── */}
        {booked && (
          <div className="mb-8 p-5 rounded-2xl bg-tertiary-container/20 border border-tertiary/20 flex items-center gap-4">
            <span className="material-symbols-outlined text-tertiary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <div>
              <p className="font-headline font-bold text-on-surface">Booking Confirmed!</p>
              <p className="text-sm text-on-surface-variant">
                {MONTHS[month]} {selectedDate}, {year} · {selectedSlot?.time} · {selectedSlot?.label} with {prof.name}
              </p>
            </div>
            <button
              onClick={() => navigate('/explore')}
              className="ml-auto btn-primary px-5 py-2 text-sm"
            >
              Browse More
            </button>
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
                  <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider">{prof.role}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider">Online</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-6 space-y-5 overflow-y-auto">
                {messages.map((msg) =>
                  msg.from === 'prof' ? (
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
                )}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex items-start gap-3">
                    <img src={prof.avatar} className="w-8 h-8 rounded-full shadow-md shrink-0 mt-1" alt="" />
                    <div className="bg-surface-container-low p-4 rounded-3xl rounded-tl-none shadow-sm">
                      <div className="flex items-center gap-1.5 h-4">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-on-surface-variant/40"
                            style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

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
                      disabled={!message.trim()}
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
                disabled={!selectedSlot || booked}
                className={`flex items-center justify-center gap-3 h-16 rounded-2xl font-headline font-extrabold tracking-tight transition-all ${
                  selectedSlot && !booked
                    ? 'btn-primary'
                    : 'bg-surface-container border border-outline-variant/10 text-on-surface-variant/30 cursor-not-allowed'
                }`}
              >
                {booked ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Booked!
                  </>
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