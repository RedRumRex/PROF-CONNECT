import { useLocation, Link } from 'react-router-dom'

const ITEMS = [
  { icon: 'dashboard',              to: '/dashboard' },
  { icon: 'explore',                to: '/explore'   },
  { icon: 'menu_book',              to: '/explore'   },
  { icon: 'group',                  to: '/explore'   },
  { icon: 'account_balance_wallet', to: '/explore'   },
]

export default function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-20 bg-stone-950 border-r border-stone-800/20 z-40 items-center py-8 gap-10">
      {/* Brand icon */}
      <div className="text-red-500">
        <span
          className="material-symbols-outlined scale-125"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          network_intelligence
        </span>
      </div>

      {/* Nav icons */}
      <div className="flex flex-col gap-8 text-stone-500">
        {ITEMS.map(({ icon, to }, i) => {
          const active = pathname === to && i === 0
          return (
            <Link key={i} to={to}>
              <span
                className={`material-symbols-outlined cursor-pointer transition-colors
                  ${active ? 'text-red-400' : 'hover:text-red-400'}`}
              >
                {icon}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Bottom */}
      <div className="mt-auto flex flex-col gap-6 text-stone-600">
        <span className="material-symbols-outlined hover:text-red-400 cursor-pointer transition-colors">
          help_center
        </span>
      </div>
    </aside>
  )
}