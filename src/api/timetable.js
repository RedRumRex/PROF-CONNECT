// Thin client for the personal timetable API (see
// /server/app/routers/timetable.py). Either role has one — the file format
// it parses is documented in README.md's "Timetable" section.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail
    if (Array.isArray(detail)) {
      // Either our parser's list of specific "Line N: ..." strings, or
      // FastAPI's own [{msg: ...}, ...] validation-error shape.
      const issues = detail.map((d) => (typeof d === 'string' ? d : d.msg))
      const err = new Error(issues.join('\n'))
      err.issues = issues
      throw err
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return data
}

// GET /api/timetable/me — the signed-in user's own timetable (either role).
export async function fetchMyTimetable(token) {
  const res = await fetch(`${API_BASE_URL}/api/timetable/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

// POST /api/timetable/upload — parses the CSV and replaces the signed-in
// user's entire timetable with what's in it.
export async function uploadTimetable(file, token) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE_URL}/api/timetable/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets the multipart boundary
    body: formData,
  })
  return handleResponse(res)
}

// GET /api/timetable/teacher/{teacherId} — read-only view of a professor's
// timetable. Visible to any signed-in student or teacher, unlike a
// student's own timetable which only they can see.
export async function fetchTeacherTimetable(teacherId, token) {
  const res = await fetch(`${API_BASE_URL}/api/timetable/teacher/${teacherId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

// DELETE /api/timetable/me — clears the signed-in user's timetable.
export async function clearMyTimetable(token) {
  const res = await fetch(`${API_BASE_URL}/api/timetable/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}
