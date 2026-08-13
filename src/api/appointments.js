// Thin client for the appointments API (see /server/app/routers/appointments.py).
// Every call requires the JWT issued at login — appointments are always
// scoped to "my own" (as a student) or "requests directed at me" (as a
// teacher); there is no public appointment data.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(' ')
      : detail || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data
}

// POST /api/appointments — student sends a request to a teacher. Starts
// out with status_label "pending" until the teacher accepts/declines.
export async function createAppointment({ teacherId, date, time }, token) {
  const res = await fetch(`${API_BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      teacher_id: teacherId,
      appointment_date: date,
      appointment_time: time,
    }),
  })
  return handleResponse(res)
}

// GET /api/appointments/student — the logged-in student's own requests,
// joined with the teacher's name/department for display.
export async function fetchMyAppointmentsAsStudent(token) {
  const res = await fetch(`${API_BASE_URL}/api/appointments/student`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

// GET /api/appointments/teacher — requests directed at the logged-in
// teacher, joined with the student's name/branch/year for display.
export async function fetchAppointmentsForTeacher(token) {
  const res = await fetch(`${API_BASE_URL}/api/appointments/teacher`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

// PATCH /api/appointments/:id/respond — teacher accepts (true) or
// declines (false) a pending request.
export async function respondToAppointment(appointmentId, accept, token) {
  const res = await fetch(`${API_BASE_URL}/api/appointments/${appointmentId}/respond`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: accept }),
  })
  return handleResponse(res)
}
