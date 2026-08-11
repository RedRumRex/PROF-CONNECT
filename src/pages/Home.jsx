import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'

const CHIPS = [
  { label: 'Dr. Aris Thorne',    plain: true,  query: 'Dr. Aris Thorne'    },
  { label: 'Dr. Elena Vance',    plain: true,  query: 'Dr. Elena Vance'    },
  { label: 'Prof. Julian Kross', plain: true,  query: 'Prof. Julian Kross' },
  { label: 'AI Matching',        plain: false, query: 'AI'                 },
]

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
  const [search, setSearch] = useState('')
  useScrollReveal()

  const goSearch = (q) => {
    const query = (q ?? search).trim()
    if (query) navigate(`/explore?q=${encodeURIComponent(query)}`)
    else navigate('/explore')
  }

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

        {/* ── HEADER ─────────────────────────────── */}
        <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-5 animate-fade-in">
          <span className="text-2xl font-black text-on-surface font-headline tracking-tighter">
            ProfConnect
          </span>
          
        </header>

        {/* ── HERO ───────────────────────────────── */}
        <main className="flex flex-col items-center justify-center px-4 pt-36 pb-32 relative z-10 min-h-screen">
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
                  placeholder="Name, field, or institution..."
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
                  <button className="p-3 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-all active:scale-90">
                    <span className="material-symbols-outlined">mic</span>
                  </button>
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
            <div className="mt-10 flex flex-wrap justify-center gap-3 animate-fade-up stagger-3">
              <span className="text-on-surface-variant text-[10px] font-bold self-center uppercase tracking-[0.2em] opacity-40 mr-1">
                Popular
              </span>
              {CHIPS.map((chip) =>
                chip.plain ? (
                  <button
                    key={chip.label}
                    onClick={() => goSearch(chip.query)}
                    className="bg-surface-container/30 px-5 py-2 rounded-xl text-on-surface-variant text-sm border border-outline-variant/5 hover:border-primary/30 hover:bg-surface-container-high/50 hover:text-on-surface transition-all active:scale-95 duration-150"
                  >
                    {chip.label}
                  </button>
                ) : (
                  <button
                    key={chip.label}
                    onClick={() => goSearch(chip.query)}
                    className="bg-primary-container/20 px-5 py-2 rounded-xl text-primary text-sm font-bold border border-primary/20 flex items-center gap-2 hover:bg-primary/20 transition-all active:scale-95 duration-150"
                  >
                    <span className="material-symbols-outlined text-xs animate-pulse">auto_awesome</span>
                    {chip.label}
                  </button>
                )
              )}
            </div>
          </div>
        </main>

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
                onClick={() => navigate('/explore')}
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
    </>
  )
}
