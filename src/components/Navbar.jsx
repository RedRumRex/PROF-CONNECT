import { Link, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/home',                                          label: 'Home'     },
  { to: '/explore',                                       label: 'Explore'  },
  { to: '/messages', pathKey: '/messages',                label: 'Messages' },
  { to: 'https://www.thapar.edu/students/pages/webkiosk', label: 'Webkiosk', external: true },
  { to: 'https://lms.thapar.edu/moodle/login/index.php', label: 'LMS', external: true }
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-stone-950/60 backdrop-blur-3xl sticky top-0 z-50 border-b border-white/[0.05] shadow-[0_4px_40px_rgba(29,8,7,0.5)]">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">

        <div className="flex items-center gap-8">
          <Link to="/home" className="text-2xl font-black text-primary tracking-tighter font-headline select-none">
            ProfConnect
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
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
          <div className="relative hidden lg:block group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-[18px] group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              className="bg-white/[0.05] border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:ring-1 focus:ring-primary/50 focus:bg-white/10 transition-all placeholder:text-stone-600 outline-none text-on-surface"
              placeholder="Discovery"
              type="text"
            />
          </div>

          <button className="p-2 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all active:scale-90">
            <span className="material-symbols-outlined">notifications</span>
          </button>

          <Link to="/settings" className="p-2 rounded-full hover:bg-white/[0.06] text-stone-400 hover:text-stone-100 transition-all active:scale-90">
  <span className="material-symbols-outlined">settings</span>
</Link>

          <Link
            to="/profile"
            className="w-9 h-9 rounded-full border border-white/10 overflow-hidden hover:border-primary/50 transition-colors"
            title="View Profile"
          >
            <img
              src="https://api.dicebear.com/9.x/notionists/svg?seed=ProfConnect&backgroundColor=321817"
              alt="Profile avatar"
              className="w-full h-full object-cover"
            />
          </Link>
        </div>

      </div>
    </nav>
  )
}