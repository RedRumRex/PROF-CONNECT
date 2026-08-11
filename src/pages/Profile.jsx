import { useParams, useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import useLiveStatus from '../hooks/useLiveStatus'

const PROFESSORS = [
  {
    id: 'aris-thorne',
    name: 'Dr. Aris Thorne',
    department: 'Department of Neural Engineering',
    hIndex: 58,
    status: 'available',
    tags: ['Neural Networks', 'Cognitive AI', 'Bio-electronics'],
    bio: 'Research focusing on bridging synaptic gaps using polymorphic carbon-nanotube interfaces and large-scale AI modeling.',
    avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ArisThorne&backgroundColor=321817',
    email: 'a.thorne@university.edu',
    publications: 143,
    citations: 4821,
    about: 'Dr. Aris Thorne is a pioneering researcher in neural engineering, known for groundbreaking work on carbon-nanotube synaptic interfaces. With over 15 years of experience, his lab bridges the gap between biological neural systems and artificial intelligence at scale.',
    recentPubs: [
      { title: 'Polymorphic CNT Interfaces for Neural Bridging', year: '2024', journal: 'Nature Neuroscience' },
      { title: 'Large-Scale AI Modeling of Synaptic Patterns', year: '2023', journal: 'Science Advances' },
      { title: 'Bio-Electronic Feedback Loops in Neural Prosthetics', year: '2023', journal: 'Cell Reports' },
    ],
    timetable: [
      { day: 'Mon', time: '09:00–11:30', title: 'Neural Lab', room: 'Lab 302', type: 'primary' },
      { day: 'Tue', time: null },
      { day: 'Wed', time: '10:00–12:00', title: 'Thesis Reviews', room: 'Office A4', type: 'primary' },
      { day: 'Thu', time: '14:00–16:30', title: 'Advanced AI', room: 'Lecture Hall 2', type: 'tertiary' },
      { day: 'Fri', time: '09:00–11:00', title: 'Neural Lab', room: 'Lab 302', type: 'primary' },
    ],
    resources: [
      { icon: 'folder_zip',         title: 'Neural Engineering Pack', sub: 'Lab resources'  },
      { icon: 'file_earmark_text',  title: 'Assignment #3',           sub: 'Due in 5 days'  },
      { icon: 'groups',             title: 'Research Group',          sub: '8 Members'       },
    ],
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
    email: 'e.vance@university.edu',
    publications: 98,
    citations: 3102,
    about: 'Dr. Elena Vance leads cutting-edge research at the intersection of quantum computing and astrophysical data science. Her team develops novel quantum algorithms capable of processing petabyte-scale datasets to uncover signatures of dark matter.',
    recentPubs: [
      { title: 'Quantum Algorithms for Dark Matter Signature Detection', year: '2024', journal: 'Physical Review Letters' },
      { title: 'Petabyte-Scale Astrophysical Data via Quantum Processing', year: '2023', journal: 'Astrophysical Journal' },
      { title: 'Efficiency Bounds in Quantum Data Compression', year: '2022', journal: 'npj Quantum Information' },
    ],
    timetable: [
      { day: 'Mon', time: null },
      { day: 'Tue', time: '10:00–12:00', title: 'Quantum Theory', room: 'Hall B1', type: 'tertiary' },
      { day: 'Wed', time: null },
      { day: 'Thu', time: '09:00–11:00', title: 'Data Science', room: 'Lab 201', type: 'primary' },
      { day: 'Fri', time: '14:00–15:30', title: 'Office Hours', room: 'Office C2', type: 'primary' },
    ],
    resources: [
      { icon: 'folder_zip',  title: 'Quantum Data Pack', sub: 'Course resources' },
      { icon: 'assignment',  title: 'Problem Set #5',    sub: 'Due in 2 days'    },
      { icon: 'groups',      title: 'Study Group',       sub: '14 Members'       },
    ],
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
    email: 'j.kross@university.edu',
    publications: 211,
    citations: 9430,
    about: 'Prof. Julian Kross is one of the foremost authorities on machine ethics and AI governance. His frameworks for autonomous decision-making have been adopted by regulatory bodies across 12 countries.',
    recentPubs: [
      { title: 'Moral Frameworks for Urban Autonomous Systems', year: '2024', journal: 'AI & Society' },
      { title: 'Multi-Agent Ethics in High-Density Environments', year: '2023', journal: 'Robotics & Autonomous Systems' },
      { title: 'Liability and Accountability in AI Decision Trees', year: '2023', journal: 'Nature Machine Intelligence' },
    ],
    timetable: [
      { day: 'Mon', time: '11:00–13:00', title: 'AI Ethics',     room: 'Hall A3',    type: 'tertiary' },
      { day: 'Tue', time: '14:00–16:00', title: 'Robotics Lab',  room: 'Lab 501',    type: 'primary'  },
      { day: 'Wed', time: null },
      { day: 'Thu', time: '10:00–12:00', title: 'Policy Seminar',room: 'Conf Room 2', type: 'primary' },
      { day: 'Fri', time: null },
    ],
    resources: [
      { icon: 'folder_zip',  title: 'Ethics Framework Pack', sub: 'Policy docs'   },
      { icon: 'assignment',  title: 'Essay #2',              sub: 'Due in 7 days' },
      { icon: 'groups',      title: 'Policy Lab Group',      sub: '21 Members'    },
    ],
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
    email: 'm.wei@university.edu',
    publications: 67,
    citations: 1874,
    about: 'Dr. Marcus Wei specializes in post-quantum cryptography and its application to critical infrastructure. His work on decentralized energy grid security has received international recognition from IEEE and NIST.',
    recentPubs: [
      { title: 'Post-Quantum Standards for Energy Grid Security', year: '2024', journal: 'IEEE Transactions on Smart Grid' },
      { title: 'Blockchain Governance in Decentralized Infrastructure', year: '2023', journal: 'ACM CCS' },
      { title: 'Lattice-Based Cryptography for IoT Networks', year: '2022', journal: 'USENIX Security' },
    ],
    timetable: [
      { day: 'Mon', time: '13:00–15:00', title: 'Cryptography',  room: 'Lab 104',   type: 'primary'  },
      { day: 'Tue', time: null },
      { day: 'Wed', time: '09:00–11:00', title: 'Blockchain',    room: 'Hall C1',   type: 'tertiary' },
      { day: 'Thu', time: null },
      { day: 'Fri', time: '14:00–16:00', title: 'Office Hours',  room: 'Office D3', type: 'primary'  },
    ],
    resources: [
      { icon: 'folder_zip',  title: 'Crypto Resource Pack', sub: 'Lab materials' },
      { icon: 'assignment',  title: 'Project #2',           sub: 'Due in 10 days'},
      { icon: 'groups',      title: 'Security Lab',         sub: '6 Members'     },
    ],
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
    email: 's.jenkins@university.edu',
    publications: 156,
    citations: 6230,
    about: 'Dr. Sarah Jenkins leads the international Pan-Genome Consortium, mapping genetic diversity across underrepresented populations. Her ethical frameworks for genomic data use have shaped global biobank policy.',
    recentPubs: [
      { title: 'Pan-Genome Mapping Across Isolated Populations', year: '2024', journal: 'Nature Genetics' },
      { title: 'Ethical Frameworks for Large-Scale Genomic Biobanks', year: '2023', journal: 'Cell' },
      { title: 'CRISPR Off-Target Detection via High-Throughput Sequencing', year: '2023', journal: 'Genome Biology' },
    ],
    timetable: [
      { day: 'Mon', time: null },
      { day: 'Tue', time: '09:00–11:30', title: 'Genomics Lab',  room: 'Bio Lab 2', type: 'primary'  },
      { day: 'Wed', time: '13:00–15:00', title: 'CRISPR Seminar',room: 'Hall D2',   type: 'tertiary' },
      { day: 'Thu', time: null },
      { day: 'Fri', time: '10:00–12:00', title: 'Thesis Reviews',room: 'Office B8', type: 'primary'  },
    ],
    resources: [
      { icon: 'folder_zip',  title: 'Genomics Data Pack', sub: 'Research files' },
      { icon: 'assignment',  title: 'Lab Report #4',      sub: 'Due in 4 days'  },
      { icon: 'groups',      title: 'Pan-Genome Team',    sub: '17 Members'     },
    ],
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
    email: 'a.dent@university.edu',
    publications: 289,
    citations: 14200,
    about: 'Prof. Arthur Dent is a titan of computational astronomy. His automated spectral analysis systems have identified over 400 candidate exoplanets and his algorithmic contributions have become standard tools in observational cosmology worldwide.',
    recentPubs: [
      { title: 'Automated Spectral Analysis of 10,000 Exoplanet Candidates', year: '2024', journal: 'The Astrophysical Journal' },
      { title: 'Deep-Space Telemetry Synthesis via Neural Logic Gates', year: '2023', journal: 'Monthly Notices of the RAS' },
      { title: 'Cosmological Constant Revisited: A Computational Approach', year: '2022', journal: 'Physical Review D' },
    ],
    timetable: [
      { day: 'Mon', time: '09:00–11:00', title: 'Cosmology',     room: 'Observatory', type: 'primary'  },
      { day: 'Tue', time: null },
      { day: 'Wed', time: '14:00–16:00', title: 'Algorithmics',  room: 'Hall E1',     type: 'tertiary' },
      { day: 'Thu', time: '09:00–11:00', title: 'Cosmology',     room: 'Observatory', type: 'primary'  },
      { day: 'Fri', time: '13:00–14:00', title: 'Office Hours',  room: 'Office F1',   type: 'primary'  },
    ],
    resources: [
      { icon: 'folder_zip',  title: 'Astronomy Data Pack', sub: 'Telescope data'  },
      { icon: 'assignment',  title: 'Problem Set #7',      sub: 'Due in 6 days'   },
      { icon: 'groups',      title: 'Exoplanet Team',      sub: '25 Members'      },
    ],
  },
]

const STATUS_COLORS = {
  available: { dot: 'bg-green-500',  text: 'text-green-400',  label: 'Available' },
  busy:      { dot: 'bg-amber-500',  text: 'text-amber-400',  label: 'Busy'      },
  away:      { dot: 'bg-rose-600',   text: 'text-rose-400',   label: 'Away'      },
}

export default function Profile() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const found    = PROFESSORS.find((p) => p.id === id)

  // Live availability pushed from this professor's door-mounted Raspberry Pi.
  const { statusMap, connected } = useLiveStatus()
  const prof = found
    ? { ...found, status: statusMap[found.id]?.status ?? found.status }
    : found

  if (!prof) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-on-surface-variant text-lg mb-4">Professor not found.</p>
          <button onClick={() => navigate('/home#explore')} className="btn-primary px-6 py-3">
            Back to Explore
          </button>
        </div>
      </div>
    )
  }

  const statusStyle = STATUS_COLORS[prof.status] ?? STATUS_COLORS.away

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-12 pb-28 lg:pb-12 space-y-8">

        {/* Back */}
        <button
          onClick={() => navigate('/home#explore')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
        >
          <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          <span className="text-sm font-medium">Back to Home</span>
        </button>

        {/* ── HERO ─────────────────────────────────────────── */}
        <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex flex-col md:flex-row gap-8 items-start">

            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-32 h-32 rounded-2xl overflow-hidden ring-2 ring-primary/20 shadow-2xl">
                <img src={prof.avatar} alt={prof.name} className="w-full h-full object-cover" />
              </div>
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface-container-highest ${statusStyle.dot}`} />
            </div>

            {/* Name + tags + actions */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/20">
                  <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                    connected
                      ? 'bg-tertiary-container/20 text-tertiary border-tertiary/20'
                      : 'bg-surface-container-highest text-on-surface-variant/50 border-outline-variant/10'
                  }`}
                  title={connected ? 'Live from door unit' : 'Live status unavailable — showing last known status'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-tertiary animate-pulse' : 'bg-on-surface-variant/30'}`} />
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
              <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface tracking-tighter mb-1">
                {prof.name}
              </h1>
              <p className="text-on-surface-variant text-lg mb-4">{prof.department}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {prof.tags.map((tag) => (
                  <span key={tag} className="bg-surface-container-lowest/60 text-[11px] px-3 py-1.5 rounded text-stone-300 border border-outline-variant/10">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => navigate(`/appointment/${prof.id}`)}
                  className="btn-primary px-6 py-3 flex items-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined text-sm">event_available</span>
                  Book Session
                </button>
                <button className="px-6 py-3 rounded-xl border border-outline-variant/30 text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors flex items-center gap-2 active:scale-95">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  Send Message
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex md:flex-col gap-6 md:gap-5 shrink-0">
              {[
                { label: 'H-Index',      value: prof.hIndex                    },
                { label: 'Publications', value: prof.publications              },
                { label: 'Citations',    value: prof.citations.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="text-center md:text-right">
                  <div className="text-2xl font-black text-primary leading-none">{value}</div>
                  <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold mt-0.5">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TIMETABLE + AVAILABILITY ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Timetable */}
          <div className="lg:col-span-8 glass-panel rounded-2xl p-7 relative overflow-hidden group">
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">Weekly Timetable</h2>
                <p className="text-on-surface-variant text-xs">Academic Semester Fall 2024</p>
              </div>
              <span className="px-3 py-1 rounded bg-surface-container-highest text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                Office Hours: 2PM–4PM
              </span>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {prof.timetable.map(({ day, time, title, room, type }) => (
                <div key={day} className="space-y-2">
                  <span className="text-[9px] text-on-surface-variant font-black uppercase opacity-40 block">
                    {day}
                  </span>
                  {time ? (
                    <div className={`rounded-xl p-3 space-y-1 bg-surface-container/80 border-l-2 ${type === 'tertiary' ? 'border-tertiary' : 'border-primary-container'}`}
                      style={{ minHeight: '90px' }}>
                      <p className={`text-[9px] font-bold ${type === 'tertiary' ? 'text-tertiary' : 'text-primary'}`}>{time}</p>
                      <p className="text-[10px] font-bold text-on-surface leading-snug">{title}</p>
                      <p className="text-[9px] text-on-surface-variant opacity-60">{room}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-surface-container-low border border-outline-variant/5 flex items-center justify-center" style={{ minHeight: '90px' }}>
                      <span className="material-symbols-outlined text-on-surface-variant/15">coffee</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="bg-surface-container-high rounded-2xl p-6 border border-outline-variant/20 flex-1">
              <h3 className="font-headline font-bold text-on-surface mb-5">Availability</h3>
              {[
                { slot: 'Morning',   full: true,  contact: prof.email },
                { slot: 'Afternoon', full: false  },
                { slot: 'Evening',   full: false  },
              ].map(({ slot, full }) => (
                <div key={slot} className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-on-surface-variant">{slot}</span>
                    <span className={full ? 'text-error font-bold' : 'text-tertiary font-bold'}>
                      {full ? 'Full' : 'Open'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${full ? 'bg-error-container w-full' : 'bg-tertiary-container w-2/5'}`} />
                  </div>
                </div>
              ))}
              <div className="mt-5 pt-4 border-t border-outline-variant/10">
                <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-1">
                  <span className="material-symbols-outlined text-primary text-base">alternate_email</span>
                  <span className="text-xs">{prof.email}</span>
                </div>
                <p className="text-[10px] text-on-surface-variant/50 italic mt-2">
                  *Responds to urgent messages within 24h.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ABOUT + PUBLICATIONS + RESOURCES ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: About + Publications */}
          <div className="lg:col-span-2 space-y-6">

            {/* About */}
            <div className="bg-surface-container-low rounded-2xl p-7 border border-outline-variant/10">
              <h2 className="font-headline text-xl font-bold text-on-surface mb-4">About</h2>
              <p className="text-on-surface-variant leading-relaxed text-sm">{prof.about}</p>
            </div>

            {/* Recent publications */}
            <div className="bg-surface-container-low rounded-2xl p-7 border border-outline-variant/10">
              <h2 className="font-headline text-xl font-bold text-on-surface mb-5">Recent Publications</h2>
              <div className="space-y-3">
                {prof.recentPubs.map((pub, i) => (
                  <div
                    key={i}
                    className="flex gap-4 p-4 bg-surface-container rounded-xl border border-outline-variant/10 hover:border-primary/20 transition-colors cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary-container/30 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-sm">article</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-on-surface leading-snug mb-1 group-hover:text-primary transition-colors">
                        {pub.title}
                      </p>
                      <p className="text-xs text-on-surface-variant">{pub.journal} · {pub.year}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant/30 group-hover:text-primary transition-colors shrink-0 self-center">
                      open_in_new
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Latest pub card + Resources */}
          <div className="space-y-5">

            {/* Latest publication highlight */}
            <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm">clinical_notes</span>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-on-surface">Latest Publication</h4>
                  <p className="text-xs text-on-surface-variant">{prof.recentPubs[0].year}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-on-surface leading-relaxed mb-4">
                "{prof.recentPubs[0].title}"
              </p>
              <p className="text-xs text-on-surface-variant mb-4">{prof.recentPubs[0].journal}</p>
              <button className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:gap-3 transition-all">
                Read Abstract
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {/* Resources */}
            <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
              <h3 className="font-headline font-bold text-sm text-on-surface mb-4">Resources</h3>
              <div className="space-y-3">
                {prof.resources.map(({ icon, title, sub }) => (
                  <button
                    key={title}
                    className="w-full bg-surface-container-lowest border border-outline-variant/10 p-4 rounded-xl flex items-center gap-3 hover:bg-surface-container transition-colors cursor-pointer group text-left"
                  >
                    <span className="material-symbols-outlined text-2xl opacity-30 group-hover:opacity-100 transition-opacity text-primary">
                      {icon}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{title}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Book CTA */}
            <button
              onClick={() => navigate(`/appointment/${prof.id}`)}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">event_available</span>
              <span className="font-headline font-bold">Book Appointment</span>
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}