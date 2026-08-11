// Thin client for the ProfConnect auth API (see /server/app/routers/auth.py).
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

// POST /api/auth/signup/student
export async function signupStudent(payload) {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup/student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

// POST /api/auth/signup/teacher
export async function signupTeacher(payload) {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup/teacher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

// POST /api/auth/login — { role, email, password } -> { access_token, role, profile }
export async function login({ role, email, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, email, password }),
  })
  return handleResponse(res)
}

// GET /api/auth/me — re-reads the logged-in user's row fresh from the DB.
// Requires the JWT issued at login. -> { role, profile }
export async function getMe(token) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}
