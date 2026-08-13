// Thin client for the messages API (see /server/app/routers/messages.py).
// One thread per (student, teacher) pair — used by both the student's
// booking-page chat and the teacher's per-request "Message" button.
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

// GET /api/messages/thread?student_id=&teacher_id= — full message history
// between this student and teacher, oldest first.
export async function fetchThread(studentId, teacherId, token) {
  const params = new URLSearchParams({ student_id: studentId, teacher_id: teacherId })
  const res = await fetch(`${API_BASE_URL}/api/messages/thread?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

// POST /api/messages — send a message. sender_role is derived server-side
// from the caller's JWT, not passed by the client.
export async function sendMessage({ studentId, teacherId, body }, token) {
  const res = await fetch(`${API_BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ student_id: studentId, teacher_id: teacherId, body }),
  })
  return handleResponse(res)
}
