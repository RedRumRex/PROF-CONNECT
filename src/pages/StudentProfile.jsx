import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import ImageLightbox from '../components/ImageLightbox'
import TimetableGrid from '../components/TimetableGrid'
import { getMe } from '../api/auth'
import { uploadProfilePhoto, removeProfilePhoto } from '../api/profile'
import { fetchMyTimetable, uploadTimetable, clearMyTimetable } from '../api/timetable'
import { setMyAvailability } from '../api/availability'
import { getToken, getProfile, getRole, setProfile as persistProfile } from '../lib/auth'
import { mapStudentProfile, mapTeacherProfile, avatarFor } from '../lib/profile'
import useLiveStatus from '../hooks/useLiveStatus'

// Timetable now lives here instead of its own /timetable page (the Navbar
// link was removed) and instead of a tab on this page (Overview/Achievements
// were removed too) — it's just shown directly for both roles, no tab
// switching needed.

const ALLOWED_PHOTO_TYPES = ['image/png', 'image/jpeg']
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // mirrors the server-side limit — see server/app/routers/profile_photo.py

export default function StudentProfile() {
  const navigate = useNavigate()
  const photoInputRef = useRef(null)
  const timetableFileInputRef = useRef(null)
  const [role, setRoleState] = useState(() => getRole() || 'student')
  const isTeacher = role === 'teacher'

  const [profile, setProfileState] = useState(() =>
    isTeacher ? mapTeacherProfile(getProfile()) : mapStudentProfile(getProfile())
  )
  // Whether the current avatar is a real uploaded photo (vs. the generated
  // placeholder) — decides whether the button reads "Add" or "Change".
  const [hasPhoto, setHasPhoto] = useState(() => Boolean(getProfile()?.avatar_url))
  const [loadError, setLoadError] = useState('')

  const [photoUploading, setPhotoUploading] = useState(false)
  const [removingPhoto,  setRemovingPhoto]  = useState(false)
  const [photoError,     setPhotoError]     = useState('')
  const [lightboxOpen,   setLightboxOpen]   = useState(false)

  // Edit modal — student fields only, for now (teacher edit flow isn't
  // built yet, so the button is hidden for teachers below).
  const [editOpen,  setEditOpen]  = useState(false)
  const [draft,     setDraft]     = useState(profile)
  const [skillInput, setSkillInput] = useState('')
  const [saved,     setSaved]     = useState(false)

  // Timetable state — moved here from the old standalone /timetable
  // page (see src/pages/Timetable.jsx, which this duplicates for now).
  const [ttEntries,      setTtEntries]      = useState([])
  const [ttLoading,      setTtLoading]      = useState(true)
  const [ttLoadError,    setTtLoadError]    = useState('')
  const [ttUploading,    setTtUploading]    = useState(false)
  const [ttUploadIssues, setTtUploadIssues] = useState([])
  const [ttUploadError,  setTtUploadError]  = useState('')

  // ── "Available in Room" toggle (teacher only) ──────────────────────
  // Pushes this teacher's real room availability over the same live-status
  // channel every Explore card / public Profile page listens to (see
  // hooks/useLiveStatus.js). statusMap updates itself once the socket
  // broadcast comes back, so isAvailable reflects the change without any
  // local optimistic state.
  const { statusMap } = useLiveStatus()
  const [togglingAvailability, setTogglingAvailability] = useState(false)
  const [availabilityError,    setAvailabilityError]    = useState('')
  const isAvailable = isTeacher && statusMap[profile.teacherId]?.status === 'available'

  const toggleAvailability = async () => {
    const token = getToken()
    if (!token || togglingAvailability) return
    setTogglingAvailability(true)
    setAvailabilityError('')
    try {
      await setMyAvailability(!isAvailable, token)
    } catch (err) {
      setAvailabilityError(err.message || 'Could not update your availability.')
    } finally {
      setTogglingAvailability(false)
    }
  }

  const loadTimetable = () => {
    const token = getToken()
    if (!token) return
    setTtLoading(true)
    setTtLoadError('')
    fetchMyTimetable(token)
      .then(setTtEntries)
      .catch((err) => setTtLoadError(err.message || 'Could not load your timetable.'))
      .finally(() => setTtLoading(false))
  }

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
        setHasPhoto(Boolean(data.profile?.avatar_url))
        setProfileState(
          data.role === 'teacher' ? mapTeacherProfile(data.profile) : mapStudentProfile(data.profile)
        )
      })
      .catch((err) => setLoadError(err.message || 'Could not load your profile.'))

    loadTimetable()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so re-selecting the same file after fixing it still fires onChange
    if (!file) return

    setPhotoError('')

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Please choose a .png or .jpg/.jpeg image.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(`That image is too large — please keep it under ${MAX_PHOTO_BYTES / (1024 * 1024)}MB.`)
      return
    }

    const token = getToken()
    if (!token) { navigate('/login'); return }

    setPhotoUploading(true)
    try {
      const { avatar_url } = await uploadProfilePhoto(file, token)
      setHasPhoto(true)
      setProfileState((p) => ({ ...p, avatar: avatar_url }))
      // Keep the cached profile (used to paint instantly on the next visit)
      // in sync too, so a page reload doesn't briefly show the old avatar.
      const cached = getProfile() || {}
      persistProfile({ ...cached, avatar_url })
    } catch (err) {
      setPhotoError(err.message || 'Could not upload that photo.')
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    const token = getToken()
    if (!token || removingPhoto) return
    if (!window.confirm('Remove your profile photo?')) return

    setRemovingPhoto(true)
    setPhotoError('')
    try {
      await removeProfilePhoto(token)
      const placeholder = isTeacher
        ? avatarFor(null, profile.teacherId, '0a1628')
        : avatarFor(null, profile.rollNo, '321817')
      setHasPhoto(false)
      setProfileState((p) => ({ ...p, avatar: placeholder }))
      const cached = getProfile() || {}
      persistProfile({ ...cached, avatar_url: null })
    } catch (err) {
      setPhotoError(err.message || 'Could not remove your photo.')
    } finally {
      setRemovingPhoto(false)
    }
  }

  const handleTimetableFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so re-selecting the same file after fixing it still fires onChange
    if (!file) return
    const token = getToken()
    if (!token) { navigate('/login'); return }

    setTtUploading(true)
    setTtUploadError('')
    setTtUploadIssues([])
    try {
      const saved = await uploadTimetable(file, token)
      setTtEntries(saved)
    } catch (err) {
      if (err.issues) setTtUploadIssues(err.issues)
      else setTtUploadError(err.message || 'Could not parse that file.')
    } finally {
      setTtUploading(false)
    }
  }

  const handleTimetableClear = async () => {
    const token = getToken()
    if (!token) return
    try {
      await clearMyTimetable(token)
      setTtEntries([])
      setTtUploadError('')
      setTtUploadIssues([])
    } catch (err) {
      setTtUploadError(err.message || 'Could not clear your timetable.')
    }
  }

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
              {/* Avatar — click to enlarge, camera badge to add/change */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="block w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-white/10 overflow-hidden bg-surface-container shadow-xl cursor-zoom-in"
                  title="Click to enlarge"
                >
                  <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center border-2 border-surface-container shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title={hasPhoto ? 'Change Photo' : 'Add Profile Photo'}
                >
                  {photoUploading ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  )}
                </button>
                {hasPhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={removingPhoto}
                    className="absolute -bottom-1.5 -left-1.5 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center border-2 border-surface-container shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove Profile Photo"
                  >
                    {removingPhoto ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    )}
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              {/* Name + badges */}
              <div className="flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
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

                    {isTeacher && (
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={toggleAvailability}
                          disabled={togglingAvailability}
                          title="Toggle whether students see you as available in your room right now"
                          className={`px-4 py-2 rounded-xl border transition-colors flex items-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                            isAvailable
                              ? 'bg-tertiary/10 border-tertiary/30 text-tertiary hover:bg-tertiary/20'
                              : 'border-outline-variant/30 text-on-surface hover:bg-surface-container-high'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-tertiary animate-pulse' : 'bg-rose-600'}`} />
                          <span className="text-xs font-bold whitespace-nowrap">
                            {isAvailable ? 'Available in Room' : 'Not in Room'}
                          </span>
                        </button>
                        {availabilityError && (
                          <p className="text-[10px] text-error px-1">{availabilityError}</p>
                        )}
                      </div>
                    )}
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

            {photoError && (
              <p className="text-[11px] text-red-400 mb-4 -mt-3">{photoError}</p>
            )}

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

        {/* ── TIMETABLE (either role — shown directly, no tabs) ── */}
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-on-surface-variant text-sm opacity-60">
                Monday – Friday &middot; 8:00 AM – 5:10 PM &middot; Lunch break 1:00 – 1:50 PM
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {ttEntries.length > 0 && (
                  <button
                    onClick={handleTimetableClear}
                    className="px-4 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-bold hover:bg-white/[0.05] transition-all"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => timetableFileInputRef.current?.click()}
                  disabled={ttUploading}
                  className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  {ttUploading ? 'Uploading…' : 'Upload Timetable'}
                </button>
                <input
                  ref={timetableFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleTimetableFileChange}
                  className="hidden"
                />
              </div>
              <Link
                to="/timetable/help"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary/80 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">help</span>
                How to change timetable
              </Link>
            </div>
          </div>

          {ttUploadError && (
            <div className="mb-4 p-4 rounded-2xl bg-error-container/10 border border-error/20">
              <p className="text-sm text-error">{ttUploadError}</p>
            </div>
          )}

          {ttUploadIssues.length > 0 && (
            <div className="mb-4 p-4 rounded-2xl bg-error-container/10 border border-error/20">
              <p className="text-sm font-bold text-error mb-2">
                Couldn't save that file — {ttUploadIssues.length} issue{ttUploadIssues.length > 1 ? 's' : ''} to fix:
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {ttUploadIssues.map((issue, i) => (
                  <li key={i} className="text-xs text-error/90">{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <TimetableGrid
            entries={ttEntries}
            loading={ttLoading}
            loadError={ttLoadError}
            emptyBody="Upload a CSV of your weekly class schedule to see it laid out here."
          />
        </div>

      </main>

      <BottomNav />

      {lightboxOpen && (
        <ImageLightbox src={profile.avatar} alt={profile.name} onClose={() => setLightboxOpen(false)} />
      )}

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
