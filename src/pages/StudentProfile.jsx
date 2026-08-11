import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import { getMe } from '../api/auth'
import { getToken, getProfile, getRole, setProfile as persistProfile } from '../lib/auth'
import { mapStudentProfile, mapTeacherProfile } from '../lib/profile'

const ACHIEVEMENTS = [
  { icon: 'emoji_events',      label: 'Smart India Hackathon 2024', sub: 'Finalist'               },
  { icon: 'workspace_premium', label: "Dean's List",                sub: 'Semester 5'             },
  { icon: 'science',           label: 'Research Publication',       sub: 'IEEE Xplore — 2024'    },
  { icon: 'code',              label: 'Open Source Contributor',    sub: 'GitHub — 3 merged PRs'  },
]

// Students see just the profile hero now (no tabs). Teachers still get
// Overview + Achievements.
const STUDENT_TABS = []
const TEACHER_TABS = ['Overview', 'Achievements']

export default function StudentProfile() {
  const navigate = useNavigate()
  const [role, setRoleState] = useState(() => getRole() || 'student')
  const isTeacher = role === 'teacher'
  const TABS = isTeacher ? TEACHER_TABS : STUDENT_TABS

  const [tab, setTab] = useState('Overview')
  const [profile, setProfileState] = useState(() =>
    isTeacher ? mapTeacherProfile(getProfile()) : mapStudentProfile(getProfile())
  )
  const [loadError, setLoadError] = useState('')

  // Edit modal — student fields only, for now (teacher edit flow isn't
  // built yet, so the button is hidden for teachers below).
  const [editOpen,  setEditOpen]  = useState(false)
  const [draft,     setDraft]     = useState(profile)
  const [skillInput, setSkillInput] = useState('')
  const [saved,     setSaved]     = useState(false)

  // Pull the freshest DB row on every visit — the cached copy from login
  // is just there so the page paints instantly.
  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login')
      return
    }
    getMe(token)
      .then((data) => {
        persistProfile(data.profile)
        setRoleState(data.role)
        setProfileState(
          data.role === 'teacher' ? mapTeacherProfile(data.profile) : mapStudentProfile(data.profile)
        )
      })
      .catch((err) => setLoadError(err.message || 'Could not load your profile.'))
  }, [navigate])

  const openEdit = () => { setDraft({ ...profile }); setEditOpen(true); setSaved(false) }
  const closeEdit = () => setEditOpen(false)

  const saveEdit = () => {
    setProfileState({ ...draft })
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

        {loadError && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs leading-relaxed">
            {loadError} Showing your last known profile.
          </div>
        )}

        {/* ── PROFILE HERO CARD ── */}
        <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden">

          {/* Banner */}
          <div className="h-32 relative"
               style={{ background: 'linear-gradient(135deg, rgba(139,0,0,0.5) 0%, rgba(29,8,7,0.85) 60%, rgba(10,10,20,0.95) 100%)' }}>
            <div className="absolute inset-0 opacity-20"
                 style={{ backgroundImage: 'radial-gradient(circle at 25% 60%, rgba(200,60,60,0.5) 0%, transparent 55%)' }} />
            {!isTeacher && (
              <button
                onClick={openEdit}
                className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-[11px] font-bold text-stone-300 hover:bg-black/50 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
                Edit Profile
              </button>
            )}
          </div>

          {/* Avatar row — sits BELOW banner, not overlapping name */}
          <div className="px-6 md:px-8 pt-0 pb-6">
            {/* Avatar + name in a clean side-by-side row */}
            <div className="flex items-center gap-5 mt-4 mb-6">
  {/* Avatar */}
  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-white/10 overflow-hidden bg-surface-container shrink-0 shadow-xl">
    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
  </div>

  {/* Name + badges */}
  <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-headline font-extrabold tracking-tighter text-on-surface leading-tight">
                      {profile.name}
                    </h1>
                    <p className="text-on-surface-variant text-sm opacity-60 mt-0.5">
                      {isTeacher
                        ? <>{profile.department} &middot; Teacher ID {profile.teacherId}</>
                        : <>{profile.rollNo} &middot; {profile.branch}</>}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {isTeacher ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                        <span className="material-symbols-outlined text-[13px]">workspace_premium</span>
                        {profile.designation}
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">school</span>
                          {profile.year}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary text-[11px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">grade</span>
                          CGPA {profile.cgpa}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick info cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(isTeacher
                ? [
                    { icon: 'mail',         label: 'Email',      value: profile.email      },
                    { icon: 'meeting_room', label: 'Room',       value: profile.roomNumber },
                    { icon: 'apartment',    label: 'Department', value: profile.department },
                    { icon: 'trending_up',  label: 'h-index',    value: profile.hIndex     },
                  ]
                : [
                    { icon: 'mail',         label: 'Email',  value: profile.email  },
                    { icon: 'call',         label: 'Phone',  value: profile.phone  },
                    { icon: 'cake',         label: 'DOB',    value: profile.dob    },
                    { icon: 'meeting_room', label: 'Hostel', value: profile.hostel },
                  ]
              ).map(({ icon, label, value }) => (
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

        {/* ── TABS (teacher only — students see just the hero card) ── */}
        {TABS.length > 0 && (
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
        )}

        {/* ── OVERVIEW (teacher) ── */}
        {tab === 'Overview' && isTeacher && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: 'emoji_events', label: 'Achievements',  value: ACHIEVEMENTS.length, color: 'text-primary'  },
              { icon: 'forum',        label: 'Conversations', value: '4 Active',          color: 'text-tertiary' },
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
        )}

        {/* ── ACHIEVEMENTS (teacher only) ── */}
        {tab === 'Achievements' && isTeacher && (
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

      {/* ── EDIT PROFILE MODAL (student only) ── */}
      {editOpen && !isTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] sticky top-0 bg-surface-container/80 backdrop-blur-xl z-10 rounded-t-2xl">
              <h3 className="font-headline font-bold text-lg">Edit Profile</h3>
              <button onClick={closeEdit} className="p-1.5 rounded-full hover:bg-white/[0.08] text-stone-400 hover:text-stone-100 transition-all">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 pt-4">
              <p className="text-[10px] text-on-surface-variant/50 leading-relaxed">
                Name, roll number, branch, year, email and phone come from your account record.
                Editing them here only changes what's shown on this device — it doesn't update the database yet.
              </p>
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
