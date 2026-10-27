import { API_BASE_URL } from './appointments'
import { getToken } from '../lib/auth'

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.detail
    const message = Array.isArray(detail) ? detail.map(item => item.msg).join(' ') : detail
    throw new Error(message || `Meeting request failed (${response.status}).`)
  }
  return data
}

export function createOrGetAppointmentMeeting(appointmentId) {
  return request(`/api/meetings/appointments/${encodeURIComponent(appointmentId)}`, { method: 'POST', body: {} })
}

export function createMeetingInvite(meetingId, passcode = '') {
  return request(`/api/meetings/${encodeURIComponent(meetingId)}/invites`, { method: 'POST', body: { passcode } })
}

export function revokeMeetingInvite(meetingId) {
  return request(`/api/meetings/${encodeURIComponent(meetingId)}/invites`, { method: 'DELETE' })
}

export function joinMeeting(meetingId, { name = 'Guest', passcode = '', inviteToken = '' } = {}) {
  return request(`/api/meetings/${encodeURIComponent(meetingId)}/join`, {
    method: 'POST',
    body: { name, passcode, invite_token: inviteToken },
    auth: !inviteToken || Boolean(getToken()),
  })
}

export function meetingSocketURL(meetingId) {
  const url = new URL(`${API_BASE_URL}/api/meetings/${encodeURIComponent(meetingId)}/signal`, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.href
}
