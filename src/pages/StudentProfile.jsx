import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'

const INITIAL_STUDENT = {
  name:    'Purunjay Bhardwaj',
  rollNo:  '102203XXX',
  branch:  'Computer Science & Engineering',
  year:    '3rd Year',
  cgpa:    '8.74',
  email:   'pbhardwaj_be22@thapar.edu',
  phone:   '+91 94600 XXXXX',
  dob:     '15 March 2004',
  hostel:  'Hostel K, Room E-13',
  avatar:  'https://api.dicebear.com/9.x/notionists/svg?seed=ProfConnect&backgroundColor=321817',
  about:   'Passionate about AI, distributed systems, and building products that matter. Currently exploring research opportunities in quantum computing and neural architectures. Open to collaborations and internships.',
  skills:  ['React', 'Python', 'Machine Learning', 'Node.js', 'Distributed Systems', 'C++', 'PyTorch', 'Docker'],
}

const COURSES = [
  { code: 'UCS510', name: 'Machine Learning',        grade: 'A',  credits: 4 },
  { code: 'UCS505', name: 'Computer Networks',        grade: 'A+', credits: 4 },
  { code: 'UCS601', name: 'Distributed Systems',      grade: 'B+', credits: 3 },
  { code: 'UMA501', name: 'Engineering Mathematics',  grade: 'A',  credits: 4 },
  { code: 'UCS502', name: 'Operating Systems',        grade: 'A+', credits: 4 },
]

