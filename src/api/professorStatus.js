// Thin client for the ProfConnect status API (see /server) — the cloud
// bridge between this frontend and the Raspberry Pi units mounted on
// professors' doors.
import { io } from 'socket.io-client'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// GET /api/professors — bulk status map, used for initial page paint.
export async function fetchAllStatuses() {
  const res = await fetch(`${API_BASE_URL}/api/professors`)
  if (!res.ok) throw new Error(`Failed to fetch statuses (${res.status})`)
  const list = await res.json()
  const map = {}
  for (const p of list) map[p.id] = { status: p.status, updatedAt: p.updatedAt, note: p.note }
  return map
}

// GET /api/professors/:id/status — single professor read.
export async function fetchStatus(id) {
  const res = await fetch(`${API_BASE_URL}/api/professors/${id}/status`)
  if (!res.ok) throw new Error(`Failed to fetch status for ${id} (${res.status})`)
  return res.json()
}

let socket = null

function getSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, { autoConnect: true, reconnection: true })
  }
  return socket
}

// Subscribes to live status:update events pushed whenever a Raspberry Pi
// (or the professor's own dashboard) changes availability. Returns an
// unsubscribe function.
export function subscribeToStatusUpdates(onUpdate, { onConnectionChange } = {}) {
  const s = getSocket()

  const handleUpdate = (payload) => onUpdate(payload)
  const handleConnect = () => onConnectionChange?.(true)
  const handleDisconnect = () => onConnectionChange?.(false)

  s.on('status:update', handleUpdate)
  s.on('connect', handleConnect)
  s.on('disconnect', handleDisconnect)

  if (s.connected) onConnectionChange?.(true)

  return () => {
    s.off('status:update', handleUpdate)
    s.off('connect', handleConnect)
    s.off('disconnect', handleDisconnect)
  }
}
