import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import { getMe } from '../api/auth'
import { fetchTeachers } from '../api/teachers'
import { getToken, getProfile, setProfile as persistProfile } from '../lib/auth'
import { mapStudentProfile, mapTeacherCard } from '../lib/profile'
import useLiveStatus from '../hooks/useLiveStatus'

const STATS = [
  { value: '1,200+', label: 'Active Researchers', sub: 'PhD faculty and scholars dedicated to pushing the boundaries of engineering and science.',         icon: 'group'         },
  { value: '15k',    label: 'Publications',        sub: 'Indexed publications in global journals of high citation and impact factor.',                      icon: 'article'       },
  { value: '85',     label: 'Startup Ventures',    sub: 'Incubated projects transitioning from academic concept to commercial reality.',                    icon: 'rocket_launch' },
  { value: '100k+',  label: 'Global Alumni',       sub: 'A worldwide network of graduates shaping technology, policy, and innovation across every sector.', icon: 'public'        },
]

const RANKINGS = [
  { rank: 'Top 20',   label: 'NIRF Engineering',  accent: true,  icon: 'military_tech' },
  { rank: '#601–800', label: 'QS World Ranking',  accent: false, icon: 'language'      },
  { rank: '65+',      label: 'Years of Heritage', accent: false, icon: 'history_edu'   },
]

const RESEARCH_CLUSTERS = [
  { title: 'AI & Data Ethics',    desc: 'Pioneering ethical frameworks for machine learning and AI in urban planning and healthcare.',           grant: '$2.4M', icon: 'psychology', tags: ['Machine Learning', 'Ethics']    },
  { title: 'Sustainability Hub',  desc: 'Developing next-generation renewable energy storage and circular economy models for emerging markets.', grant: '$1.8M', icon: 'eco',         tags: ['Solar Tech', 'Bio-Fuels']        },
  { title: 'Quantum Systems Lab', desc: 'Exploring quantum coherence and entanglement for next-gen computing architectures.',                   grant: '$3.1M', icon: 'memory',      tags: ['Quantum Computing', 'Photonics'] },
]

const STATUS_COLORS = { available: 'bg-green-500', busy: 'bg-amber-500', away: 'bg-rose-600' }
const SORT_OPTIONS  = [
  { value: 'hIndex-desc', label: 'H-Index: High → Low' },
  { value: 'hIndex-asc',  label: 'H-Index: Low → High' },
  { value: 'name-asc',    label: 'Name: A → Z'         },
  { value: 'name-desc',   label: 'Name: Z → A'         },
]

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.scroll-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

