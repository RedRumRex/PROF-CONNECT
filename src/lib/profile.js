// Maps raw DB rows (from /api/auth/me or the login response) into the
// display shape the profile-related pages use. The student/teacher tables
// only carry a handful of real columns (see db/schema.sql) — a few fields
// the UI shows for students (cgpa, dob, hostel, about, skills) aren't
// backed by any column yet, so those stay as clearly-labeled placeholders
// rather than fabricated data.

function ordinalYear(year) {
  const n = Number(year)
  if (!Number.isFinite(n)) return '—'
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10] || 'th'
  return `${n}${suffix} Year`
}

// A row's avatar_url (set via "Add/Change Profile Photo" — see
// api/profile.js and server/app/routers/profile_photo.py) wins when
// present; otherwise falls back to a generated placeholder so every user
// still has *some* avatar before uploading a real photo.
function avatarFor(row, seed, fallbackBg) {
  if (row?.avatar_url) return row.avatar_url
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed || 'ProfConnect')}&backgroundColor=${fallbackBg}`
}

export function mapStudentProfile(row) {
  if (!row) {
    return {
      name: 'Student', rollNo: '—', branch: '—', year: '—',
      email: '—', phone: '—',
      cgpa: '—', dob: '—', hostel: '—', about: '', skills: [],
      avatar: avatarFor(null, 'ProfConnect', '321817'),
    }
  }
  const rollno = row.rollno ?? ''
  return {
    name: row.name || 'Student',
    rollNo: String(rollno),
    branch: row.branch || '—',
    year: row.year != null ? ordinalYear(row.year) : '—',
    email: row.email || '—',
    phone: row.phone_no != null ? String(row.phone_no) : '—',
    // Not in the DB schema yet — placeholders, editable locally only.
    cgpa: '—',
    dob: '—',
    hostel: '—',
    about: '',
    skills: [],
    avatar: avatarFor(row, String(rollno), '321817'),
  }
}

// Maps a row from GET /api/teachers (the public directory) into the shape
// used by the professor cards in the Home/Explore grid. Lighter than
// mapTeacherProfile — the directory endpoint only exposes non-sensitive,
// DB-backed columns (no email, no fabricated bio/tags/publications).
export function mapTeacherCard(row) {
  const teacherId = row.teacher_id ?? ''
  return {
    id: String(teacherId),
    name: row.name || 'Professor',
    department: row.department || '—',
    designation: row.designation || 'Professor',
    roomNumber: row.room_number || '—',
    hIndex: row.h_index != null ? row.h_index : '—',
    avatar: avatarFor(row, String(teacherId), '321817'),
  }
}

export function mapTeacherProfile(row) {
  if (!row) {
    return {
      name: 'Professor', teacherId: '—', department: '—', designation: '—',
      roomNumber: '—', hIndex: '—', email: '—',
      avatar: avatarFor(null, 'ProfConnect', '0a1628'),
    }
  }
  const teacherId = row.teacher_id ?? ''
  return {
    name: row.name || 'Professor',
    teacherId: teacherId !== '' ? String(teacherId) : '—',
    department: row.department || '—',
    designation: row.designation || 'Professor',
    roomNumber: row.room_number || '—',
    hIndex: row.h_index != null ? String(row.h_index) : '—',
    email: row.email || '—',
    avatar: avatarFor(row, String(teacherId), '0a1628'),
  }
}
