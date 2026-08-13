// Thin client for the public teacher directory (see /server/app/routers/teachers.py).
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// GET /api/teachers — every teacher on file, used by the Home/Explore grid.
export async function fetchTeachers() {
  const res = await fetch(`${API_BASE_URL}/api/teachers`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || `Failed to fetch teachers (${res.status})`)
  }
  return res.json()
}

// GET /api/teachers/:id — single teacher, used by the Profile and
// Appointment pages reached from a card in the Explore grid.
export async function fetchTeacher(id) {
  const res = await fetch(`${API_BASE_URL}/api/teachers/${id}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || `Failed to fetch teacher (${res.status})`)
  }
  return res.json()
}
