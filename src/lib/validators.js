// Password rule: min 8 chars, at least one lowercase, one uppercase, one
// digit. Mirrors the server-side check in server/app/auth_utils.py so the
// user gets instant feedback instead of waiting on a round trip.
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter.'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number.'
  }
  return null
}
