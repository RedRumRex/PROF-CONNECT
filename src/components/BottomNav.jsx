import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { icon: 'home',     label: 'Home',    to: '/home'      },
  { icon: 'explore',  label: 'Explore', to: '/explore'   },
  { icon: 'bookmark', label: 'Saved',   to: '/explore'   },
  { icon: 'person',   label: 'Profile', to: '/dashboard' },
]

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center p-3 bg-stone-950/80 backdrop-blur-2xl border-t border-white/[0.05] shadow-2xl shadow-black">
      {TABS.map(({ icon, label, to }) => {
        const active = pathname === to
        return (
          <Link
            key={label}
            to={to}
            className={`flex flex-col items-center justify-center px-4 py-1 rounded-xl transition-all active:scale-90 ${
              active
                ? 'text-red-400 bg-red-950/25'
                : 'text-stone-500 hover:text-red-200'
            }`}
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span className="text-[10px] uppercase tracking-widest mt-0.5 font-bold font-label">
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}