const PROFESSORS = [
  { name: 'Prof. Ananya Sharma', dept: 'Quantum Informatics',  avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Sharma&backgroundColor=321817' },
  { name: 'Prof. Rajiv Mehta',   dept: 'Advanced AI & ML',     avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Mehta&backgroundColor=0a1628'   },
  { name: 'Prof. Simran Kaur',   dept: 'Distributed Systems',  avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Kaur&backgroundColor=0d1f0d'    },
]

const ACHIEVEMENTS = [
  { icon: 'emoji_events',      label: 'Smart India Hackathon 2024', sub: 'Finalist'               },
  { icon: 'workspace_premium', label: "Dean's List",                sub: 'Semester 5'             },
  { icon: 'science',           label: 'Research Publication',       sub: 'IEEE Xplore — 2024'    },
  { icon: 'code',              label: 'Open Source Contributor',    sub: 'GitHub — 3 merged PRs'  },
]

const GRADE_COLOR = { 'A+': 'text-tertiary', 'A': 'text-primary', 'B+': 'text-on-surface-variant' }
const TABS = ['Overview', 'Academics', 'Connections', 'Achievements']

export default function StudentProfile() {
  const navigate = useNavigate()
  const [tab,     setTab]     = useState('Overview')
  const [student, setStudent] = useState(INITIAL_STUDENT)

  // Edit modal state
  const [editOpen,  setEditOpen]  = useState(false)
  const [draft,     setDraft]     = useState(student)
  const [skillInput, setSkillInput] = useState('')
  const [saved,     setSaved]     = useState(false)

  const openEdit = () => { setDraft({ ...student }); setEditOpen(true); setSaved(false) }
  const closeEdit = () => setEditOpen(false)

  const saveEdit = () => {
    setStudent({ ...draft })
    setSaved(true)
    setTimeout(() => { setSaved(false); setEditOpen(false) }, 1200)
  }

  const addSkill = () => {
    const s = skillInput.trim()
    if (s && !draft.skills.includes(s)) {
      setDraft(d => ({ ...d, skills: [...d.skills, s] }))
    }
    setSkillInput('')
  }

  const removeSkill = (skill) => setDraft(d => ({ ...d, skills: d.skills.filter(s => s !== skill) }))

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-10 pb-28 lg:pb-12 space-y-6">

        {/* ── PROFILE HERO CARD ── */}
        <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden">

          {/* Banner */}
          <div className="h-32 relative"
               style={{ background: 'linear-gradient(135deg, rgba(139,0,0,0.5) 0%, rgba(29,8,7,0.85) 60%, rgba(10,10,20,0.95) 100%)' }}>
            <div className="absolute inset-0 opacity-20"
                 style={{ backgroundImage: 'radial-gradient(circle at 25% 60%, rgba(200,60,60,0.5) 0%, transparent 55%)' }} />
            <button
              onClick={openEdit}
              className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-[11px] font-bold text-stone-300 hover:bg-black/50 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              Edit Profile
            </button>
          </div>

          {/* Avatar row — sits BELOW banner, not overlapping name */}
          <div className="px-6 md:px-8 pt-0 pb-6">
            {/* Avatar + name in a clean side-by-side row */}
            <div className="flex items-center gap-5 mt-4 mb-6">
  {/* Avatar */}
  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-white/10 overflow-hidden bg-surface-container shrink-0 shadow-xl">
    <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
  </div>

  {/* Name + badges */}
  <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-extrabold tracking-tighter text-on-surface leading-tight">
                      {student.name}
                    </h1>
                    <p className="text-on-surface-variant text-sm opacity-60 mt-0.5">
                      {student.rollNo} &middot; {student.branch}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                      <span className="material-symbols-outlined text-[13px]">school</span>
                      {student.year}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary text-[11px] font-bold">
                      <span className="material-symbols-outlined text-[13px]">grade</span>
                      CGPA {student.cgpa}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick info cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: 'mail',         label: 'Email',  value: student.email  },
                { icon: 'call',         label: 'Phone',  value: student.phone  },
                { icon: 'cake',         label: 'DOB',    value: student.dob    },
                { icon: 'meeting_room', label: 'Hostel', value: student.hostel },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-surface-container/40 border border-white/[0.05] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-primary text-[14px]">{icon}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50">{label}</span>
                  </div>
                  <p className="text-[11px] font-medium text-on-surface truncate">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 p-1 bg-surface-container/30 rounded-xl border border-white/[0.05] w-fit overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap
                ${tab === t
                  ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                  : 'text-stone-400 hover:text-stone-100 hover:bg-white/[0.04]'
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 glass-panel rounded-2xl p-6 border border-outline-variant/20">
              <h3 className="font-headline font-bold text-lg mb-3">About</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed opacity-80">{student.about}</p>
              <div className="mt-6">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 mb-3">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {student.skills.map(skill => (
                    <span key={skill} className="px-3 py-1 rounded-lg bg-surface-container border border-white/[0.07] text-xs font-medium text-on-surface-variant hover:border-primary/30 hover:text-primary transition-colors cursor-default">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { icon: 'book',         label: 'Courses Enrolled',  value: COURSES.length,       color: 'text-primary'  },
                { icon: 'group',        label: 'Prof. Connections',  value: PROFESSORS.length,    color: 'text-tertiary' },
                { icon: 'emoji_events', label: 'Achievements',       value: ACHIEVEMENTS.length,  color: 'text-primary'  },
                { icon: 'forum',        label: 'Conversations',      value: '4 Active',           color: 'text-tertiary' },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="glass-panel rounded-xl p-4 border border-outline-variant/20 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className={`material-symbols-outlined ${color} text-[20px]`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <div>
                    <p className={`text-xl font-headline font-black ${color}`}>{value}</p>
                    <p className="text-[10px] text-on-surface-variant opacity-60 uppercase tracking-wide">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ACADEMICS ── */}
        {tab === 'Academics' && (
          <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/[0.05] flex items-center justify-between">
              <div>
                <h3 className="font-headline font-bold text-lg">Current Semester Courses</h3>
                <p className="text-[11px] text-on-surface-variant opacity-50 mt-0.5">Semester 5 · Fall 2024</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary text-[11px] font-bold">
                CGPA {student.cgpa}
              </span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {COURSES.map((c, i) => (
                <div key={c.code} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <span className="text-[11px] font-black text-on-surface-variant opacity-30 w-5 text-center">{i + 1}</span>
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[18px]">menu_book</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface">{c.name}</p>
                    <p className="text-[10px] text-on-surface-variant opacity-50 font-mono">{c.code} &middot; {c.credits} Credits</p>
                  </div>
                  <span className={`text-lg font-headline font-black ${GRADE_COLOR[c.grade] ?? 'text-on-surface'}`}>{c.grade}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-surface-container/20 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[11px] text-on-surface-variant opacity-50">
                Total Credits: {COURSES.reduce((s, c) => s + c.credits, 0)}
              </span>
              <button className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:opacity-80 transition-opacity">
                <span className="material-symbols-outlined text-[14px]">download</span>
                Download Transcript
              </button>
            </div>
          </div>
        )}

        {/* ── CONNECTIONS ── */}
        {tab === 'Connections' && (
          <div className="space-y-4">
            <p className="text-[11px] text-on-surface-variant opacity-50 uppercase tracking-widest font-bold">
              {PROFESSORS.length} Connected Professors
            </p>
            {PROFESSORS.map(prof => (
              <div key={prof.name} className="glass-panel rounded-2xl border border-outline-variant/20 p-5 flex items-center gap-4 hover:border-primary/20 transition-all group">
                <div className="w-14 h-14 rounded-xl border border-white/[0.1] overflow-hidden bg-surface-container shrink-0">
                  <img src={prof.avatar} alt={prof.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{prof.name}</h4>
                  <p className="text-[11px] text-on-surface-variant opacity-60">{prof.dept}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/messages')}
                    className="px-3 py-2 rounded-xl border border-outline-variant/20 text-[11px] font-bold text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">mail</span>
                    Message
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-[11px] font-bold text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ACHIEVEMENTS ── */}
        {tab === 'Achievements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACHIEVEMENTS.map(({ icon, label, sub }) => (
              <div key={label} className="glass-panel rounded-2xl border border-outline-variant/20 p-6 flex items-center gap-4 hover:border-primary/20 transition-all group">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-on-surface">{label}</h4>
                  <p className="text-[11px] text-on-surface-variant opacity-60 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
            <button className="glass-panel rounded-2xl border border-dashed border-outline-variant/30 p-6 flex items-center gap-4 hover:border-primary/30 transition-all opacity-50 hover:opacity-80">
              <div className="w-14 h-14 rounded-2xl border border-dashed border-outline-variant/30 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">add</span>
              </div>
              <div>
                <h4 className="font-headline font-bold text-sm text-on-surface-variant">Add Achievement</h4>
                <p className="text-[11px] text-on-surface-variant opacity-60 mt-0.5">Certifications, awards, projects</p>
              </div>
            </button>
          </div>
        )}

      </main>

      <BottomNav />

      {/* ── EDIT PROFILE MODAL ── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] sticky top-0 bg-surface-container/80 backdrop-blur-xl z-10 rounded-t-2xl">
              <h3 className="font-headline font-bold text-lg">Edit Profile</h3>
              <button onClick={closeEdit} className="p-1.5 rounded-full hover:bg-white/[0.08] text-stone-400 hover:text-stone-100 transition-all">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">Full Name</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                />
              </div>

              {/* Roll No + Branch */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">Roll Number</label>
                  <input
                    value={draft.rollNo}
                    onChange={e => setDraft(d => ({ ...d, rollNo: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">Year</label>
                  <select
                    value={draft.year}
                    onChange={e => setDraft(d => ({ ...d, year: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  >
                    {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => (
                      <option key={y} value={y} className="bg-stone-900">{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">Email</label>
                  <input
                    value={draft.email}
                    onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">Phone</label>
                  <input
                    value={draft.phone}
                    onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
              </div>

              {/* Hostel + CGPA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">Hostel / Room</label>
                  <input
                    value={draft.hostel}
                    onChange={e => setDraft(d => ({ ...d, hostel: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">CGPA</label>
                  <input
                    value={draft.cgpa}
                    onChange={e => setDraft(d => ({ ...d, cgpa: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
              </div>

              {/* About */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">About</label>
                <textarea
                  rows={4}
                  value={draft.about}
                  onChange={e => setDraft(d => ({ ...d, about: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 resize-none leading-relaxed transition-all"
                />
              </div>

              {/* Skills */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-2">Skills</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {draft.skills.map(skill => (
                    <span key={skill} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container border border-white/[0.07] text-xs font-medium text-on-surface-variant">
                      {skill}
                      <button onClick={() => removeSkill(skill)} className="ml-1 text-stone-500 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSkill()}
                    placeholder="Add a skill..."
                    className="flex-1 bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-stone-600"
                  />
                  <button
                    onClick={addSkill}
                    className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold hover:bg-primary/20 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3 sticky bottom-0 bg-surface-container/80 backdrop-blur-xl rounded-b-2xl">
              <button
                onClick={closeEdit}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant font-bold text-sm hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
              >
                {saved
                  ? <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> Saved!</>
                  : <><span className="material-symbols-outlined text-[16px]">save</span> Save Changes</>
                }
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}