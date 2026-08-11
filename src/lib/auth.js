// Real JWT auth (issued by POST /api/auth/login). Stores the token, the
// signed-in role, and a lightweight profile snapshot in localStorage.
const ROLE_KEY    = 'profconnect_role'
const TOKEN_KEY    = 'profconnect_token'
const PROFILE_KEY = 'profconnect_profile'

export function getRole() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ROLE_KEY)
}

export function setRole(role) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROLE_KEY, role)
}

export function getToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function getProfile() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setProfile(profile) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function isAuthenticated() {
  return Boolean(getToken())
}

// Clears the full signed-in session (role + token + profile).
export function clearRole() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ROLE_KEY)
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(PROFILE_KEY)
}
