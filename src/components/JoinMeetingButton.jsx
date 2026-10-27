import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrGetAppointmentMeeting } from '../api/meetings'

// Opens the in-app ProfConnect meeting for an accepted appointment. The
// backend creates the meeting on first use (or returns the existing one) and
// only lets the appointment's own student and professor in, so this button is
// safe to show to anyone who can see the appointment.
export default function JoinMeetingButton({ appointmentId, label = 'Join Meeting', className = '' }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = async (event) => {
    event.stopPropagation()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const meeting = await createOrGetAppointmentMeeting(appointmentId)
      navigate(`/meeting/${encodeURIComponent(meeting.meeting_id)}`)
    } catch (err) {
      setError(err.message || 'Could not open the meeting.')
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={open} disabled={busy} className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`}>
        <span className="material-symbols-outlined text-sm">videocam</span>
        {busy ? 'Opening…' : label}
      </button>
      {error && <span role="alert" className="text-[10px] text-error max-w-[220px]">{error}</span>}
    </span>
  )
}
