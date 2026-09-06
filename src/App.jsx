import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login          from './pages/Login'
import SignUp         from './pages/SignUp'
import Home           from './pages/Home'
import Dashboard      from './pages/Dashboard'
import Appointment    from './pages/Appointment'
import Appointments   from './pages/Appointments'
import StudentProfile from './pages/StudentProfile'
import Profile        from './pages/Profile'
import Messages       from './pages/Messages'
import Timetable      from './pages/Timetable'
import TimetableHelp  from './pages/TimetableHelp'
import Settings       from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<Navigate to="/login" replace />} />
        <Route path="/login"             element={<Login />} />
        <Route path="/signup"            element={<SignUp />} />
        <Route path="/home"              element={<Home />} />
        <Route path="/profile/:id"       element={<Profile />} />
        <Route path="/profile"           element={<StudentProfile />} />
        <Route path="/dashboard"         element={<Dashboard />} />
        <Route path="/appointment/:id"   element={<Appointment />} />
        <Route path="/appointments"      element={<Appointments />} />
        <Route path="/messages"          element={<Messages />} />
        <Route path="/timetable"         element={<Timetable />} />
        <Route path="/timetable/help"    element={<TimetableHelp />} />
        <Route path="/settings"          element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}