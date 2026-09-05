// Thin client for the profile-photo API (see
// /server/app/routers/profile_photo.py).
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data?.detail
    const message = Array.isArray(detail)
      ? detail.map((d) => (typeof d === 'string' ? d : d.msg)).join(' ')
      : detail || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data
}

// POST /api/profile/photo — uploads (or replaces) the signed-in user's
// profile photo. Accepts .png/.jpg/.jpeg. -> { avatar_url }
export async function uploadProfilePhoto(file, token) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE_URL}/api/profile/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets the multipart boundary
    body: formData,
  })
  return handleResponse(res)
}
