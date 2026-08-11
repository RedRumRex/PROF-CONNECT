import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'

// ── Toggle component ──────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0
        ${value ? 'bg-primary' : 'bg-surface-container-high border border-white/10'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300
        ${value ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, subtitle, icon, children }) {
  return (
    <div className="glass-panel rounded-2xl border border-outline-variant/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/[0.05] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        <div>
          <h3 className="font-headline font-bold text-sm text-on-surface">{title}</h3>
          {subtitle && <p className="text-[10px] text-on-surface-variant opacity-50">{subtitle}</p>}
        </div>
      </div>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  )
}

// ── Row types ─────────────────────────────────────────────────
function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-on-surface">{label}</p>
        {sub && <p className="text-[11px] text-on-surface-variant opacity-50 mt-0.5">{sub}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

function SelectRow({ label, sub, value, options, onChange }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-on-surface">{label}</p>
        {sub && <p className="text-[11px] text-on-surface-variant opacity-50 mt-0.5">{sub}</p>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-surface-container border border-white/[0.09] rounded-lg px-3 py-1.5 text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
      >
        {options.map(o => <option key={o} value={o} className="bg-stone-900">{o}</option>)}
      </select>
    </div>
  )
}

function LinkRow({ label, sub, icon, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors text-left group`}
    >
      <div className="flex-1">
        <p className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-on-surface'}`}>{label}</p>
        {sub && <p className="text-[11px] text-on-surface-variant opacity-50 mt-0.5">{sub}</p>}
      </div>
      <span className={`material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform
        ${danger ? 'text-red-400/60' : 'text-on-surface-variant opacity-30'}`}>
        {icon ?? 'chevron_right'}
      </span>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate()

  // Notification settings
  const [notif, setNotif] = useState({
    email:        true,
    push:         true,
    sms:          false,
    appointments: true,
    messages:     true,
    publications: false,
    digest:       true,
  })

  // Privacy settings
  const [privacy, setPrivacy] = useState({
    profileVisible:   true,
    showEmail:        false,
    showPhone:        false,
    allowMessages:    true,
    showActivity:     true,
  })

  // Appearance
  const [appearance, setAppearance] = useState({
    theme:    'Dark',
    language: 'English',
    fontSize: 'Medium',
    density:  'Comfortable',
  })

  // Academic
  const [academic, setAcademic] = useState({
    showCGPA:      true,
    showCourses:   true,
    researchAlerts: true,
    mentorMatch:   true,
  })

  // Security
  const [twoFA, setTwoFA]       = useState(false)
  const [sessions]              = useState([
    { device: 'MacBook Pro — Chrome', location: 'Patiala, IN', time: 'Active now',   current: true  },
    { device: 'iPhone 14 — Safari',   location: 'Patiala, IN', time: '2 hours ago',  current: false },
  ])

  // Modals / feedback
  const [saved,        setSaved]        = useState(false)
  const [showLogout,   setShowLogout]   = useState(false)
  const [showDelete,   setShowDelete]   = useState(false)
  const [deleteInput,  setDeleteInput]  = useState('')
  const [pwModal,      setPwModal]      = useState(false)
  const [pw,           setPw]           = useState({ current: '', next: '', confirm: '' })
  const [pwSaved,      setPwSaved]      = useState(false)

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const changePassword = () => {
    if (!pw.current || !pw.next || pw.next !== pw.confirm) return
    setPwSaved(true)
    setTimeout(() => { setPwSaved(false); setPwModal(false); setPw({ current: '', next: '', confirm: '' }) }, 1500)
  }

  const SECTIONS = [
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'privacy',       label: 'Privacy',        icon: 'lock'         },
    { id: 'appearance',    label: 'Appearance',     icon: 'palette'      },
    { id: 'academic',      label: 'Academic',       icon: 'school'       },
    { id: 'security',      label: 'Security',       icon: 'security'     },
    { id: 'danger',        label: 'Account',        icon: 'manage_accounts' },
  ]

  const [activeSection, setActiveSection] = useState('notifications')

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 pb-28 lg:pb-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-headline font-extrabold tracking-tighter text-on-surface">Settings</h2>
            <p className="text-on-surface-variant text-sm mt-1 opacity-60">Manage your account preferences</p>
          </div>
          <button
            onClick={showSaved}
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
          >
            {saved
              ? <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Saved!</>
              : <><span className="material-symbols-outlined text-[16px]">save</span>Save Changes</>
            }
          </button>
        </div>

        <div className="flex gap-6">

          {/* ── SIDEBAR NAV ── */}
          <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                  ${activeSection === s.id
                    ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                    : 'text-stone-400 hover:text-stone-100 hover:bg-white/[0.04]'
                  }`}
              >
                <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </aside>

          {/* ── MOBILE TABS ── */}
          <div className="md:hidden flex gap-1 mb-4 overflow-x-auto pb-1 w-full">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all
                  ${activeSection === s.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-stone-400 bg-surface-container/30 border border-white/[0.05]'
                  }`}
              >
                <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* ── CONTENT ── */}
          <div className="flex-1 space-y-5 min-w-0">

            {/* NOTIFICATIONS */}
            {activeSection === 'notifications' && (
              <>
                <Section title="Notification Channels" subtitle="How you want to be notified" icon="campaign">
                  <ToggleRow label="Email Notifications"  sub="Receive updates to your registered email"   value={notif.email}   onChange={v => setNotif(n => ({ ...n, email: v }))}   />
                  <ToggleRow label="Push Notifications"   sub="Browser and device push alerts"             value={notif.push}    onChange={v => setNotif(n => ({ ...n, push: v }))}    />
                  <ToggleRow label="SMS Alerts"           sub="Text messages for critical updates"         value={notif.sms}     onChange={v => setNotif(n => ({ ...n, sms: v }))}     />
                </Section>

                <Section title="Notification Types" subtitle="What you want to be notified about" icon="tune">
                  <ToggleRow label="Appointment Reminders" sub="Alerts for upcoming booked sessions"        value={notif.appointments} onChange={v => setNotif(n => ({ ...n, appointments: v }))} />
                  <ToggleRow label="New Messages"          sub="When a professor replies to your message"   value={notif.messages}     onChange={v => setNotif(n => ({ ...n, messages: v }))}     />
                  <ToggleRow label="New Publications"      sub="When connected professors publish papers"   value={notif.publications} onChange={v => setNotif(n => ({ ...n, publications: v }))} />
                  <ToggleRow label="Weekly Digest"         sub="Summary of activity and recommendations"   value={notif.digest}       onChange={v => setNotif(n => ({ ...n, digest: v }))}       />
                </Section>
              </>
            )}

            {/* PRIVACY */}
            {activeSection === 'privacy' && (
              <>
                <Section title="Profile Visibility" subtitle="Control who can see your profile" icon="visibility">
                  <ToggleRow label="Public Profile"       sub="Your profile is visible to all professors"  value={privacy.profileVisible} onChange={v => setPrivacy(p => ({ ...p, profileVisible: v }))} />
                  <ToggleRow label="Show Email Address"   sub="Display email on your public profile"       value={privacy.showEmail}      onChange={v => setPrivacy(p => ({ ...p, showEmail: v }))}      />
                  <ToggleRow label="Show Phone Number"    sub="Display phone on your public profile"       value={privacy.showPhone}      onChange={v => setPrivacy(p => ({ ...p, showPhone: v }))}      />
                </Section>

                <Section title="Interaction Settings" subtitle="Control how others interact with you" icon="people">
                  <ToggleRow label="Allow Direct Messages" sub="Professors can send you messages"          value={privacy.allowMessages} onChange={v => setPrivacy(p => ({ ...p, allowMessages: v }))} />
                  <ToggleRow label="Show Online Activity"  sub="Show when you were last active"            value={privacy.showActivity}  onChange={v => setPrivacy(p => ({ ...p, showActivity: v }))}  />
                </Section>

                <Section title="Data & Privacy" icon="policy">
                  <LinkRow label="Download My Data"       sub="Export all your ProfConnect data"          onClick={() => {}} />
                  <LinkRow label="Privacy Policy"         sub="Read our full privacy policy"              onClick={() => {}} />
                  <LinkRow label="Cookie Preferences"     sub="Manage tracking and analytics cookies"     onClick={() => {}} />
                </Section>
              </>
            )}

            {/* APPEARANCE */}
            {activeSection === 'appearance' && (
              <Section title="Display Preferences" subtitle="Personalise how ProfConnect looks" icon="palette">
                <SelectRow label="Theme"     sub="Choose your colour scheme"           value={appearance.theme}    options={['Dark', 'Light', 'System']}                         onChange={v => setAppearance(a => ({ ...a, theme: v }))}    />
                <SelectRow label="Language"  sub="Interface display language"          value={appearance.language} options={['English', 'Hindi', 'Punjabi']}                     onChange={v => setAppearance(a => ({ ...a, language: v }))} />
                <SelectRow label="Font Size" sub="Adjust text size across the app"    value={appearance.fontSize} options={['Small', 'Medium', 'Large']}                        onChange={v => setAppearance(a => ({ ...a, fontSize: v }))} />
                <SelectRow label="Density"   sub="Compact or spacious layout"         value={appearance.density}  options={['Compact', 'Comfortable', 'Spacious']}              onChange={v => setAppearance(a => ({ ...a, density: v }))} />
              </Section>
            )}

            {/* ACADEMIC */}
            {activeSection === 'academic' && (
              <>
                <Section title="Academic Visibility" subtitle="Control what academic info is shown" icon="school">
                  <ToggleRow label="Show CGPA on Profile"    sub="Display your GPA to connected professors"   value={academic.showCGPA}    onChange={v => setAcademic(a => ({ ...a, showCGPA: v }))}    />
                  <ToggleRow label="Show Enrolled Courses"   sub="Professors can see your current courses"    value={academic.showCourses} onChange={v => setAcademic(a => ({ ...a, showCourses: v }))} />
                </Section>

                <Section title="Research & Matching" subtitle="AI-powered academic tools" icon="auto_awesome">
                  <ToggleRow label="Research Opportunity Alerts" sub="Get notified about matching research openings"  value={academic.researchAlerts} onChange={v => setAcademic(a => ({ ...a, researchAlerts: v }))} />
                  <ToggleRow label="AI Mentor Matching"          sub="Let AI suggest professors based on your profile" value={academic.mentorMatch}    onChange={v => setAcademic(a => ({ ...a, mentorMatch: v }))}    />
                  <LinkRow   label="Update Research Interests"   sub="Add topics you are interested in"                onClick={() => navigate('/profile')} />
                </Section>
              </>
            )}

            {/* SECURITY */}
            {activeSection === 'security' && (
              <>
                <Section title="Authentication" subtitle="Manage how you sign in" icon="lock">
                  <LinkRow  label="Change Password"          sub="Update your account password"                  onClick={() => setPwModal(true)} />
                  <ToggleRow label="Two-Factor Authentication" sub="Add an extra layer of security to your account" value={twoFA} onChange={setTwoFA} />
                  <LinkRow  label="Linked Accounts"          sub="Google, Microsoft SSO connections"             onClick={() => {}} />
                </Section>

                <Section title="Active Sessions" subtitle="Devices currently signed in to your account" icon="devices">
                  {sessions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                            {s.device.includes('iPhone') ? 'smartphone' : 'laptop_mac'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface flex items-center gap-2">
                            {s.device}
                            {s.current && (
                              <span className="px-2 py-0.5 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary text-[9px] font-bold uppercase tracking-wider">
                                This device
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-on-surface-variant opacity-50">{s.location} &middot; {s.time}</p>
                        </div>
                      </div>
                      {!s.current && (
                        <button className="text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors">
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                  <LinkRow label="Sign out all other sessions" sub="Revoke access from all other devices" danger onClick={() => {}} />
                </Section>
              </>
            )}

            {/* ACCOUNT / DANGER ZONE */}
            {activeSection === 'danger' && (
              <>
                <Section title="Account Actions" subtitle="Manage your ProfConnect account" icon="manage_accounts">
                  <LinkRow label="Edit Profile"            sub="Update your name, photo and details"        onClick={() => navigate('/profile')}   />
                  <LinkRow label="Change Email Address"    sub="Update your registered email"               onClick={() => {}}                     />
                  <LinkRow label="Notification Preferences" sub="Go to notification settings"              onClick={() => setActiveSection('notifications')} />
                </Section>

                <Section title="Danger Zone" subtitle="Irreversible account actions" icon="warning">
                  <LinkRow
                    label="Deactivate Account"
                    sub="Temporarily disable your account — you can reactivate anytime"
                    danger
                    onClick={() => setShowLogout(true)}
                  />
                  <LinkRow
                    label="Delete Account"
                    sub="Permanently delete all your data — this cannot be undone"
                    danger
                    onClick={() => setShowDelete(true)}
                  />
                </Section>

                {/* Sign Out button */}
                <button
                  onClick={() => setShowLogout(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 font-bold text-sm hover:bg-red-500/10 transition-all active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Sign Out
                </button>
              </>
            )}

          </div>
        </div>
      </main>

      <BottomNav />

      {/* ── CHANGE PASSWORD MODAL ── */}
      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h3 className="font-headline font-bold text-lg">Change Password</h3>
              <button onClick={() => setPwModal(false)} className="p-1.5 rounded-full hover:bg-white/[0.08] text-stone-400 hover:text-stone-100 transition-all">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { label: 'Current Password', key: 'current' },
                { label: 'New Password',     key: 'next'    },
                { label: 'Confirm New Password', key: 'confirm' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50 block mb-1.5">{label}</label>
                  <input
                    type="password"
                    value={pw[key]}
                    onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
              ))}
              {pw.next && pw.confirm && pw.next !== pw.confirm && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  Passwords do not match
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setPwModal(false)} className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant font-bold text-sm hover:bg-white/[0.04] transition-colors">
                Cancel
              </button>
              <button
                onClick={changePassword}
                disabled={!pw.current || !pw.next || pw.next !== pw.confirm}
                className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {pwSaved
                  ? <><span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Updated!</>
                  : 'Update Password'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIGN OUT CONFIRM ── */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl border border-outline-variant/20 shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-400 text-2xl">logout</span>
            </div>
            <h3 className="font-headline font-bold text-lg mb-1">Sign Out?</h3>
            <p className="text-sm text-on-surface-variant opacity-60 mb-6">You will be signed out of your ProfConnect account on this device.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogout(false)} className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant font-bold text-sm hover:bg-white/[0.04] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT CONFIRM ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl border border-red-500/20 shadow-2xl w-full max-w-sm p-6">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-400 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
            </div>
            <h3 className="font-headline font-bold text-lg mb-1 text-center">Delete Account?</h3>
            <p className="text-sm text-on-surface-variant opacity-60 mb-5 text-center">This will permanently delete all your data. Type <span className="font-bold text-red-400">DELETE</span> to confirm.</p>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full bg-white/[0.05] border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-red-500/40 transition-all mb-4 placeholder:text-stone-600"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDelete(false); setDeleteInput('') }} className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant font-bold text-sm hover:bg-white/[0.04] transition-colors">
                Cancel
              </button>
              <button
                disabled={deleteInput !== 'DELETE'}
                onClick={() => navigate('/login')}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}