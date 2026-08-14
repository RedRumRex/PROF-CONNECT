// Thin client for the notification bell (see
// /server/app/routers/notifications.py). Rows are created server-side
// whenever someone books a session, a teacher accepts/declines a request,
// or either side sends a message — this file only reads/acknowledges them
// and listens for the live push.
import { io } from 'socket.io-client'

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

// GET /api/notifications — the signed-in user's own notifications, most
// recent first.
export async function fetchNotifications(token) {
  const res = await fetch(`${API_BASE_URL}/api/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

// PATCH /api/notifications/:id/read
export async function markNotificationRead(id, token) {
  const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

// PATCH /api/notifications/read-all
export async function markAllNotificationsRead(token) {
  const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse(res)
}

let socket = null

function getSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, { autoConnect: true, reconnection: true })
  }
  return socket
}

// Joins this socket connection to the signed-in user's own private
// notification room (see server/app/sockets.py: subscribe_notifications) so
// they get a `notification:new` push the instant someone books a session
// with them, responds to their request, or messages them. Re-joins on every
// reconnect. Returns an unsubscribe function.
export function subscribeToNotifications(token, onNotification) {
  const s = getSocket()

  const join = () => s.emit('subscribe_notifications', { token })
  const handleNotification = (payload) => onNotification(payload)

  s.on('connect', join)
  s.on('notification:new', handleNotification)
  if (s.connected) join()

  return () => {
    s.off('connect', join)
    s.off('notification:new', handleNotification)
  }
}
