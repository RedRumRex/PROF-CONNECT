// Thin client for real teacher availability (see
// /server/app/routers/availability.py). Distinct from professorStatus.js
// (the legacy Raspberry-Pi-door-unit bridge, keyed by fake seed professor
// ids) — this is what actually backs the teacher's own "Available in
// Room" toggle on the Dashboard, keyed by the real numeric teacher_id.
// Live updates still arrive over the shared status:update socket channel
// set up in professorStatus.js, so useLiveStatus() only needed its bulk
// GET repointed here.
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

// GET /api/availability — bulk map, used for initial page paint.
export async function fetchAllAvailability() {
  const res = await fetch(`${API_BASE_URL}/api/availability`)
  if (!res.ok) throw new Error(`Failed to fetch availability (${res.status})`)
  const list = await res.json()
  const map = {}
  for (const t of list) map[t.id] = { status: t.status, updatedAt: t.updatedAt, note: t.note }
  return map
}

// PATCH /api/availability/me — the signed-in teacher sets their own
// "available in room" status. Broadcasts to every connected browser tab.
export async function setMyAvailability(available, token) {
  const res = await fetch(`${API_BASE_URL}/api/availability/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ available }),
  })
  return handleResponse(res)
}
