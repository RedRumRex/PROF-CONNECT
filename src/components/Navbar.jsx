import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearRole, getRole } from '../lib/auth'
import useNotifications from '../hooks/useNotifications'

const NAV_LINKS = [
  { to: '/home',                                          label: 'Home'     },
  { to: '/dashboard', pathKey: '/dashboard', teacherOnly: true, label: 'Dashboard' },
  { to: '/home#explore',                                  label: 'Explore'  },
  { to: '/messages', pathKey: '/messages',                label: 'Messages' },
  { to: '/timetable', pathKey: '/timetable',               label: 'Timetable' },
  { to: 'https://www.thapar.edu/students/pages/webkiosk', label: 'Webkiosk', external: true },
  { to: 'https://lms.thapar.edu/moodle/login/index.php', label: 'LMS', external: true }
]

const NOTIFICATION_ICONS = {
  appointment_request:  'event_available',
  appointment_accepted: 'event_available',
  appointment_declined: 'event_busy',
  message:               'mail',
}

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const role = getRole()
  const visibleLinks = NAV_LINKS.filter((link) => !link.teacherOnly || role === 'teacher')

  const handleLogout = () => {
    clearRole()
    navigate('/login')
  }

  const [showNotifications, setShowNotifications] = useState(false)
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications()

  const handleClickNotification = (n) => {
    markRead(n.notification_id)
    setShowNotifications(false)
    if (n.link) navigate(n.link)
  }

  return (
    <nav className="bg-stone-950/60 backdrop-blur-3xl sticky top-0 z-50 border-b border-white/[0.05] shadow-[0_4px_40px_rgba(29,8,7,0.5)]">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">

        <div className="flex items-center gap-8">
          <Link to="/home" className="text-2xl font-black text-primary tracking-tighter font-headline select-none">
            ProfConnect
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {visibleLinks.map((link) => {
              const active = !link.external && pathname === (link.pathKey ?? link.to)

              if (link.external) {
                return (
                  <a
                    key={link.label}
                    href={link.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-stone-400 hover:text-stone-100 hover:bg-white/[0.06]"
                  >
                    {link.label}
                  </a>
                )
              }

              return (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${active ? 'text-primary bg-primary/10 font-bold' : 'text-stone-400 hover:text-stone-100 hover:bg-white/[0.06]'}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="relative p-2 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all active:scale-90"
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary text-[9px] font-black flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-high border border-outline-variant/20 rounded-2xl shadow-2xl z-30 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/10">
                  <h4 className="font-headline font-bold text-sm text-on-surface">Notifications</h4>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-primary font-bold uppercase tracking-wider hover:opacity-80">
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <p className="text-xs text-on-surface-variant opacity-60 text-center py-8">Loading…</p>
                  ) : notifications.length === 0 ? (
                    <p className="text-xs text-on-surface-variant opacity-50 text-center py-8">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.notification_id}
                        onClick={() => handleClickNotification(n)}
                        className={`w-full text-left flex items-start gap-3 px-5 py-4 border-b border-outline-variant/5 transition-colors ${
                          n.read ? 'opacity-50' : 'hover:bg-surface-container-highest'
                        }`}
                      >
                        <span className="material-symbols-outlined text-primary text-lg mt-0.5">
                          {NOTIFICATION_ICONS[n.type] || 'notifications'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-on-surface font-bold">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-on-surface-variant opacity-70 mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-[10px] text-on-surface-variant opacity-40 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Link to="/settings" className="p-2 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all active:scale-90">
  <span className="material-symbols-outlined">settings</span>
</Link>

          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 rounded-full hover:bg-red-500/10 text-stone-400 hover:text-red-400 transition-all active:scale-90"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>

      </div>
    </nav>
  )
}
