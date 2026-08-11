import { useState, useEffect, useRef } from 'react'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'

const CONVERSATIONS = [
  {
    id: 1,
    name: 'Prof. Ananya Sharma',
    dept: 'Quantum Informatics',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Sharma&backgroundColor=321817',
    online: true,
    unread: 2,
    messages: [
      { from: 'them', text: 'Hello! I reviewed your thesis draft. Overall structure looks great.', time: '10:02 AM', date: 'Yesterday' },
      { from: 'me',   text: 'Thank you Professor! Should I revise the methodology section?', time: '10:15 AM', date: 'Yesterday' },
      { from: 'them', text: 'Yes, please elaborate on the quantum gate coherence part. Also cite the 2023 Nielsen paper.', time: '10:18 AM', date: 'Yesterday' },
      { from: 'me',   text: 'Understood, I will update it by tomorrow.', time: '10:20 AM', date: 'Yesterday' },
      { from: 'them', text: 'Perfect. Also do not forget the seminar on Wednesday - attendance is mandatory.', time: '10:45 AM', date: 'Today' },
      { from: 'them', text: 'Send me the revised draft before the seminar.', time: '10:46 AM', date: 'Today' },
    ],
  },
  {
    id: 2,
    name: 'Prof. Rajiv Mehta',
    dept: 'Advanced AI & ML',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Mehta&backgroundColor=0a1628',
    online: false,
    unread: 0,
    messages: [
      { from: 'me',   text: 'Sir, I had a question regarding the backpropagation assignment.', time: '9:00 AM', date: 'Mon' },
      { from: 'them', text: 'Sure, what is the issue?', time: '9:05 AM', date: 'Mon' },
      { from: 'me',   text: 'The gradient descent is not converging for the deeper layers.', time: '9:10 AM', date: 'Mon' },
      { from: 'them', text: 'Try reducing the learning rate to 1e-4 and adding batch normalization before each ReLU.', time: '9:15 AM', date: 'Tue' },
      { from: 'me',   text: 'That fixed it! Thank you so much sir.', time: '9:20 AM', date: 'Tue' },
      { from: 'them', text: 'Good. Document this in your report as an ablation study.', time: '9:22 AM', date: 'Tue' },
    ],
  },
  {
    id: 3,
    name: 'Prof. Simran Kaur',
    dept: 'Distributed Systems',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Kaur&backgroundColor=0d1f0d',
    online: true,
    unread: 1,
    messages: [
      { from: 'them', text: 'Your project proposal has been approved. You can begin implementation.', time: '3:00 PM', date: 'Yesterday' },
      { from: 'me',   text: 'Thank you Professor Kaur! We will start with the consensus module.', time: '3:10 PM', date: 'Yesterday' },
      { from: 'them', text: 'Good choice. Keep me updated weekly. First check-in is next Friday.', time: '3:15 PM', date: 'Yesterday' },
    ],
  },
  {
    id: 4,
    name: 'Prof. Vikram Bose',
    dept: 'Computer Architecture',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Bose&backgroundColor=1a0a28',
    online: false,
    unread: 0,
    messages: [
      { from: 'me',   text: 'Sir, requesting a re-evaluation of my mid-sem paper.', time: '11:00 AM', date: 'Last Week' },
      { from: 'them', text: 'I have reviewed it. Your answer to Q4 was partially correct, adding 3 marks.', time: '2:00 PM', date: 'Last Week' },
      { from: 'me',   text: 'Thank you sir, I appreciate it.', time: '2:05 PM', date: 'Last Week' },
    ],
  },
  {
    id: 5,
    name: 'Prof. Deepa Nair',
    dept: 'Data Science & Analytics',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Nair&backgroundColor=0a1a1a',
    online: true,
    unread: 3,
    messages: [
      { from: 'them', text: 'The dataset for your capstone project has been uploaded to the portal.', time: '8:00 AM', date: 'Today' },
      { from: 'them', text: 'Please ensure you handle the missing values before running any models.', time: '8:01 AM', date: 'Today' },
      { from: 'them', text: 'Office hours are at 4 PM today if you need help getting started.', time: '8:02 AM', date: 'Today' },
    ],
  },
]

