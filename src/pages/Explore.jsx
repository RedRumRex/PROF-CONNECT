import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import useLiveStatus from '../hooks/useLiveStatus'


const ALL_PROFESSORS = [
  {
    id: 'aris-thorne',
    name: 'Dr. Aris Thorne',
    department: 'Department of Neural Engineering',
    hIndex: 58,
    status: 'available',
    tags: ['Neural Networks', 'Cognitive AI', 'Bio-electronics'],
    bio: 'Research focusing on bridging synaptic gaps using polymorphic carbon-nanotube interfaces and large-scale AI modeling.',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ArisThorne&backgroundColor=321817',
    filters: ['Artificial Intelligence', 'Computer Science'],
  },
  {
    id: 'elena-vance',
    name: 'Dr. Elena Vance',
    department: 'Theoretical Physics & Data Science',
    hIndex: 42,
    status: 'busy',
    tags: ['Quantum Computing', 'Big Data'],
    bio: 'Exploration of quantum algorithmic efficiency in processing multi-petabyte astrophysical datasets for dark matter detection.',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ElenaVance&backgroundColor=321817',
    filters: ['Quantum Physics', 'Computer Science'],
  },
  {
    id: 'julian-kross',
    name: 'Prof. Julian Kross',
    department: 'Ethics & Autonomous Systems',
    hIndex: 91,
    status: 'available',
    tags: ['AI Policy', 'Robotics', 'Machine Ethics'],
    bio: 'Defining the moral framework for autonomous vehicles and multi-agent systems in high-density urban environments.',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=JulianKross&backgroundColor=321817',
    filters: ['Artificial Intelligence', 'Computer Science'],
  },
  {
    id: 'marcus-wei',
    name: 'Dr. Marcus Wei',
    department: 'Cyber-Physical Security',
    hIndex: 31,
    status: 'available',
    tags: ['Cryptography', 'Blockchain'],
    bio: 'Developing post-quantum cryptographic standards for secure energy grid distribution and decentralized governance.',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=MarcusWei&backgroundColor=321817',
    filters: ['Computer Science', 'Quantum Physics'],
  },
  {
    id: 'sarah-jenkins',
    name: 'Dr. Sarah Jenkins',
    department: 'Genomic Computing',
    hIndex: 64,
    status: 'away',
    tags: ['CRISPR', 'Bio-informatics', 'Ethics'],
    bio: 'Leading the Pan-Genome project to map genetic variance across isolated populations using high-throughput sequencing.',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=SarahJenkins&backgroundColor=321817',
    filters: ['Neuroscience', 'Computer Science'],
  },
  {
    id: 'arthur-dent',
    name: 'Prof. Arthur Dent',
    department: 'Astronomy & Computational Logic',
    hIndex: 102,
    status: 'available',
    tags: ['Cosmology', 'Algorithmics'],
    bio: 'Advancing the search for habitable exoplanets through automated spectral analysis and deep-space telemetry synthesis.',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ArthurDent&backgroundColor=321817',
    filters: ['Computer Science', 'Quantum Physics'],
  },
]

const ALL_FILTERS   = ['Artificial Intelligence', 'Computer Science', 'Neuroscience', 'Quantum Physics']
const STATUS_COLORS = { available: 'bg-green-500', busy: 'bg-amber-500', away: 'bg-rose-600' }
const SORT_OPTIONS  = [
  { value: 'hIndex-desc', label: 'H-Index: High → Low' },
  { value: 'hIndex-asc',  label: 'H-Index: Low → High' },
  { value: 'name-asc',    label: 'Name: A → Z'         },
  { value: 'name-desc',   label: 'Name: Z → A'         },
]

