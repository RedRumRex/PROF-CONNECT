import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import { fetchConversations, markConversationRead, fetchThread, sendMessage as postMessage } from '../api/messages'
import { subscribeToNotifications } from '../api/notifications'
import { getToken, getRole, getProfile } from '../lib/auth'
import useLiveStatus from '../hooks/useLiveStatus'

// A conversation can exist without any appointment ever being booked (the
// booking page lets a student message a professor before requesting a
// session), so this page is backed by GET /api/messages/conversations —
// derived straight from the `message` table — rather than the appointment
// list. See server/app/routers/messages.py.

function dateLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function previewTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Turns a row from GET /api/messages/thread into this page's bubble shape.
function mapThreadMessage(row, myRole) {
  return {
    id: row.message_id,
    from: row.sender_role === myRole ? 'me' : 'them',
    text: row.body,
    time: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    date: dateLabel(row.created_at),
  }
}

// Mirrors server/app/routers/messages.py's _other_id_from_link — a
// message-type notification's link doubles as a pointer to which thread
// it's about, so a live "notification:new" push can be matched against
// the conversation currently open on this page.
function otherIdFromLink(role, link) {
  if (!link) return null
  const match = role === 'student'
    ? link.match(/^\/appointment\/(\d+)$/)
    : link.match(/^\/dashboard\?student_id=(\d+)$/)
  return match ? Number(match[1]) : null
}

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
  const navigate = useNavigate()
  const role = getRole()
  const myId = role === 'student' ? getProfile()?.rollno : getProfile()?.teacher_id

  const [activeId,       setActiveId]       = useState(null)
  const [input,          setInput]          = useState('')
  const [conversations,  setConversations]  = useState([])
  const [listLoading,    setListLoading]    = useState(true)
  const [listError,      setListError]      = useState('')
  const [search,         setSearch]         = useState('')
  const [mobileView,     setMobileView]     = useState('list') // 'list' | 'chat'
  const [messages,       setMessages]       = useState([])
  const [chatLoading,    setChatLoading]    = useState(false)
  const [chatError,      setChatError]      = useState('')
  const [chatSending,    setChatSending]    = useState(false)
  const messagesEndRef = useRef(null)

  const { statusMap } = useLiveStatus() // only meaningful for a student's teacher counterparts

  const active = conversations.find(c => c.id === activeId)

  useEffect(() => {
    if (!getToken()) navigate('/login')
  }, [navigate])

  // ── Load the conversation list ──────────────────────────────────────
  useEffect(() => {
    const token = getToken()
    if (!token) { setListLoading(false); return }
    setListLoading(true)
    setListError('')
    fetchConversations(token)
      .then(setConversations)
      .catch((err) => setListError(err.message || 'Could not load your conversations.'))
      .finally(() => setListLoading(false))
  }, [])

  const loadThread = useCallback((otherId) => {
    const token = getToken()
    if (!token || !myId || !otherId) return
    setChatLoading(true)
    setChatError('')
    const studentId = role === 'student' ? myId : otherId
    const teacherId = role === 'student' ? otherId : myId
    fetchThread(studentId, teacherId, token)
      .then((rows) => setMessages(rows.map((r) => mapThreadMessage(r, role))))
      .catch((err) => setChatError(err.message || 'Could not load this conversation.'))
      .finally(() => setChatLoading(false))
  }, [myId, role])

  // ── Live updates: refresh the list (and the open thread) the instant a
  // new message notification comes in, instead of only on next page load.
  useEffect(() => {
    const token = getToken()
    if (!token || !role) return
    const unsubscribe = subscribeToNotifications(token, (payload) => {
      if (payload.type !== 'message') return
      const otherId = otherIdFromLink(role, payload.link)
      if (otherId != null && otherId === activeId) {
        loadThread(otherId)
        markConversationRead(otherId, token)
          .catch(() => {})
          .finally(() => {
            fetchConversations(token).then(setConversations).catch(() => {})
          })
      } else {
        fetchConversations(token).then(setConversations).catch(() => {})
      }
    })
    return unsubscribe
  }, [role, activeId, loadThread])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, messages])

  const filteredConvos = conversations.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.department || '').toLowerCase().includes(search.toLowerCase())
  )

  const selectConvo = (id) => {
    setActiveId(id)
    setMobileView('chat')
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c))
    loadThread(id)
    const token = getToken()
    if (token) markConversationRead(id, token).catch(() => {})
  }

  const sendMessage = async () => {
    const body = input.trim()
    if (!body || !activeId || chatSending) return
    const token = getToken()
    if (!token) { navigate('/login'); return }

    setInput('')
    setChatSending(true)
    setChatError('')
    try {
      const studentId = role === 'student' ? myId : activeId
      const teacherId = role === 'student' ? activeId : myId
      const sent = await postMessage({ studentId, teacherId, body }, token)
      setMessages(prev => [...prev, mapThreadMessage(sent, role)])
      setConversations(prev => {
        const updated = prev.map(c => c.id === activeId
          ? { ...c, last_message: { body: sent.body, sender_role: sent.sender_role, created_at: sent.created_at } }
          : c
        )
        const idx = updated.findIndex(c => c.id === activeId)
        if (idx > 0) {
          const [item] = updated.splice(idx, 1)
          updated.unshift(item)
        }
        return updated
      })
    } catch (err) {
      setChatError(err.message || 'Could not send that message. Please try again.')
    } finally {
      setChatSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0)
  const avatarFor = (id) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(String(id))}&backgroundColor=321817`

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

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {listLoading && (
                <p className="text-sm text-on-surface-variant opacity-60 text-center py-8">Loading conversations…</p>
              )}

              {!listLoading && listError && (
                <p className="text-xs text-error text-center px-4 py-8">{listError}</p>
              )}

              {!listLoading && !listError && conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-40 px-6 text-center gap-2">
                  <span className="material-symbols-outlined text-4xl mb-1">forum</span>
                  <p className="text-sm">No conversations yet</p>
                  {role === 'student' && (
                    <p className="text-xs opacity-70">Message a professor from their profile to start one.</p>
                  )}
                </div>
              )}

              {!listLoading && !listError && conversations.length > 0 && filteredConvos.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-30">
                  <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                  <p className="text-sm">No results found</p>
                </div>
              )}

              {filteredConvos.map((c) => {
                const isActive = c.id === activeId
                const online = statusMap[c.id]?.status === 'available'
                const fromMe = c.last_message.sender_role === role
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
                        <img src={avatarFor(c.id)} alt={c.name} className="w-full h-full object-cover" />
                      </div>
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${online ? 'bg-tertiary' : 'bg-stone-600'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[13px] font-bold truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                          {c.name || 'Unknown'}
                        </span>
                        <span className={`text-[10px] shrink-0 ml-2 ${c.unread > 0 ? 'text-primary font-semibold' : 'text-on-surface-variant opacity-50'}`}>
                          {previewTime(c.last_message.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-on-surface-variant truncate opacity-55 flex-1">
                          {fromMe
                            ? <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px] text-primary/70" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>{c.last_message.body}</span>
                            : c.last_message.body
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
                    <img src={avatarFor(active.id)} alt={active.name} className="w-full h-full object-cover" />
                  </div>
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${statusMap[active.id]?.status === 'available' ? 'bg-tertiary' : 'bg-stone-600'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-headline font-bold text-[13px] text-on-surface truncate">{active.name || 'Unknown'}</h4>
                  <p className="text-[11px] opacity-50 text-on-surface-variant">
                    {[active.department, active.designation].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-1"
                style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(var(--color-primary-rgb, 200,80,60), 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.015) 0%, transparent 40%)',
                }}
              >
                {chatLoading && (
                  <p className="text-sm text-on-surface-variant opacity-60 text-center py-8">Loading conversation…</p>
                )}

                {!chatLoading && messages.length === 0 && !chatError && (
                  <p className="text-sm text-on-surface-variant opacity-50 text-center py-8">
                    No messages yet. Say hello to {active.name}.
                  </p>
                )}

                {!chatLoading && groupByDate(messages).map((item, i) => {
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
                    <div key={item.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} mb-1`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-full border border-white/[0.1] overflow-hidden shrink-0 mb-0.5 bg-surface-container">
                          <img src={avatarFor(active.id)} alt="" className="w-full h-full object-cover" />
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

              {chatError && (
                <p className="text-xs text-error px-5 pb-2">{chatError}</p>
              )}

              {/* Input bar */}
              <div className="px-4 md:px-5 py-3 border-t border-white/[0.05] bg-surface-container/10 shrink-0">
                <div className="flex items-end gap-2">
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
                      placeholder={`Message ${(active.name || '').split(' ').slice(0, 2).join(' ')}...`}
                      className="w-full bg-white/[0.06] border border-white/[0.09] rounded-2xl px-4 py-2.5 text-sm
                                 focus:ring-1 focus:ring-primary/40 focus:bg-white/[0.09] transition-all
                                 placeholder:text-stone-600 outline-none text-on-surface resize-none leading-relaxed"
                      style={{ maxHeight: '120px' }}
                    />
                  </div>

                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || chatSending}
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
                <p className="text-sm text-on-surface-variant mt-1">
                  {role === 'student' ? 'Choose a professor to view messages' : 'Choose a student to view messages'}
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