function groupByDate(messages) {
  const groups = []
  let currentDate = null
  messages.forEach(msg => {
    if (msg.date !== currentDate) {
      currentDate = msg.date
      groups.push({ type: 'date', label: msg.date })
    }
    groups.push({ type: 'msg', ...msg })
  })
  return groups
}

export default function Messages() {
  const [activeId,      setActiveId]      = useState(null)
  const [input,         setInput]         = useState('')
  const [convos,        setConvos]        = useState(CONVERSATIONS)
  const [search,        setSearch]        = useState('')
  const [mobileView,    setMobileView]    = useState('list') // 'list' | 'chat'
  const messagesEndRef = useRef(null)

  const active = convos.find(c => c.id === activeId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, convos])

  const filteredConvos = convos.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dept.toLowerCase().includes(search.toLowerCase())
  )

  const selectConvo = (id) => {
    setActiveId(id)
    setMobileView('chat')
    setConvos(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c))
  }

  const sendMessage = () => {
    if (!input.trim() || !activeId) return
    setConvos(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: [...c.messages, { from: 'me', text: input.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: 'Today' }] }
        : c
    ))
    setInput('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const totalUnread = convos.reduce((sum, c) => sum + c.unread, 0)

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 lg:pb-8">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-headline font-extrabold tracking-tighter text-on-surface">Messages</h2>
            <p className="text-on-surface-variant text-sm mt-0.5 opacity-60">
              {totalUnread > 0 ? `${totalUnread} unread message${totalUnread > 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          <button className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-white/[0.05] text-stone-400 hover:text-stone-100 transition-all">
            <span className="material-symbols-outlined text-[20px]">edit_square</span>
          </button>
        </div>

        {/* Main Container */}
        <div
          className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden flex"
          style={{ height: 'calc(100vh - 230px)', minHeight: '560px' }}
        >

          {/* ── SIDEBAR ── */}
          <div className={`
            flex flex-col border-r border-white/[0.06]
            ${activeId ? 'hidden md:flex md:w-72 lg:w-80' : 'flex w-full md:w-72 lg:w-80'}
          `}>

            {/* Search bar */}
            <div className="p-3 border-b border-white/[0.05]">
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-[16px] group-focus-within:text-primary transition-colors pointer-events-none">
                  search
                </span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm
                             focus:ring-1 focus:ring-primary/40 focus:bg-white/[0.08] transition-all
                             placeholder:text-stone-600 outline-none text-on-surface"
                  placeholder="Search conversations..."
                  type="text"
                />
              </div>
            </div>

            {/* Professor list */}
            <div className="flex-1 overflow-y-auto">
              {filteredConvos.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-30">
                  <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                  <p className="text-sm">No results found</p>
                </div>
              )}
              {filteredConvos.map((c, idx) => {
                const last     = c.messages[c.messages.length - 1]
                const isActive = c.id === activeId
                return (
                  <button
                    key={c.id}
                    onClick={() => selectConvo(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all relative
                                border-b border-white/[0.03]
                                ${isActive
                                  ? 'bg-primary/10 border-l-[3px] border-l-primary'
                                  : 'hover:bg-white/[0.04] border-l-[3px] border-l-transparent'
                                }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full border border-white/[0.12] overflow-hidden bg-surface-container">
                        <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${c.online ? 'bg-tertiary' : 'bg-stone-600'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[13px] font-bold truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                          {c.name}
                        </span>
                        <span className={`text-[10px] shrink-0 ml-2 ${c.unread > 0 ? 'text-primary font-semibold' : 'text-on-surface-variant opacity-50'}`}>
                          {last.time}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-on-surface-variant truncate opacity-55 flex-1">
                          {last.from === 'me'
                            ? <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px] text-primary/70" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>{last.text}</span>
                            : last.text
                          }
                        </p>
                        {c.unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-black flex items-center justify-center">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── CHAT PANEL ── */}
          {activeId && active ? (
            <div className="flex-1 flex flex-col min-w-0">

              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] bg-surface-container/20 shrink-0">
                {/* Back button (mobile) */}
                <button
                  onClick={() => { setActiveId(null); setMobileView('list') }}
                  className="md:hidden p-1.5 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>

                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full border border-white/[0.12] overflow-hidden bg-surface-container">
                    <img src={active.avatar} alt={active.name} className="w-full h-full object-cover" />
                  </div>
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${active.online ? 'bg-tertiary' : 'bg-stone-600'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-headline font-bold text-[13px] text-on-surface truncate">{active.name}</h4>
                  <p className="text-[11px] opacity-50 text-on-surface-variant">
                    {active.dept} &middot; {active.online ? 'Online' : 'Last seen recently'}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button className="p-2 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all active:scale-90">
                    <span className="material-symbols-outlined text-[19px]">videocam</span>
                  </button>
                  <button className="p-2 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all active:scale-90">
                    <span className="material-symbols-outlined text-[19px]">call</span>
                  </button>
                  <button className="p-2 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all active:scale-90">
                    <span className="material-symbols-outlined text-[19px]">more_vert</span>
                  </button>
                </div>
              </div>

              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-1"
                style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(var(--color-primary-rgb, 200,80,60), 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.015) 0%, transparent 40%)',
                }}
              >
                {groupByDate(active.messages).map((item, i) => {
                  if (item.type === 'date') {
                    return (
                      <div key={'date-' + i} className="flex items-center justify-center py-3">
                        <span className="px-3 py-1 rounded-full bg-surface-container-high border border-white/[0.06] text-[10px] text-on-surface-variant opacity-60 font-medium">
                          {item.label}
                        </span>
                      </div>
                    )
                  }

                  const isMe = item.from === 'me'
                  return (
                    <div key={i} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} mb-1`}>
                      {/* Avatar — only for them, only if next msg is different sender or date */}
                      {!isMe && (
                        <div className="w-7 h-7 rounded-full border border-white/[0.1] overflow-hidden shrink-0 mb-0.5 bg-surface-container">
                          <img src={active.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className={`flex flex-col gap-0.5 max-w-[70%] md:max-w-[60%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`
                          px-3.5 py-2.5 text-sm leading-relaxed
                          ${isMe
                            ? 'bg-primary text-on-primary rounded-2xl rounded-br-sm shadow-lg'
                            : 'bg-surface-container-high text-on-surface rounded-2xl rounded-bl-sm border border-white/[0.07]'
                          }
                        `}>
                          {item.text}
                        </div>
                        <div className={`flex items-center gap-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[10px] text-on-surface-variant opacity-35">{item.time}</span>
                          {isMe && (
                            <span className="material-symbols-outlined text-[12px] text-primary/50" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="px-4 md:px-5 py-3 border-t border-white/[0.05] bg-surface-container/10 shrink-0">
                <div className="flex items-end gap-2">
                  <button className="p-2 rounded-full hover:bg-white/[0.06] text-stone-500 hover:text-stone-300 transition-all shrink-0 mb-0.5">
                    <span className="material-symbols-outlined text-[20px]">attach_file</span>
                  </button>

                  <div className="flex-1 relative">
                    <textarea
                      rows={1}
                      value={input}
                      onChange={e => {
                        setInput(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                      }}
                      onKeyDown={handleKey}
                      placeholder={'Message ' + active.name.split(' ').slice(0, 2).join(' ') + '...'}
                      className="w-full bg-white/[0.06] border border-white/[0.09] rounded-2xl px-4 py-2.5 text-sm
                                 focus:ring-1 focus:ring-primary/40 focus:bg-white/[0.09] transition-all
                                 placeholder:text-stone-600 outline-none text-on-surface resize-none leading-relaxed"
                      style={{ maxHeight: '120px' }}
                    />
                  </div>

                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="btn-primary p-2.5 rounded-full disabled:opacity-25 disabled:cursor-not-allowed shrink-0 mb-0.5
                               flex items-center justify-center active:scale-90 transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* Empty state — no chat selected (desktop) */
            <div className="flex-1 hidden md:flex flex-col items-center justify-center opacity-30 gap-4">
              <span className="material-symbols-outlined text-6xl">forum</span>
              <div className="text-center">
                <p className="font-headline font-bold text-lg">Select a conversation</p>
                <p className="text-sm text-on-surface-variant mt-1">Choose a professor to view messages</p>
              </div>
            </div>
          )}

        </div>
      </main>

      <BottomNav />
    </div>
  )
}