export default function Explore() {
  const navigate = useNavigate()

  const [search,       setSearch]       = useState('')
  const [activeFilters,setActiveFilters]= useState([])
  const [saved,        setSaved]        = useState(new Set(['julian-kross']))
  const [sort,         setSort]         = useState('hIndex-desc')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Live availability pushed from professors' door-mounted Raspberry Pi units.
  const { statusMap, connected } = useLiveStatus()

  // ── Toggle filter chip ──────────────────────────
  const toggleFilter = (f) => {
    setActiveFilters((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    )
  }

  // ── Toggle bookmark ─────────────────────────────
  const toggleSave = (id, e) => {
    e.stopPropagation()
    setSaved((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Filtered + sorted list ──────────────────────
  const results = useMemo(() => {
    // Overlay live door-unit status on top of the static seed data.
    let list = ALL_PROFESSORS.map((p) => ({
      ...p,
      status: statusMap[p.id]?.status ?? p.status,
    }))

    // search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      )
    }

    // filter chips
    if (activeFilters.length > 0) {
      list = list.filter((p) =>
        activeFilters.every((f) => p.filters.includes(f))
      )
    }

    // status
    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter)
    }

    // sort
    list.sort((a, b) => {
      if (sort === 'hIndex-desc') return b.hIndex - a.hIndex
      if (sort === 'hIndex-asc')  return a.hIndex - b.hIndex
      if (sort === 'name-asc')    return a.name.localeCompare(b.name)
      if (sort === 'name-desc')   return b.name.localeCompare(a.name)
      return 0
    })

    return list
  }, [search, activeFilters, statusFilter, sort, statusMap])

  const currentSort = SORT_OPTIONS.find((o) => o.value === sort)

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-12 pb-28 lg:pb-12">

        {/* ── PAGE HEADER ──────────────────────────── */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tighter">
              Explore <span className="text-primary">Experts</span>
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                connected
                  ? 'bg-tertiary-container/20 text-tertiary border-tertiary/20'
                  : 'bg-surface-container-highest text-on-surface-variant/50 border-outline-variant/10'
              }`}
              title={connected ? 'Receiving live availability from door units' : 'Live status unavailable — showing last known status'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-tertiary animate-pulse' : 'bg-on-surface-variant/30'}`} />
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* ── SEARCH BAR ───────────────────────── */}
          <div className="relative mb-5">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, department, or keyword..."
              className="input-base w-full py-3.5 pl-12 pr-12 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>

          {/* ── FILTERS ROW ──────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Filter chips */}
            {ALL_FILTERS.map((f) => {
              const on = activeFilters.includes(f)
              return (
                <button
                  key={f}
                  onClick={() => toggleFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all duration-150 ${
                    on
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {f}
                  {on && <span className="material-symbols-outlined text-[14px]">close</span>}
                </button>
              )
            })}

            {/* Clear all filters */}
            {activeFilters.length > 0 && (
              <button
                onClick={() => setActiveFilters([])}
                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
              >
                Clear all
              </button>
            )}
          </div>

          {/* ── TOOLBAR ROW ──────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">

              {/* Status filter */}
              <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-1">
                {[
                  { value: 'all',       label: 'All'       },
                  { value: 'available', label: 'Available' },
                  { value: 'busy',      label: 'Busy'      },
                  { value: 'away',      label: 'Away'      },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === value
                        ? 'bg-primary-container text-on-primary-container'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {value !== 'all' && (
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_COLORS[value]}`} />
                    )}
                    {label}
                  </button>
                ))}
              </div>

              {/* Result count */}
              <span className="text-on-surface-variant text-sm">
                <span className="font-semibold text-primary">{results.length}</span> result{results.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high border border-outline-variant/20 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">sort</span>
                {currentSort.label}
                <span className="material-symbols-outlined text-base">
                  {showSortMenu ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-surface-container-high border border-outline-variant/20 rounded-xl overflow-hidden z-20 shadow-2xl">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSort(opt.value); setShowSortMenu(false) }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                        sort === opt.value
                          ? 'text-primary bg-primary-container/20'
                          : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                      }`}
                    >
                      {opt.label}
                      {sort === opt.value && (
                        <span className="material-symbols-outlined text-primary text-base">check</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── PROFESSOR GRID ───────────────────────── */}
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">
              search_off
            </span>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No results found</h3>
            <p className="text-on-surface-variant text-sm opacity-60 mb-6">
              Try adjusting your search or removing some filters.
            </p>
            <button
              onClick={() => { setSearch(''); setActiveFilters([]); setStatusFilter('all') }}
              className="btn-primary px-6 py-3 text-sm"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((prof) => (
              <article
                key={prof.id}
                className="glass-card p-6 rounded-2xl flex flex-col group"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                      <img
                        src={prof.avatar}
                        alt={prof.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface-container-highest ${STATUS_COLORS[prof.status] ?? 'bg-stone-500'}`}
                      title={prof.status}
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold block">
                      H-Index
                    </span>
                    <span className="text-2xl font-black text-primary leading-none">{prof.hIndex}</span>
                  </div>
                </div>

                {/* Name + dept */}
                <h3 className="font-headline text-lg font-bold text-on-surface mb-0.5">{prof.name}</h3>
                <p className="text-on-surface-variant text-sm mb-4">{prof.department}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {prof.tags.map((tag) => (
                    <span
                      key={tag}
                      onClick={() => setSearch(tag)}
                      className="bg-surface-container-lowest/60 text-[11px] px-2.5 py-1 rounded text-stone-300 border border-outline-variant/10 cursor-pointer hover:border-primary/30 hover:text-primary transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Bio */}
                <p className="text-xs text-stone-500 leading-relaxed line-clamp-2 mb-6 flex-grow">
                  {prof.bio}
                </p>

                {/* Status badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[prof.status]}`} />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60 capitalize">
                    {prof.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/profile/${prof.id}`)}
                    className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">person</span>
                    Full Profile
                  </button>
                  <button
                    onClick={() => navigate(`/appointment/${prof.id}`)}
                    className="px-3 rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary active:scale-90"
                    title="Book appointment"
                  >
                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                  </button>
                  <button
                    onClick={(e) => toggleSave(prof.id, e)}
                    className="px-3 rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary active:scale-90"
                    title={saved.has(prof.id) ? 'Unsave' : 'Save'}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={saved.has(prof.id) ? { fontVariationSettings: "'FILL' 1", color: '#ffb4a8' } : {}}
                    >
                      bookmark
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── SAVED SECTION ────────────────────────── */}
        {saved.size > 0 && activeFilters.length === 0 && !search && statusFilter === 'all' && (
          <div className="mt-16 pt-10 border-t border-outline-variant/10">
            <h2 className="font-headline text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                bookmark
              </span>
              Saved Professors
              <span className="text-sm font-normal text-on-surface-variant ml-1">({saved.size})</span>
            </h2>
            <div className="flex flex-wrap gap-3">
              {ALL_PROFESSORS.filter((p) => saved.has(p.id)).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/profile/${p.id}`)}
                  className="flex items-center gap-3 px-4 py-3 glass-card rounded-xl hover:border-primary/30 transition-all"
                >
                  <img src={p.avatar} className="w-8 h-8 rounded-lg" alt={p.name} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">{p.name}</p>
                    <p className="text-[10px] text-on-surface-variant">{p.department}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}