export default function Home() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [search, setSearch] = useState('')
  const [student, setStudent] = useState(() => mapStudentProfile(getProfile()))
  useScrollReveal()

  // Land directly on the Explore section when arriving via a #explore link
  // (Navbar/Sidebar/BottomNav) from another page.
  useEffect(() => {
    if (location.hash === '#explore') {
      document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  useEffect(() => {
    const token = getToken()
    if (!token) return
    getMe(token)
      .then((data) => {
        persistProfile(data.profile)
        setStudent(mapStudentProfile(data.profile))
      })
      .catch(() => {
        // Background refresh only — keep showing the cached profile.
      })
  }, [])

  // ── Explore: real teachers from the DB ──────────
  const [teachers,        setTeachers]        = useState([])
  const [teachersLoading, setTeachersLoading] = useState(true)
  const [teachersError,   setTeachersError]   = useState('')
  const [saved,           setSaved]           = useState(new Set())
  const [sort,            setSort]            = useState('hIndex-desc')
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [showSortMenu,    setShowSortMenu]    = useState(false)

  // Live availability pushed from professors' door-mounted Raspberry Pi units.
  const { statusMap, connected } = useLiveStatus()

  useEffect(() => {
    fetchTeachers()
      .then((rows) => setTeachers(rows.map(mapTeacherCard)))
      .catch((err) => setTeachersError(err.message || 'Could not load teachers.'))
      .finally(() => setTeachersLoading(false))
  }, [])

  const goSearch = (q) => {
    if (q !== undefined) setSearch(q)
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleSave = (id, e) => {
    e.stopPropagation()
    setSaved((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const popularChips = useMemo(
    () => [...new Set(teachers.map((t) => t.department).filter((d) => d && d !== '—'))].slice(0, 4),
    [teachers]
  )

  // ── Filtered + sorted list ──────────────────────
  const results = useMemo(() => {
    // Overlay live door-unit status on top of each teacher.
    let list = teachers.map((t) => ({
      ...t,
      status: statusMap[t.id]?.status ?? 'away',
    }))

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.designation.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter)
    }

    list.sort((a, b) => {
      if (sort === 'hIndex-desc') return (Number(b.hIndex) || 0) - (Number(a.hIndex) || 0)
      if (sort === 'hIndex-asc')  return (Number(a.hIndex) || 0) - (Number(b.hIndex) || 0)
      if (sort === 'name-asc')    return a.name.localeCompare(b.name)
      if (sort === 'name-desc')   return b.name.localeCompare(a.name)
      return 0
    })

    return list
  }, [teachers, search, statusFilter, sort, statusMap])

  const currentSort = SORT_OPTIONS.find((o) => o.value === sort)

  return (
    <>
      <style>{`
        .scroll-reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s cubic-bezier(0.4,0,0.2,1), transform 0.65s cubic-bezier(0.4,0,0.2,1);
        }
        .scroll-reveal.scroll-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .scroll-reveal:nth-child(2) { transition-delay: 0.1s; }
        .scroll-reveal:nth-child(3) { transition-delay: 0.2s; }
        .scroll-reveal:nth-child(4) { transition-delay: 0.3s; }
      `}</style>

      <div className="min-h-screen flex flex-col relative font-body bg-background">
        <Background />
        <Navbar />

        {/* ── STUDENT PROFILE SUMMARY ─────────────── */}
        <section className="relative z-10 px-4 md:px-8 pt-8">
          <div className="max-w-5xl mx-auto glass-panel rounded-2xl p-5 md:p-6 border border-outline-variant/15 shadow-2xl flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <img
                src={student.avatar}
                alt={student.name}
                className="w-16 h-16 rounded-2xl border border-white/10 object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50">
                  Welcome back
                </p>
                <h2 className="font-headline font-bold text-xl text-on-surface truncate">
                  {student.name}
                </h2>
                <p className="text-on-surface-variant text-xs opacity-70 truncate">
                  {student.rollNo} &middot; {student.branch} &middot; {student.year}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => navigate('/appointments')}
                className="px-5 py-2.5 text-sm rounded-xl border border-outline-variant/20 text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors flex items-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-lg">calendar_month</span>
                Appointments
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-lg">person</span>
                View Full Profile
              </button>
            </div>
          </div>
        </section>

        {/* ── HERO ───────────────────────────────── */}
        <main className="flex flex-col items-center justify-center px-4 pt-16 pb-32 relative z-10">
          <div className="w-full max-w-5xl text-center flex flex-col items-center">

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/20 border border-primary/15 mb-8 animate-fade-in stagger-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Research Network v4.2</span>
            </div>

            <h1 className="font-headline text-5xl md:text-6xl font-extrabold text-on-surface tracking-tighter mb-5 animate-fade-up stagger-1">
              Find your{' '}
              <span className="text-primary">Professor.</span>
            </h1>

            <p className="text-on-surface-variant text-lg max-w-xl mb-14 opacity-70 animate-fade-up stagger-2">
              Connect with world-class researchers, book sessions, and accelerate your academic journey.
            </p>

            {/* ── SEARCH BAR ─────────────────────── */}
            <div className="w-full max-w-2xl relative group search-container animate-fade-up stagger-2">
              <div className="relative glass-panel rounded-xl p-3 flex items-center gap-4 border border-outline-variant/10 shadow-2xl focus-within:border-primary/30 focus-within:shadow-[0_0_40px_rgba(139,0,0,0.15)] focus-within:bg-surface-container/60 transition-all duration-300">
                <span className="material-symbols-outlined text-on-surface-variant/60 ml-3 scale-110">
                  search
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goSearch()}
                  className="bg-transparent border-none focus:ring-0 text-on-surface text-lg md:text-xl w-full font-body placeholder:text-on-surface-variant/30 outline-none"
                  placeholder="Name, department, or designation..."
                  type="text"
                />
                <div className="flex items-center gap-2 pr-2">
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="p-2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  )}
                  <button
                    onClick={() => goSearch()}
                    className="btn-primary px-6 py-3 flex items-center gap-2"
                  >
                    <span className="text-sm tracking-widest uppercase font-bold">Search</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── CHIPS ──────────────────────────── */}
            {popularChips.length > 0 && (
              <div className="mt-10 flex flex-wrap justify-center gap-3 animate-fade-up stagger-3">
                <span className="text-on-surface-variant text-[10px] font-bold self-center uppercase tracking-[0.2em] opacity-40 mr-1">
                  Popular
                </span>
                {popularChips.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => goSearch(dept)}
                    className="bg-surface-container/30 px-5 py-2 rounded-xl text-on-surface-variant text-sm border border-outline-variant/5 hover:border-primary/30 hover:bg-surface-container-high/50 hover:text-on-surface transition-all active:scale-95 duration-150"
                  >
                    {dept}
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ── EXPLORE EXPERTS ─────────────────────── */}
        <section id="explore" className="relative z-10 px-4 md:px-8 py-16 border-t border-outline-variant/10 scroll-mt-20">
          <div className="max-w-7xl mx-auto">

            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tighter">
                Explore <span className="text-primary">Experts</span>
              </h2>
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

            {/* ── TOOLBAR ROW ──────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3 flex-wrap">
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

                <span className="text-on-surface-variant text-sm">
                  <span className="font-semibold text-primary">{results.length}</span> result{results.length !== 1 ? 's' : ''}
                </span>
              </div>

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

            {/* ── PROFESSOR GRID ───────────────────────── */}
            {teachersLoading ? (
              <div className="flex items-center justify-center py-32">
                <p className="text-on-surface-variant text-sm opacity-60">Loading teachers…</p>
              </div>
            ) : teachersError ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <span className="material-symbols-outlined text-4xl text-error/60 mb-3">error</span>
                <p className="text-on-surface-variant text-sm opacity-70">{teachersError}</p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">
                  search_off
                </span>
                <h3 className="font-headline font-bold text-xl text-on-surface mb-2">No results found</h3>
                <p className="text-on-surface-variant text-sm opacity-60 mb-6">
                  Try adjusting your search or filters.
                </p>
                <button
                  onClick={() => { setSearch(''); setStatusFilter('all') }}
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
                    <p className="text-on-surface-variant text-sm mb-1">{prof.department}</p>
                    <p className="text-on-surface-variant text-xs opacity-60 mb-4">{prof.designation} &middot; Room {prof.roomNumber}</p>

                    {/* Status badge */}
                    <div className="flex items-center gap-2 mb-4 mt-auto">
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
            {saved.size > 0 && (
              <div className="mt-16 pt-10 border-t border-outline-variant/10">
                <h3 className="font-headline text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    bookmark
                  </span>
                  Saved Professors
                  <span className="text-sm font-normal text-on-surface-variant ml-1">({saved.size})</span>
                </h3>
                <div className="flex flex-wrap gap-3">
                  {teachers.filter((t) => saved.has(t.id)).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/profile/${t.id}`)}
                      className="flex items-center gap-3 px-4 py-3 glass-card rounded-xl hover:border-primary/30 transition-all"
                    >
                      <img src={t.avatar} className="w-8 h-8 rounded-lg" alt={t.name} />
                      <div className="text-left">
                        <p className="text-sm font-bold text-on-surface">{t.name}</p>
                        <p className="text-[10px] text-on-surface-variant">{t.department}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── BY THE NUMBERS ─────────────────────── */}
        <section className="relative z-10 px-8 py-24 border-t border-outline-variant/10">
          <div className="max-w-6xl mx-auto">
            <div className="scroll-reveal mb-16">
              <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tighter mb-3">By the Numbers</h2>
              <div className="w-12 h-[3px] bg-primary rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {STATS.map(({ value, label, sub, icon }) => (
                <div key={label} className="scroll-reveal">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-5xl font-black text-on-surface tracking-tighter font-headline leading-none">{value}</span>
                    <span className="material-symbols-outlined text-primary mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.18em] mb-2">{label}</p>
                  <p className="text-sm text-stone-500 leading-relaxed">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RANKINGS & PRESTIGE ────────────────── */}
        <section className="relative z-10 px-8 py-24 border-t border-outline-variant/10">
          <div className="max-w-6xl mx-auto">
            <div className="scroll-reveal text-center mb-16">
              <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tighter mb-3">Rankings & Prestige</h2>
              <p className="text-on-surface-variant text-sm opacity-60">A testament to our unwavering commitment to academic rigour.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {RANKINGS.map(({ rank, label, accent, icon }) => (
                <div
                  key={label}
                  className={`scroll-reveal rounded-2xl p-8 flex flex-col justify-between min-h-[180px] border transition-all duration-300 hover:-translate-y-1 ${
                    accent ? 'bg-[#1a1aff] border-[#3333ff]/40' : 'glass-panel border-outline-variant/15'
                  }`}
                >
                  <span className={`material-symbols-outlined text-2xl ${accent ? 'text-blue-200' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                  </span>
                  <div>
                    <div className={`text-4xl font-black font-headline tracking-tighter mb-1 ${accent ? 'text-blue-100' : 'text-on-surface'}`}>{rank}</div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${accent ? 'text-blue-300' : 'text-on-surface-variant'}`}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="scroll-reveal glass-panel rounded-2xl p-6 flex items-center gap-6 border border-outline-variant/15">
              <div className="w-14 h-14 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
              </div>
              <div>
                <h4 className="font-headline font-bold text-on-surface mb-1">Global Partnerships</h4>
                <p className="text-sm text-on-surface-variant opacity-70">
                  Collaborations with Trinity College Dublin, Tel Aviv University, University of Queensland, and 40+ institutions worldwide.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── RESEARCH CLUSTERS ──────────────────── */}
        <section className="relative z-10 px-8 py-24 border-t border-outline-variant/10">
          <div className="max-w-6xl mx-auto">
            <div className="scroll-reveal flex items-end justify-between mb-16 flex-wrap gap-4">
              <div>
                <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tighter mb-2">Research Frontier</h2>
                <p className="text-on-surface-variant text-sm opacity-60 max-w-md">Driving innovation through specialized research clusters and world-class labs.</p>
              </div>
              <button
                onClick={() => goSearch('')}
                className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant hover:text-primary transition-colors"
              >
                Explore Labs
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {RESEARCH_CLUSTERS.map(({ title, desc, grant, icon, tags }) => (
                <div
                  key={title}
                  onClick={() => goSearch(title)}
                  className="scroll-reveal glass-card rounded-2xl p-7 flex flex-col cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-container/40 flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <h3 className="font-headline font-bold text-on-surface text-lg mb-2">{title}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed flex-1 mb-5">{desc}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tags.map((t) => (
                      <span
                        key={t}
                        onClick={(e) => { e.stopPropagation(); goSearch(t) }}
                        className="text-[9px] font-bold uppercase tracking-wider bg-surface-container-lowest border border-outline-variant/15 text-stone-400 px-2.5 py-1 rounded hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 border-t border-outline-variant/10 pt-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Active Grants: {grant}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────── */}
        <footer className="relative z-10 border-t border-outline-variant/15 px-8 pt-16 pb-10 bg-surface-container-lowest/30">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
              <div className="md:col-span-1">
                <h3 className="font-headline text-2xl font-black text-on-surface tracking-tighter mb-3">ProfConnect</h3>
                <p className="text-xs text-on-surface-variant opacity-50 leading-relaxed mb-5">Bridging students and world-class researchers since 2022.</p>
                <div className="flex gap-3">
                  {['mail', 'link', 'rss_feed'].map((ic) => (
                    <button key={ic} className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/15 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all">
                      <span className="material-symbols-outlined text-sm">{ic}</span>
                    </button>
                  ))}
                </div>
              </div>
              {[
                { heading: 'Platform',   links: ['Explore Experts', 'AI Matching', 'Publications', 'Research Labs'] },
                { heading: 'University', links: ['About', 'Rankings', 'Partnerships', 'News']                       },
                { heading: 'Support',    links: ['Documentation', 'Privacy Policy', 'Terms of Use', 'Security']     },
              ].map(({ heading, links }) => (
                <div key={heading}>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-40 mb-4">{heading}</h4>
                  <ul className="space-y-3">
                    {links.map((l) => (
                      <li key={l}>
                        <button className="text-sm text-on-surface-variant hover:text-primary transition-colors opacity-70 hover:opacity-100">{l}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-outline-variant/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[10px] text-on-surface-variant opacity-30 uppercase tracking-[0.2em]">
                © 2025 ProfConnect · Built by Thapar Institute of Engineering and Technology
              </p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-on-surface-variant opacity-30 uppercase tracking-[0.15em]">All systems operational</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <BottomNav />
    </>
  )
}
