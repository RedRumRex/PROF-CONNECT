import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Background from '../components/Background'
import Navbar     from '../components/Navbar'
import BottomNav  from '../components/BottomNav'
import TimetableGrid from '../components/TimetableGrid'
import { fetchMyTimetable, uploadTimetable, clearMyTimetable } from '../api/timetable'
import { getToken } from '../lib/auth'

export default function Timetable() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [entries,      setEntries]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [uploading,    setUploading]    = useState(false)
  const [uploadIssues, setUploadIssues] = useState([])
  const [uploadError,  setUploadError]  = useState('')

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const load = () => {
    const token = getToken()
    if (!token) return
    setLoading(true)
    setLoadError('')
    fetchMyTimetable(token)
      .then(setEntries)
      .catch((err) => setLoadError(err.message || 'Could not load your timetable.'))
      .finally(() => setLoading(false))
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so re-selecting the same file after fixing it still fires onChange
    if (!file) return
    const token = getToken()
    if (!token) { navigate('/login'); return }

    setUploading(true)
    setUploadError('')
    setUploadIssues([])
    try {
      const saved = await uploadTimetable(file, token)
      setEntries(saved)
    } catch (err) {
      if (err.issues) setUploadIssues(err.issues)
      else setUploadError(err.message || 'Could not parse that file.')
    } finally {
      setUploading(false)
    }
  }

  const handleClear = async () => {
    const token = getToken()
    if (!token) return
    try {
      await clearMyTimetable(token)
      setEntries([])
      setUploadError('')
      setUploadIssues([])
    } catch (err) {
      setUploadError(err.message || 'Could not clear your timetable.')
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">
      <Background />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 lg:pb-8">

        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-4xl font-headline font-extrabold tracking-tighter text-on-surface">My Timetable</h2>
            <p className="text-on-surface-variant text-sm mt-0.5 opacity-60">
              Monday – Friday · 8:00 AM – 5:10 PM · Lunch break 1:00 – 1:50 PM
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-bold hover:bg-white/[0.05] transition-all"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                {uploading ? 'Uploading…' : 'Upload Timetable'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
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

        {uploadError && (
          <div className="mb-4 p-4 rounded-2xl bg-error-container/10 border border-error/20">
            <p className="text-sm text-error">{uploadError}</p>
          </div>
        )}

        {uploadIssues.length > 0 && (
          <div className="mb-4 p-4 rounded-2xl bg-error-container/10 border border-error/20">
            <p className="text-sm font-bold text-error mb-2">
              Couldn't save that file — {uploadIssues.length} issue{uploadIssues.length > 1 ? 's' : ''} to fix:
            </p>
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {uploadIssues.map((issue, i) => (
                <li key={i} className="text-xs text-error/90">{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <TimetableGrid
          entries={entries}
          loading={loading}
          loadError={loadError}
          emptyBody="Upload a CSV of your weekly class schedule to see it laid out here."
        />
      </main>

      <BottomNav />
    </div>
  )
}
